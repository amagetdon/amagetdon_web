import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { paymentKey, orderId, amount } = await req.json()

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

      if (itemType === 'bpost') {
        const { data: post } = await supabase
          .from('board_posts')
          .select('title, price, is_paid, is_published')
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
      } else {
        const { data: ins } = await supabase
          .from('instructors')
          .select('name, newsletter_price, newsletter_days')
          .eq('id', bId)
          .maybeSingle()
        if (!ins) return json({ error: '강사를 찾을 수 없습니다.' }, 404)
        const subPrice = ins.newsletter_price ?? 0
        const subDays = ins.newsletter_days && ins.newsletter_days > 0 ? ins.newsletter_days : 30
        if (subPrice <= 0) return json({ error: '구독 상품이 없는 강사입니다.' }, 400)
        if (amount !== subPrice) {
          return json({ error: '결제 금액이 상품 가격과 일치하지 않습니다.' }, 400)
        }
        // 유효 구독이 남아 있으면 그 만료일부터 이어서 연장
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
        bTitle = `[뉴스레터 구독] ${ins.name} ${subDays}일`
        bInsert = { board_instructor_id: bId, expires_at: new Date(baseMs + subDays * 86400000).toISOString() }
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

      return json({ success: true, title: bTitle, board: true })
    }

    // ───── 강의 / 전자책 ─────
    const itemId = Number(orderParts[4])
    if (!itemId || isNaN(itemId)) return json({ error: '잘못된 주문번호입니다.' }, 400)

    let title = '상품'
    let courseId: number | null = null
    let ebookId: number | null = null
    let expiresAt: string | null = null
    let rewardPoints = 0
    let maxPrice = 0
    let isFreeItem = false
    let afterPurchaseUrl: string | null = null
    // 전환 추적(Purchase 이벤트)용 — 결제 완료 페이지로 내려보낸다.
    let instructorName: string | null = null
    let contentCategory: string | null = null    // 상품 유형(무료/유료 라벨)
    let contentSubcategory: string | null = null  // 랜딩 카테고리명(주제)

    if (itemType === 'course') {
      const { data: course } = await supabase
        .from('courses')
        .select('title, original_price, sale_price, course_type, reward_points, duration_days, enrollment_deadline, after_purchase_url, landing_category_id, landing_category_ids, instructor:instructors(name)')
        .eq('id', itemId)
        .maybeSingle()
      if (!course) return json({ error: '강의를 찾을 수 없습니다.' }, 404)
      courseId = itemId
      title = course.title
      rewardPoints = course.reward_points ?? 0
      isFreeItem = course.course_type === 'free'
      maxPrice = Math.max(course.original_price ?? 0, course.sale_price ?? 0)
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
      if (course.enrollment_deadline && course.duration_days && course.duration_days > 0) {
        const base = new Date(course.enrollment_deadline)
        base.setDate(base.getDate() + course.duration_days)
        expiresAt = base.toISOString()
      }
    } else if (itemType === 'ebook') {
      const { data: ebook } = await supabase
        .from('ebooks')
        .select('title, original_price, sale_price, is_free, duration_days, reward_points, instructor:instructors(name)')
        .eq('id', itemId)
        .maybeSingle()
      if (!ebook) return json({ error: '전자책을 찾을 수 없습니다.' }, 404)
      ebookId = itemId
      title = ebook.title
      rewardPoints = ebook.reward_points ?? 0
      isFreeItem = !!ebook.is_free
      maxPrice = Math.max(ebook.original_price ?? 0, ebook.sale_price ?? 0)
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

    // 정가 초과 결제 차단 (쿠폰/할인은 가격을 낮추기만 하므로 amount > maxPrice 는 비정상)
    if (maxPrice > 0 && amount > maxPrice) {
      return json({ error: '결제 금액이 상품 가격을 초과합니다.' }, 400)
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
      original_price: amount,
      price: amount,
      payment_key: paymentKey,
      payment_method: 'toss',
      expires_at: expiresAt,
    })
    if (purchaseError) return json({ error: '구매 기록 생성에 실패했습니다.' }, 500)

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
