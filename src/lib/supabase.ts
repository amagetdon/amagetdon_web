import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    storageKey: 'sb-auth-token',
  },
  db: {
    schema: 'public',
  },
})

// 탭 복귀 시 세션 갱신 + 데이터 리페치 이벤트 발행
let lastRefresh = 0
let hiddenAt = 0
const STALE_THRESHOLD = 120000 // 2분 이상 백그라운드에 있었으면 리페치

async function refreshIfStale() {
  const now = Date.now()
  if (now - lastRefresh < 60000) return
  lastRefresh = now
  try {
    await supabase.auth.getSession()
  } catch {
    // 세션 갱신 실패해도 리페치 시도
  }

  // 2분 이상 백그라운드였으면 데이터 리페치 이벤트 발행
  if (hiddenAt && now - hiddenAt >= STALE_THRESHOLD) {
    window.dispatchEvent(new CustomEvent('supabase:stale-refresh'))
  }
}

const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now()
  } else if (document.visibilityState === 'visible') {
    refreshIfStale()
  }
}

document.addEventListener('visibilitychange', handleVisibilityChange)
window.addEventListener('focus', () => refreshIfStale())
