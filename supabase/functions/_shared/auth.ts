// Edge Function 인증 헬퍼.
//
// supabase-js 의 auth.getUser(token) 는 Supabase 가 새로 도입한 ES256 asymmetric JWT 를
// 제대로 검증하지 못해 멀쩡한 토큰에도 401 을 내는 사례가 있다. 그래서 토큰 검증은
// 항상 Auth 서버 (/auth/v1/user) 에 직접 위임한다 — 서버가 검증하므로 알고리즘과 무관.

export interface AuthedUser {
  id: string
  email?: string | null
}

/**
 * Bearer 토큰을 검증하고 사용자 ID 를 반환합니다.
 * - service_role 키와 일치하면 `{ isServiceRole: true, user: null }`
 * - 사용자 토큰이면 `{ isServiceRole: false, user }`
 * - 토큰이 무효하면 `null`
 */
export async function verifyToken(
  token: string,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
): Promise<{ isServiceRole: boolean; user: AuthedUser | null } | null> {
  if (!token) return null
  if (token === serviceKey) return { isServiceRole: true, user: null }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!res.ok) return null
    const data = await res.json() as { id?: string; email?: string | null }
    if (!data.id) return null
    return { isServiceRole: false, user: { id: data.id, email: data.email ?? null } }
  } catch {
    return null
  }
}
