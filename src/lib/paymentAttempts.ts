import { supabase } from './supabase'

// 결제창 기록 — 결제창을 열 때(open)와 실패(fail)·취소(cancel)로 끝났을 때 payment_attempts 에 한 줄 남긴다.
// 결제 흐름에는 관여하지 않는다: 기다리지 않고, 실패해도 조용히 넘어간다(표가 아직 없어도 결제는 그대로 진행).
// 개인정보는 넣지 않는다(회원 번호는 서버가 로그인 정보에서 붙인다).

export type AttemptStage = 'open' | 'fail' | 'cancel'
export type AttemptKind = 'course' | 'ebook'

const LP_KEY = 'amag_lp_from'
const LP_MAX_AGE = 24 * 60 * 60 * 1000

/** 최근 24시간 안에 랜딩의 결제 버튼으로 이 상품에 왔으면 그 랜딩 이름 */
function landingFor(kind: AttemptKind, productId: number): string | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LP_KEY) || 'null') as { slug?: unknown; product?: unknown; at?: unknown } | null
    if (!raw || typeof raw.slug !== 'string' || typeof raw.at !== 'number') return null
    if (Date.now() - raw.at > LP_MAX_AGE || raw.product !== `${kind}/${productId}`) return null
    return raw.slug.slice(0, 60)
  } catch {
    return null
  }
}

/** 주문 번호(ORDER_날짜_난수_course_139) → 상품 */
export function productFromOrderId(orderId: string): { kind: AttemptKind; productId: number } | null {
  const m = orderId.match(/_(course|ebook)_(\d+)$/)
  return m ? { kind: m[1] as AttemptKind, productId: Number(m[2]) } : null
}

/** 토스 오류 코드·메시지로 취소인지 실패인지 가른다 */
export function stageFromError(code: string, message: string): AttemptStage {
  return /CANCEL/i.test(code) || message.includes('사용자가') || message.includes('취소') ? 'cancel' : 'fail'
}

export function logPaymentAttempt(stage: AttemptStage, p: { kind: AttemptKind; productId: number; orderId?: string; amount?: number; code?: string }): void {
  try {
    void supabase.rpc('log_payment_attempt' as never, {
      p_stage: stage,
      p_kind: p.kind,
      p_id: p.productId,
      p_order_id: p.orderId ?? null,
      p_amount: p.amount ?? null,
      p_code: p.code ? p.code.slice(0, 60) : null,
      p_landing: landingFor(p.kind, p.productId),
    } as never).then(() => {}, () => {})
  } catch {
    // 기록 실패는 결제에 영향을 주지 않는다
  }
}

/** 결제 요청이 던진 오류를 기록한다(결제창을 닫음 = cancel, 그 밖 = fail) */
export function logPaymentError(err: unknown, p: { kind: AttemptKind; productId: number; orderId?: string; amount?: number }): void {
  const code = typeof (err as { code?: unknown })?.code === 'string' ? (err as { code: string }).code : ''
  const message = err instanceof Error ? err.message : ''
  logPaymentAttempt(stageFromError(code, message), { ...p, code: code || 'UNKNOWN' })
}
