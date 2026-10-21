import { supabase } from '../lib/supabase'

// 카드(토스) 결제 대조·구매 금액 수정 (2026-10-21)
// 대조는 서버 함수(/api/toss-reconcile)가 토스에 결제를 조회(GET)만 해서 사이트 금액과 비교한다. 토스 비밀키는 브라우저로 오지 않는다.

export interface ReconcileRow {
  purchase_id: number
  user_id: string
  title: string | null
  purchased_at: string | null
  price: number
  payment_key_tail: string
  extra_linkpay: number
  extra_manual: number
  toss_status?: string | null
  toss_total?: number | null
  toss_balance?: number | null
  toss_canceled?: number
  toss_last_canceled_at?: string | null
  expected?: number | null
  diff?: number | null
  error?: string
}

export interface ReconcileResult {
  checked: number
  matched: number
  mismatched: number
  failed: number
  rows: ReconcileRow[]
}

export const reconcileService = {
  /** purchaseIds 가 없으면 사이트의 카드(토스) 결제 구매 전체(최대 500건) */
  async run(purchaseIds?: number[]): Promise<ReconcileResult> {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/toss-reconcile', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify(purchaseIds?.length ? { purchaseIds } : {}),
    })
    const body = (await res.json().catch(() => ({}))) as ReconcileResult & { error?: string }
    if (!res.ok || body.error) throw new Error(body.error || `대조에 실패했습니다 (${res.status})`)
    return body
  },

  /** 관리자: 구매 금액 수정(사유 필수, purchase_audit_logs 에 price_change 로 남음) */
  async setPrice(purchaseId: number, price: number, reason: string): Promise<{ changed: boolean }> {
    const { data, error } = await supabase.rpc('admin_set_purchase_price' as never, {
      p_purchase_id: purchaseId, p_price: price, p_reason: reason,
    } as never)
    if (error) throw error
    return { changed: !!(data as { changed?: boolean } | null)?.changed }
  },
}
