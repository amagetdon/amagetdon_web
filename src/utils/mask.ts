// 개인정보(이메일·전화번호) 마스킹 유틸.
// 후기 저장 시 원본 PII 를 그대로 DB 에 넣지 않고, 진위 확인용으로 일부만 남긴다.

/** 문자열 앞 2글자만 남기고 나머지를 * 로 가린다. */
function maskPartial(text: string): string {
  if (text.length <= 2) return '*'.repeat(text.length)
  return text.slice(0, 2) + '*'.repeat(text.length - 2)
}

/**
 * 이메일 마스킹 — 로컬파트 앞 1~2글자만 남기고 가린다. 도메인은 그대로.
 * 예) thswndud0237@hanmail.net → th***@hanmail.net
 */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return ''
  const t = value.trim()
  if (!t) return ''
  const at = t.indexOf('@')
  if (at < 1) return maskPartial(t)
  const local = t.slice(0, at)
  const domain = t.slice(at)
  const keep = local.length <= 2 ? 1 : 2
  return local.slice(0, keep) + '***' + domain
}

/**
 * 전화번호 마스킹 — 앞 3자리·뒤 4자리만 남기고 가운데를 가린다.
 * 예) 01025991115 → 010****1115
 */
export function maskPhone(value: string | null | undefined): string {
  if (!value) return ''
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 4) return '*'.repeat(digits.length)
  const head = digits.slice(0, 3)
  const tail = digits.slice(-4)
  const midLen = Math.max(1, digits.length - head.length - tail.length)
  return head + '*'.repeat(midLen) + tail
}
