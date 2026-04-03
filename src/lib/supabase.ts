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
const STALE_THRESHOLD = 30000 // 30초 이상 백그라운드에 있었으면 리페치

async function refreshIfStale() {
  const now = Date.now()
  const elapsed = hiddenAt ? now - hiddenAt : 0
  const isStale = elapsed >= STALE_THRESHOLD

  // 중복 호출 방지 (10초 이내)
  if (now - lastRefresh < 10000) {
    if (isStale) {
      window.dispatchEvent(new CustomEvent('supabase:stale-refresh'))
    }
    return
  }
  lastRefresh = now

  try {
    // refreshSession으로 토큰 확실히 갱신
    const { data } = await supabase.auth.refreshSession()
    if (!data.session) {
      // refresh 실패 시 getSession fallback
      await supabase.auth.getSession()
    }
  } catch {
    try {
      await supabase.auth.getSession()
    } catch {
      // 세션 갱신 완전 실패
    }
  }

  if (isStale) {
    hiddenAt = 0
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
