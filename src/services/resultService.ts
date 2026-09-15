import { supabase } from '../lib/supabase'
import { getCached, setCache, clearCache } from '../lib/cache'
import type { Result } from '../types'

export const resultService = {
  // includeUnpublished 는 관리자 목록 전용. 공개 화면은 RLS 의 "관리자 전체 읽기" 정책 때문에 관리자 계정에서
  // 비공개 성과가 노출되므로 기본값(false)에서 is_published 를 명시 필터.
  async getAll(options?: { page?: number; perPage?: number; includeUnpublished?: boolean }) {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 4
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    let query = supabase
      .from('results')
      .select('*', { count: 'exact' })
    if (!options?.includeUnpublished) query = query.eq('is_published', true)
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) throw error
    return { data: data as Result[], count: count ?? 0 }
  },

  async getFeatured(limit = 4) {
    const key = `results:featured:${limit}`
    const cached = getCached<Result[]>(key)
    if (cached) return cached
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return setCache(key, data as Result[])
  },

  invalidate() { clearCache('results') },

  async create(result: Omit<Result, 'id' | 'created_at' | 'is_published' | 'likes_count'>) {
    const { data, error } = await supabase
      .from('results')
      .insert(result as never)
      .select()
      .single()
    if (error) throw error
    this.invalidate()
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
    this.invalidate()
    return data as Result
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('results')
      .delete()
      .eq('id', id)
    if (error) throw error
    this.invalidate()
  },
}
