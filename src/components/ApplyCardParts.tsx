import { formatLong, remainingMs, useNow, type PromoCountdown } from '../lib/promoSettings'

// 신청 카드 부품 — 라이브 일시 / 선착순 마감 카운트다운 / 남은 자리 배지 (10/16)

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

/** [10월 | 23일] 달력 아이콘 + "10월 23일 금요일 / 오후 7시 30분 시작" */
export function ScheduleBlock({ startsAt }: { startsAt: string }) {
  const k = kstParts(startsAt)
  return (
    <div className="flex items-center gap-3 mt-4">
      <div className="w-14 shrink-0 rounded-lg overflow-hidden border border-gray-200 text-center bg-white">
        <div className="bg-[#ef4444] text-white text-[11px] font-bold py-0.5">{k.month}월</div>
        <div className="text-lg font-extrabold text-gray-900 py-1 tabular-nums">{k.day}일</div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900 m-0">{k.month}월 {k.day}일 {k.weekday}</p>
        <p className="text-sm text-gray-500 m-0 mt-0.5">{k.time} 시작</p>
      </div>
    </div>
  )
}

/** "선착순 마감까지 3일 22시간 41분 29초" — 반복 주기가 있으면 0이 되면 다시 시작 */
export function PromoCountdownBlock({ countdown }: { countdown: PromoCountdown }) {
  const now = useNow(true)
  const left = remainingMs(countdown.end_at, countdown.loop_minutes, now)
  if (left <= 0) return null
  return (
    <div className="text-center mt-6">
      <p className="text-sm text-gray-600 m-0">{countdown.label || '선착순 마감까지'}</p>
      <p className="text-xl font-bold mt-1 text-[#ef4444] tabular-nums m-0">{formatLong(left)}</p>
    </div>
  )
}

/** 신청 버튼 안의 [남은자리 12개] 배지 */
export function SeatsBadge({ seats }: { seats: number }) {
  return (
    <span className="ml-2 inline-block align-middle bg-white/95 text-[#ef4444] text-xs font-extrabold rounded-md px-2 py-0.5">
      남은자리 {seats.toLocaleString()}개
    </span>
  )
}
