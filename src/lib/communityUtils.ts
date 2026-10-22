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

