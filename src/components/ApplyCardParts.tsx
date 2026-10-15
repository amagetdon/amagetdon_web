import { remainingMs, timeParts, useNow } from '../lib/promoSettings'

// 신청 카드 부품 — 라이브 일시 / 가격 카드 / 선착순 마감 카운트다운 / 남은 자리 배지 (10/16, 대표님 레퍼런스 기준)

export type Accent = 'green' | 'blue'
export const ACCENT = {
  green: { bg: 'bg-[#2ED573]', hover: 'hover:bg-[#25B866]', text: 'text-[#16a34a]', shadow: 'shadow-[#2ED573]/30' },
  blue: { bg: 'bg-[#2563eb]', hover: 'hover:bg-[#1d4ed8]', text: 'text-[#2563eb]', shadow: 'shadow-[#2563eb]/30' },
} as const

function kstParts(iso: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'long', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  )
  const wd = { Sunday: '일요일', Monday: '월요일', Tuesday: '화요일', Wednesday: '수요일', Thursday: '목요일', Friday: '금요일', Saturday: '토요일' }[p.weekday as string] ?? ''
  const h = Number(p.hour), m = Number(p.minute)
  const time = `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시${m ? ` ${m}분` : ''}`
  return { month: p.month, day: p.day, weekday: wd, time }
}

/** [11월 | 16일] 달력 아이콘 + "11월 16일 월요일 / 오후 7시 30분 시작" */
export function ScheduleBlock({ startsAt }: { startsAt: string }) {
  const k = kstParts(startsAt)
  return (
    <div className="flex items-center gap-3.5 mt-5">
      <div className="w-[60px] shrink-0 rounded-xl overflow-hidden bg-white shadow-[0_1px_4px_rgba(0,0,0,0.12)] text-center">
        <div className="bg-[#ef4444] text-white text-[12px] font-bold py-1 leading-none">{k.month}월</div>
        <div className="text-[22px] font-extrabold text-gray-900 py-1.5 leading-none tabular-nums">{k.day}<span className="text-xs font-bold ml-0.5">일</span></div>
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-bold text-gray-900 m-0 leading-snug">{k.month}월 {k.day}일 {k.weekday}</p>
        <p className="text-sm text-gray-500 m-0 mt-0.5">{k.time} 시작</p>
      </div>
    </div>
  )
}

/** 테두리 가격 카드 — ✔ 무료 강의 / ~~정가~~ / 선착순 100% 할인 / 0 원 */
export function PriceCard({ accent, title, original, priceText, discountLabel, sub }: {
  accent: Accent; title: string; original: number | null; priceText: string; discountLabel?: string | null; sub?: string | null
}) {
  const a = ACCENT[accent]
  return (
    <div className="mt-5 rounded-2xl border border-gray-200 bg-white px-5 py-4">
      <p className={`m-0 flex items-center gap-1.5 text-sm font-bold ${a.text}`}>
        <i className="ti ti-circle-check-filled text-base" /> {title}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {original != null && original > 0 && (
            <p className="m-0 text-sm text-gray-400 line-through tabular-nums">{original.toLocaleString()}원</p>
          )}
          {discountLabel?.trim() && <p className="m-0 mt-0.5 text-sm font-bold text-[#ef4444]">{discountLabel}</p>}
        </div>
        <p className="m-0 text-[32px] leading-none font-extrabold text-gray-900 tabular-nums">{priceText}</p>
      </div>
      {sub && <p className="m-0 mt-1.5 text-xs text-gray-400 text-right">{sub}</p>}
    </div>
  )
}

/** 연회색 박스 + 검정 둥근 칸에 흰 숫자 — "선착순 마감까지 3일 22시간 41분" */
export function PromoCountdownBlock({ label, endAt, loopMinutes }: { label?: string | null; endAt: string | null | undefined; loopMinutes?: number | null }) {
  const now = useNow(true)
  const left = remainingMs(endAt, loopMinutes, now)
  if (left <= 0) return null
  return (
    <div className="mt-5 rounded-2xl bg-gray-100 px-4 py-3.5 text-center">
      <p className="m-0 text-[13px] font-medium text-gray-500">{label || '선착순 마감까지'}</p>
      <p className="m-0 mt-2 inline-flex items-baseline gap-1.5 rounded-full bg-gray-900 px-5 py-2 text-white tabular-nums">
        {timeParts(left).map((p) => (
          <span key={p.u} className="inline-flex items-baseline">
            <span className="text-lg font-extrabold">{p.v}</span><span className="text-xs font-bold ml-0.5 text-white/80">{p.u}</span>
          </span>
        ))}
      </p>
    </div>
  )
}

/** 신청 버튼 안의 [남은자리 12개] 흰 배지 */
export function SeatsBadge({ seats, accent = 'green' }: { seats: number; accent?: Accent }) {
  return (
    <span className={`ml-2 inline-block align-middle bg-white ${ACCENT[accent].text} text-[13px] font-extrabold rounded-full px-2.5 py-0.5 tabular-nums`}>
      남은자리 {seats.toLocaleString()}개
    </span>
  )
}
