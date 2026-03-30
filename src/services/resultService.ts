import { supabase } from '../lib/supabase'
import type { Result } from '../types'

export const resultService = {
  async getAll(options?: { page?: number; perPage?: number }) {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 4
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    const { data, error, count } = await supabase
      .from('results')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) throw error
    return { data: data as Result[], count: count ?? 0 }
  },

  async getFeatured(limit = 4) {
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data as Result[]
  },

  async create(result: Omit<Result, 'id' | 'created_at' | 'is_published' | 'likes_count'>) {
    const { data, error } = await supabase
      .from('results')
      .insert(result as never)
      .select()
      .single()
    if (error) throw error
    return data as Result
  },

  async toggleLike(id: number, increment: boolean) {
    const { data: current, error: fetchError } = await supabase
      .from('results')
      .select('likes_count')
      .eq('id', id)
      .single()
    if (fetchError) throw fetchError

    const currentData = current as { likes_count: number | null }
    const newCount = Math.max(0, (currentData.likes_count ?? 0) + (increment ? 1 : -1))
    const { error } = await supabase
      .from('results')
      .update({ likes_count: newCount } as never)
      .eq('id', id)
    if (error) throw error
    return newCount
  },

  async update(id: number, updates: Partial<Omit<Result, 'id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('results')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Result
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('results')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
