import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// navigator.locks 대신 메모리 기반 뮤텍스 (탭 프리즈에 영향 안 받음)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const locks = new Map<string, Promise<any>>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memoryLock = async (name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
  const existing = locks.get(name)
  if (existing) {
    try { await existing } catch { /* */ }
  }

  const promise = fn()
  locks.set(name, promise)

  try {
    return await promise
  } finally {
    if (locks.get(name) === promise) {
      locks.delete(name)
    }
  }
}

// 만료 토큰(stale JWT) 자동 복구 — 백그라운드 탭/절전 복귀 직후에는 autoRefreshToken 의
// 갱신 큐가 돌기 전에 만료된 토큰이 요청에 실려 나가 401 이 난다 (강의/일정 등이
// "불러오기 실패"로 보이는 고질 증상). 모든 REST/RPC/Functions 요청에서 401 을 만나면
// 세션을 갱신하고 새 토큰으로 딱 1회 재시도한다. auth 엔드포인트 자체는 제외(루프 방지).
let refreshInFlight: Promise<unknown> | null = null

const fetchWithAuthRetry: typeof fetch = async (input, init) => {
  // cache: 'no-store' — API 응답을 브라우저 HTTP 캐시에 절대 태우지 않는다.
  // (FK 모호성 사고 때 캐시 가능한 300 에러 응답이 디스크 캐시에 박혀, 서버를 고친 뒤에도
  //  같은 URL 요청이 캐시된 에러를 재생하며 "강의 정보를 찾을 수 없습니다"가 지속된 사례)
  const res = await fetch(input, { ...init, cache: 'no-store' })
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (res.status !== 401 || url.includes('/auth/v1/')) return res

  try {
    // 동시 다발 401 은 갱신 1회로 합류
    if (!refreshInFlight) {
      refreshInFlight = supabase.auth.refreshSession()
        .catch(() => supabase.auth.getSession())
        .finally(() => { refreshInFlight = null })
    }
    await refreshInFlight
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return res
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return await fetch(input, { ...init, headers, cache: 'no-store' })
  } catch {
    return res
  }
}

// dev(Vite HMR)에서 이 모듈이 재평가될 때마다 새 GoTrueClient 가 생기면, 이전 인스턴스와
// 같은 storage key 로 토큰 갱신을 경쟁하다 refresh token 이 무효화되어 세션이 깨진다
// ("Multiple GoTrueClient instances" 경고 + 개발 중 401 '불러오기 실패' 증상의 뿌리).
// 전역에 1개만 만들어 HMR 재평가 시 재사용한다.
function createSupabaseClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
      storageKey: 'sb-auth-token',
      lock: memoryLock,
    },
    db: {
      schema: 'public',
    },
    global: {
      fetch: fetchWithAuthRetry,
    },
  })
}

const g = globalThis as typeof globalThis & { __amagetdonSupabase?: ReturnType<typeof createSupabaseClient> }

export const supabase = g.__amagetdonSupabase ?? createSupabaseClient()
if (import.meta.env.DEV) g.__amagetdonSupabase = supabase
