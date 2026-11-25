// 강의 플랜 옵션 (베이직·마스터·프리미엄 등) 공통 규칙
export type CoursePlanOption = {
  id: number
  name: string
  description: string | null
  original_price: number | null
  sale_price: number | null
  installment_months: number
  max_enrollments: number | null
  sold: number
}

export const planSoldOut = (p: CoursePlanOption) => (p.max_enrollments ?? 0) > 0 && p.sold >= (p.max_enrollments as number)

// 할인 기간(강의 설정)을 반영한 플랜 가격 — 서버(confirm-payment·purchase_with_points)와 같은 규칙
export const planPrice = (p: { original_price: number | null; sale_price: number | null }, discountActive: boolean) =>
  p.sale_price === 0 ? 0
    : discountActive && (p.sale_price ?? 0) > 0 ? (p.sale_price as number)
    : p.original_price ?? p.sale_price ?? 0
