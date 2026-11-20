// 카카오싱크 서비스 약관 동의 결과 저장 — POST /api/kakao-consent { provider_token }
// 카카오 로그인 직후 화면(KakaoConsentSync)이 부른다. 로그인한 회원 본인 확인 → 카카오에 그 회원의 약관 동의 내역을
// 직접 물어(화면이 보낸 값은 믿지 않음) → user_consents 에 서버 키로 기록. 카카오 [간편가입]이 꺼져 있으면 기록할 게 없어 그냥 끝난다.
// 약관 태그(카카오 개발자 콘솔 [카카오 로그인] > [간편가입] 에 등록한 값)와 칸 대응은 아래 TAGS.

export const config = { runtime: 'edge' }

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || ''

const TAGS = { terms: 'terms_service', privacy: 'privacy_collect', marketing: 'marketing' } as const

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

type Term = { tag: string; agreed: boolean; agreed_at: string | null }

/** 카카오 응답 → 약관 목록. v2(service_terms: [{tag, agreed, agreed_at}])와 예전 v1(allowed_service_terms: [{tag, agreed_at}]) 둘 다 읽는다 */
function parseTerms(body: Record<string, unknown>): Term[] {
  const v2 = body.service_terms as { tag?: string; agreed?: boolean; agreed_at?: string }[] | undefined
  if (Array.isArray(v2)) return v2.filter((t) => t.tag).map((t) => ({ tag: String(t.tag), agreed: t.agreed !== false, agreed_at: t.agreed_at ?? null }))
  const v1 = body.allowed_service_terms as { tag?: string; agreed_at?: string }[] | undefined
  if (Array.isArray(v1)) return v1.filter((t) => t.tag).map((t) => ({ tag: String(t.tag), agreed: true, agreed_at: t.agreed_at ?? null }))
  return []
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) return json({ error: '서버 설정이 아직 없습니다.' }, 500)
  const userToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!userToken) return json({ error: '로그인이 필요합니다.' }, 401)

  let body: { provider_token?: string }
  try { body = await request.json() } catch { return json({ error: '잘못된 요청' }, 400) }
  const kakaoToken = String(body.provider_token || '')
  if (!kakaoToken) return json({ error: '카카오 토큰이 없습니다.' }, 400)

  // 1) 로그인한 회원 확인 + 연결된 카카오 계정 번호
  const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${userToken}` } })
  if (!meRes.ok) return json({ error: '로그인이 필요합니다.' }, 401)
  const me = (await meRes.json()) as { id: string; identities?: { provider: string; id?: string; identity_data?: { provider_id?: string; sub?: string } }[] }
  const kakaoIds = new Set((me.identities ?? []).filter((i) => i.provider === 'kakao')
    .flatMap((i) => [i.id, i.identity_data?.provider_id, i.identity_data?.sub]).filter(Boolean).map(String))
  if (kakaoIds.size === 0) return json({ ok: true, skipped: 'not_kakao' })

  // 2) 카카오에 약관 동의 내역 확인 (그 카카오 계정의 것인지도 확인)
  const kRes = await fetch('https://kapi.kakao.com/v2/user/service_terms', { headers: { authorization: `Bearer ${kakaoToken}` } })
  if (!kRes.ok) return json({ ok: true, skipped: `kakao_${kRes.status}` }) // 간편가입 꺼짐·토큰 만료 등 — 기록할 게 없음
  const kBody = (await kRes.json()) as Record<string, unknown>
  if (kBody.id != null && !kakaoIds.has(String(kBody.id))) return json({ error: '카카오 계정이 일치하지 않습니다.' }, 403)
  const terms = parseTerms(kBody)
  const find = (tag: string) => terms.find((t) => t.tag === tag)
  const terms_ = find(TAGS.terms)
  const privacy = find(TAGS.privacy)
  const marketing = find(TAGS.marketing)
  if (!terms_ && !privacy && !marketing) return json({ ok: true, skipped: 'no_terms' })

  // 3) 기존 기록과 합쳐 저장 — 마케팅은 바뀐 경우에만 시각 갱신
  const H = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' }
  const prevRes = await fetch(`${SUPABASE_URL}/rest/v1/user_consents?user_id=eq.${me.id}&select=marketing_agreed,terms_agreed_at,privacy_agreed_at`, { headers: H })
  if (!prevRes.ok) return json({ error: '동의 기록 표가 아직 없습니다.' }, 500)
  const prev = ((await prevRes.json()) as { marketing_agreed: boolean; terms_agreed_at: string | null; privacy_agreed_at: string | null }[])[0]
  const now = new Date().toISOString()
  const at = (t: Term | undefined, old: string | null | undefined) => (t?.agreed ? t.agreed_at || old || now : old ?? null)
  const marketingAgreed = marketing ? marketing.agreed : prev?.marketing_agreed ?? false
  const row = {
    user_id: me.id,
    terms_agreed_at: at(terms_, prev?.terms_agreed_at),
    privacy_agreed_at: at(privacy, prev?.privacy_agreed_at),
    marketing_agreed: marketingAgreed,
    ...(prev?.marketing_agreed !== marketingAgreed || !prev ? { marketing_changed_at: marketing?.agreed_at || now } : {}),
    source: 'kakao_sync',
    raw: terms,
    updated_at: now,
  }
  const up = await fetch(`${SUPABASE_URL}/rest/v1/user_consents?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...H, prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  })
  if (!up.ok) return json({ error: `저장 실패 (HTTP ${up.status})` }, 500)
  return json({ ok: true, marketing: marketingAgreed })
}
