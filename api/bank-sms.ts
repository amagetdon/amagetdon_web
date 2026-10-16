// 입금 문자 → 무통장 입금함 — POST /api/bank-sms  (대표님 안드로이드 폰의 'Incoming SMS to URL forwarder' 앱이 보냄)
//   비밀키: 헤더 x-sms-key 또는 본문 "key" — Vercel 환경변수 BANK_SMS_SECRET 와 같아야 함 (클로브용 BANK_IMPORT_SECRET 과 별개 — 폰 분실 시 이것만 교체)
//   본문(앱 기본 형식): { "from": "15778000", "text": "[Web발신]\n신한08/26 09:26\n...", "receivedStamp": 1792000000000 }
//     (from/sender, text/message, receivedStamp/received_at 아무 이름이나 받음)
//   → 신한 입금 문자만 읽어 입금함에 '미처리'로 추가. 출금·인증번호 등은 무시.
//     형식을 못 읽은 입금 문자는 버리지 않고 원문과 함께 미처리로 넣는다(관리자가 직접 확인).
//     같은 입금이 이미 있으면(클로브·첫 적재·같은 문자 재전송) 건너뛴다.

import { parseShinhanSms, isSameDeposit, loadNearby, sameSecret } from './_lib/bank-sms'

export const config = { runtime: 'edge' }

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || ''
const SMS_SECRET = env.BANK_SMS_SECRET || ''
const BANK_SENDERS = new Set(['15778000']) // 신한은행 (하이픈·공백·+82 등은 지우고 비교)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

async function sha(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

async function insert(row: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bank_deposits?on_conflict=external_id`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json',
      prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify([row]),
  })
  if (!res.ok) throw new Error(`저장 실패 (HTTP ${res.status}) ${(await res.text()).slice(0, 150)}`)
  return ((await res.json()) as unknown[]).length
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!SMS_SECRET || !SERVICE_KEY) return json({ error: '서버 설정이 아직 없습니다 (BANK_SMS_SECRET / SUPABASE_SERVICE_ROLE_KEY).' }, 500)
  let b: Record<string, unknown>
  try { b = await request.json() } catch { return json({ error: '잘못된 요청' }, 400) }
  // 비밀키: 헤더 x-sms-key 또는 (앱에 헤더 칸이 없을 때) 본문 "key"
  const key = request.headers.get('x-sms-key') || (typeof b.key === 'string' ? b.key : '')
  if (!sameSecret(key, SMS_SECRET)) return json({ error: 'forbidden' }, 403)
  const sender = String(b.from ?? b.sender ?? '').replace(/[^\d]/g, '').replace(/^82/, '0')
  const text = String(b.text ?? b.message ?? '').slice(0, 1000)
  const stamp = b.receivedStamp ?? b.received_at ?? b.sentStamp
  const receivedAt = typeof stamp === 'number' ? new Date(stamp) : stamp ? new Date(String(stamp)) : new Date()
  if (!text) return json({ error: 'text 가 없습니다.' }, 400)
  if (!BANK_SENDERS.has(sender)) return json({ ok: true, skipped: 'bank sender 아님' })

  const p = parseShinhanSms(text, Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt)
  try {
    if (p.kind === 'ignored') return json({ ok: true, skipped: p.reason })
    if (p.kind === 'failed') {
      // 못 읽은 입금 문자 — 금액을 짐작할 수 있으면 원문과 함께 미처리로 넣고, 금액도 못 찾으면(0원은 저장 불가) 422로 알린다
      const amountGuess = Number((text.match(/입금[^\d]*([\d,]+)/) || [])[1]?.replace(/,/g, '') || 0)
      if (amountGuess > 0) {
        const inserted = await insert({
          source: 'sms', external_id: `sms-raw|${await sha(text)}`, deposited_at: receivedAt.toISOString(),
          amount: amountGuess, depositor: null, raw_text: text, memo: `문자 읽기 실패: ${p.reason} — 원문 확인 필요`,
        })
        return json({ ok: true, parsed: false, reason: p.reason, inserted })
      }
      return json({ ok: false, parsed: false, reason: p.reason }, 422)
    }

    const t = new Date(p.deposited_at).getTime()
    const nearby = await loadNearby(SUPABASE_URL, SERVICE_KEY, new Date(t - 86400_000).toISOString(), new Date(t + 86400_000).toISOString(), [p.amount])
    if (nearby.some((e) => isSameDeposit(p, e))) return json({ ok: true, duplicate: true })

    const inserted = await insert({
      source: 'sms',
      external_id: `sms|${p.deposited_at}|${p.amount}|${(p.depositor ?? '').replace(/\s/g, '')}|${p.account_tail ?? ''}`,
      deposited_at: p.deposited_at, amount: p.amount, depositor: p.depositor,
      memo: p.account_tail ? `신한 …${p.account_tail}` : null, raw_text: text,
    })
    return json({ ok: true, parsed: true, inserted, duplicate: inserted === 0 })
  } catch (e) {
    return json({ error: (e as Error).message }, 502)
  }
}
