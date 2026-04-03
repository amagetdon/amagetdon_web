import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 잠금 사용 가능하면 즉시 실행, 아니면 잠금 없이 바로 실행
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const quickLock = async (name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return fn()
  }

  const result = await navigator.locks.request(name, { ifAvailable: true }, async (lock) => {
    if (lock) return { ok: true as const, value: await fn() }
    return { ok: false as const }
  })

  if (result.ok) return result.value

  // 잠금이 점유 중이면 대기하지 않고 바로 실행
  return fn()
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    storageKey: 'sb-auth-token',
    lock: quickLock,
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
