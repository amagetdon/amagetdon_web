// 카드(토스) 결제 부분 환불 — 핵심 처리(서버 함수 api/toss-partial-cancel.ts 가 부름)
//   1) 관리자 확인 → 2) 구매 확인(토스 카드 결제만, 링크페이·무통장·빌링 제외) → 3) 토스 조회로 남은 금액 확인
//   4) 토스 부분취소(cancelAmount, Idempotency-Key 로 같은 요청 두 번 막음) → 5) 사이트 구매 금액을 토스 남은 금액으로 반영
//      (admin_set_purchase_price — 사유·전후 금액이 purchase_audit_logs 에 남는다. 수강권·기간은 그대로)
//   토스는 성공했는데 사이트 반영이 실패하면 site_updated:false 로 알려 화면이 경고하고 '결제 대조 > 맞추기'로 고치게 한다.
//   토스 비밀키는 이 함수 안에서만 쓰고 응답에 넣지 않는다. 시험은 deps 를 바꿔 끼워 실제 결제 없이 한다.

export interface PartialCancelDeps {
  /** Supabase REST(관리자 토큰으로) */
  db: (path: string, init?: RequestInit) => Promise<Response>
  /** 토스 API */
  toss: (path: string, key: string, init?: RequestInit) => Promise<Response>
}

export interface TossPayment {
  status?: string
  totalAmount?: number
  balanceAmount?: number
  cancels?: { cancelAmount?: number; canceledAt?: string }[] | null
}

interface PurchaseRow {
  id: number
  title: string | null
  price: number
  payment_method: string | null
  payment_key: string | null
  board_instructor_id: number | null
}

export type PreviewResult =
  | { ok: true; purchase_id: number; title: string | null; site_price: number; toss_status: string | null; toss_total: number | null; toss_canceled: number; toss_balance: number; extra: number }
  | { ok: false; status: number; error: string }

export type CancelResult =
  | { ok: true; purchase_id: number; refunded: number; toss_balance: number; site_price_before: number; site_price: number | null; site_updated: boolean; site_error?: string }
  | { ok: false; status: number; error: string }

async function json<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T
}

export async function isAdmin(deps: PartialCancelDeps): Promise<boolean> {
  const res = await deps.db('rpc/is_admin', { method: 'POST', body: '{}' })
  return res.ok && (await res.json()) === true
}

async function loadKeys(deps: PartialCancelDeps): Promise<{ secretKey: string; billingSecretKey: string }> {
  const res = await deps.db('site_settings?select=value&key=eq.toss_payments')
  const rows = res.ok ? await json<{ value: Record<string, string> }[]>(res) : []
  const v = rows[0]?.value ?? {}
  return { secretKey: v.secretKey || '', billingSecretKey: v.billingSecretKey || '' }
}

async function loadPurchase(deps: PartialCancelDeps, purchaseId: number): Promise<PurchaseRow | null> {
  const res = await deps.db(`purchases?select=id,title,price,payment_method,payment_key,board_instructor_id&id=eq.${purchaseId}`)
  if (!res.ok) return null
  return (await json<PurchaseRow[]>(res))[0] ?? null
}

/** 같은 구매에 더해진 링크페이·무통장 금액(결제 대조와 같은 기준) — 사이트 금액 = 토스 남은 금액 + 이 합계 */
async function extraAmount(deps: PartialCancelDeps, purchaseId: number): Promise<number> {
  const [lp, mp] = await Promise.all([
    deps.db(`linkpay_payments?select=amount&granted=eq.true&purchase_id=eq.${purchaseId}`),
    deps.db(`manual_payments?select=amount,mode&purchase_id=eq.${purchaseId}`),
  ])
  const a = lp.ok ? await json<{ amount: number | null }[]>(lp) : []
  const b = mp.ok ? await json<{ amount: number; mode: string | null }[]>(mp) : []
  return a.reduce((s, r) => s + (r.amount ?? 0), 0) + b.filter((r) => r.mode === 'top_up').reduce((s, r) => s + (r.amount ?? 0), 0)
}

/** 토스 결제 조회 — 키 순서대로(빌링 건은 빌링 키 먼저) 시도해 처음 성공한 키를 돌려준다 */
async function tossGet(deps: PartialCancelDeps, paymentKey: string, keys: string[]): Promise<{ ok: true; p: TossPayment; key: string } | { ok: false; error: string }> {
  let last = '토스 조회 실패'
  for (const key of keys) {
    try {
      const res = await deps.toss(`/v1/payments/${encodeURIComponent(paymentKey)}`, key, { method: 'GET' })
      if (res.ok) return { ok: true, p: await json<TossPayment>(res), key }
      const b = await json<{ code?: string; message?: string }>(res)
      last = b.message || b.code || `HTTP ${res.status}`
    } catch (e) {
      last = e instanceof Error ? e.message : String(e)
    }
  }
  return { ok: false, error: last }
}

function balanceOf(p: TossPayment): number {
  return p.balanceAmount ?? (p.status === 'CANCELED' ? 0 : p.totalAmount ?? 0)
}

/** 부분 환불할 수 있는 구매인지 + 토스 조회값 */
async function prepare(deps: PartialCancelDeps, purchaseId: number) {
  const purchase = await loadPurchase(deps, purchaseId)
  if (!purchase) return { ok: false as const, status: 404, error: '구매를 찾을 수 없습니다.' }
  if (purchase.payment_method !== 'toss' || !purchase.payment_key) {
    return { ok: false as const, status: 400, error: '토스 카드 결제 건만 부분 환불할 수 있어요(링크페이·무통장은 해당 경로에서 환불).' }
  }
  if (purchase.board_instructor_id) {
    return { ok: false as const, status: 400, error: '뉴스레터 정기결제(빌링) 건은 부분 환불을 지원하지 않아요.' }
  }
  const { secretKey, billingSecretKey } = await loadKeys(deps)
  const keys = [secretKey, billingSecretKey].filter(Boolean)
  if (!keys.length) return { ok: false as const, status: 500, error: '토스 결제 설정(시크릿 키)이 없습니다.' }
  const t = await tossGet(deps, purchase.payment_key, keys)
  if (!t.ok) return { ok: false as const, status: 502, error: `토스 조회에 실패했어요: ${t.error}` }
  return { ok: true as const, purchase, toss: t.p, key: t.key }
}

export async function preview(deps: PartialCancelDeps, purchaseId: number): Promise<PreviewResult> {
  const pr = await prepare(deps, purchaseId)
  if (!pr.ok) return pr
  const canceled = (pr.toss.cancels ?? []).reduce((a, c) => a + (c.cancelAmount ?? 0), 0)
  return {
    ok: true,
    purchase_id: pr.purchase.id,
    title: pr.purchase.title,
    site_price: pr.purchase.price,
    toss_status: pr.toss.status ?? null,
    toss_total: pr.toss.totalAmount ?? null,
    toss_canceled: canceled,
    toss_balance: balanceOf(pr.toss),
    extra: await extraAmount(deps, purchaseId),
  }
}

export async function partialCancel(
  deps: PartialCancelDeps,
  input: { purchaseId: number; cancelAmount: number; reason: string; idempotencyKey: string },
): Promise<CancelResult> {
  const reason = (input.reason ?? '').trim()
  const amount = Math.floor(Number(input.cancelAmount))
  if (!reason) return { ok: false, status: 400, error: '사유를 입력해 주세요.' }
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, status: 400, error: '환불 금액을 1원 이상으로 입력해 주세요.' }
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(input.idempotencyKey ?? '')) return { ok: false, status: 400, error: '요청 번호가 올바르지 않아요. 창을 다시 열어 주세요.' }

  const pr = await prepare(deps, input.purchaseId)
  if (!pr.ok) return pr
  if (pr.toss.status !== 'DONE' && pr.toss.status !== 'PARTIAL_CANCELED') {
    return { ok: false, status: 400, error: `토스 결제 상태가 '${pr.toss.status ?? '알 수 없음'}'이라 부분 환불할 수 없어요.` }
  }
  const balance = balanceOf(pr.toss)
  if (amount > balance) return { ok: false, status: 400, error: `남은 금액(${balance.toLocaleString()}원)보다 많이 환불할 수 없어요.` }

  // 토스 부분취소 — 조회에 성공한 키(그 결제를 승인한 상점 키)로. Idempotency-Key 로 같은 요청이 두 번 들어가도 한 번만 취소된다.
  const res = await deps.toss(`/v1/payments/${encodeURIComponent(pr.purchase.payment_key!)}/cancel`, pr.key, {
    method: 'POST',
    headers: { 'Idempotency-Key': input.idempotencyKey },
    body: JSON.stringify({ cancelReason: reason.slice(0, 200), cancelAmount: amount }),
  })
  const body = await json<TossPayment & { message?: string; code?: string }>(res)
  if (!res.ok) return { ok: false, status: 400, error: `토스 부분취소에 실패했어요: ${body.message || body.code || `HTTP ${res.status}`}` }

  // 사이트 금액 = 토스 남은 금액 + 같은 구매에 더해진 링크페이·무통장 금액
  const newBalance = balanceOf(body)
  const extra = await extraAmount(deps, input.purchaseId)
  const sitePrice = newBalance + extra
  const before = pr.purchase.price
  const rpc = await deps.db('rpc/admin_set_purchase_price', {
    method: 'POST',
    body: JSON.stringify({
      p_purchase_id: input.purchaseId,
      p_price: sitePrice,
      p_reason: `부분 환불 ${amount.toLocaleString()}원(토스 부분취소): ${reason}`.slice(0, 500),
    }),
  })
  if (!rpc.ok) {
    const e = await json<{ message?: string }>(rpc)
    return { ok: true, purchase_id: input.purchaseId, refunded: amount, toss_balance: newBalance, site_price_before: before, site_price: null, site_updated: false, site_error: e.message || `HTTP ${rpc.status}` }
  }
  return { ok: true, purchase_id: input.purchaseId, refunded: amount, toss_balance: newBalance, site_price_before: before, site_price: sitePrice, site_updated: true }
}
