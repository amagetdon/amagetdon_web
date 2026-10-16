// 무통장 입금 올리기 — POST /api/bank-deposits-import  (매일 12시 예약 작업이 클로브에서 읽은 새 입금을 보냄)
//   헤더 x-import-key: Vercel 환경변수 BANK_IMPORT_SECRET 와 같아야 함
//   본문 { deposits: [{ external_id, deposited_at, amount, depositor?, memo?, balance? }] }  (한 번에 최대 500건)
//   → bank_deposits 에 '새 줄 추가'만 한다. 같은 external_id 는 무시(중복 방지). 읽기·수정·삭제 불가.
// 서버 전용 키(SUPABASE_SERVICE_ROLE_KEY)는 이 표 추가에만 쓴다.

import { isSameDeposit, loadNearby, sameSecret } from './_lib/bank-sms'

export const config = { runtime: 'edge' }

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || ''
const IMPORT_SECRET = env.BANK_IMPORT_SECRET || ''

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) || null : null)

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!IMPORT_SECRET || !SERVICE_KEY) return json({ error: '서버 설정이 아직 없습니다 (BANK_IMPORT_SECRET / SUPABASE_SERVICE_ROLE_KEY).' }, 500)
  if (!sameSecret(request.headers.get('x-import-key') || '', IMPORT_SECRET)) return json({ error: 'forbidden' }, 403)

  let body: { deposits?: unknown }
  try { body = await request.json() } catch { return json({ error: '잘못된 요청' }, 400) }
  const list = Array.isArray(body.deposits) ? body.deposits : null
  if (!list) return json({ error: 'deposits 배열이 필요합니다.' }, 400)
  if (list.length > 500) return json({ error: '한 번에 500건까지' }, 400)

  const rows: Record<string, unknown>[] = []
  const rejected: { index: number; reason: string }[] = []
  list.forEach((raw, index) => {
    const d = raw as Record<string, unknown>
    const externalId = clip(d.external_id, 200)
    const at = typeof d.deposited_at === 'string' ? new Date(d.deposited_at) : null
    const amount = Number(d.amount)
    if (!externalId) { rejected.push({ index, reason: 'external_id 없음' }); return }
    if (!at || Number.isNaN(at.getTime())) { rejected.push({ index, reason: 'deposited_at 형식' }); return }
    if (!Number.isInteger(amount) || amount <= 0) { rejected.push({ index, reason: 'amount 는 양의 정수' }); return }
    const balance = d.balance == null ? null : Number(d.balance)
    rows.push({
      source: 'clobe',
      external_id: externalId,
      deposited_at: at.toISOString(),
      amount,
      depositor: clip(d.depositor, 100),
      memo: clip(d.memo, 300),
      balance: Number.isFinite(balance as number) ? balance : null,
    })
  })

  // 이미 입금함에 같은 입금이 있으면 건너뛴다 — 입금 문자(sms, 분 단위)·첫 적재(seed, 날짜만)는 클로브 거래 ID가 없어서
  // 같은 금액·입금자 + 시각 2분 이내(첫 적재는 같은 날짜)면 같은 입금으로 본다 (api/_lib/bank-sms.ts)
  let seedSkipped = 0
  if (rows.length) {
    const times = rows.map((r) => new Date(String(r.deposited_at)).getTime())
    const nearby = await loadNearby(SUPABASE_URL, SERVICE_KEY, new Date(Math.min(...times) - 86400_000).toISOString(),
      new Date(Math.max(...times) + 86400_000).toISOString(), rows.map((r) => Number(r.amount)))
      .catch(() => [])
    const before = rows.length
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i] as { deposited_at: string; amount: number; depositor: string | null }
      if (nearby.some((e) => e.source !== 'clobe' && isSameDeposit(r, e))) rows.splice(i, 1)
    }
    seedSkipped = before - rows.length
  }

  let inserted = 0
  if (rows.length) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bank_deposits?on_conflict=external_id`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        authorization: `Bearer ${SERVICE_KEY}`,
        'content-type': 'application/json',
        prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify(rows),
    })
    if (!res.ok) return json({ error: `저장 실패 (HTTP ${res.status})`, detail: (await res.text()).slice(0, 200) }, 502)
    const saved = (await res.json()) as unknown[]
    inserted = saved.length
  }
  return json({ ok: true, received: list.length, inserted, duplicates: rows.length - inserted + seedSkipped, rejected })
}
