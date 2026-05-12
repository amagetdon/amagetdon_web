import { useEffect, useRef, useState } from 'react'

/**
 * 목록 페이지의 검색/페이지/정렬 같은 상태를 sessionStorage 에 동기화합니다.
 * detail 페이지에서 목록으로 돌아왔을 때 직전 상태가 그대로 복원됩니다.
 */
export function useSessionState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key)
      if (stored !== null) return JSON.parse(stored) as T
    } catch {}
    return initial
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state))
    } catch {}
  }, [key, state])

  return [state, setState]
}

/**
 * 페이지를 떠날 때 스크롤 위치를 저장하고, 다시 진입했을 때 복원합니다.
 * ready 가 true 가 된 직후 한 번만 복원합니다 (보통 목록 데이터 로딩 완료 시점).
 */
export function useScrollRestore(key: string, ready: boolean) {
  const restoredRef = useRef(false)

  useEffect(() => {
    if (!ready || restoredRef.current) return
    restoredRef.current = true
    try {
      const stored = sessionStorage.getItem(key)
      if (stored === null) return
      const y = Number(stored)
      if (!Number.isFinite(y)) return
      // 레이아웃이 잡힌 다음 프레임에 스크롤 — 이미지 등이 늦게 로드돼도 대략적인 위치는 맞춤.
      requestAnimationFrame(() => window.scrollTo(0, y))
    } catch {}
  }, [key, ready])

  useEffect(() => {
    return () => {
      try {
        sessionStorage.setItem(key, String(window.scrollY))
      } catch {}
    }
  }, [key])
}
