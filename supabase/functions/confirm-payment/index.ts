import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { addMonthsKst } from '../_shared/period.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// 할인 기간: 시작·종료가 둘 다 없으면 항상 할인 중 (상세 화면·포인트 결제와 같은 규칙)
const DISCOUNT_GRACE_MS = 30 * 60 * 1000
function discountState(start: string | null | undefined, end: string | null | undefined) {
  const now = Date.now()
  if (!start && !end) return { active: true, justEnded: false }
  const started = !start || new Date(start).getTime() <= now
  const endMs = end ? new Date(end).getTime() : null
  const active = started && (endMs == null || endMs > now)
  const justEnded = started && endMs != null && endMs <= now && now - endMs <= DISCOUNT_GRACE_MS
  return { active, justEnded }
}

type CouponRow = {
  min_purchase: number | null
  discount_type: 'fixed' | 'percent'
  discount_value: number
  max_discount: number | null
}
// 쿠폰 할인액 (CourseDetailPage·purchase_with_points 와 같은 계산)
function couponDiscount(price: number, cp: CouponRow | null): number {
  if (!cp || price < (cp.min_purchase ?? 0)) return 0
  if (cp.discount_type === 'percent') {
    return Math.min(Math.floor(price * cp.discount_value / 100), cp.max_discount || Infinity, price)
  }
  return Math.min(cp.discount_value, price)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { paymentKey, orderId, amount, couponId: rawCouponId, planId: rawPlanId } = await req.json()
    const couponId = rawCouponId == null || rawCouponId === '' ? null : Number(rawCouponId)
    if (couponId != null && (!Number.isInteger(couponId) || couponId <= 0)) {
      return json({ error: '잘못된 쿠폰입니다.' }, 400)
    }
    const planId = rawPlanId == null || rawPlanId === '' ? null : Number(rawPlanId)
    if (planId != null && (!Number.isInteger(planId) || planId <= 0)) {
      return json({ error: '잘못된 플랜입니다.' }, 400)
    }

    if (!paymentKey || !orderId || typeof amount !== 'number' || amount <= 0) {
      return json({ error: '필수 파라미터가 누락되었거나 유효하지 않습니다.' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: '인증이 필요합니다.' }, 401)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: '유효하지 않은 사용자입니다.' }, 401)

    // paymentKey 중복 처리 방지 — 이미 같은 paymentKey 로 purchase 가 있으면 차단
    {
      const { data: existing } = await supabase
        .from('purchases')
        .select('id')
        .eq('payment_key', paymentKey)
        .maybeSingle()
      if (existing) return json({ error: '이미 처리된 결제입니다.' }, 400)
    }

    const orderParts = orderId.split('_')
    const itemType = orderParts[3] // 'course' | 'ebook' | 'charge'

    // ───── 충전 (포인트) ─────
    if (itemType === 'charge') {
      const { data: settingsData } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'toss_payments')
        .maybeSingle()
      const secretKey = (settingsData?.value as Record<string, string>)?.secretKey
      if (!secretKey) return json({ error: '결제 설정이 완료되지 않았습니다.' }, 500)

      const confirmResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(secretKey + ':')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      })
      const confirmData = await confirmResponse.json()
      if (!confirmResponse.ok) {
        return json({ error: confirmData.message || '결제 승인에 실패했습니다.' }, 400)
      }

      const { error: rpcError } = await supabase.rpc('add_points', {
        user_id_input: user.id,
        amount_input: amount,
      })
      if (rpcError) return json({ error: '포인트 충전에 실패했습니다.' }, 500)

      const { data: profileData } = await supabase.from('profiles').select('points').eq('id', user.id).single()
      await supabase.rpc('insert_point_log', {
        p_user_id: user.id,
        p_amount: amount,
        p_balance: profileData?.points ?? amount,
        p_type: 'charge',
        p_memo: `토스 결제 충전 (${paymentKey})`,
      })

      return json({ success: true, title: `포인트 ${amount.toLocaleString()}P 충전`, type: 'charge' })
    }

    // ───── 뉴스레터: 글 단건(bpost) / 강사 구독(bsub) ─────
    if (itemType === 'bpost' || itemType === 'bsub') {
      const bId = Number(orderParts[4])
      if (!bId || isNaN(bId)) return json({ error: '잘못된 주문번호입니다.' }, 400)

      let bTitle = ''
      let bInsert: Record<string, unknown> = {}
      let bInstructorName: string | null = null

      if (itemType === 'bpost') {
        const { data: post } = await supabase
          .from('board_posts')
          .select('title, price, is_paid, is_published, instructor_id')
          .eq('id', bId)
          .maybeSingle()
        if (!post || !post.is_published) return json({ error: '게시글을 찾을 수 없습니다.' }, 404)
        if (!post.is_paid || !post.price || post.price <= 0) {
          return json({ error: '단건 구매가 불가능한 글입니다.' }, 400)
        }
        if (amount !== post.price) {
          return json({ error: '결제 금액이 상품 가격과 일치하지 않습니다.' }, 400)
        }
        const { data: dup } = await supabase
          .from('purchases').select('id')
          .eq('user_id', user.id).eq('board_post_id', bId).maybeSingle()
        if (dup) return json({ error: '이미 구매한 글입니다.', title: post.title }, 400)
        bTitle = `[뉴스레터] ${post.title}`
        // 단건 구매는 영구 열람
        bInsert = { board_post_id: bId, expires_at: null }
        // 전환 이벤트용 강사명
        if (post.instructor_id) {
          const { data: ins } = await supabase
            .from('instructors').select('name').eq('id', post.instructor_id).maybeSingle()
          bInstructorName = (ins as { name?: string } | null)?.name ?? null
        }
      } else {
        const { data: ins } = await supabase
          .from('instructors')
          .select('name, newsletter_price, newsletter_months')
          .eq('id', bId)
          .maybeSingle()
        if (!ins) return json({ error: '강사를 찾을 수 없습니다.' }, 404)
        const subPrice = ins.newsletter_price ?? 0
        const subMonths = ins.newsletter_months && ins.newsletter_months > 0 ? ins.newsletter_months : 1
        if (subPrice <= 0) return json({ error: '구독 상품이 없는 강사입니다.' }, 400)
        if (amount !== subPrice) {
          return json({ error: '결제 금액이 상품 가격과 일치하지 않습니다.' }, 400)
        }
        // 유효 구독이 남아 있으면 그 만료일부터 이어서 연장 (달력 월 단위)
        const { data: cur } = await supabase
          .from('purchases')
          .select('expires_at')
          .eq('user_id', user.id).eq('board_instructor_id', bId)
          .not('expires_at', 'is', null)
          .order('expires_at', { ascending: false })
          .limit(1).maybeSingle()
        const baseMs = Math.max(
          Date.now(),
          cur?.expires_at ? new Date(cur.expires_at as string).getTime() : 0,
        )
        bTitle = `[뉴스레터 구독] ${ins.name} ${subMonths}개월`
        bInsert = { board_instructor_id: bId, expires_at: addMonthsKst(new Date(baseMs), subMonths).toISOString() }
        bInstructorName = ins.name
      }

      const { data: settingsData2 } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'toss_payments')
        .maybeSingle()
      const secretKey2 = (settingsData2?.value as Record<string, string>)?.secretKey
      if (!secretKey2) return json({ error: '결제 설정이 완료되지 않았습니다.' }, 500)

      const confirmRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(secretKey2 + ':')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      })
      const confirmBody = await confirmRes.json()
      if (!confirmRes.ok) {
        return json({ error: confirmBody.message || '결제 승인에 실패했습니다.' }, 400)
      }

      const { error: bpError } = await supabase.from('purchases').insert({
        user_id: user.id,
        title: bTitle,
        original_price: amount,
        price: amount,
        payment_key: paymentKey,
        payment_method: 'toss',
        ...bInsert,
      })
      if (bpError) return json({ error: '구매 기록 생성에 실패했습니다.' }, 500)

      return json({
        success: true,
        title: bTitle,
        board: true,
        content_category: '뉴스레터',
        instructor_name: bInstructorName,
      })
    }

    // ───── 강의 / 전자책 ─────
    const itemId = Number(orderParts[4])
    if (!itemId || isNaN(itemId)) return json({ error: '잘못된 주문번호입니다.' }, 400)

    let title = '상품'
    let courseId: number | null = null
    let ebookId: number | null = null
    let expiresAt: string | null = null
    let rewardPoints = 0
    // 서버가 계산한 정가(할인 기간 반영, 쿠폰 전). 포인트 결제(purchase_with_points)와 같은 규칙.
    let listPrice = 0
    // 할인이 막 끝난 직후 결제창을 연 사람을 위해, 할인 종료 30분 안에는 할인가도 받아 준다
    let graceSalePrice: number | null = null
    let isFreeItem = false
    // 플랜 강의에서 고른 플랜 (플랜이 없는 강의는 null)
    let planIdUsed: number | null = null
    let afterPurchaseUrl: string | null = null
    // 전환 추적(Purchase 이벤트)용 — 결제 완료 페이지로 내려보낸다.
    let instructorName: string | null = null
    let contentCategory: string | null = null    // 상품 유형(무료/유료 라벨)
    let contentSubcategory: string | null = null  // 랜딩 카테고리명(주제)

    if (itemType === 'course') {
      const { data: course } = await supabase
        .from('courses')
        .select('title, original_price, sale_price, discount_start, discount_end, course_type, reward_points, duration_days, enrollment_deadline, after_purchase_url, landing_category_id, landing_category_ids, instructor:instructors(name)')
        .eq('id', itemId)
        .maybeSingle()
      if (!course) return json({ error: '강의를 찾을 수 없습니다.' }, 404)
      courseId = itemId
      title = course.title
      rewardPoints = course.reward_points ?? 0
      isFreeItem = course.course_type === 'free'
      {
        const disc = discountState(course.discount_start, course.discount_end)
        const sale = course.sale_price ?? 0
        if (course.course_type === 'free' || course.sale_price === 0) listPrice = 0
        else if (disc.active && sale > 0) listPrice = sale
        else listPrice = course.original_price ?? 0
        if (!disc.active && disc.justEnded && sale > 0) graceSalePrice = sale
      }
      // 플랜: 판매 중인 플랜이 있는 강의는 고른 플랜의 가격·인원·기간을 쓴다 (purchase_with_points 와 같은 규칙)
      let durationDays: number | null = course.duration_days ?? null
      {
        const { data: plans } = await supabase
          .from('course_plans')
          .select('id, name, original_price, sale_price, max_enrollments, duration_days')
          .eq('course_id', itemId).eq('is_active', true)
        const planRows = (plans ?? []) as { id: number; name: string; original_price: number | null; sale_price: number | null; max_enrollments: number | null; duration_days: number | null }[]
        if (planRows.length > 0) {
          const plan = planRows.find((p) => p.id === planId)
          if (!plan) return json({ error: '플랜을 다시 선택해 주세요. 결제는 진행되지 않았습니다.' }, 400)
          if ((plan.max_enrollments ?? 0) > 0) {
            const { count } = await supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('plan_id', plan.id)
            if ((count ?? 0) >= (plan.max_enrollments as number)) {
              return json({ error: '이 플랜은 정원이 마감되었습니다. 결제는 진행되지 않았습니다.' }, 400)
            }
          }
          const disc = discountState(course.discount_start, course.discount_end)
          const sale = plan.sale_price ?? 0
          graceSalePrice = null
          if (plan.sale_price === 0) listPrice = 0
          else if (disc.active && sale > 0) listPrice = sale
          else listPrice = plan.original_price ?? plan.sale_price ?? 0
          if (!disc.active && disc.justEnded && sale > 0) graceSalePrice = sale
          title = `${course.title} (${plan.name})`
          if (plan.duration_days != null) durationDays = plan.duration_days
          planIdUsed = plan.id
        } else if (planId != null) {
          return json({ error: '선택할 수 없는 플랜입니다. 결제는 진행되지 않았습니다.' }, 400)
        }
      }
      afterPurchaseUrl = course.after_purchase_url ?? null
      contentCategory = course.course_type === 'free' ? '무료강의' : course.course_type === 'pre_alert' ? '사전알림' : '유료강의'
      // to-one 관계라 객체로 오지만, 일부 환경에서 배열로 직렬화되는 경우까지 방어.
      {
        const inst = (course as { instructor?: { name?: string } | { name?: string }[] | null }).instructor
        instructorName = (Array.isArray(inst) ? inst[0]?.name : inst?.name) ?? null
      }
      // 대표 랜딩 카테고리명 → content_subcategory(주제 분류).
      // 클라이언트(CourseDetailPage)와 동일하게 대표(landing_category_id) 우선, 없으면 첫 번째.
      {
        const ids = course.landing_category_ids as number[] | null | undefined
        const catId = course.landing_category_id ?? (Array.isArray(ids) ? ids[0] : null)
        if (catId) {
          const { data: lc } = await supabase
            .from('landing_categories')
            .select('name')
            .eq('id', catId)
            .maybeSingle()
          contentSubcategory = lc?.name ?? null
        }
      }
      // 수강 기간: 모집 마감일이 있으면 마감일부터, 없으면 결제 시점부터 다시보기 일수 (0 이면 무제한)
      if (durationDays && durationDays > 0) {
        const base = course.enrollment_deadline ? new Date(course.enrollment_deadline) : new Date()
        base.setDate(base.getDate() + durationDays)
        expiresAt = base.toISOString()
      }
    } else if (itemType === 'ebook') {
      const { data: ebook } = await supabase
        .from('ebooks')
        .select('title, original_price, sale_price, discount_start, discount_end, is_free, duration_days, reward_points, instructor:instructors(name)')
        .eq('id', itemId)
        .maybeSingle()
      if (!ebook) return json({ error: '전자책을 찾을 수 없습니다.' }, 404)
      ebookId = itemId
      title = ebook.title
      rewardPoints = ebook.reward_points ?? 0
      isFreeItem = !!ebook.is_free
      {
        const disc = discountState(ebook.discount_start, ebook.discount_end)
        if (ebook.is_free) listPrice = 0
        else if (disc.active && ebook.sale_price != null) listPrice = ebook.sale_price
        else listPrice = ebook.original_price ?? ebook.sale_price ?? 0
        if (!disc.active && disc.justEnded && ebook.sale_price != null) graceSalePrice = ebook.sale_price
      }
      contentCategory = ebook.is_free ? '무료전자책' : '유료전자책'
      {
        const inst = (ebook as { instructor?: { name?: string } | { name?: string }[] | null }).instructor
        instructorName = (Array.isArray(inst) ? inst[0]?.name : inst?.name) ?? null
      }
      if (ebook.duration_days && ebook.duration_days > 0) {
        const expires = new Date()
        expires.setDate(expires.getDate() + ebook.duration_days)
        expiresAt = expires.toISOString()
      }
    } else {
      return json({ error: '알 수 없는 상품 유형입니다.' }, 400)
    }

    // 무료 상품인데 결제가 들어옴 — 거부
    if (isFreeItem) return json({ error: '무료 상품에는 결제가 필요하지 않습니다.' }, 400)

    // 결제 금액 검증 — 서버가 계산한 금액(할인 기간·쿠폰 반영)과 정확히 같아야 한다.
    // 다르면 토스 승인 전에 거절하므로 카드 대금은 빠져나가지 않는다.
    let couponClaimId: number | null = null
    {
      let couponRow: CouponRow | null = null
      if (couponId != null) {
        const { data: cl } = await supabase
          .from('coupon_claims').select('id, claimed_at')
          .eq('coupon_id', couponId).eq('user_id', user.id).is('used_at', null)
          .limit(1).maybeSingle()
        const { data: cp } = await supabase
          .from('coupons')
          .select('id, is_published, expires_at, use_days, applies_to, course_id, ebook_id, min_purchase, discount_type, discount_value, max_discount')
          .eq('id', couponId).maybeSingle()
        const kindOk = cp && (cp.applies_to === 'all'
          || (cp.applies_to === 'course' && courseId != null && (cp.course_id == null || cp.course_id === courseId))
          || (cp.applies_to === 'ebook' && ebookId != null && (cp.ebook_id == null || cp.ebook_id === ebookId)))
        const notExpired = cp && (!cp.expires_at || new Date(cp.expires_at).getTime() >= Date.now())
          && !(cl && (cp.use_days ?? 0) > 0 && cl.claimed_at
            && new Date(cl.claimed_at).getTime() + (cp.use_days as number) * 864e5 < Date.now())
        if (!cl || !cp || !cp.is_published || !kindOk || !notExpired) {
          return json({ error: '사용할 수 없는 쿠폰입니다. 결제는 진행되지 않았습니다.' }, 400)
        }
        couponRow = cp as CouponRow
        couponClaimId = cl.id as number
      }
      const candidates = [listPrice, ...(graceSalePrice != null ? [graceSalePrice] : [])]
      const ok = candidates.some((p) => p > 0 && amount === p - couponDiscount(p, couponRow))
      if (!ok) {
        return json({ error: '결제 금액이 상품 가격과 일치하지 않습니다. 결제는 진행되지 않았습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.' }, 400)
      }
      // 저장용 정가: 실제 결제 금액에 맞는 후보
      listPrice = candidates.find((p) => p > 0 && amount === p - couponDiscount(p, couponRow)) ?? listPrice
    }

    // 동일 사용자 + 동일 상품 중복 구매 차단
    {
      const dup = courseId
        ? await supabase.from('purchases').select('id').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
        : await supabase.from('purchases').select('id').eq('user_id', user.id).eq('ebook_id', ebookId!).maybeSingle()
      if (dup.data) return json({ error: '이미 구매한 상품입니다.', title }, 400)
    }

    // 토스 결제 승인 (모든 사전 검증 통과 후)
    const { data: settingsData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'toss_payments')
      .maybeSingle()
    const secretKey = (settingsData?.value as Record<string, string>)?.secretKey
    if (!secretKey) return json({ error: '결제 설정이 완료되지 않았습니다.' }, 500)

    const confirmResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(secretKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
    const confirmData = await confirmResponse.json()
    if (!confirmResponse.ok) {
      return json({ error: confirmData.message || '결제 승인에 실패했습니다.' }, 400)
    }

    // purchase 레코드 생성
    const { error: purchaseError } = await supabase.from('purchases').insert({
      user_id: user.id,
      course_id: courseId,
      ebook_id: ebookId,
      title,
      original_price: listPrice,
      price: amount,
      coupon_id: couponId,
      payment_key: paymentKey,
      payment_method: 'toss',
      expires_at: expiresAt,
      // 플랜 칸은 플랜 강의일 때만 넣는다 (DB 에 칸이 생기기 전에 함수가 먼저 배포돼도 일반 결제는 그대로 되게)
      ...(planIdUsed != null ? { plan_id: planIdUsed } : {}),
    })
    if (purchaseError) return json({ error: '구매 기록 생성에 실패했습니다.' }, 500)

    // 쿠폰 사용 처리 (실패해도 구매는 유효)
    if (couponClaimId != null) {
      try {
        await supabase.from('coupon_claims').update({ used_at: new Date().toISOString() }).eq('id', couponClaimId)
      } catch { /* 무시 */ }
    }

    // 적립 포인트 (실패해도 구매는 유효)
    if (rewardPoints > 0) {
      try {
        await supabase.rpc('add_points', { user_id_input: user.id, amount_input: rewardPoints })
        const { data: freshProfile } = await supabase.from('profiles').select('points').eq('id', user.id).single()
        await supabase.rpc('insert_point_log', {
          p_user_id: user.id,
          p_amount: rewardPoints,
          p_balance: freshProfile?.points ?? rewardPoints,
          p_type: 'charge',
          p_memo: `${title} 수강 적립`,
        })
      } catch { /* 포인트 지급 실패는 구매 흐름에 영향 없음 */ }
    }

    return json({ success: true, title, after_purchase_url: afterPurchaseUrl, instructor_name: instructorName, content_category: contentCategory, content_subcategory: contentSubcategory })
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : '서버 오류가 발생했습니다.' },
      500,
    )
  }
})
