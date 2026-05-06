import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'
import { webhookService } from '../services/webhookService'
import { profileService } from '../services/profileService'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  isAdmin: false,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      setProfile(data)
      return data as Profile
    } catch {
      setProfile(null)
      return null
    }
  }

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }, [user?.id])

  useEffect(() => {
    let initialSessionHandled = false

    // 세션 복원 타임아웃: 5초 안에 안 되면 로딩 해제
    const timeout = setTimeout(() => {
      if (loading) setLoading(false)
    }, 5000)

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      clearTimeout(timeout)
      initialSessionHandled = true
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    }).catch(() => {
      clearTimeout(timeout)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!initialSessionHandled) return

        setSession(newSession)
        setUser(newSession?.user ?? null)

        if (newSession?.user) {
          fetchProfile(newSession.user.id).then(async (initialProf) => {
            // OAuth(카카오/구글) 로그인 시 user_metadata 에서 프로필 빈 필드 자동 채우기 — 이후 isIncomplete 판단에 반영되도록 먼저 await
            let prof = initialProf
            if (event === 'SIGNED_IN') {
              const oauthProvider = newSession.user.app_metadata?.provider
              if (prof && oauthProvider && oauthProvider !== 'email') {
                try {
                  const updated = await profileService.applyOAuthMetadata(newSession.user, prof)
                  if (updated) {
                    const refreshed = await fetchProfile(newSession.user.id)
                    if (refreshed) prof = refreshed
                  }
                } catch { /* OAuth 메타 매핑 실패는 무시 */ }
              }
            }

            // Umami 유저 식별
            try {
              if (prof && typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).umami) {
                const umami = (window as unknown as Record<string, { identify: (data: Record<string, string>) => void }>).umami
                umami.identify({
                  userId: newSession.user.id,
                  email: prof.email || '',
                  name: prof.name || '',
                })
              }
            } catch { /* Umami 오류 무시 */ }

            // 활성 시간 갱신 (5분 이내 중복 방지)
            const lastUpdate = sessionStorage.getItem('lastActiveUpdate')
            if (!lastUpdate || Date.now() - Number(lastUpdate) > 300000) {
              sessionStorage.setItem('lastActiveUpdate', String(Date.now()))
              supabase
                .from('profiles')
                .update({ last_active_at: new Date().toISOString() } as never)
                .eq('id', newSession.user.id)
                .then(({ error }) => {
                  if (error) console.warn('[Auth] last_active_at 갱신 실패:', error.message)
                })
            }

            if (event === 'SIGNED_IN') {
              // UTM/가입경로가 프로필에 없으면 sessionStorage에서 채우기
              if (prof && !prof.utm_source && !prof.signup_referrer) {
                const utmSource = sessionStorage.getItem('utm_source')
                const referrer = sessionStorage.getItem('signup_referrer')
                if (utmSource || referrer) {
                  const utmUpdate: Record<string, string> = {}
                  if (utmSource) utmUpdate.utm_source = utmSource
                  const medium = sessionStorage.getItem('utm_medium')
                  const campaign = sessionStorage.getItem('utm_campaign')
                  const content = sessionStorage.getItem('utm_content')
                  const term = sessionStorage.getItem('utm_term')
                  if (medium) utmUpdate.utm_medium = medium
                  if (campaign) utmUpdate.utm_campaign = campaign
                  if (content) utmUpdate.utm_content = content
                  if (term) utmUpdate.utm_term = term
                  if (referrer) utmUpdate.signup_referrer = referrer
                  supabase
                    .from('profiles')
                    .update(utmUpdate as never)
                    .eq('id', newSession.user.id)
                    .then(({ error }) => {
                      if (error) {
                        console.warn('[Auth] UTM 갱신 실패:', error.message)
                        return
                      }
                      fetchProfile(newSession.user.id)
                    })
                }
              }

              const flag = sessionStorage.getItem('pendingSignIn')
              if (flag) {
                sessionStorage.removeItem('pendingSignIn')
                const isIncomplete = !prof?.phone || !prof?.name || !prof?.gender || !prof?.birth_date
                if (isIncomplete) {
                  // /mypage 에서 다시 /onboarding 으로 보냄
                  window.location.replace('/mypage')
                }
              }

              // OAuth 신규 가입자 webhook (이메일 가입은 SignUpPage에서 직접 fire)
              const provider = newSession.user.app_metadata?.provider
              if (provider && provider !== 'email') {
                supabase
                  .from('webhook_logs')
                  .select('id', { count: 'exact', head: true })
                  .eq('user_id', newSession.user.id)
                  .eq('event_type', 'signup')
                  .then(({ count }) => {
                    if ((count ?? 0) > 0) return
                    webhookService.fireSignup({
                      userId: newSession.user.id,
                      name: prof?.name || (newSession.user.user_metadata?.name as string) || (newSession.user.user_metadata?.full_name as string) || '',
                      email: newSession.user.email || '',
                      phone: prof?.phone || '',
                      gender: prof?.gender || null,
                      address: prof?.address || null,
                      birth_date: prof?.birth_date || null,
                      provider,
                      utm_source: prof?.utm_source || null,
                      utm_medium: prof?.utm_medium || null,
                      utm_campaign: prof?.utm_campaign || null,
                      utm_content: prof?.utm_content || null,
                      utm_term: prof?.utm_term || null,
                    }, webhookService.captureContext()).catch(() => {})
                  })
              }
            }
            setLoading(false)
          })
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    // 탭 복귀 시 자동 세션 갱신 재시작
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.startAutoRefresh()
      } else {
        supabase.auth.stopAutoRefresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const isAdmin = profile?.role === 'admin'

  const value = useMemo(
    () => ({ user, profile, session, loading, isAdmin, refreshProfile }),
    [user, profile, session, loading, isAdmin, refreshProfile]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
