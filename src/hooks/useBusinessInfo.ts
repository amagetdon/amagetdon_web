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

function fetchBusinessInfo(): Promise<BusinessInfo> {
  if (cached) return Promise.resolve(cached)
  if (fetching) return fetching
  fetching = supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'business_info')
    .maybeSingle()
    .then(({ data }) => {
      cached = (data as Record<string, unknown>)?.value as BusinessInfo || {}
      fetching = null
      return cached
    })
  return fetching
}

export function useBusinessInfo() {
  const [biz, setBiz] = useState<BusinessInfo>(cached || {})

  useEffect(() => {
    fetchBusinessInfo().then(setBiz)
  }, [])

  return biz
}
