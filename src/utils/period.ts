// 구독 기간 계산 헬퍼 — 달력 월 단위 (KST 기준)
// 서버(엣지 함수 _shared/period.ts)와 동일한 규칙을 클라이언트(포인트 결제)에서도 쓴다.
// 사용자 브라우저 타임존과 무관하게 KST 벽시계 기준으로 월을 더하고, 월말은 클램프한다.
// (1/31 +1개월 → 2/28, 이후 갱신은 만료일 기준으로 이어진다)

const KST_OFFSET_MS = 9 * 3600_000

export function addMonthsKst(date: Date, months: number): Date {
  const d = new Date(date.getTime() + KST_OFFSET_MS)
  const day = d.getUTCDate()
  d.setUTCMonth(d.getUTCMonth() + months)
  if (d.getUTCDate() < day) d.setUTCDate(0) // 월말 넘침 → 대상 달의 마지막 날로
  return new Date(d.getTime() - KST_OFFSET_MS)
}
