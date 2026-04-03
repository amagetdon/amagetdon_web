import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 고아 잠금 빠르게 복구 - 잠금 사용 가능하면 바로 실행, 없으면 1초만 대기 후 탈취
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const quickLock = async (name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return fn()
  }

  // 잠금이 비어있으면 즉시 획득
  const result = await navigator.locks.request(name, { ifAvailable: true }, async (lock) => {
    if (lock) return { ok: true as const, value: await fn() }
    return { ok: false as const }
  })
  if (result.ok) return result.value

  // 잠금이 있으면 1초만 대기 후 강제 탈취
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      navigator.locks.request(name, { steal: true }, () => fn()).then(resolve, reject)
    }, 1000)

    navigator.locks.request(name, () => fn()).then((val) => {
      clearTimeout(timeout)
      resolve(val)
    }, (err) => {
      // steal에 의해 abort된 경우 무시 (steal 쪽에서 처리)
      if (err.name !== 'AbortError') {
        clearTimeout(timeout)
        reject(err)
      }
    })
  })
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
