import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export const profileService = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data as Profile
  },

  async updateProfile(userId: string, updates: {
    name?: string
    phone?: string | null
    birth_date?: string | null
    gender?: 'male' | 'female' | null
    address?: string | null
    provider?: string | null
  }) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates as never)
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data as Profile
  },

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (error) throw error
  },

  // 비회원 게스트 계정을 정규 이메일 계정으로 승격
  async promoteGuestToMember(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ provider: 'email' } as never)
      .eq('id', userId)
    if (error) throw error
  },
}
