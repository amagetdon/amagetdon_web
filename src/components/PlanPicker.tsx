// 강의 플랜 고르기 (베이직·마스터·프리미엄 등) — 상세 페이지 가격 아래와 구매 확인 창에서 같이 쓴다.
import { planPrice, planSoldOut, type CoursePlanOption } from '../lib/coursePlans'

export default function PlanPicker({ plans, selectedId, onSelect, discountActive, compact = false }: {
  plans: CoursePlanOption[]
  selectedId: number | null
  onSelect: (id: number) => void
  discountActive: boolean
  compact?: boolean
}) {
  if (plans.length === 0) return null
  return (
    <div className={compact ? 'mt-2' : 'mt-5'}>
      <p className="text-xs font-bold text-gray-600 mb-2">플랜 선택</p>
      <div className="space-y-2" role="radiogroup" aria-label="플랜 선택">
        {plans.map((p) => {
          const soldOut = planSoldOut(p)
          const selected = p.id === selectedId
          const price = planPrice(p, discountActive)
          const months = Math.max(0, p.installment_months ?? 0)
          const showOriginal = p.original_price != null && p.original_price > price
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={soldOut}
              onClick={() => onSelect(p.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                soldOut ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                  : selected ? 'bg-[#2ED573]/5 border-[#2ED573] cursor-pointer'
                  : 'bg-white border-gray-200 hover:border-gray-300 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <i className={`ti ${selected ? 'ti-circle-check-filled text-[#2ED573]' : 'ti-circle text-gray-300'} text-lg shrink-0`} />
                  <span className="font-bold text-gray-900 truncate">{p.name}</span>
                  {soldOut && <span className="text-[11px] font-bold text-white bg-gray-500 rounded px-1.5 py-0.5 shrink-0">마감</span>}
                </span>
                <span className="text-right shrink-0">
                  {showOriginal && <span className="block text-[11px] text-gray-400 line-through">{(p.original_price as number).toLocaleString()}원</span>}
                  <span className="block text-sm font-extrabold text-gray-900">
                    {months > 0 ? `월 ${Math.round(price / months).toLocaleString()}원` : `${price.toLocaleString()}원`}
                  </span>
                </span>
              </div>
              {!compact && p.description && <p className="text-xs text-gray-500 mt-1.5 pl-7 whitespace-pre-line">{p.description}</p>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
