// 신한은행 입금 문자 읽기 + 입금 중복 판단 (무통장 입금함 — /api/bank-sms, /api/bank-deposits-import 공용)
//
// 신한 입금 문자 형식(대표님 폰 캡처 3건, 2026-10-16):
//   [Web발신]
//   신한08/26 09:26
//   100-***-946265
//   입금     299,000
//   서보민
// 연도가 없어서 받은 시각의 연도를 쓰고, 12월 문자를 1월에 받은 경우는 전년도로 본다.

export type SmsParse =
  | { kind: 'deposit'; deposited_at: string; amount: number; depositor: string | null; account_tail: string | null }
  | { kind: 'ignored'; reason: string }
  | { kind: 'failed'; reason: string }

const KST = 9 * 3600_000

export function parseShinhanSms(text: string, receivedAt: Date): SmsParse {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean)
  const body = lines.join('\n')
  if (/출금/.test(body) && !/입금\s+[\d,]+/.test(body)) return { kind: 'ignored', reason: '출금 문자' }
  const amountIdx = lines.findIndex((l) => /^입금\s+[\d,]+/.test(l))
  if (amountIdx < 0) {
    return /입금/.test(body) ? { kind: 'failed', reason: '입금 금액 줄을 찾지 못함' } : { kind: 'ignored', reason: '입금 문자 아님' }
  }
  const amount = Number(lines[amountIdx].replace(/^입금\s+/, '').replace(/[^\d]/g, ''))
  if (!Number.isInteger(amount) || amount <= 0) return { kind: 'failed', reason: '금액 형식' }

  const dm = body.match(/신한\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/)
  if (!dm) return { kind: 'failed', reason: '날짜·시각 줄을 찾지 못함' }
  const [mo, d, h, mi] = dm.slice(1).map(Number)
  const recvKst = new Date(receivedAt.getTime() + KST)
  let year = recvKst.getUTCFullYear()
  if (mo - (recvKst.getUTCMonth() + 1) > 6) year -= 1 // 12월 문자를 1월에 받음
  const deposited = new Date(Date.UTC(year, mo - 1, d, h, mi) - KST)
  if (Number.isNaN(deposited.getTime())) return { kind: 'failed', reason: '날짜 계산' }

  const acct = body.match(/\d{2,4}-\*+-(\d{4,8})/)
  const next = lines[amountIdx + 1]
  const depositor = next && !/잔액|^\d/.test(next) ? next.slice(0, 100) : null
  return { kind: 'deposit', deposited_at: deposited.toISOString(), amount, depositor, account_tail: acct ? acct[1] : null }
}

export const normName = (s: string | null | undefined) => String(s ?? '').replace(/\s/g, '')
export const kstDate = (iso: string) => new Date(new Date(iso).getTime() + KST).toISOString().slice(0, 10)

export interface ExistingDeposit { source: string; deposited_at: string; amount: number; depositor: string | null }

/**
 * 이미 입금함에 같은 입금이 있는지:
 *  - 같은 금액 + 같은 입금자 + 시각 차이 2분 이내(문자는 분 단위, 클로브는 초 단위)
 *  - 첫 적재(seed)는 시각이 없어(정오로 넣음) 같은 날짜면 같은 입금으로 본다
 */
export function isSameDeposit(a: { deposited_at: string; amount: number; depositor: string | null }, b: ExistingDeposit): boolean {
  if (a.amount !== b.amount || normName(a.depositor) !== normName(b.depositor)) return false
  if (b.source === 'seed') return kstDate(a.deposited_at) === kstDate(b.deposited_at)
  return Math.abs(new Date(a.deposited_at).getTime() - new Date(b.deposited_at).getTime()) <= 2 * 60_000
}

/** 서버 전용 키로 같은 금액·전후 하루 안의 기존 입금을 읽는다 */
export async function loadNearby(supabaseUrl: string, serviceKey: string, fromIso: string, toIso: string, amounts: number[]): Promise<ExistingDeposit[]> {
  if (!amounts.length) return []
  const url = `${supabaseUrl}/rest/v1/bank_deposits?select=source,deposited_at,amount,depositor`
    + `&deposited_at=gte.${encodeURIComponent(fromIso)}&deposited_at=lte.${encodeURIComponent(toIso)}`
    + `&amount=in.(${[...new Set(amounts)].join(',')})`
  const res = await fetch(url, { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } })
  if (!res.ok) throw new Error(`기존 입금 조회 실패 (HTTP ${res.status})`)
  return (await res.json()) as ExistingDeposit[]
}

// 길이가 달라도 시간 차이로 비밀키를 짐작하지 못하게 끝까지 비교
export function sameSecret(a: string, b: string) {
  if (!a || !b) return false
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}
