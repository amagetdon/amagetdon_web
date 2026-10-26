// 카드(토스) 결제 부분 환불 — POST /api/toss-partial-cancel
//   { purchaseId, preview: true }                         → 토스 조회값(결제 금액·취소된 금액·남은 금액)
//   { purchaseId, cancelAmount, reason, idempotencyKey }  → 토스 부분취소 + 사이트 구매 금액 반영
//   관리자 로그인 토큰이 있어야 하고(is_admin), DB 는 그 관리자 권한으로 읽고 쓴다. 처리 내용은 api/_lib/partial-cancel.ts
import { isAdmin, partialCancel, preview, type PartialCancelDeps } from './_lib/partial-cancel'

export const config = { runtime: 'edge' }

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
  const userToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!userToken) return json({ error: '로그인이 필요합니다.' }, 401)

  const deps: PartialCancelDeps = {
    db: (path, init) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${userToken}`, 'content-type': 'application/json', ...(init?.headers || {}) },
    }),
    toss: (path, key, init) => fetch(`https://api.tosspayments.com${path}`, {
      ...init,
      headers: { Authorization: `Basic ${btoa(`${key}:`)}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    }),
  }
  if (!(await isAdmin(deps))) return json({ error: '관리자만 사용할 수 있습니다.' }, 403)

  let body: { purchaseId?: unknown; preview?: unknown; cancelAmount?: unknown; reason?: unknown; idempotencyKey?: unknown }
  try { body = await request.json() } catch { return json({ error: '요청을 읽지 못했어요.' }, 400) }
  const purchaseId = Number(body.purchaseId)
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) return json({ error: '구매 번호가 필요해요.' }, 400)

  try {
    if (body.preview === true) {
      const r = await preview(deps, purchaseId)
      return r.ok ? json(r) : json({ error: r.error }, r.status)
    }
    const r = await partialCancel(deps, {
      purchaseId,
      cancelAmount: Number(body.cancelAmount),
      reason: String(body.reason ?? ''),
      idempotencyKey: String(body.idempotencyKey ?? ''),
    })
    return r.ok ? json(r) : json({ error: r.error }, r.status)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '부분 환불에 실패했어요.' }, 500)
  }
}
