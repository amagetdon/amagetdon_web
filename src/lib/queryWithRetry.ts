import { supabase } from './supabase'

/**
 * Supabase 쿼리 실행 후 실패하면 세션 갱신 후 1회 재시도
 */
export async function queryWithRetry<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>
): Promise<{ data: T | null; error: { message: string; code?: string } | null }> {
  const result = await queryFn()

  // 성공이거나 데이터가 있으면 바로 반환
  if (!result.error) return result

  // 인증 관련 에러면 세션 갱신 후 재시도
  const code = result.error.code || ''
  const msg = result.error.message || ''
  const isAuthError = code === 'PGRST301' || code === '401' ||
    msg.includes('JWT') || msg.includes('token') || msg.includes('auth')

  if (isAuthError) {
    try {
      await supabase.auth.refreshSession()
    } catch {
      try { await supabase.auth.getSession() } catch { /* */ }
    }
    return queryFn()
  }

  return result
}
