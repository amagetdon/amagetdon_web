import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface SeoSettings {
  title?: string
  author?: string
  description?: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
  rssUrl?: string
  sitemapUrl?: string
}

let cached: SeoSettings | null = null
let fetching: Promise<SeoSettings> | null = null

async function fetchSeoSettings(): Promise<SeoSettings> {
  if (cached) return cached
  if (fetching) return fetching
  fetching = (async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'seo_settings')
      .maybeSingle()
    cached = ((data as unknown as Record<string, unknown> | null)?.value as SeoSettings) || {}
    fetching = null
    return cached
  })()
  return fetching
}

export function invalidateSeoSettings() {
  cached = null
  fetching = null
}

export function useSeoSettings() {
  const [seo, setSeo] = useState<SeoSettings>(cached || {})

  useEffect(() => {
    fetchSeoSettings().then(setSeo)
  }, [])

  return seo
}
