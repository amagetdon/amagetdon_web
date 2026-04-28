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

    if (itemType === 'course') {
      const { data: course } = await supabase
        .from('courses')
        .select('title, original_price, sale_price, course_type, reward_points, duration_days, enrollment_deadline, after_purchase_url')
        .eq('id', itemId)
        .maybeSingle()
      if (!course) return json({ error: '강의를 찾을 수 없습니다.' }, 404)
      courseId = itemId
      title = course.title
      rewardPoints = course.reward_points ?? 0
      isFreeItem = course.course_type === 'free'
      maxPrice = Math.max(course.original_price ?? 0, course.sale_price ?? 0)
      afterPurchaseUrl = course.after_purchase_url ?? null
      if (course.enrollment_deadline && course.duration_days && course.duration_days > 0) {
        const base = new Date(course.enrollment_deadline)
        base.setDate(base.getDate() + course.duration_days)
        expiresAt = base.toISOString()
      }
    } else if (itemType === 'ebook') {
      const { data: ebook } = await supabase
        .from('ebooks')
        .select('title, original_price, sale_price, is_free, duration_days, reward_points')
        .eq('id', itemId)
        .maybeSingle()
      if (!ebook) return json({ error: '전자책을 찾을 수 없습니다.' }, 404)
      ebookId = itemId
      title = ebook.title
      rewardPoints = ebook.reward_points ?? 0
      isFreeItem = !!ebook.is_free
      maxPrice = Math.max(ebook.original_price ?? 0, ebook.sale_price ?? 0)
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

    return json({ success: true, title, after_purchase_url: afterPurchaseUrl })
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : '서버 오류가 발생했습니다.' },
      500,
    )
  }
})
