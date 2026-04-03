import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 고아 잠금 즉시 탈취 - 백그라운드 탭 복귀 시 5초 대기 제거
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stealLock = async (name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(name, { steal: true }, () => fn())
  }
  return fn()
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    storageKey: 'sb-auth-token',
    lock: stealLock,
  },
  db: {
    schema: 'public',
  },
})

// 탭 복귀 시 즉시 세션 갱신 + 데이터 리페치 이벤트 발행
let hiddenAt = 0

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now()
    return
  }

  if (hiddenAt && Date.now() - hiddenAt >= 30000) {
    hiddenAt = 0
    try {
      await supabase.auth.refreshSession()
    } catch {
      try { await supabase.auth.getSession() } catch { /* 무시 */ }
    }
    window.dispatchEvent(new CustomEvent('supabase:stale-refresh'))
  }
})

window.addEventListener('focus', async () => {
  if (hiddenAt && Date.now() - hiddenAt >= 30000) {
    hiddenAt = 0
    try {
      await supabase.auth.refreshSession()
    } catch {
      try { await supabase.auth.getSession() } catch { /* 무시 */ }
    }
    window.dispatchEvent(new CustomEvent('supabase:stale-refresh'))
  }
})
