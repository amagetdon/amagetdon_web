// 구독 기간 계산 헬퍼 — 달력 월 단위 (KST 기준)
//
// 서버(Deno)는 UTC 로 돌기 때문에 단순히 UTC 필드로 월을 더하면 KST 벽시계와
// 어긋나는 날이 생긴다 (예: KST 3/1 새벽 = UTC 2/28 → UTC 기준 +1개월 = 3/28).
// 타임스탬프를 +9h 밀어 KST 벽시계를 UTC 필드로 재현한 뒤 월을 더하고 되돌린다.
// 월말은 클램프: 1/31 +1개월 → 2/28(윤년 2/29), 이후 갱신은 만료일 기준으로 이어진다.

const KST_OFFSET_MS = 9 * 3600_000

export function addMonthsKst(date: Date, months: number): Date {
  const d = new Date(date.getTime() + KST_OFFSET_MS)
  const day = d.getUTCDate()
  d.setUTCMonth(d.getUTCMonth() + months)
  if (d.getUTCDate() < day) d.setUTCDate(0) // 월말 넘침 → 대상 달의 마지막 날로
  return new Date(d.getTime() - KST_OFFSET_MS)
}
