// 광고비 자동 가져오기 (메타·네이버 검색광고·구글 Ads·네이버 GFA) — /api/ad-spend-sync
//
// 흐름: 매체 캠페인의 일별 비용을 ad_campaign_daily 에 모은다 → 상품마다 고른 캠페인만 rebuild_product_ad_spend() 로 광고비에 넣는다.
//
//  관리자(로그인 토큰):
//   POST { action: 'campaigns', channel }          → 그 매체 캠페인 목록 (메타·네이버 SA 는 매체 API, 구글·GFA 는 받아 둔 기록에서)
//   POST { action: 'sync', kind, product_id }      → 그 상품에 고른 메타·네이버 SA 캠페인을 처음부터 다시 받고 광고비를 다시 만든다
//   POST { action: 'upload', channel: 'gfa', rows } → GFA 보고서 파일에서 읽은 일별 비용 저장 + 고른 상품 광고비 다시 만들기
//  매일 자동(Vercel Cron, Authorization: Bearer CRON_SECRET):
//   GET                                            → 어느 상품이든 고른 메타·네이버 SA 캠페인의 최근 35일을 받고 모든 상품 광고비를 다시 만든다
//  구글 Ads 스크립트(헤더 x-ad-sync-secret: AD_SYNC_SECRET):
//   POST { action: 'push', channel: 'google', account_id, rows: [{ campaign_id, campaign_name, date, cost }] }
//
// Vercel 환경변수: META_ACCESS_TOKEN(기존), NAVER_SA_API_KEY·NAVER_SA_SECRET_KEY·NAVER_SA_CUSTOMER_ID, CRON_SECRET, AD_SYNC_SECRET,
//                 SUPABASE_SERVICE_ROLE_KEY(기존 — 자동·구글 수신 때만 사용)
// 비용은 매체가 주는 값 그대로(메타 spend·네이버 salesAmt·구글 cost 모두 부가세 별도).

import { COURSE_VARIANTS } from '../src/lib/courseVariants'

export const config = { runtime: 'edge' }

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || ''
const META_TOKEN = env.META_ACCESS_TOKEN || ''
const NAVER_KEY = env.NAVER_SA_API_KEY || ''
const NAVER_SECRET = env.NAVER_SA_SECRET_KEY || ''
const NAVER_CUSTOMER = env.NAVER_SA_CUSTOMER_ID || ''
const CRON_SECRET = env.CRON_SECRET || ''
const PUSH_SECRET = env.AD_SYNC_SECRET || ''
const GRAPH = 'https://graph.facebook.com/v21.0'
const NAVER_API = 'https://api.searchad.naver.com'

type Channel = 'meta' | 'naver_sa' | 'google' | 'gfa'
type Kind = 'course' | 'ebook'
interface Daily { channel: Channel; campaign_id: string; campaign_name: string | null; account_id: string | null; spend_date: string; amount: number }
interface Settings { kind: Kind; product_id: number; meta_campaign_ids: string[]; naver_campaign_ids?: string[]; google_campaign_ids?: string[]; gfa_campaign_ids?: string[] }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

/** token = 관리자 로그인 토큰 또는 서비스 키 */
function db(path: string, token: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: token === SERVICE_KEY ? SERVICE_KEY : SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  })
}

const kstDate = (d: Date) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
const daysAgo = (n: number) => kstDate(new Date(Date.now() - n * 86400 * 1000))

/** 동시에 limit 개씩 */
async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]) }
  }))
  return out
}

// ── 메타 ─────────────────────────────────────────────────────────────────────
async function graphAll<T>(url: string): Promise<T[]> {
  const out: T[] = []
  let next: string | null = url
  for (let i = 0; next && i < 20; i++) {
    const res: Response = await fetch(next)
    const body = (await res.json()) as { data?: T[]; paging?: { next?: string }; error?: { message?: string } }
    if (!res.ok || body.error) throw new Error(body.error?.message || `메타 API 오류 (HTTP ${res.status})`)
    out.push(...(body.data ?? []))
    next = body.paging?.next ?? null
  }
  return out
}

/** 토큰으로 볼 수 있는 모든 광고 계정의 캠페인 */
async function metaCampaigns() {
  const tk = encodeURIComponent(META_TOKEN)
  const accounts = await graphAll<{ id: string; name: string }>(`${GRAPH}/me/adaccounts?fields=id,name&limit=100&access_token=${tk}`)
  const lists = await pool(accounts, 4, async (a) => {
    const rows = await graphAll<{ id: string; name: string; effective_status: string }>(
      `${GRAPH}/${a.id}/campaigns?fields=id,name,effective_status&limit=200&access_token=${tk}`,
    )
    return rows.map((c) => ({ id: c.id, name: c.name, status: c.effective_status, account: a.name }))
  })
  return lists.flat().sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE'))
}

/** since 가 없으면 캠페인 전체 기간 */
async function metaDaily(cid: string, since?: string): Promise<Daily[]> {
  const range = since ? `time_range=${encodeURIComponent(JSON.stringify({ since, until: kstDate(new Date()) }))}` : 'date_preset=maximum'
  const rows = await graphAll<{ date_start: string; spend: string; campaign_name?: string; account_id?: string }>(
    `${GRAPH}/${cid}/insights?fields=spend,campaign_name,account_id&time_increment=1&${range}&limit=500&access_token=${encodeURIComponent(META_TOKEN)}`,
  )
  return rows.map((r) => ({ channel: 'meta', campaign_id: cid, campaign_name: r.campaign_name ?? null, account_id: r.account_id ?? null, spend_date: r.date_start, amount: Number(r.spend) || 0 }))
}

// ── 네이버 검색광고 ─────────────────────────────────────────────────────────────
async function naverFetch<T>(method: string, uri: string, query = ''): Promise<T> {
  const ts = String(Date.now())
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(NAVER_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}.${method}.${uri}`)))
  const res = await fetch(`${NAVER_API}${uri}${query ? `?${query}` : ''}`, {
    method,
    headers: { 'X-Timestamp': ts, 'X-API-KEY': NAVER_KEY, 'X-Customer': NAVER_CUSTOMER, 'X-Signature': btoa(String.fromCharCode(...sig)) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`네이버 검색광고 API 오류 (HTTP ${res.status}) ${text.slice(0, 200)}`)
  return JSON.parse(text) as T
}

const naverReady = () => !!(NAVER_KEY && NAVER_SECRET && NAVER_CUSTOMER)

async function naverCampaigns() {
  const rows = await naverFetch<{ nccCampaignId: string; name: string; status?: string; campaignTp?: string }[]>('GET', '/ncc/campaigns')
  return rows.map((c) => ({ id: c.nccCampaignId, name: c.name, status: c.status ?? '', account: c.campaignTp ?? '' }))
    .sort((a, b) => Number(b.status === 'ELIGIBLE') - Number(a.status === 'ELIGIBLE'))
}

/** 하루씩 묶어 받는다 (캠페인 여러 개를 한 번에) — 응답 형식에 덜 기대도록 날짜는 우리가 붙인다 */
async function naverDaily(ids: string[], since: string): Promise<Daily[]> {
  if (!ids.length) return []
  const names = new Map((await naverCampaigns()).map((c) => [c.id, c.name]))
  const days: string[] = []
  const today = kstDate(new Date())
  for (let d = new Date(`${since}T00:00:00Z`); d.toISOString().slice(0, 10) <= today; d = new Date(d.getTime() + 86400 * 1000)) {
    days.push(d.toISOString().slice(0, 10))
  }
  const per = await pool(days, 4, async (day) => {
    const q = new URLSearchParams()
    for (const id of ids) q.append('ids', id)
    q.set('fields', JSON.stringify(['salesAmt']))
    q.set('timeRange', JSON.stringify({ since: day, until: day }))
    const body = await naverFetch<{ data?: { id: string; salesAmt?: number }[] }>('GET', '/stats', q.toString())
    return (body.data ?? []).map((r) => ({
      channel: 'naver_sa' as const, campaign_id: r.id, campaign_name: names.get(r.id) ?? null, account_id: NAVER_CUSTOMER, spend_date: day, amount: Number(r.salesAmt) || 0,
    }))
  })
  return per.flat()
}

// ── 캠페인 랜딩 주소 (캠페인 고를 때 어느 강의로 가는지 확인용) ─────────────────────────────
/** 객체 안의 http 주소를 모두 모은다 (이미지·메타 내부 주소 제외) */
function collectUrls(x: unknown, out: Set<string>, depth = 0) {
  if (depth > 8 || x == null) return
  if (typeof x === 'string') {
    if (/^https?:\/\//i.test(x) && !/\.(jpe?g|png|gif|webp|mp4|svg)(\?|$)/i.test(x) && !/(fbcdn|facebook\.com|instagram\.com|fb\.me|pstatic\.net|naver\.net)/i.test(x)) out.add(x)
    return
  }
  if (Array.isArray(x)) { for (const v of x) collectUrls(v, out, depth + 1); return }
  if (typeof x === 'object') for (const v of Object.values(x as Record<string, unknown>)) collectUrls(v, out, depth + 1)
}

/** 주소 → 호스트+경로 (쿼리·UTM 제외) */
const shortUrl = (u: string) => { try { const x = new URL(u); return (x.host + x.pathname).replace(/\/$/, '') } catch { return u } }

async function metaLandings(cid: string): Promise<string[]> {
  const ads = await graphAll<unknown>(
    `${GRAPH}/${cid}/ads?fields=creative{object_story_spec,asset_feed_spec,link_url,object_url,template_url}&limit=100&access_token=${encodeURIComponent(META_TOKEN)}`,
  )
  const s = new Set<string>(); collectUrls(ads, s)
  return [...new Set([...s].map(shortUrl))]
}

async function naverLandings(cid: string): Promise<string[]> {
  const groups = await naverFetch<{ nccAdgroupId: string }[]>('GET', '/ncc/adgroups', `nccCampaignId=${encodeURIComponent(cid)}`)
  const s = new Set<string>()
  await pool(groups.slice(0, 30), 4, async (g) => {
    const ads = await naverFetch<unknown[]>('GET', '/ncc/ads', `nccAdgroupId=${encodeURIComponent(g.nccAdgroupId)}`).catch(() => [])
    collectUrls(ads, s)
  })
  return [...new Set([...s].map(shortUrl))]
}

// ── 저장 ─────────────────────────────────────────────────────────────────────
async function saveDaily(rows: Daily[], token: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, updated_at: new Date().toISOString() }))
    const res = await db('ad_campaign_daily?on_conflict=channel,campaign_id,spend_date', token, {
      method: 'POST', body: JSON.stringify(chunk), headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
    })
    if (!res.ok) throw new Error(`비용 저장 실패: ${(await res.text()).slice(0, 200)}`)
  }
}

async function rebuild(kind: Kind, productId: number, token: string) {
  const res = await db('rpc/rebuild_product_ad_spend', token, { method: 'POST', body: JSON.stringify({ p_kind: kind, p_id: productId }) })
  if (!res.ok) throw new Error(`광고비 다시 만들기 실패: ${(await res.text()).slice(0, 200)}`)
  return Number(await res.json()) || 0
}

async function allSettings(token: string): Promise<Settings[]> {
  const res = await db('product_funnel_settings?select=kind,product_id,meta_campaign_ids,naver_campaign_ids,google_campaign_ids,gfa_campaign_ids', token)
  if (!res.ok) throw new Error(`연결 설정 읽기 실패: ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as Settings[]
}

const picked = (s: Settings) =>
  (s.meta_campaign_ids?.length ?? 0) + (s.naver_campaign_ids?.length ?? 0) + (s.google_campaign_ids?.length ?? 0) + (s.gfa_campaign_ids?.length ?? 0) > 0

/** 고른 캠페인이 있는 모든 상품 광고비 다시 만들기 */
async function rebuildAll(token: string, only?: (s: Settings) => boolean) {
  const list = (await allSettings(token)).filter((s) => picked(s) && (!only || only(s)))
  for (const s of list) await rebuild(s.kind, s.product_id, token)
  return list.length
}

// ── 랜딩 주소로 캠페인 자동 연결 ─────────────────────────────────────────────────
// 광고가 보내는 랜딩이 우리 사이트 상품 한 곳(/course/N · /ebook/N · /c/slug)이면 그 상품에 캠페인을 붙인다.
// 상품 두 곳 이상으로 가는 캠페인은 붙이지 않고 알려 준다. 사람이 붙인 연결은 지우지 않는다(추가만).

/** 호스트+경로 → 상품 */
function productOf(u: string): { kind: Kind; id: number } | null {
  const m = u.match(/^(?:www\.)?amag-class\.com(\/.*)?$/i)
  if (!m) return null
  const path = m[1] ?? ''
  let x = path.match(/^\/(course|ebook)\/(\d+)(\/|$)/)
  if (x) return { kind: x[1] as Kind, id: Number(x[2]) }
  x = path.match(/^\/c\/([^/]+)/)
  const v = x ? COURSE_VARIANTS[x[1]] : undefined
  return v ? { kind: 'course', id: v.courseId } : null
}

interface LinkResult { added: { channel: Channel; campaign: string; name: string; kind: Kind; product_id: number }[]; ambiguous: { channel: Channel; name: string; products: string[] }[] }

async function autoLink(token: string): Promise<LinkResult & { newMeta: string[]; newNaver: string[] }> {
  const out: LinkResult = { added: [], ambiguous: [] }
  const found: { channel: Channel; id: string; name: string; landings: string[] }[] = []
  if (META_TOKEN) {
    const camps = await metaCampaigns()
    const ls = await pool(camps, 8, async (c) => ({ channel: 'meta' as const, id: c.id, name: c.name, landings: await metaLandings(c.id).catch(() => [] as string[]) }))
    found.push(...ls)
  }
  if (naverReady()) {
    const camps = await naverCampaigns()
    const ls = await pool(camps, 3, async (c) => ({ channel: 'naver_sa' as const, id: c.id, name: c.name, landings: await naverLandings(c.id).catch(() => [] as string[]) }))
    found.push(...ls)
  }
  const settings = await allSettings(token)
  const field = { meta: 'meta_campaign_ids', naver_sa: 'naver_campaign_ids' } as const
  const patch = new Map<string, Settings>()
  const get = (kind: Kind, id: number) => {
    const k = `${kind}:${id}`
    let s = patch.get(k) ?? settings.find((x) => x.kind === kind && x.product_id === id)
    if (!s) s = { kind, product_id: id, meta_campaign_ids: [], naver_campaign_ids: [] }
    s = { ...s, meta_campaign_ids: [...(s.meta_campaign_ids ?? [])], naver_campaign_ids: [...(s.naver_campaign_ids ?? [])] }
    patch.set(k, s)
    return s
  }
  // 이미 어느 상품에든 붙어 있는 캠페인은 건드리지 않는다
  const linkedAnywhere = new Set(settings.flatMap((s) => [...(s.meta_campaign_ids ?? []).map((x) => `meta:${x}`), ...(s.naver_campaign_ids ?? []).map((x) => `naver_sa:${x}`)]))
  const newMeta: string[] = []; const newNaver: string[] = []
  for (const c of found) {
    if (linkedAnywhere.has(`${c.channel}:${c.id}`)) continue
    const prods = new Map<string, { kind: Kind; id: number }>()
    for (const u of c.landings) { const p = productOf(u); if (p) prods.set(`${p.kind}:${p.id}`, p) }
    if (prods.size === 0) continue
    if (prods.size > 1) { out.ambiguous.push({ channel: c.channel, name: c.name, products: [...prods.keys()] }); continue }
    const p = [...prods.values()][0]
    const s = get(p.kind, p.id)
    const list = (s[field[c.channel as 'meta' | 'naver_sa']] ?? []) as string[]
    if (!list.includes(c.id)) list.push(c.id)
    ;(s as unknown as Record<string, string[]>)[field[c.channel as 'meta' | 'naver_sa']] = list
    out.added.push({ channel: c.channel, campaign: c.id, name: c.name, kind: p.kind, product_id: p.id })
    if (c.channel === 'meta') newMeta.push(c.id); else newNaver.push(c.id)
  }
  const changed = [...patch.values()].filter((s) => out.added.some((a) => a.kind === s.kind && a.product_id === s.product_id))
  if (changed.length) {
    const res = await db('product_funnel_settings?on_conflict=kind,product_id', token, {
      method: 'POST',
      body: JSON.stringify(changed.map((s) => ({ kind: s.kind, product_id: s.product_id, meta_campaign_ids: s.meta_campaign_ids, naver_campaign_ids: s.naver_campaign_ids ?? [], updated_at: new Date().toISOString() }))),
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
    })
    if (!res.ok) throw new Error(`연결 저장 실패: ${(await res.text()).slice(0, 200)}`)
  }
  return { ...out, newMeta, newNaver }
}

/** 새로 붙은 캠페인은 전체 기간(네이버 120일)을 받는다 */
async function fetchNew(newMeta: string[], newNaver: string[], token: string, errors: string[]) {
  if (newMeta.length) {
    const lists = await pool(newMeta, 4, (cid) => metaDaily(cid).catch((e) => { errors.push(`메타 ${cid}: ${(e as Error).message}`); return [] as Daily[] }))
    await saveDaily(lists.flat(), token)
  }
  if (newNaver.length) {
    try { await saveDaily(await naverDaily(newNaver, daysAgo(120)), token) } catch (e) { errors.push(`네이버: ${(e as Error).message}`) }
  }
}

/** 오래 걸리는 작업 — 25초 안에 응답을 시작해야 해서 공백부터 보내고 결과 JSON 을 이어 보낸다 */
function streamJson(work: () => Promise<unknown>): Response {
  const enc = new TextEncoder()
  const body = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(enc.encode(' '))
      const t = setInterval(() => ctrl.enqueue(enc.encode(' ')), 10000)
      try { ctrl.enqueue(enc.encode(JSON.stringify(await work()))) } catch (e) { ctrl.enqueue(enc.encode(JSON.stringify({ error: (e as Error).message }))) }
      clearInterval(t)
      ctrl.close()
    },
  })
  return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
}

/** 매일 자동: 랜딩으로 새 캠페인 연결 → 최근 35일 */
async function cronSync() {
  const errors: string[] = []
  let link: Awaited<ReturnType<typeof autoLink>> | null = null
  try { link = await autoLink(SERVICE_KEY); await fetchNew(link.newMeta, link.newNaver, SERVICE_KEY, errors) } catch (e) { errors.push(`자동 연결: ${(e as Error).message}`) }
  const settings = await allSettings(SERVICE_KEY)
  const metaIds = [...new Set(settings.flatMap((s) => s.meta_campaign_ids ?? []))].filter((x) => /^\d+$/.test(x))
  const naverIds = [...new Set(settings.flatMap((s) => s.naver_campaign_ids ?? []))]
  const since = daysAgo(35)
  let rows = 0
  if (META_TOKEN && metaIds.length) {
    const lists = await pool(metaIds, 4, (cid) => metaDaily(cid, since).catch((e) => { errors.push(`메타 ${cid}: ${(e as Error).message}`); return [] as Daily[] }))
    const flat = lists.flat(); rows += flat.length
    await saveDaily(flat, SERVICE_KEY)
  }
  if (naverReady() && naverIds.length) {
    try { const flat = await naverDaily(naverIds, since); rows += flat.length; await saveDaily(flat, SERVICE_KEY) } catch (e) { errors.push(`네이버: ${(e as Error).message}`) }
  }
  const products = await rebuildAll(SERVICE_KEY)
  return { ok: errors.length === 0, rows, products, added: link?.added.length ?? 0, ambiguous: link?.ambiguous ?? [], errors }
}

export default async function handler(request: Request): Promise<Response> {
  const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')

  // 매일 자동 (Vercel Cron)
  if (request.method === 'GET') {
    if (!CRON_SECRET || auth !== CRON_SECRET) return json({ error: 'unauthorized' }, 401)
    if (!SERVICE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY 없음' }, 500)
    return streamJson(cronSync)
  }
  if (request.method !== 'POST') return json({ error: 'GET/POST only' }, 405)

  let body: { action?: string; channel?: string; kind?: string; product_id?: number; account_id?: string; rows?: unknown[]; landings?: Record<string, unknown> }
  try { body = await request.json() } catch { return json({ error: '잘못된 요청' }, 400) }

  // 구글 Ads 스크립트가 보내는 일별 비용
  if (body.action === 'push') {
    if (!PUSH_SECRET || request.headers.get('x-ad-sync-secret') !== PUSH_SECRET) return json({ error: 'unauthorized' }, 401)
    if (!SERVICE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY 없음' }, 500)
    if (body.channel !== 'google') return json({ error: 'channel 은 google 만' }, 400)
    const rows: Daily[] = (Array.isArray(body.rows) ? body.rows : []).flatMap((x) => {
      const r = x as { campaign_id?: unknown; campaign_name?: unknown; date?: unknown; cost?: unknown }
      const date = String(r.date ?? '')
      if (!r.campaign_id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return []
      return [{ channel: 'google' as const, campaign_id: String(r.campaign_id), campaign_name: r.campaign_name ? String(r.campaign_name).slice(0, 300) : null,
        account_id: body.account_id ? String(body.account_id).slice(0, 50) : null, spend_date: date, amount: Math.max(0, Number(r.cost) || 0) }]
    })
    if (rows.length > 20000) return json({ error: '한 번에 너무 많습니다' }, 400)
    try {
      await saveDaily(rows, SERVICE_KEY)
      // 스크립트가 보낸 캠페인별 랜딩 주소로 자동 연결 (상품 한 곳일 때만, 이미 붙은 캠페인은 그대로)
      const added: string[] = []
      const ambiguous: string[] = []
      const landings = body.landings && typeof body.landings === 'object' ? body.landings : {}
      const settings = await allSettings(SERVICE_KEY)
      const linked = new Set(settings.flatMap((s) => s.google_campaign_ids ?? []))
      const patch = new Map<string, Settings>()
      for (const [cid, urls] of Object.entries(landings).slice(0, 2000)) {
        if (linked.has(cid) || !Array.isArray(urls)) continue
        const prods = new Map<string, { kind: Kind; id: number }>()
        for (const u of urls.slice(0, 50)) { const p = productOf(shortUrl(String(u))); if (p) prods.set(`${p.kind}:${p.id}`, p) }
        if (prods.size !== 1) { if (prods.size > 1) ambiguous.push(cid); continue }
        const p = [...prods.values()][0]
        const k = `${p.kind}:${p.id}`
        const s = patch.get(k) ?? { ...(settings.find((x) => x.kind === p.kind && x.product_id === p.id) ?? { kind: p.kind, product_id: p.id, meta_campaign_ids: [] }) }
        s.google_campaign_ids = [...new Set([...(s.google_campaign_ids ?? []), cid])]
        patch.set(k, s)
        added.push(cid)
      }
      if (patch.size) {
        const res = await db('product_funnel_settings?on_conflict=kind,product_id', SERVICE_KEY, {
          method: 'POST',
          body: JSON.stringify([...patch.values()].map((s) => ({ kind: s.kind, product_id: s.product_id, google_campaign_ids: s.google_campaign_ids, updated_at: new Date().toISOString() }))),
          headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        })
        if (!res.ok) throw new Error(`연결 저장 실패: ${(await res.text()).slice(0, 200)}`)
      }
      const products = await rebuildAll(SERVICE_KEY, (s) => (s.google_campaign_ids?.length ?? 0) > 0)
      return json({ ok: true, rows: rows.length, products, linked: added.length, ambiguous: ambiguous.length })
    } catch (e) { return json({ error: (e as Error).message }, 502) }
  }

  // 여기부터 관리자
  if (!auth) return json({ error: '로그인이 필요합니다.' }, 401)
  const adminRes = await db('rpc/is_admin', auth, { method: 'POST', body: '{}' })
  if (!adminRes.ok || (await adminRes.json()) !== true) return json({ error: '관리자만 사용할 수 있습니다.' }, 403)

  try {
    // 랜딩 주소로 모든 상품에 캠페인 자동 연결 + 새 캠페인 비용 받기 + 광고비 다시 만들기
    if (body.action === 'autolink') {
      return streamJson(async () => {
        const errors: string[] = []
        const link = await autoLink(auth)
        await fetchNew(link.newMeta, link.newNaver, auth, errors)
        const touched = new Set(link.added.map((a) => `${a.kind}:${a.product_id}`))
        for (const k of touched) { const [kind, id] = k.split(':'); await rebuild(kind as Kind, Number(id), auth) }
        return { ok: errors.length === 0, added: link.added, ambiguous: link.ambiguous, errors }
      })
    }

    // 캠페인별 랜딩 주소 — 목록을 띄운 뒤 따로 부른다 (메타는 캠페인마다 한 번씩 물어 봐야 해서 느림)
    if (body.action === 'landings') {
      const ids = (Array.isArray((body as { ids?: unknown }).ids) ? (body as { ids: unknown[] }).ids : []).map(String).slice(0, 300)
      if (body.channel === 'meta') {
        if (!META_TOKEN) return json({ error: '메타 토큰 없음' }, 400)
        const r = await pool(ids.filter((x) => /^\d+$/.test(x)), 8, async (id) => [id, await metaLandings(id).catch(() => null)] as const)
        return json({ landings: Object.fromEntries(r) })
      }
      if (body.channel === 'naver_sa') {
        if (!naverReady()) return json({ error: '네이버 키 없음' }, 400)
        const r = await pool(ids, 3, async (id) => [id, await naverLandings(id).catch(() => null)] as const)
        return json({ landings: Object.fromEntries(r) })
      }
      return json({ landings: {} })
    }

    if (body.action === 'campaigns') {
      if (body.channel === 'meta') {
        if (!META_TOKEN) return json({ error: '메타 연동 토큰이 없습니다 (Vercel 환경변수 META_ACCESS_TOKEN).' }, 400)
        return json({ campaigns: await metaCampaigns() })
      }
      if (body.channel === 'naver_sa') {
        if (!naverReady()) return json({ error: '네이버 검색광고 API 키가 아직 없습니다 (Vercel 환경변수 NAVER_SA_API_KEY·NAVER_SA_SECRET_KEY·NAVER_SA_CUSTOMER_ID).' }, 400)
        return json({ campaigns: await naverCampaigns() })
      }
      if (body.channel === 'google' || body.channel === 'gfa') {
        // 받아 둔 기록에서: 캠페인별 이름·마지막 날짜·합계
        const res = await db(`ad_campaign_daily?channel=eq.${body.channel}&select=campaign_id,campaign_name,account_id,spend_date,amount&order=spend_date.desc&limit=20000`, auth)
        const rows = (await res.json()) as { campaign_id: string; campaign_name: string | null; account_id: string | null; spend_date: string; amount: number }[]
        const m = new Map<string, { id: string; name: string; status: string; account: string; total: number }>()
        for (const r of rows) {
          const c = m.get(r.campaign_id)
          if (c) c.total += Number(r.amount)
          else m.set(r.campaign_id, { id: r.campaign_id, name: r.campaign_name ?? r.campaign_id, status: `마지막 ${r.spend_date}`, account: r.account_id ?? '', total: Number(r.amount) })
        }
        return json({ campaigns: [...m.values()] })
      }
      return json({ error: '알 수 없는 매체' }, 400)
    }

    if (body.action === 'sync') {
      const kind: Kind | null = body.kind === 'ebook' ? 'ebook' : body.kind === 'course' ? 'course' : null
      const productId = Number(body.product_id)
      if (!kind || !Number.isInteger(productId)) return json({ error: '상품 정보가 없습니다.' }, 400)
      const s = (await allSettings(auth)).find((x) => x.kind === kind && x.product_id === productId)
      if (!s || !picked(s)) return json({ error: '연결된 캠페인이 없습니다.' }, 400)
      const metaIds = (s.meta_campaign_ids ?? []).filter((x) => /^\d+$/.test(x))
      const naverIds = s.naver_campaign_ids ?? []
      const errors: string[] = []
      if (metaIds.length) {
        if (!META_TOKEN) errors.push('메타 토큰 없음')
        else {
          const lists = await pool(metaIds, 4, (cid) => metaDaily(cid).catch((e) => { errors.push(`메타 ${cid}: ${(e as Error).message}`); return [] as Daily[] }))
          await saveDaily(lists.flat(), auth)
        }
      }
      if (naverIds.length) {
        if (!naverReady()) errors.push('네이버 검색광고 API 키 없음')
        else {
          try { await saveDaily(await naverDaily(naverIds, daysAgo(90)), auth) } catch (e) { errors.push(`네이버: ${(e as Error).message}`) }
        }
      }
      const days = await rebuild(kind, productId, auth)
      return json({ ok: errors.length === 0, days, errors })
    }

    if (body.action === 'upload') {
      if (body.channel !== 'gfa') return json({ error: '파일 올리기는 GFA 만' }, 400)
      const rows: Daily[] = (Array.isArray(body.rows) ? body.rows : []).flatMap((x) => {
        const r = x as { campaign_id?: unknown; campaign_name?: unknown; date?: unknown; cost?: unknown }
        const date = String(r.date ?? '')
        if (!r.campaign_id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return []
        return [{ channel: 'gfa' as const, campaign_id: String(r.campaign_id).slice(0, 200), campaign_name: r.campaign_name ? String(r.campaign_name).slice(0, 300) : null,
          account_id: null, spend_date: date, amount: Math.max(0, Number(r.cost) || 0) }]
      })
      if (!rows.length) return json({ error: '읽은 줄이 없습니다.' }, 400)
      await saveDaily(rows, auth)
      const products = await rebuildAll(auth, (s) => (s.gfa_campaign_ids?.length ?? 0) > 0)
      return json({ ok: true, rows: rows.length, products })
    }

    return json({ error: '알 수 없는 요청' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 502)
  }
}
