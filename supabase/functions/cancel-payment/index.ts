// 토스 결제 취소 (관리자 환불) — 관리자 또는 service_role 만 호출 가능.
// 뉴스레터 구독(빌링) 결제 건은 빌링 시크릿 키로 승인되므로 취소도 그 키로 호출해야 한다.
// purchases 에서 결제 건을 조회해 키를 고르고, 실패하면 대체 키로 1회 재시도한다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyToken } from '../_shared/auth.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { paymentKey, cancelReason } = await req.json()
    if (!paymentKey) return json({ error: '결제 키가 필요합니다.' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, serviceKey)

    // 결제 취소는 파괴적 작업 — 관리자 또는 service_role 만 허용
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: '인증이 필요합니다.' }, 401)
    const token = authHeader.replace('Bearer ', '')
    let allowed = token === serviceKey
    if (!allowed) {
      const verified = await verifyToken(token, supabaseUrl, anonKey, serviceKey)
      if (verified?.isServiceRole) {
        allowed = true
      } else if (verified?.user) {
        const { data: prof } = await supabase
          .from('profiles').select('role').eq('id', verified.user.id).maybeSingle()
        allowed = (prof as { role?: string } | null)?.role === 'admin'
      }
    }
    if (!allowed) return json({ error: '권한이 없습니다.' }, 403)

    const { data: settingsData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'toss_payments')
      .maybeSingle()
    const settings = (settingsData?.value ?? {}) as Record<string, string>
    const secretKey = settings.secretKey
    const billingSecretKey = settings.billingSecretKey
    if (!secretKey && !billingSecretKey) return json({ error: '결제 설정이 완료되지 않았습니다.' }, 500)

    // 구독(빌링) 결제 건인지 확인해 우선 키 결정 — 빌링 건은 빌링 시크릿 키로 승인됐다
    const { data: purchase } = await supabase
      .from('purchases')
      .select('board_instructor_id')
      .eq('payment_key', paymentKey)
      .maybeSingle()
    const isBillingPayment = !!(purchase as { board_instructor_id: number | null } | null)?.board_instructor_id
    const primaryKey = (isBillingPayment ? billingSecretKey : secretKey) || secretKey || billingSecretKey
    const fallbackKey = primaryKey === secretKey ? billingSecretKey : secretKey

    const requestCancel = async (key: string) => {
      const res = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(key + ':')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cancelReason: cancelReason || '관리자 환불' }),
      })
      return { ok: res.ok, body: await res.json() }
    }

    let result = await requestCancel(primaryKey!)
    // 다른 MID 키로 승인된 결제(키 불일치)면 대체 키로 1회 재시도
    if (!result.ok && fallbackKey && fallbackKey !== primaryKey) {
      const retry = await requestCancel(fallbackKey)
      if (retry.ok) result = retry
    }
    if (!result.ok) {
      return json({ error: (result.body as { message?: string }).message || '결제 취소에 실패했습니다.' }, 400)
    }

    return json({ success: true })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : '서버 오류가 발생했습니다.' }, 500)
  }
})
