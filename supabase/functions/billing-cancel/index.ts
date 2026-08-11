// 뉴스레터 구독 자동갱신 해지 — 본인 구독만 해지 가능
// 토스 가이드대로 다음 결제일에 자동결제 승인 API 를 호출하지 않는 방식:
// 상태를 canceled 로 바꾸고 빌링키를 폐기한다. 이미 결제된 기간(purchases.expires_at)은
// 만료일까지 그대로 이용 가능하다. 재구독 시 카드 등록(빌링키 발급)부터 다시 진행.
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
    const { instructorId } = await req.json()
    const insId = Number(instructorId)
    if (!insId || isNaN(insId)) return json({ error: '필수 파라미터가 누락되었습니다.' }, 400)

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

    const { data: updated, error } = await supabase
      .from('newsletter_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        next_charge_at: null,
        billing_key: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', verified.user.id)
      .eq('instructor_id', insId)
      .in('status', ['active', 'failed'])
      .select('id, current_expires_at')
    if (error) return json({ error: '해지 처리에 실패했습니다.' }, 500)
    if (!updated || updated.length === 0) return json({ error: '해지할 구독이 없습니다.' }, 404)

    return json({ success: true, expires_at: updated[0].current_expires_at })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : '서버 오류가 발생했습니다.' }, 500)
  }
})
