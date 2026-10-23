import { useEffect, useState } from 'react'
import { communityService } from '../services/communityService'

// 커뮤니티 화면 공용 함수

/** '방금' · '13:55' · '어제' · '10.21.' */
export function timeLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return '방금'
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return '어제'
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.`
  return d.getFullYear() === now.getFullYear() ? md : `${String(d.getFullYear()).slice(2)}.${md}`
}

export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString()
}

/** 비공개 사진 주소(1시간짜리) */
export function useSignedUrls(paths: (string | null | undefined)[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = paths.filter(Boolean).join('|')
  useEffect(() => {
    const list = key ? key.split('|') : []
    if (!list.length) return
    let alive = true
    communityService.signedUrls(list).then((u) => { if (alive) setUrls((prev) => ({ ...prev, ...u })) }).catch(() => undefined)
    return () => { alive = false }
  }, [key])
  return urls
}


/** 강의 → 그 강의에 연결된 기수 방(없으면 내 강의실) */
export function courseLinkFor(boards: { slug: string; course_ids: number[]; enabled: boolean; read_level: string }[], courseId: number): string {
  const b = boards.find((x) => x.enabled && x.read_level === 'cohort' && x.course_ids.includes(courseId))
  return b ? `/community/b/${b.slug}` : '/my-classroom?tab=course'
}

/** 글 본문의 주소를 링크로(글자만 쓰는 글이라 HTML 은 쓰지 않음) */
export function splitLinks(text: string): { text: string; href?: string }[] {
  const out: { text: string; href?: string }[] = []
  const re = /https?:\/\/[^\s<>"')\]]+/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) })
    out.push({ text: m[0], href: m[0] })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/** 임시저장(이 기기 브라우저) — 저장소가 막혀 있어도 화면은 그대로 동작 */
export const draftStore = {
  key: (boardSlug: string | null, editId: number | null) => `cmty-draft:${editId ? `edit-${editId}` : boardSlug || 'any'}`,
  read<T>(key: string): T | null {
    try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null } catch { return null }
  },
  write(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 저장 불가 */ }
  },
  clear(key: string) {
    try { localStorage.removeItem(key) } catch { /* 저장 불가 */ }
  },
}
