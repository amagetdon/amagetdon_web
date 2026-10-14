// 링크페이·무통장 결제를 강의·수강권에 연결할 때 쓰는 공용 규칙 (관리자 링크페이 화면·처리 패널)
import type { CourseWithInstructor } from '../types'

/** 강의 마감일·수강기간 기준 수강권 만료일 (AdminMembers 수동 부여와 동일 규칙) */
export function courseExpiry(course: CourseWithInstructor | undefined): string | null {
  if (!course) return null
  const c = course as unknown as { enrollment_deadline: string | null; duration_days: number | null }
  // 마감일이 있으면 마감일부터, 없으면 지금부터 다시보기 일수 (0 이면 무제한)
  if (c.duration_days && c.duration_days > 0) {
    const base = c.enrollment_deadline ? new Date(c.enrollment_deadline).getTime() : Date.now()
    return new Date(base + c.duration_days * 86400000).toISOString()
  }
  return null
}

// 상품명 강의 번호 규칙 — 개인결제 상품 이름에 [C112](강의) / [E5](전자책)를 넣으면 갱신·결제 때 자동 연결된다.
const ITEM_CODE_RE = /\[(C|E)(\d+)\]/i
export function itemCodeFromName(name: string | null | undefined): { courseId: number | null; ebookId: number | null } | null {
  const m = name ? ITEM_CODE_RE.exec(name) : null
  if (!m) return null
  const id = Number(m[2])
  return m[1].toUpperCase() === 'C' ? { courseId: id, ebookId: null } : { courseId: null, ebookId: id }
}

// 상품명("권승미_[프리미엄] N억 버는 자사몰…")으로 강의 추천 — 고객 이름 접두어를 떼고 제목 단어가 가장 많이 겹치는 강의(2단어 이상)
export function guessCourseId(orderName: string | null, courses: CourseWithInstructor[]): number | null {
  if (!orderName) return null
  const code = itemCodeFromName(orderName)
  if (code?.courseId && courses.some((c) => c.id === code.courseId)) return code.courseId
  const name = orderName.includes('_') ? orderName.slice(orderName.indexOf('_') + 1) : orderName
  const words = (t: string) => new Set(t.replace(/[[\]()'"·\-_/]/g, ' ').split(/\s+/).filter((w) => w.length >= 2))
  const target = words(name)
  let best: { id: number; score: number } | null = null
  for (const c of courses) {
    let score = 0
    for (const w of words(c.title)) if (target.has(w)) score++
    if (score >= 2 && (!best || score > best.score)) best = { id: c.id, score }
  }
  return best?.id ?? null
}
