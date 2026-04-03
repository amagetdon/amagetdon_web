import { useEffect, useRef, useState } from 'react'

/**
 * 탭이 백그라운드에서 오래 있다가 돌아오면 콜백을 실행합니다.
 * supabase.ts에서 세션 갱신 후 'supabase:stale-refresh' 이벤트를 발행하면 동작합니다.
 */
export function useVisibilityRefresh(onRefresh: () => void) {
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const handler = () => onRefreshRef.current()
    window.addEventListener('supabase:stale-refresh', handler)
    return () => window.removeEventListener('supabase:stale-refresh', handler)
  }, [])
}

/**
 * 탭 복귀 시 자동으로 증가하는 refreshKey를 반환합니다.
 * useEffect 의존성에 넣으면 탭 복귀 시 자동 리페치됩니다.
 */
export function useStaleRefreshKey() {
  const [key, setKey] = useState(0)

  useEffect(() => {
    const handler = () => setKey((k) => k + 1)
    window.addEventListener('supabase:stale-refresh', handler)
    return () => window.removeEventListener('supabase:stale-refresh', handler)
  }, [])

  return key
}
