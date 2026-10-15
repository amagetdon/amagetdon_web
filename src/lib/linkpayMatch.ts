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
  // 기수(3기)·등급(프리미엄·마스터·베이직·연장권)은 단어 수보다 우선한다 — 강의 이름이 바뀐 기수에서
  // 단어가 더 많이 겹치는 이전 기수 강의가 추천되던 문제(10/15, 3기 결제 → 이름이 같은 옛 강의).
  // 주문명에 있는 기수·등급과 같은 강의가 하나라도 있으면 그 강의들 안에서만 고른다.
  const cohort = /(\d+)\s*기/.exec(name)?.[1]
  const level = /(프리미엄|마스터|베이직|연장권)/.exec(name)?.[1]
  let pool = courses
  for (const keep of [
    (t: string) => !cohort || new RegExp(`(^|[^\\d])${cohort}\\s*기`).test(t),
    (t: string) => !level || t.includes(level),
  ]) {
    const narrowed = pool.filter((c) => keep(c.title))
    if (narrowed.length) pool = narrowed
  }
  // 겹치는 단어가 같으면 주문명에 없는 단어가 적은 강의(예: '2기'가 붙지 않은 쪽)를 고른다
  let best: { id: number; score: number; extra: number } | null = null
  for (const c of pool) {
    const titleWords = words(c.title)
    let score = 0
    for (const w of titleWords) if (target.has(w)) score++
    const extra = titleWords.size - score
    if (score >= 2 && (!best || score > best.score || (score === best.score && extra < best.extra))) best = { id: c.id, score, extra }
  }
  return best?.id ?? null
}
