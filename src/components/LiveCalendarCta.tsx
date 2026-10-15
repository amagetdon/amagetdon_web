import { downloadIcs, googleCalendarUrl, liveLabel, type LiveEvent } from '../lib/liveCalendar'

// 라이브 예정 강의 — "📅 10월 23일(금) 오후 7:30 무료 라이브 시작" + 캘린더에 추가(구글 / 휴대폰 캘린더)
export default function LiveCalendarCta({ event, className = '' }: { event: LiveEvent; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#2ED573]/40 bg-[#2ED573]/5 px-4 py-3 ${className}`}>
      <p className="text-sm font-bold text-gray-900">📅 {liveLabel(event.startsAt)} 무료 라이브 시작</p>
      <p className="text-xs text-gray-500 mt-0.5">캘린더에 추가해 두면 잊지 않아요 (휴대폰 캘린더는 30분 전 알림).</p>
      <div className="flex gap-2 mt-2.5 flex-wrap">
        <a
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[120px] whitespace-nowrap inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm font-bold text-gray-800 no-underline hover:bg-gray-50"
        >
          <i className="ti ti-brand-google" /> 구글 캘린더
        </a>
        <button
          type="button"
          onClick={() => downloadIcs(event)}
          className="flex-1 min-w-[120px] whitespace-nowrap inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#2ED573] border-none text-sm font-bold text-white cursor-pointer hover:bg-[#25B866]"
        >
          <i className="ti ti-calendar-plus" /> 휴대폰 캘린더
        </button>
      </div>
    </div>
  )
}
