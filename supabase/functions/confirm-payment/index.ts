import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { paymentKey, orderId, amount } = await req.json()

    if (!paymentKey || !orderId || !amount) {
      return new Response(
        JSON.stringify({ error: '필수 파라미터가 누락되었습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Supabase 클라이언트 (service role key로 RLS 우회)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Authorization 헤더에서 사용자 토큰 추출
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 사용자 확인
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 사용자입니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // site_settings에서 토스 시크릿 키 조회
    const { data: settingsData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'toss_payments')
      .maybeSingle()

    const secretKey = (settingsData?.value as Record<string, string>)?.secretKey
    if (!secretKey) {
      return new Response(
        JSON.stringify({ error: '결제 설정이 완료되지 않았습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 토스 페이먼츠 결제 승인 API 호출
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
      return new Response(
        JSON.stringify({ error: confirmData.message || '결제 승인에 실패했습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // orderId에서 상품 정보 파싱
    const orderParts = orderId.split('_')
    const itemType = orderParts[3] // 'course', 'ebook', or 'charge'

    // 포인트 충전인 경우
    if (itemType === 'charge') {
      const { error: rpcError } = await supabase.rpc('add_points', {
        user_id_input: user.id,
        amount_input: amount,
      })
      if (rpcError) {
        return new Response(
          JSON.stringify({ error: '포인트 충전에 실패했습니다.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      // 포인트 로그 기록
      const { data: profileData } = await supabase.from('profiles').select('points').eq('id', user.id).single()
      await supabase.rpc('insert_point_log', {
        p_user_id: user.id,
        p_amount: amount,
        p_balance: profileData?.points ?? amount,
        p_type: 'charge',
        p_memo: `토스 결제 충전 (${paymentKey})`,
      })

      return new Response(
        JSON.stringify({ success: true, title: `포인트 ${amount.toLocaleString()}P 충전`, type: 'charge' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const itemId = Number(orderParts[4])

    let title = confirmData.orderName || '상품'
    let courseId: number | null = null
    let ebookId: number | null = null
    let expiresAt: string | null = null

    let rewardPoints = 0
    if (itemType === 'course' && itemId) {
      courseId = itemId
      const { data: course } = await supabase.from('courses').select('title, reward_points').eq('id', itemId).maybeSingle()
      if (course) {
        title = course.title
        rewardPoints = course.reward_points ?? 0
      }
    } else if (itemType === 'ebook' && itemId) {
      ebookId = itemId
      const { data: ebook } = await supabase.from('ebooks').select('title, duration_days, reward_points').eq('id', itemId).maybeSingle()
      if (ebook) {
        title = ebook.title
        rewardPoints = ebook.reward_points ?? 0
        if (ebook.duration_days && ebook.duration_days > 0) {
          const expires = new Date()
          expires.setDate(expires.getDate() + ebook.duration_days)
          expiresAt = expires.toISOString()
        }
      }
    }

    // 중복 구매 체크
    const duplicateCheck = courseId
      ? await supabase.from('purchases').select('id').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
      : ebookId
        ? await supabase.from('purchases').select('id').eq('user_id', user.id).eq('ebook_id', ebookId).maybeSingle()
        : { data: null }

    if (duplicateCheck.data) {
      return new Response(
        JSON.stringify({ error: '이미 구매한 상품입니다.', title }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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

    if (purchaseError) {
      return new Response(
        JSON.stringify({ error: '구매 기록 생성에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 수강/구매 적립 포인트 지급 (실패해도 구매는 유효)
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
      } catch {
        // 포인트 지급 실패 무시
      }
    }

    return new Response(
      JSON.stringify({ success: true, title }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
