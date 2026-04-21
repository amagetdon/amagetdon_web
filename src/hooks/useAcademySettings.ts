import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface AcademySettings {
  closedVisualEffect?: boolean
}

const DEFAULTS: Required<AcademySettings> = {
  closedVisualEffect: true,
}

let cached: AcademySettings | null = null
let fetching: Promise<AcademySettings> | null = null

async function fetchAcademySettings(): Promise<AcademySettings> {
  if (cached) return cached
  if (fetching) return fetching
  fetching = (async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'academy_settings')
      .maybeSingle()
    const value = ((data as unknown as Record<string, unknown> | null)?.value as AcademySettings) || {}
    cached = { ...DEFAULTS, ...value }
    fetching = null
    return cached
  })()
  return fetching
}

export function invalidateAcademySettings() {
  cached = null
  fetching = null
}

export function useAcademySettings() {
  const [settings, setSettings] = useState<AcademySettings>(cached ?? DEFAULTS)

  useEffect(() => {
    fetchAcademySettings().then(setSettings)
  }, [])

  return settings
}
