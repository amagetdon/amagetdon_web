// 마감 상태 유틸. 주어진 일시가 현재 시각보다 과거면 '마감'으로 판단.
export function isClosedAt(deadline: string | null | undefined): boolean {
  if (!deadline) return false
  const t = new Date(deadline).getTime()
  if (isNaN(t)) return false
  return t <= Date.now()
}

export const isCourseClosed = isClosedAt
export const isEbookClosed = isClosedAt
