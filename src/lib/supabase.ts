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

// 탭 복귀 시 세션 갱신 + 리페치 이벤트
let hiddenAt = 0

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now()
    return
  }

  if (hiddenAt && Date.now() - hiddenAt >= 10000) {
    hiddenAt = 0
    try {
      await supabase.auth.refreshSession()
    } catch {
      try { await supabase.auth.getSession() } catch { /* */ }
    }
    window.dispatchEvent(new CustomEvent('supabase:stale-refresh'))
  }
})
