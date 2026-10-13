import { useSyncExternalStore } from 'react'

// 사이트 공통 화면 요소(헤더·푸터·상담 버튼) 숨김 상태 — 게시판 글 설정 '헤더·푸터 숨기기'용.
let hidden = false
const listeners = new Set<() => void>()

export function setChromeHidden(v: boolean) {
  if (hidden === v) return
  hidden = v
  // 채널톡 상담 버튼도 함께 숨김/복원
  const ch = (window as unknown as { ChannelIO?: (cmd: string) => void }).ChannelIO
  try { ch?.(v ? 'hideChannelButton' : 'showChannelButton') } catch { /* 채널톡 미설치 */ }
  listeners.forEach((l) => l())
}

export function useChromeHidden() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l) },
    () => hidden,
    () => false,
  )
}
