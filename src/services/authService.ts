import { supabase } from '../lib/supabase'
import type { Provider } from '@supabase/supabase-js'

export const authService = {
  async signUp(email: string, password: string, meta: {
    name: string
    gender?: string
    phone?: string
    address?: string
    birth_date?: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
    utm_term?: string
    signup_referrer?: string
  }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: meta,
      },
    })
    if (error) throw error
    return data
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  async signInWithOAuth(provider: Provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: provider === 'kakao' ? 'account_email gender age_range' : undefined,
      },
    })
    if (error) throw error
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  },

  async resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })
    if (error) throw error
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  },

  // 비회원 간소 가입 — 이름/전화/이메일/비밀번호만 받고 즉시 가입 + 자동 로그인
  // provider='guest' 로 기록해 admin 에서 구분. 다음 접속 시엔 일반 이메일+비밀번호 로그인 가능.
  async guestSignUp(input: {
    name: string
    phone: string
    email: string
    password: string
    signup_referrer?: string
  }) {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          name: input.name,
          phone: input.phone,
          provider: 'guest',
          signup_referrer: input.signup_referrer,
        },
      },
    })
    if (error) {
      if (/registered|already|exists|duplicate/i.test(error.message)) {
        throw new Error('이미 가입된 이메일입니다. 로그인 후 구매해주세요.')
      }
      throw error
    }

    // 이메일 확인이 필요한 설정이면 session 이 null. 사용자가 입력한 비밀번호로 즉시 로그인 시도.
    if (!data.session) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      })
      if (signInErr) {
        throw new Error('가입은 성공했지만 자동 로그인에 실패했습니다. 로그인 페이지에서 이메일/비밀번호로 로그인해주세요.')
      }
      return signInData
    }
    return data
  },
}
