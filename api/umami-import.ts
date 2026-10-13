// 과거 방문(Umami) 가져오기 — POST /api/umami-import { kind, product_id }  (관리자 상품 대시보드)
// 자체 방문 기록(product_visits)을 시작하기 전(TRACKING_START) 상품 상세 페이지 방문자를 Umami 에서 UTM 별로 받아
// product_visit_history 에 덮어쓴다. Umami 는 관리자 대시보드에 걸린 읽기 전용 공유 링크로 읽는다(로그인 정보 불필요).
// DB 쓰기는 요청한 관리자 본인의 로그인 토큰으로 — 관리자만 통과하는 RLS 그대로.

export const config = { runtime: 'edge' }

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
const UMAMI = 'https://umami-ama.vercel.app'
const UMAMI_SHARE_ID = env.UMAMI_SHARE_ID || 'LuxmmqXDx2i6kFBo'
// product_visits 기록 시작 시각 (2026-10-12 22:18 KST) — 이 이전만 Umami 로 채운다
const TRACKING_START = Date.parse('2026-10-12T13:18:00Z')

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

const db = (path: string, userToken: string, init?: RequestInit) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${userToken}`, 'content-type': 'application/json', ...(init?.headers || {}) },
  })

/** Umami query 문자열 → 유입 출처. UTM 이 없으면 광고 클릭 표시(fbclid·gclid·NaPm)로, 그것도 없으면 직접·미확인 */
function parseQuery(q: string) {
  const p = new URLSearchParams(q)
  const src = p.get('utm_source')
  if (src) {
    return { source: src.toLowerCase(), campaign: p.get('utm_campaign') || '', content: p.get('utm_content') || '', term: p.get('utm_term') || '' }
  }
  const source = p.has('fbclid') ? 'meta' : p.has('gclid') ? 'google' : p.has('NaPm') ? 'naver' : ''
  return { source, campaign: '', content: '', term: '' }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
  const userToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!userToken) return json({ error: '로그인이 필요합니다.' }, 401)
  const adminRes = await db('rpc/is_admin', userToken, { method: 'POST', body: '{}' })
  if (!adminRes.ok || (await adminRes.json()) !== true) return json({ error: '관리자만 사용할 수 있습니다.' }, 403)

  let body: { kind?: string; product_id?: number }
  try { body = await request.json() } catch { return json({ error: '잘못된 요청' }, 400) }
  const kind = body.kind === 'ebook' ? 'ebook' : body.kind === 'course' ? 'course' : null
  const productId = Number(body.product_id)
  if (!kind || !Number.isInteger(productId)) return json({ error: '상품 정보가 없습니다.' }, 400)

  try {
    const share = (await (await fetch(`${UMAMI}/api/share/${UMAMI_SHARE_ID}`)).json()) as { websiteId?: string; token?: string }
    if (!share.websiteId || !share.token) throw new Error('Umami 공유 링크를 읽지 못했습니다.')
    const H = { 'x-umami-share-token': share.token }
    const base = `${UMAMI}/api/websites/${share.websiteId}`
    const range = `startAt=0&endAt=${TRACKING_START}&path=${encodeURIComponent(`/${kind}/${productId}`)}`

    const stats = (await (await fetch(`${base}/stats?${range}`, { headers: H })).json()) as { visitors?: number }
    const total = Number(stats.visitors) || 0
    const qRes = await fetch(`${base}/metrics?${range}&type=query&limit=100000`, { headers: H })
    if (!qRes.ok) throw new Error(`Umami 조회 실패 (HTTP ${qRes.status})`)
    const queries = (await qRes.json()) as { x: string; y: number }[]

    // 출처·캠페인·소재·세트별로 합치기
    const agg = new Map<string, { source: string; campaign: string; content: string; term: string; visitors: number }>()
    for (const q of queries) {
      const r = parseQuery(q.x || '')
      const key = [r.source, r.campaign, r.content, r.term].join('\u0001')
      const a = agg.get(key) ?? { ...r, visitors: 0 }
      a.visitors += q.y
      agg.set(key, a)
    }
    // 한 사람이 여러 주소로 들어오면 query 합이 방문자 수보다 커진다 → 전체 방문자 수에 맞춰 비율 조정
    const sum = [...agg.values()].reduce((s, a) => s + a.visitors, 0)
    const scale = sum > 0 && total > 0 ? total / sum : 1
    const cutoff = new Date(TRACKING_START).toISOString()
    const rows = [...agg.values()]
      .map((a) => ({ kind, product_id: productId, ...a, visitors: Math.round(a.visitors * scale), cutoff }))
      .filter((a) => a.visitors > 0)

    const del = await db(`product_visit_history?kind=eq.${kind}&product_id=eq.${productId}`, userToken, { method: 'DELETE' })
    if (!del.ok) throw new Error(`기존 기록 정리 실패 (HTTP ${del.status})`)
    for (let i = 0; i < rows.length; i += 1000) {
      const ins = await db('product_visit_history', userToken, { method: 'POST', body: JSON.stringify(rows.slice(i, i + 1000)), headers: { prefer: 'return=minimal' } })
      if (!ins.ok) throw new Error(`저장 실패: ${(await ins.text()).slice(0, 200)}`)
    }
    return json({ ok: true, visitors: total, rows: rows.length })
  } catch (e) {
    return json({ error: (e as Error).message }, 502)
  }
}
