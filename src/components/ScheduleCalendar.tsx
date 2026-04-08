import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSchedules } from '../hooks/useSchedules'
import type { ScheduleWithDetails } from '../types'

const DAYS = ['월', '화', '수', '목', '금', '토', '일']

interface ScheduleCalendarProps {
  title?: string
  linkTo?: string
  hideHeader?: boolean
  schedules?: ScheduleWithDetails[]
}

function ScheduleCalendar({ title = '다가올 강의 한눈에 보기', linkTo = '/academy/free', hideHeader = false, schedules: initialSchedules }: ScheduleCalendarProps) {
  const navigate = useNavigate()
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1)

  const isInitialMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth() + 1
  const { schedules: fetchedSchedules } = useSchedules(
    isInitialMonth ? 0 : currentYear,
    isInitialMonth ? 0 : currentMonth
  )
  const schedules = isInitialMonth && initialSchedules ? initialSchedules : fetchedSchedules

  const lectureDays = useMemo(() => {
    return schedules.map((s) => new Date(s.scheduled_at).getDate())
  }, [schedules])

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay()
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

  const calendarDays: number[] = []
  for (let i = 0; i < startOffset; i++) calendarDays.push(0)
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d)
  while (calendarDays.length % 7 !== 0) calendarDays.push(0)

  const isToday = (day: number) =>
    day > 0 && currentYear === today.getFullYear() && currentMonth === today.getMonth() + 1 && day === today.getDate()

  const hasLecture = (day: number) => day > 0 && lectureDays.includes(day)

  const handlePrevMonth = () => {
    if (currentMonth === 1) { setCurrentYear(currentYear - 1); setCurrentMonth(12) }
    else setCurrentMonth(currentMonth - 1)
  }

  const handleNextMonth = () => {
    if (currentMonth === 12) { setCurrentYear(currentYear + 1); setCurrentMonth(1) }
    else setCurrentMonth(currentMonth + 1)
  }

  const formatScheduleDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const month = d.getMonth() + 1
    const day = d.getDate()
    const weekday = weekdays[d.getDay()]
    const hours = d.getHours()
    const minutes = d.getMinutes()
    const ampm = hours >= 12 ? '오후' : '오전'
    const h = hours > 12 ? hours - 12 : hours
    return `${month}월 ${day}일(${weekday}) ${ampm} ${h}시${minutes > 0 ? ` ${minutes}분` : ''}`
  }

  return (
    <section className="w-full bg-white py-14 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        {!hideHeader && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <Link
              to={linkTo}
              className="flex items-center gap-2 px-5 py-2 border border-gray-300 rounded-full text-sm text-gray-600 bg-white cursor-pointer no-underline hover:bg-gray-50"
            >
              전체 보기 <span className="text-lg">→</span>
            </Link>
          </div>
        )}

        <div className="flex gap-0 max-md:flex-col border border-gray-200 rounded-2xl p-8 max-sm:p-5">
          <div className="w-[360px] max-md:w-full shrink-0">
            <div className="flex items-center justify-center gap-4 mb-5">
              <button onClick={handlePrevMonth} className="border-none bg-transparent cursor-pointer p-1" aria-label="이전 달">
                <i className="ti ti-chevron-left text-lg text-gray-400" />
              </button>
              <span className="text-base font-bold text-gray-900">
                {currentYear}. {String(currentMonth).padStart(2, '0')}
              </span>
              <button onClick={handleNextMonth} className="border-none bg-transparent cursor-pointer p-1" aria-label="다음 달">
                <i className="ti ti-chevron-right text-lg text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS.map((day) => (
                <div key={day} className="text-center text-xs text-gray-400 py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => (
                <div key={idx} className="flex items-center justify-center py-0.5">
                  {day > 0 && (
                    <span className={`w-10 h-9 flex items-center justify-center text-sm rounded ${
                      isToday(day)
                        ? 'bg-[#2ED573] text-black font-bold'
                        : hasLecture(day)
                          ? 'border-[1.5px] border-[#2ED573] text-gray-700'
                          : 'text-gray-700'
                    }`}>
                      {day}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-l border-gray-200 mx-8 max-md:border-l-0 max-md:border-t max-md:my-6 max-md:mx-0" />

          <div className="flex-1 flex flex-col gap-6">
            {schedules.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                이번 달 예정된 강의가 없습니다.
              </div>
            ) : (
              schedules.map((item) => (
                <div key={item.id} className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full shrink-0 overflow-hidden" />
                  <div className="flex-1">
                    <p className="text-xs text-[#2ED573] font-bold mb-1">{formatScheduleDate(item.scheduled_at)}</p>
                    <p className="text-sm font-bold text-gray-900 whitespace-pre-line leading-snug mb-1">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-400">{item.instructor?.name ? `${item.instructor.name} 강사` : ''}</p>
                  </div>
                  {item.course_id && (
                    <button
                      onClick={() => navigate(`/course/${item.course_id}`)}
                      className="shrink-0 px-4 py-2 bg-gray-900 text-white text-xs rounded-md cursor-pointer border-none"
                    >
                      강의 안내 &gt;
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ScheduleCalendar
