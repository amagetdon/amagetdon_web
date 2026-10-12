// 메타 광고비 자동 가져오기 (관리자 상품 대시보드) — POST /api/meta-ad-sync
//   { action: 'campaigns' }                       → 광고 계정의 캠페인 목록
//   { action: 'sync', kind, product_id }          → 상품에 연결한 캠페인의 일별 지출을 product_ad_spend 에 저장(덮어쓰기)
// 필요한 Vercel 환경변수: META_ACCESS_TOKEN(시스템 사용자 토큰, ads_read), META_AD_ACCOUNT_ID(선택, act_ 포함)
// DB 쓰기는 요청한 관리자 본인의 로그인 토큰으로 한다 — 관리자만 통과하는 RLS 가 그대로 지켜진다(서버 비밀키 불필요).

export const config = { runtime: 'edge' }

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
const META_TOKEN = env.META_ACCESS_TOKEN || ''
const AD_ACCOUNT = env.META_AD_ACCOUNT_ID || 'act_1143093140955205'
const GRAPH = 'https://graph.facebook.com/v21.0'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

async function db(path: string, userToken: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${userToken}`,
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  })
}

/** 페이지를 따라가며 data 배열을 모두 모은다 (최대 20쪽) */
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

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
  const userToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!userToken) return json({ error: '로그인이 필요합니다.' }, 401)

  // 관리자 확인
  const adminRes = await db('rpc/is_admin', userToken, { method: 'POST', body: '{}' })
  if (!adminRes.ok || (await adminRes.json()) !== true) return json({ error: '관리자만 사용할 수 있습니다.' }, 403)

  if (!META_TOKEN) {
    return json({ error: '메타 연동 토큰이 아직 설정되지 않았습니다 (Vercel 환경변수 META_ACCESS_TOKEN).' }, 400)
  }

  let body: { action?: string; kind?: string; product_id?: number }
  try {
    body = await request.json()
  } catch {
    return json({ error: '잘못된 요청' }, 400)
  }

  try {
    if (body.action === 'campaigns') {
      const rows = await graphAll<{ id: string; name: string; effective_status: string }>(
        `${GRAPH}/${AD_ACCOUNT}/campaigns?fields=id,name,effective_status&limit=200&access_token=${encodeURIComponent(META_TOKEN)}`,
      )
      const campaigns = rows
        .map((c) => ({ id: c.id, name: c.name, status: c.effective_status }))
        .sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE'))
      return json({ campaigns })
    }

    if (body.action === 'sync') {
      const kind = body.kind === 'ebook' ? 'ebook' : body.kind === 'course' ? 'course' : null
      const productId = Number(body.product_id)
      if (!kind || !Number.isInteger(productId)) return json({ error: '상품 정보가 없습니다.' }, 400)

      const setRes = await db(`product_funnel_settings?kind=eq.${kind}&product_id=eq.${productId}&select=meta_campaign_ids`, userToken)
      const settings = (await setRes.json()) as { meta_campaign_ids?: string[] }[]
      const ids = (settings?.[0]?.meta_campaign_ids ?? []).filter((x) => /^\d+$/.test(x))
      if (!ids.length) return json({ error: '연결된 메타 캠페인이 없습니다.' }, 400)

      let days = 0
      for (const cid of ids) {
        const insights = await graphAll<{ date_start: string; spend: string; campaign_name?: string }>(
          `${GRAPH}/${cid}/insights?fields=spend,campaign_name&time_increment=1&date_preset=maximum&limit=500&access_token=${encodeURIComponent(META_TOKEN)}`,
        )
        const rows = insights
          .filter((r) => Number(r.spend) > 0)
          .map((r) => ({
            kind, product_id: productId, channel: 'meta', spend_date: r.date_start, amount: Number(r.spend),
            source: 'meta', external_id: cid, note: r.campaign_name ?? null,
          }))
        // 이 캠페인 분은 통째로 새 값으로 교체 (메타 쪽 지출이 사후 보정되는 경우 반영)
        const del = await db(`product_ad_spend?kind=eq.${kind}&product_id=eq.${productId}&source=eq.meta&external_id=eq.${cid}`, userToken, { method: 'DELETE' })
        if (!del.ok) throw new Error(`기존 기록 정리 실패 (HTTP ${del.status})`)
        if (rows.length) {
          const ins = await db('product_ad_spend', userToken, { method: 'POST', body: JSON.stringify(rows), headers: { prefer: 'return=minimal' } })
          if (!ins.ok) throw new Error(`저장 실패: ${(await ins.text()).slice(0, 200)}`)
        }
        days += rows.length
      }
      return json({ ok: true, campaigns: ids.length, days })
    }

    return json({ error: '알 수 없는 요청' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 502)
  }
}
