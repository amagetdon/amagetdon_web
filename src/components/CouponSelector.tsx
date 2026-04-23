import type { Coupon } from '../types'

interface CouponSelectorProps {
  coupons: Coupon[]
  selected: Coupon | null
  onSelect: (coupon: Coupon | null) => void
  price: number
}

function getDaysLeft(expiresAt: string | null): string {
  if (!expiresAt) return '무제한'
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return '만료'
  const days = Math.ceil(diff / 86400000)
  if (days <= 1) return '오늘 만료'
  if (days <= 7) return `D-${days}`
  if (days <= 30) return `D-${days}`
  return `~${new Date(expiresAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`
}

export default function CouponSelector({ coupons, selected, onSelect, price }: CouponSelectorProps) {
  if (coupons.length === 0 || price <= 0) return null

  return (
    <div className="pt-2 pb-1">
      <p className="text-xs font-bold text-gray-500 mb-2">쿠폰 적용</p>
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {/* 선택 안 함 */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`w-full text-left rounded-xl border-2 p-3 transition-all cursor-pointer ${
            !selected ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              !selected ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
            }`}>
              {!selected && <i className="ti ti-check text-white text-[10px]" />}
            </div>
            <span className="text-sm text-gray-500">쿠폰 사용 안 함</span>
          </div>
        </button>

        {coupons.map((c) => {
          const isSelected = selected?.id === c.id
          const meetsMin = price >= (c.min_purchase || 0)
          const discount = c.discount_type === 'percent'
            ? Math.min(Math.floor(price * c.discount_value / 100), c.max_discount || Infinity, price)
            : Math.min(c.discount_value, price)
          const daysLeft = getDaysLeft(c.expires_at)

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : (meetsMin ? c : null))}
              disabled={!meetsMin}
              className={`w-full text-left rounded-xl border-2 p-3 transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#2ED573] bg-[#2ED573]/5'
                  : meetsMin
                  ? 'border-gray-100 bg-white hover:border-gray-300'
                  : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* 체크 */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'border-[#2ED573] bg-[#2ED573]' : 'border-gray-300'
                  }`}>
                    {isSelected && <i className="ti ti-check text-white text-[10px]" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-900">
                        {c.discount_type === 'percent' ? `${c.discount_value}%` : `${c.discount_value.toLocaleString()}원`}
                      </span>
                      <span className="text-xs text-gray-400 truncate">{c.title.split('\n')[0]}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {c.min_purchase > 0 && (
                        <span className={`text-[10px] ${meetsMin ? 'text-gray-400' : 'text-red-400'}`}>
                          {c.min_purchase.toLocaleString()}P 이상
                        </span>
                      )}
                      {c.discount_type === 'percent' && c.max_discount && (
                        <span className="text-[10px] text-gray-400">최대 {c.max_discount.toLocaleString()}원</span>
                      )}
                      <span className={`text-[10px] ${daysLeft.includes('만료') || daysLeft.includes('오늘') ? 'text-red-400' : daysLeft === '무제한' ? 'text-gray-300' : 'text-gray-400'}`}>
                        {daysLeft}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 할인 금액 */}
                {meetsMin && (
                  <span className="text-sm font-bold text-[#2ED573] shrink-0 ml-2">
                    -{discount.toLocaleString()}P
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
