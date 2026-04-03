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

// 페이지 포커스 시 즉시 세션 갱신
let lastRefresh = 0
function refreshIfStale() {
  const now = Date.now()
  if (now - lastRefresh > 60000) {
    lastRefresh = now
    supabase.auth.getSession()
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshIfStale()
})
window.addEventListener('focus', refreshIfStale)
