import { Link } from 'react-router-dom'
import { htmlToPlainText } from '../utils/richText'
import type { BoardInstructor } from '../types'

// 뉴스레터(/board) 페이지들이 공유하는 조각 — 강사 카드, 아바타, 배지, 가격 라벨.

// 멤버십 상품 가격을 "월 99,000원" 식으로. 30일=월, 365일=연, 그 외 N일, 무기한은 가격만.
export function membershipPriceLabel(price: number | null, durationDays: number | null): string | null {
  if (!price) return null
  const p = `${price.toLocaleString()}원`
  if (durationDays === 30) return `월 ${p}`
  if (durationDays === 365) return `연 ${p}`
  if (durationDays) return `${durationDays}일 ${p}`
  return p
}

// 강사 이름 옆 인증마크 (lucide shield-check)
export function VerifiedBadge({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={`${className} text-[#2ED573] inline-block shrink-0`} role="img" aria-label="아마겟돈 검증 강사">
      <title>아마겟돈 검증 강사</title>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function InstructorAvatar({ src, name, className = 'w-9 h-9' }: { src: string | null; name: string; className?: string }) {
  return src ? (
    <img src={src} alt={name} className={`${className} rounded-full object-cover bg-gray-100 shrink-0`} />
  ) : (
    <div className={`${className} rounded-full bg-gray-100 flex items-center justify-center shrink-0`}>
      <i className="ti ti-user text-gray-400" />
    </div>
  )
}

// 글의 무료/유료 배지 (글 자체 속성 — 내가 구매했는지와 무관).
// 유료 글에 단건 판매가가 있으면 함께 표기 ("유료 · 33,000원"), 없으면 구독 전용.
export function PaidBadge({ paid, price }: { paid: boolean; price?: number }) {
  return paid ? (
    <span className="text-[11px] px-2 py-0.5 rounded-md border border-[#2ED573]/40 bg-[#2ED573]/10 text-[#1faf5c] font-medium whitespace-nowrap">
      유료{price && price > 0 ? ` · ${price.toLocaleString()}원` : ''}
    </span>
  ) : (
    <span className="text-[11px] px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-gray-500 font-medium whitespace-nowrap">무료</span>
  )
}

// 강사 카드 — /board 상단 리스트. 강사소개(검색) 카드 디자인을 그대로 쓰되 포인트만 그린.
// 클릭하면 강사 뉴스레터 페이지로.
export function InstructorCard({ ins }: { ins: BoardInstructor }) {
  const price = membershipPriceLabel(ins.sub_price, ins.sub_days)
  const chips = (ins.careers ?? []).filter((c) => c.trim())
  const bioText = htmlToPlainText(ins.bio)
  return (
    <Link
      to={`/board/instructor/${ins.id}`}
      className="no-underline flex items-start gap-6 max-sm:flex-col max-sm:items-center max-sm:gap-4 max-sm:text-center border border-gray-200 rounded-2xl p-6 max-sm:p-5 hover:shadow-md transition-shadow bg-white"
    >
      <div className="w-40 h-40 max-sm:w-24 max-sm:h-24 rounded-full bg-gray-200 shrink-0 overflow-hidden self-center">
        {ins.image_url ? (
          <img src={ins.image_url} alt={ins.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><i className="ti ti-user text-gray-400 text-4xl" /></div>
        )}
      </div>
      <div className="min-w-0 flex-1 max-sm:w-full">
        <div className="flex items-center gap-2 mb-1 max-sm:justify-center">
          <p className="text-lg max-sm:text-base font-bold text-gray-900 inline-flex items-center gap-1.5">{ins.name} <VerifiedBadge /></p>
          {ins.title && <span className="text-sm text-gray-400">{ins.title}</span>}
        </div>
        {ins.headline && <p className="text-sm text-gray-600 mb-2">{ins.headline}</p>}
        {bioText && (
          <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed mb-2 whitespace-pre-line">{bioText}</p>
        )}
        {chips.length > 0 && (
          // 칩 20px + gap 6px → 3줄(72px)까지만 노출
          <div className="flex flex-wrap gap-1.5 max-sm:justify-center max-h-[72px] overflow-hidden">
            {chips.map((c, idx) => (
              <span key={idx} className="inline-block max-w-full truncate text-xs bg-[#2ED573]/10 text-[#1faf5c] px-2 py-0.5 rounded-full" title={c}>{c}</span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-gray-400 max-sm:justify-center">
          <span className="inline-flex items-center gap-1"><i className="ti ti-news text-sm" /> 칼럼 {ins.post_count}</span>
          <span className="inline-flex items-center gap-1"><i className="ti ti-users text-sm" /> 구독자 {ins.subscriber_count.toLocaleString()}명</span>
          {price && <span className="font-bold text-[#1faf5c]">{price}</span>}
          {ins.is_subscribed && (
            <span className="font-bold text-[#1faf5c] inline-flex items-center gap-0.5"><i className="ti ti-circle-check text-sm" /> 구독 중</span>
          )}
        </div>
      </div>
    </Link>
  )
}
