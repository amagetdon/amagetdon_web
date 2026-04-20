import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ExternalServiceSettings } from '../constants/externalServices'

const EXTERNAL_SERVICES_KEY = 'external_services'

let cached: ExternalServiceSettings | null = null
let fetching: Promise<ExternalServiceSettings> | null = null
const subscribers = new Set<(v: ExternalServiceSettings) => void>()

async function fetchExternalServices(): Promise<ExternalServiceSettings> {
  if (cached) return cached
  if (fetching) return fetching
  fetching = (async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', EXTERNAL_SERVICES_KEY)
      .maybeSingle()
    const row = data as { value?: Partial<ExternalServiceSettings> } | null
    cached = (row?.value ?? {}) as ExternalServiceSettings
    fetching = null
    return cached
  })()
  return fetching
}

export function invalidateExternalServices(next?: ExternalServiceSettings) {
  cached = next ?? null
  fetching = null
  if (next) {
    for (const fn of subscribers) fn(next)
  }
}

export function useExternalServices() {
  const [settings, setSettings] = useState<ExternalServiceSettings>(
    (cached ?? {}) as ExternalServiceSettings,
  )

  useEffect(() => {
    let mounted = true
    fetchExternalServices().then((v) => {
      if (mounted) setSettings(v)
    })
    const onUpdate = (v: ExternalServiceSettings) => {
      if (mounted) setSettings(v)
    }
    subscribers.add(onUpdate)
    return () => {
      mounted = false
      subscribers.delete(onUpdate)
    }
  }, [])

  return settings
}

export function getCachedExternalServices(): ExternalServiceSettings | null {
  return cached
}
