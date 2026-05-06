// 이메일 중복 가입 여부 확인 — 회원가입 타입폼 1단계에서 호출.
// auth.users 의 service-role 조회는 클라에서 직접 못 하므로 edge function 으로 위임.
//
// 보안:
//  - IP 단위 rate limit (분당 20회) — 이메일 enumeration 방지를 위한 완만한 제한
//  - 입력 검증 (email 형식)
//  - 응답은 단순 { exists: boolean } 만 노출
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_WINDOW_SEC = 60
const RATE_MAX = 20

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as { email?: string }
    const rawEmail = (body.email ?? '').trim().toLowerCase()

    if (!rawEmail || !EMAIL_RE.test(rawEmail) || rawEmail.length > 254) {
      return json({ error: '이메일 형식이 올바르지 않습니다.' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    // Rate limit — signup_attempts 의 IP 기록 재활용
    const ip = getClientIp(req)
    const since = new Date(Date.now() - RATE_WINDOW_SEC * 1000).toISOString()
    const { count } = await admin
      .from('signup_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', since)
    if ((count ?? 0) >= RATE_MAX) {
      return json({ error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' }, 429)
    }

    // Admin API 로 이메일 사용자 조회. listUsers 의 filter 옵션은 GoTrue 버전에 따라 차이가 있어
    // page=1 + per_page=1 + email 필터로 호출, 결과에 매칭이 있는지 확인.
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      // @ts-expect-error - filter 는 일부 GoTrue 버전에서만 지원
      filter: `email.eq.${rawEmail}`,
    })
    if (error) {
      // filter 미지원 환경 폴백: 전체 페이징 없이 1페이지만 보고 일치 여부 검사
      const fallback = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      if (fallback.error) {
        return json({ error: fallback.error.message }, 500)
      }
      const exists = !!fallback.data.users.find((u) => (u.email ?? '').toLowerCase() === rawEmail)
      return json({ exists })
    }

    const exists = !!data.users.find((u) => (u.email ?? '').toLowerCase() === rawEmail)
    return json({ exists })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
