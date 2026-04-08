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
}
