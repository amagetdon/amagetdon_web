import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 세션 갱신 중복 방지
let refreshPromise: Promise<void> | null = null

async function refreshSession() {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const { data } = await supabase.auth.refreshSession()
      if (!data.session) {
        await supabase.auth.getSession()
      }
    } catch {
      try { await supabase.auth.getSession() } catch { /* 무시 */ }
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

// 401 에러 시 세션 갱신 후 자동 재시도하는 커스텀 fetch
const fetchWithRetry: typeof fetch = async (input, init) => {
  const response = await fetch(input, init)

  // 401이면 세션 갱신 후 한 번 재시도
  if (response.status === 401) {
    await refreshSession()
    return fetch(input, init)
  }

  return response
}

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
  global: {
    fetch: fetchWithRetry,
  },
})

// 탭 복귀 시 즉시 세션 갱신 + 데이터 리페치 이벤트 발행
let hiddenAt = 0

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now()
    return
  }

  // visible로 복귀
  if (hiddenAt && Date.now() - hiddenAt >= 30000) {
    hiddenAt = 0
    await refreshSession()
    window.dispatchEvent(new CustomEvent('supabase:stale-refresh'))
  }
})

window.addEventListener('focus', async () => {
  if (hiddenAt && Date.now() - hiddenAt >= 30000) {
    hiddenAt = 0
    await refreshSession()
    window.dispatchEvent(new CustomEvent('supabase:stale-refresh'))
  }
})
