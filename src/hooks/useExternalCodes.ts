import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ExternalCode } from '../types/externalCode'

const EXTERNAL_CODES_KEY = 'external_codes'

let cached: ExternalCode[] | null = null
let fetching: Promise<ExternalCode[]> | null = null
const subscribers = new Set<(v: ExternalCode[]) => void>()

function normalize(input: unknown): ExternalCode[] {
  if (!Array.isArray(input)) return []
  return (input as Partial<ExternalCode>[])
    .filter((item): item is Partial<ExternalCode> => !!item && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : String(item.id ?? ''),
      name: typeof item.name === 'string' ? item.name : '',
      type: (item.type as ExternalCode['type']) ?? 'script',
      content: typeof item.content === 'string' ? item.content : '',
      position: (item.position === 'body' ? 'body' : 'head') as ExternalCode['position'],
      enabled: !!item.enabled,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    }))
    .filter((item) => !!item.id)
}

export async function fetchExternalCodes(): Promise<ExternalCode[]> {
  if (cached) return cached
  if (fetching) return fetching
  fetching = (async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', EXTERNAL_CODES_KEY)
      .maybeSingle()
    const row = data as { value?: unknown } | null
    cached = normalize(row?.value)
    fetching = null
    return cached
  })()
  return fetching
}

export async function saveExternalCodes(next: ExternalCode[]): Promise<void> {
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key: EXTERNAL_CODES_KEY, value: next } as never, { onConflict: 'key' })
  if (error) throw error
  invalidateExternalCodes(next)
}

export function invalidateExternalCodes(next?: ExternalCode[]) {
  cached = next ?? null
  fetching = null
  if (next) {
    for (const fn of subscribers) fn(next)
  }
}

export function useExternalCodes() {
  const [codes, setCodes] = useState<ExternalCode[]>(cached ?? [])

  useEffect(() => {
    let mounted = true
    fetchExternalCodes().then((v) => {
      if (mounted) setCodes(v)
    })
    const onUpdate = (v: ExternalCode[]) => {
      if (mounted) setCodes(v)
    }
    subscribers.add(onUpdate)
    return () => {
      mounted = false
      subscribers.delete(onUpdate)
    }
  }, [])

  return codes
}
