import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// 메인 헤더 네비게이션 메뉴 노출 여부. site_settings.nav_visibility 에 저장.
// 키는 path 와 1:1 매핑 — 새 메뉴 추가 시 여기에 키를 추가하고 Header 의 path 매핑에 연결.
export interface NavVisibility {
  home: boolean
  academy: boolean
  instructors: boolean
  reviews: boolean
  newsletter: boolean
  results: boolean
  faq: boolean
}

export const DEFAULT_NAV_VISIBILITY: NavVisibility = {
  home: true,
  academy: true,
  instructors: true,
  reviews: true,
  newsletter: true,
  results: true,
  faq: true,
}

let cached: NavVisibility | null = null
let fetching: Promise<NavVisibility> | null = null

async function fetchNavVisibility(): Promise<NavVisibility> {
  if (cached) return cached
  if (fetching) return fetching
  fetching = (async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'nav_visibility')
      .maybeSingle()
    const value = ((data as unknown as Record<string, unknown> | null)?.value as Partial<NavVisibility>) || {}
    cached = { ...DEFAULT_NAV_VISIBILITY, ...value }
    fetching = null
    return cached
  })()
  return fetching
}

export function invalidateNavVisibility() {
  cached = null
  fetching = null
}

export function useNavVisibility() {
  const [visibility, setVisibility] = useState<NavVisibility>(cached ?? DEFAULT_NAV_VISIBILITY)

  useEffect(() => {
    fetchNavVisibility().then(setVisibility)
  }, [])

  return visibility
}
