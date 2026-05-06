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
  }, captchaToken?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: meta,
        captchaToken,
      },
    })
    if (error) throw error
    return data
  },

  async signIn(email: string, password: string, captchaToken?: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    })
    if (error) throw error
    return data
  },

  async signInWithOAuth(provider: Provider) {
    // 카카오는 콘솔 동의항목으로 등록한 모든 항목을 한 번에 요청.
    // (Business 승인이 필요한 name, phone_number, birthyear 도 포함 — 미승인 항목은 자동 무시되거나 동의창에 노출되지 않음)
    const kakaoScopes = [
      'account_email',
      'profile_nickname',
      'profile_image',
      'name',
      'gender',
      'age_range',
      'birthday',
      'birthyear',
      'phone_number',
    ].join(' ')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: provider === 'kakao' ? kakaoScopes : undefined,
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

  async resendConfirmation(email: string, captchaToken?: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { captchaToken },
    })
    if (error) throw error
  },

  async resetPassword(email: string, captchaToken?: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken,
    })
    if (error) throw error
  },

  // 비회원 간소 가입 — guest-signup edge function 으로 이메일 확인을 자동 처리한 뒤
  // 랜덤 비번으로 즉시 signInWithPassword 하여 로그인 상태로 전환.
  async guestSignUp(input: {
    name: string
    phone: string
    email: string
    signup_referrer?: string
  }, captchaToken?: string) {
    const randomPassword = `g_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`

    const { data: fnData, error: fnErr } = await supabase.functions.invoke('guest-signup', {
      body: {
        email: input.email,
        password: randomPassword,
        name: input.name,
        phone: input.phone,
        signup_referrer: input.signup_referrer,
        captchaToken,
      },
    })

    const payload = (fnData ?? {}) as { user_id?: string; error?: string }
    if (fnErr || payload.error) {
      // supabase-js 는 non-2xx 응답을 받으면 error 에 FunctionsHttpError 를 세팅하고 data 는 null 로 둔다.
      // 원본 응답 body 는 error.context (Response) 에 있어 직접 파싱해야 한다.
      let bodyError: string | null = null
      const ctx = (fnErr as { context?: unknown } | null)?.context
      if (ctx instanceof Response) {
        try {
          const parsed = await ctx.clone().json() as { error?: string }
          bodyError = parsed?.error ?? null
        } catch { /* JSON 아니면 무시 */ }
      }
      const msg = bodyError || payload.error || fnErr?.message || ''
      if (msg === 'ALREADY_REGISTERED' || /already|registered|exists|duplicate/i.test(msg)) {
        throw new Error('이미 가입된 이메일입니다. 로그인 페이지에서 "비회원 로그인" 을 이용해주세요.')
      }
      throw new Error(msg || '가입에 실패했습니다.')
    }

    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: randomPassword,
    })
    if (signInErr) {
      throw new Error('가입은 완료됐지만 자동 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }

    // signup 웹훅/알림톡 발송 — 비회원도 CRM 기록 + 가입 안내 알림톡 받도록
    if (signInData?.user?.id) {
      const { webhookService } = await import('./webhookService')
      webhookService.fireSignup({
        userId: signInData.user.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        provider: 'guest',
      }, webhookService.captureContext()).catch(() => { /* fire-and-forget */ })
    }

    return signInData
  },

  // 회원가입 1단계 — 이메일 중복 여부 확인 (edge function)
  // 네트워크/함수 오류 시에는 false 반환하여 가입 흐름을 막지 않는다 (최종 signUp 단계에서 한 번 더 검증).
  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('check-email-exists', {
        body: { email },
      })
      if (error) return false
      const payload = (data ?? {}) as { exists?: boolean }
      return !!payload.exists
    } catch {
      return false
    }
  },

  // 이메일 매직 링크 로그인 — 비회원 구매로 만들어진 계정의 비밀번호 없이 로그인
  // shouldCreateUser:false 로 기존 계정만 허용 (가입 유도는 비회원 구매/회원가입 페이지로)
  async sendLoginLink(email: string, captchaToken?: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        shouldCreateUser: false,
        captchaToken,
      },
    })
    if (error) throw error
  },
}
