import { supabase } from '../lib/supabase'
import type { Achievement } from '../types'

export const achievementService = {
  async getAll(options?: { page?: number; perPage?: number }) {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 4
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    const { data, error, count } = await supabase
      .from('achievements')
      .select('*', { count: 'exact' })
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) throw error
    return { data: data as Achievement[], count: count ?? 0 }
  },

  async create(achievement: Omit<Achievement, 'id' | 'created_at' | 'is_published'>) {
    const { data, error } = await supabase
      .from('achievements')
      .insert(achievement as never)
      .select()
      .single()
    if (error) throw error
    return data as Achievement
  },

  async getAllAdmin(options?: { page?: number; perPage?: number }) {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 20
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    const { data, error, count } = await supabase
      .from('achievements')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) throw error
    return { data: data as Achievement[], count: count ?? 0 }
  },

  async update(id: number, updates: Partial<Achievement>) {
    const { data, error } = await supabase
      .from('achievements')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Achievement
  },

  async delete(id: number) {
    const { error } = await supabase.from('achievements').delete().eq('id', id)
    if (error) throw error
  },
}
