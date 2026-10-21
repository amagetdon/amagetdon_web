// 카드(토스) 결제 대조 — POST /api/toss-reconcile { purchaseIds?: number[] }
//   사이트 구매 금액(purchases.price)을 토스에 남은 금액(balanceAmount)과 맞춰 본다. 토스 상점관리자에서 한 부분취소는
//   사이트에 알려 주는 통로가 없어 금액이 그대로 남는다(10/20 구매 1887: 599만 결제 − 100만 부분취소인데 599만으로 남음).
//   · 관리자 로그인 토큰이 있어야 하고(is_admin), DB 는 그 관리자 권한으로 읽는다.
//   · 토스 API 는 결제 조회(GET)만 한다. 취소 같은 쓰기 호출은 하지 않는다.
//   · 토스 비밀키는 이 서버 함수 안에서만 쓰고 응답에 넣지 않는다. 응답에는 회원 이름·연락처도 넣지 않는다.
//   맞아야 할 금액 = 토스 잔액 + 같은 구매에 더해진 링크페이·무통장 금액(금액 더하기로 합산된 것)

export const config = { runtime: 'edge' }

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
const MAX = 500
const CONCURRENCY = 6

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

async function db(path: string, userToken: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${userToken}`, 'content-type': 'application/json', ...(init?.headers || {}) },
  })
}
async function rows<T>(path: string, userToken: string): Promise<T[]> {
  const res = await db(path, userToken)
  if (!res.ok) throw new Error(`조회 실패: ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T[]
}

interface PurchaseRow {
  id: number
  user_id: string
  title: string | null
  price: number
  payment_key: string
  purchased_at: string | null
  board_instructor_id: number | null
}
interface TossPayment {
  status?: string
  totalAmount?: number
  balanceAmount?: number
  cancels?: { cancelAmount?: number; canceledAt?: string }[] | null
}

async function tossGet(paymentKey: string, keys: string[]): Promise<{ ok: true; p: TossPayment } | { ok: false; error: string }> {
  let last = '조회 실패'
  for (const key of keys) {
    try {
      const res = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, {
        method: 'GET',
        headers: { Authorization: `Basic ${btoa(`${key}:`)}` },
      })
      if (res.ok) return { ok: true, p: (await res.json()) as TossPayment }
      const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string }
      last = body.code || `HTTP ${res.status}`
    } catch (e) {
      last = e instanceof Error ? e.message : String(e)
    }
  }
  return { ok: false, error: last }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
  const userToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!userToken) return json({ error: '로그인이 필요합니다.' }, 401)
  const adminRes = await db('rpc/is_admin', userToken, { method: 'POST', body: '{}' })
  if (!adminRes.ok || (await adminRes.json()) !== true) return json({ error: '관리자만 사용할 수 있습니다.' }, 403)

  let body: { purchaseIds?: unknown }
  try { body = await request.json() } catch { body = {} }
  const ids = Array.isArray(body.purchaseIds)
    ? body.purchaseIds.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, MAX)
    : []

  try {
    // 비밀키 — 관리자 권한으로만 읽히는 줄(10/20 공개 읽기에서 제외)
    const settings = await rows<{ value: Record<string, string> }>('site_settings?select=value&key=eq.toss_payments', userToken)
    const s = settings[0]?.value ?? {}
    const secretKey = s.secretKey || ''
    const billingSecretKey = s.billingSecretKey || ''
    if (!secretKey && !billingSecretKey) return json({ error: '토스 결제 설정(시크릿 키)이 없습니다.' }, 400)

    const filter = ids.length ? `&id=in.(${ids.join(',')})` : ''
    const purchases = await rows<PurchaseRow>(
      `purchases?select=id,user_id,title,price,payment_key,purchased_at,board_instructor_id&payment_method=eq.toss&payment_key=not.is.null${filter}&order=purchased_at.desc&limit=${MAX}`,
      userToken,
    )
    if (purchases.length === 0) return json({ checked: 0, matched: 0, mismatched: 0, failed: 0, rows: [] })

    // 같은 구매에 더해진 링크페이·무통장(금액 더하기) 합계
    const idList = purchases.map((p) => p.id).join(',')
    const [linkpays, manuals] = await Promise.all([
      rows<{ purchase_id: number; amount: number | null }>(`linkpay_payments?select=purchase_id,amount&granted=eq.true&purchase_id=in.(${idList})`, userToken),
      rows<{ purchase_id: number; amount: number; mode: string | null }>(`manual_payments?select=purchase_id,amount,mode&purchase_id=in.(${idList})`, userToken).catch(() => []),
    ])
    const sum = (list: { purchase_id: number; amount: number | null }[]) => {
      const m = new Map<number, number>()
      for (const r of list) m.set(r.purchase_id, (m.get(r.purchase_id) ?? 0) + (r.amount ?? 0))
      return m
    }
    const linkpayBy = sum(linkpays)
    const manualBy = sum(manuals.filter((r) => r.mode === 'top_up'))

    const out: Record<string, unknown>[] = new Array(purchases.length)
    let cursor = 0
    const worker = async () => {
      while (cursor < purchases.length) {
        const i = cursor++
        const p = purchases[i]
        // 뉴스레터 구독(빌링) 결제는 빌링 키로 승인됐다 — 그 키 먼저, 안 되면 다른 키로 한 번 더
        const keys = (p.board_instructor_id ? [billingSecretKey, secretKey] : [secretKey, billingSecretKey]).filter(Boolean)
        const t = await tossGet(p.payment_key, keys)
        const extraLinkpay = linkpayBy.get(p.id) ?? 0
        const extraManual = manualBy.get(p.id) ?? 0
        const base = {
          purchase_id: p.id,
          user_id: p.user_id,
          title: p.title,
          purchased_at: p.purchased_at,
          price: p.price,
          payment_key_tail: p.payment_key.slice(-6),
          extra_linkpay: extraLinkpay,
          extra_manual: extraManual,
        }
        if (!t.ok) { out[i] = { ...base, error: t.error }; continue }
        const total = t.p.totalAmount ?? null
        const balance = t.p.balanceAmount ?? (t.p.status === 'CANCELED' ? 0 : total)
        const canceled = (t.p.cancels ?? []).reduce((a, c) => a + (c.cancelAmount ?? 0), 0)
        const lastCanceledAt = (t.p.cancels ?? []).map((c) => c.canceledAt).filter(Boolean).sort().at(-1) ?? null
        const expected = balance == null ? null : balance + extraLinkpay + extraManual
        out[i] = {
          ...base,
          toss_status: t.p.status ?? null,
          toss_total: total,
          toss_balance: balance,
          toss_canceled: canceled,
          toss_last_canceled_at: lastCanceledAt,
          expected,
          diff: expected == null ? null : p.price - expected,
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, purchases.length) }, worker))

    const failed = out.filter((r) => r.error).length
    const mismatched = out.filter((r) => !r.error && r.diff !== 0).length
    return json({ checked: out.length, matched: out.length - failed - mismatched, mismatched, failed, rows: out })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '대조에 실패했습니다.' }, 500)
  }
}
