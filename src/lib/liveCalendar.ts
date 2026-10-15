// 라이브 강의 '캘린더에 추가' — 구글 캘린더 링크 + 휴대폰 기본 캘린더용 .ics 파일(아이폰·삼성)
// 일정 길이는 기본 2시간, .ics 에는 30분 전 알림을 넣는다(구글 캘린더 링크는 알림을 지정할 수 없어 사용자 기본 알림).

export interface LiveEvent {
  courseId: number
  title: string
  startsAt: string // ISO
  openchatUrl?: string | null
}

const SITE = 'https://amag-class.com'
const DURATION_MS = 2 * 60 * 60 * 1000

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

function details(ev: LiveEvent) {
  const lines = [
    `[아마겟돈 클래스] ${ev.title} 무료 라이브`,
    '',
    `▶ 라이브 입장·강의 보기: ${SITE}/my-classroom`,
    `▶ 강의 안내: ${SITE}/course/${ev.courseId}`,
  ]
  if (ev.openchatUrl) lines.push(`▶ 오픈채팅방: ${ev.openchatUrl}`)
  lines.push('', '시작 10분 전에 미리 입장해 주세요.')
  return lines.join('\n')
}

export function isUpcomingLive(startsAt: string | null | undefined): startsAt is string {
  return !!startsAt && new Date(startsAt).getTime() > Date.now()
}

// "10월 23일(금) 오후 7시 30분" (한국 시간)
export function liveLabel(startsAt: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date(startsAt)).map((p) => [p.type, p.value]),
  )
  const wd = { Sun: '일', Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토' }[parts.weekday as string] ?? ''
  const h = Number(parts.hour)
  const m = Number(parts.minute)
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${parts.month}월 ${parts.day}일(${wd}) ${ampm} ${h12}시${m ? ` ${m}분` : ''}`
}

export function googleCalendarUrl(ev: LiveEvent): string {
  const start = new Date(ev.startsAt)
  const end = new Date(start.getTime() + DURATION_MS)
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `[무료 라이브] ${ev.title}`,
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    details: details(ev),
    location: `${SITE}/my-classroom`,
    ctz: 'Asia/Seoul',
  })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

// .ics 글자 규칙: 쉼표·세미콜론·역슬래시 이스케이프, 줄바꿈은 \n
const icsText = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

export function buildIcs(ev: LiveEvent): string {
  const start = new Date(ev.startsAt)
  const end = new Date(start.getTime() + DURATION_MS)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//amag-class.com//live//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:live-${ev.courseId}-${utcStamp(start)}@amag-class.com`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${icsText(`[무료 라이브] ${ev.title}`)}`,
    `DESCRIPTION:${icsText(details(ev))}`,
    `URL:${SITE}/my-classroom`,
    `LOCATION:${icsText(`${SITE}/my-classroom`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:30분 뒤 라이브 시작',
    'TRIGGER:-PT30M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadIcs(ev: LiveEvent) {
  const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `amag-live-${ev.courseId}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
