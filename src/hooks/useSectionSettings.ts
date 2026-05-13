import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface SectionConfig {
  title: string
  subtitle?: string
  count?: number
}

export type SectionKey =
  | 'premium_courses'
  | 'free_courses'
  | 'academy_tab_premium_courses'
  | 'academy_tab_free_courses'
  | 'academy_premium_courses'
  | 'academy_free_courses'
  | 'free_ebooks'
  | 'academy_tab_free_ebooks'
  | 'academy_free_ebooks'
  | 'secret_books'
  | 'real_results'
  | 'reviews'
  | 'instructors'

export type SectionSettings = Partial<Record<SectionKey, SectionConfig>>

const DEFAULTS: Record<SectionKey, SectionConfig> = {
  premium_courses: { title: '유료 강의', count: 6 },
  free_courses: { title: '무료 강의', count: 6 },
  academy_tab_premium_courses: { title: '프리미엄 강의', count: 6 },
  academy_tab_free_courses: { title: '무료 강의', count: 6 },
  academy_premium_courses: { title: '프리미엄 강의', count: 9 },
  academy_free_courses: { title: '무료 강의', count: 9 },
  free_ebooks: { title: '무료 전자책', count: 5 },
  academy_tab_free_ebooks: { title: '무료 전자책', count: 5 },
  academy_free_ebooks: { title: '무료 전자책', count: 10 },
  secret_books: { title: '시크릿 북', subtitle: '무료 전자책에서 더 깊게 배우고 싶다면?', count: 5 },
  real_results: {
    title: '리얼 성과 공개',
    subtitle: '아마겟돈 수강생들이 직접 만들어낸',
    count: 4,
  },
  reviews: {
    title: '실제 강의 수강생 후기',
    subtitle: '조작된 후기는 절대 사용하지 않습니다.',
    count: 10,
  },
  instructors: {
    title: '아마겟돈 클래스 강사를 소개합니다.',
    subtitle: '현장에서 이미 결과로 증명된 강사진입니다.',
  },
}

let cached: SectionSettings | null = null
let fetching: Promise<SectionSettings> | null = null
const listeners = new Set<(s: SectionSettings) => void>()

async function fetchSectionSettings(): Promise<SectionSettings> {
  if (cached) return cached
  if (fetching) return fetching
  fetching = (async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'section_settings')
      .maybeSingle()
    const value = ((data as unknown as Record<string, unknown> | null)?.value as SectionSettings) || {}
    cached = value
    fetching = null
    return cached
  })()
  return fetching
}

export function invalidateSectionSettings() {
  cached = null
  fetching = null
}

export function getSectionDefault(key: SectionKey): SectionConfig {
  return DEFAULTS[key]
}

export async function saveSectionConfig(key: SectionKey, patch: Partial<SectionConfig>): Promise<void> {
  const current = await fetchSectionSettings()
  const merged: SectionSettings = {
    ...current,
    [key]: { ...DEFAULTS[key], ...current[key], ...patch },
  }
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key: 'section_settings', value: merged } as never, { onConflict: 'key' })
  if (error) throw error
  cached = merged
  listeners.forEach((cb) => cb(merged))
}

export function useSectionConfig(key: SectionKey): SectionConfig {
  const initial = cached?.[key] ?? DEFAULTS[key]
  const [config, setConfig] = useState<SectionConfig>(initial)

  useEffect(() => {
    let mounted = true
    fetchSectionSettings().then((s) => {
      if (!mounted) return
      setConfig({ ...DEFAULTS[key], ...s[key] })
    })
    const listener = (s: SectionSettings) => {
      if (!mounted) return
      setConfig({ ...DEFAULTS[key], ...s[key] })
    }
    listeners.add(listener)
    return () => {
      mounted = false
      listeners.delete(listener)
    }
  }, [key])

  return config
}
