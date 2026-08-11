// 뉴스레터 구독 빌링키 발급 + 1회차 자동결제 승인
// 클라이언트가 requestBillingAuth 성공 후 받은 authKey 를 전달하면:
//   1) 토스 빌링키 발급 API 로 authKey → billingKey 교환
//   2) newsletter_subscriptions 에 빌링키·카드정보 upsert
//   3) 즉시 1회차 자동결제 승인 → purchases 행 생성 (기존 구독과 동일한 열람권 부여)
//   4) 다음 자동결제 시각(만료 6시간 전) 기록 — 이후 갱신은 billing-charge(pg_cron)가 수행
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyToken } from '../_shared/auth.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const TOSS_API = 'https://api.tosspayments.com/v1'
// 만료 직전이 아니라 6시간 전에 갱신 결제 — 연장 기준일이 기존 만료일이라 이용기간 손해는 없다.
const RENEW_BEFORE_MS = 6 * 3600_000

function generateOrderId(suffix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 10)
  return `ORDER_${date}_${random}${suffix}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { authKey, customerKey, instructorId } = await req.json()
    const insId = Number(instructorId)
    if (!authKey || !customerKey || !insId || isNaN(insId)) {
      return json({ error: '필수 파라미터가 누락되었습니다.' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, serviceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: '인증이 필요합니다.' }, 401)
    const verified = await verifyToken(authHeader.replace('Bearer ', ''), supabaseUrl, anonKey, serviceKey)
    if (!verified || verified.isServiceRole || !verified.user) {
      return json({ error: '유효하지 않은 사용자입니다.' }, 401)
    }
    const user = verified.user
    // customerKey 는 반드시 본인 계정 — 타인 명의 빌링키 발급 차단
    if (customerKey !== user.id) return json({ error: '잘못된 요청입니다.' }, 403)

    const { data: ins } = await supabase
      .from('instructors')
      .select('name, newsletter_price, newsletter_days')
      .eq('id', insId)
      .maybeSingle()
    if (!ins) return json({ error: '강사를 찾을 수 없습니다.' }, 404)
    const price = ins.newsletter_price ?? 0
    const days = ins.newsletter_days && ins.newsletter_days > 0 ? ins.newsletter_days : 30
    if (price <= 0) return json({ error: '구독 상품이 없는 강사입니다.' }, 400)

    // 빌링 시크릿 키 — 별도 키가 없으면 일반 시크릿 키로 폴백 (단일 MID 로 빌링 계약한 경우)
    const { data: settingsData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'toss_payments')
      .maybeSingle()
    const settings = (settingsData?.value ?? {}) as Record<string, string>
    const billingSecretKey = settings.billingSecretKey || settings.secretKey
    if (!billingSecretKey) return json({ error: '자동결제(빌링) 설정이 완료되지 않았습니다.' }, 500)
    const basicAuth = `Basic ${btoa(billingSecretKey + ':')}`

    // ── 1) authKey → 빌링키 발급 ──
    const issueRes = await fetch(`${TOSS_API}/billing/authorizations/issue`, {
      method: 'POST',
      headers: { 'Authorization': basicAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ authKey, customerKey }),
    })
    const issueData = await issueRes.json()
    if (!issueRes.ok) {
      return json({ error: issueData.message || '빌링키 발급에 실패했습니다.' }, 400)
    }
    const billingKey = issueData.billingKey as string
    const cardCompany = (issueData.cardCompany ?? issueData.card?.company ?? null) as string | null
    const cardNumber = (issueData.cardNumber ?? issueData.card?.number ?? null) as string | null

    // ── 2) 구독 레코드 upsert (재구독 시 카드 교체 포함) ──
    const { error: upsertError } = await supabase
      .from('newsletter_subscriptions')
      .upsert({
        user_id: user.id,
        instructor_id: insId,
        customer_key: customerKey,
        billing_key: billingKey,
        card_company: cardCompany,
        card_number: cardNumber,
        status: 'active',
        price,
        period_days: days,
        fail_count: 0,
        last_error: null,
        canceled_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,instructor_id' })
    if (upsertError) return json({ error: '구독 정보 저장에 실패했습니다.' }, 500)

    // ── 3) 1회차 자동결제 승인 ──
    const orderId = generateOrderId(`_bsub_${insId}`)
    const title = `[뉴스레터 구독] ${ins.name} ${days}일`
    const chargeRes = await fetch(`${TOSS_API}/billing/${billingKey}`, {
      method: 'POST',
      headers: { 'Authorization': basicAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerKey,
        amount: price,
        orderId,
        orderName: title,
        customerEmail: user.email ?? undefined,
      }),
    })
    const chargeData = await chargeRes.json()
    if (!chargeRes.ok) {
      await supabase
        .from('newsletter_subscriptions')
        .update({
          status: 'failed',
          last_error: chargeData.message || '1회차 결제 승인 실패',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('instructor_id', insId)
      return json({ error: chargeData.message || '결제 승인에 실패했습니다.' }, 400)
    }

    // ── 4) 열람권(purchases) 생성 — 유효 구독이 남아 있으면 그 만료일부터 연장 ──
    const { data: cur } = await supabase
      .from('purchases')
      .select('expires_at')
      .eq('user_id', user.id)
      .eq('board_instructor_id', insId)
      .not('expires_at', 'is', null)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const baseMs = Math.max(Date.now(), cur?.expires_at ? new Date(cur.expires_at as string).getTime() : 0)
    const expiresAt = new Date(baseMs + days * 86400_000).toISOString()

    const { error: purchaseError } = await supabase.from('purchases').insert({
      user_id: user.id,
      title,
      original_price: price,
      price,
      payment_key: chargeData.paymentKey,
      payment_method: 'toss',
      board_instructor_id: insId,
      expires_at: expiresAt,
    })

    await supabase
      .from('newsletter_subscriptions')
      .update({
        current_expires_at: expiresAt,
        next_charge_at: new Date(new Date(expiresAt).getTime() - RENEW_BEFORE_MS).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('instructor_id', insId)

    // 결제는 승인됐는데 구매 기록만 실패한 경우 — 열람권 미부여 상태라 반드시 관리자 확인 필요
    if (purchaseError) {
      return json({ error: '결제는 완료되었으나 구매 기록 생성에 실패했습니다. 고객센터로 문의해 주세요.' }, 500)
    }

    return json({
      success: true,
      title,
      order_id: orderId,
      instructor_name: ins.name,
      price,
      period_days: days,
      expires_at: expiresAt,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : '서버 오류가 발생했습니다.' }, 500)
  }
})
