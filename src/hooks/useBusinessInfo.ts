import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface BusinessInfo {
  mallName?: string
  mallNameEn?: string
  siteTitle?: string
  logoUrl?: string
  faviconUrl?: string
  companyName?: string
  bizNumber?: string
  ceoName?: string
  bizType?: string
  bizCategory?: string
  email?: string
  address?: string
  phone?: string
  ecommerceNumber?: string
  remoteAcademyNumber?: string
}

let cached: BusinessInfo | null = null
let fetching: Promise<BusinessInfo> | null = null

async function fetchBusinessInfo(): Promise<BusinessInfo> {
  if (cached) return cached
  if (fetching) return fetching
  fetching = (async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'business_info')
      .maybeSingle()
    cached = ((data as unknown as Record<string, unknown> | null)?.value as BusinessInfo) || {}
    fetching = null
    return cached
  })()
  return fetching
}

export function useBusinessInfo() {
  const [biz, setBiz] = useState<BusinessInfo>(cached || {})

  useEffect(() => {
    fetchBusinessInfo().then(setBiz)
  }, [])

  return biz
}
