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
}
