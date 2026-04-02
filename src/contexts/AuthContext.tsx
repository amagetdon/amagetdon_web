import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

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
  }, [user])

  useEffect(() => {
    let initialSessionHandled = false

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      initialSessionHandled = true
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        fetchProfile(s.user.id).then(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // 초기 세션 복원은 getSession에서 처리했으므로 스킵
        if (!initialSessionHandled) return

        setSession(newSession)
        setUser(newSession?.user ?? null)

        if (newSession?.user) {
          const prof = await fetchProfile(newSession.user.id)

          // 실제 새 로그인일 때만 프로필 완성 체크
          if (event === 'SIGNED_IN') {
            const flag = sessionStorage.getItem('pendingSignIn')
            if (flag) {
              sessionStorage.removeItem('pendingSignIn')
              const isIncomplete = !prof?.phone || !prof?.address
              if (isIncomplete) {
                window.location.replace('/mypage')
              }
            }
          }
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
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
