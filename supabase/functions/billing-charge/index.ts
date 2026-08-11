// 뉴스레터 구독 자동 갱신 결제 — pg_cron 이 매시 호출 (newsletter-billing-charge 잡)
// next_charge_at 이 도래한 active 구독을 찾아 빌링키로 자동결제 승인하고
// purchases 행을 추가해 열람권을 연장한다. 실패 시 12시간 뒤 재시도, 3회 연속 실패면 failed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyToken } from '../_shared/auth.ts'
import { addMonthsKst } from '../_shared/period.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const TOSS_API = 'https://api.tosspayments.com/v1'
const RENEW_BEFORE_MS = 6 * 3600_000   // 만료 6시간 전 갱신 (billing-issue 와 동일)
const RETRY_AFTER_MS = 12 * 3600_000   // 실패 시 12시간 뒤 재시도
const MAX_FAILS = 3
const MAX_PER_RUN = 20

interface SubRow {
  id: number
  user_id: string
  instructor_id: number
  customer_key: string
  billing_key: string | null
  fail_count: number
  next_charge_at: string
}

function generateOrderId(suffix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 10)
  return `ORDER_${date}_${random}${suffix}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // service_role(pg_cron) 또는 관리자 수동 실행만 허용 (webhook-schedule-runner 와 동일 규칙)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace('Bearer ', '')
    let isServiceRole = token === serviceKey
    if (!isServiceRole) {
      // legacy JWT 대응 — env 의 service_role 키(sb_secret_xxx)와 포맷이 다르면 admin API 로 판정
      try {
        const probeRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
          headers: { 'Authorization': `Bearer ${token}`, 'apikey': token },
        })
        if (probeRes.ok) isServiceRole = true
      } catch { /* ignore */ }
    }
    const supabase = createClient(supabaseUrl, serviceKey)
    if (!isServiceRole) {
      const verified = await verifyToken(token, supabaseUrl, anonKey, serviceKey)
      if (!verified || !verified.user) return json({ error: 'Invalid auth' }, 401)
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', verified.user.id).maybeSingle()
      if ((prof as { role?: string } | null)?.role !== 'admin') return json({ error: 'Admin only' }, 403)
    }

    const { data: settingsData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'toss_payments')
      .maybeSingle()
    const settings = (settingsData?.value ?? {}) as Record<string, string>
    const billingSecretKey = settings.billingSecretKey || settings.secretKey
    if (!billingSecretKey) return json({ error: '자동결제(빌링) 설정이 완료되지 않았습니다.' }, 500)
    const basicAuth = `Basic ${btoa(billingSecretKey + ':')}`

    const nowIso = new Date().toISOString()
    const { data: dueSubs, error: dueError } = await supabase
      .from('newsletter_subscriptions')
      .select('id, user_id, instructor_id, customer_key, billing_key, fail_count, next_charge_at')
      .eq('status', 'active')
      .not('next_charge_at', 'is', null)
      .lte('next_charge_at', nowIso)
      .order('next_charge_at', { ascending: true })
      .limit(MAX_PER_RUN)
    if (dueError) return json({ error: dueError.message }, 500)

    let charged = 0
    let failed = 0
    let skipped = 0

    for (const sub of (dueSubs ?? []) as SubRow[]) {
      // 원자적 선점 — 동시 실행(중복 cron)이 같은 구독을 두 번 결제하지 않도록
      // 조건부 UPDATE 로 next_charge_at 을 재시도 시각으로 밀어두고, 갱신된 행만 처리한다.
      const { data: claimed } = await supabase
        .from('newsletter_subscriptions')
        .update({ next_charge_at: new Date(Date.now() + RETRY_AFTER_MS).toISOString() })
        .eq('id', sub.id)
        .eq('status', 'active')
        .eq('next_charge_at', sub.next_charge_at)
        .select('id')
      if (!claimed || claimed.length === 0) { skipped++; continue }

      const failUpdate = async (message: string) => {
        const failCount = sub.fail_count + 1
        await supabase
          .from('newsletter_subscriptions')
          .update({
            fail_count: failCount,
            last_error: message,
            ...(failCount >= MAX_FAILS ? { status: 'failed', next_charge_at: null } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id)
        failed++
      }

      if (!sub.billing_key) {
        await failUpdate('빌링키가 없습니다.')
        continue
      }

      // 강사의 현재 구독료로 갱신 결제 — 가격이 바뀌면 다음 회차부터 자동 반영
      const { data: ins } = await supabase
        .from('instructors')
        .select('name, newsletter_price, newsletter_months')
        .eq('id', sub.instructor_id)
        .maybeSingle()
      const price = ins?.newsletter_price ?? 0
      const months = ins?.newsletter_months && ins.newsletter_months > 0 ? ins.newsletter_months : 1
      if (!ins || price <= 0) {
        // 구독 상품이 내려간 강사 — 더 이상 결제하지 않고 종료
        await supabase
          .from('newsletter_subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            next_charge_at: null,
            billing_key: null,
            last_error: '구독 상품 판매 종료',
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id)
        skipped++
        continue
      }

      const orderId = generateOrderId(`_bsub_${sub.instructor_id}`)
      const title = `[뉴스레터 구독] ${ins.name} ${months}개월`
      let chargeData: Record<string, unknown>
      try {
        const chargeRes = await fetch(`${TOSS_API}/billing/${sub.billing_key}`, {
          method: 'POST',
          headers: { 'Authorization': basicAuth, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerKey: sub.customer_key,
            amount: price,
            orderId,
            orderName: title,
          }),
        })
        chargeData = await chargeRes.json()
        if (!chargeRes.ok) {
          await failUpdate((chargeData.message as string) || '자동결제 승인 실패')
          continue
        }
      } catch (err) {
        await failUpdate(err instanceof Error ? err.message : '자동결제 요청 실패')
        continue
      }

      // 열람권 연장 — 기존 만료일(남아 있으면)부터 이어서
      const { data: cur } = await supabase
        .from('purchases')
        .select('expires_at')
        .eq('user_id', sub.user_id)
        .eq('board_instructor_id', sub.instructor_id)
        .not('expires_at', 'is', null)
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const baseMs = Math.max(Date.now(), cur?.expires_at ? new Date(cur.expires_at as string).getTime() : 0)
      const expiresAt = addMonthsKst(new Date(baseMs), months).toISOString()

      await supabase.from('purchases').insert({
        user_id: sub.user_id,
        title,
        original_price: price,
        price,
        payment_key: chargeData.paymentKey,
        payment_method: 'toss',
        board_instructor_id: sub.instructor_id,
        expires_at: expiresAt,
      })

      await supabase
        .from('newsletter_subscriptions')
        .update({
          price,
          period_days: months * 30, // 구버전 호환용 근사값 — 실제 주기는 period_months
          period_months: months,
          current_expires_at: expiresAt,
          next_charge_at: new Date(new Date(expiresAt).getTime() - RENEW_BEFORE_MS).toISOString(),
          fail_count: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id)
      charged++
    }

    return json({ success: true, due: dueSubs?.length ?? 0, charged, failed, skipped })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : '서버 오류가 발생했습니다.' }, 500)
  }
})
