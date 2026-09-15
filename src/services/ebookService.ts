import { supabase } from '../lib/supabase'
import { getCached, setCache, clearCache } from '../lib/cache'
import type { EbookWithInstructor } from '../types'

export const ebookService = {
  // includeUnpublished 는 관리자 목록 전용. 공개 화면은 RLS 의 "관리자 전체 읽기" 정책 때문에 관리자 계정에서
  // 비공개 전자책이 노출되므로 기본값(false)에서 is_published 를 명시 필터.
  async getAll(options?: { isFree?: boolean; limit?: number; includeUnpublished?: boolean }) {
    const key = `ebooks:${options?.isFree ?? 'all'}:${options?.limit ?? 'all'}:${options?.includeUnpublished ? 'all' : 'pub'}`
    const cached = getCached<EbookWithInstructor[]>(key)
    if (cached) return cached
    let query = supabase
      .from('ebooks')
      .select('*, instructor:instructors(id, name)')
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (!options?.includeUnpublished) query = query.eq('is_published', true)
    if (options?.isFree !== undefined) query = query.eq('is_free', options.isFree)
    if (options?.limit) query = query.limit(options.limit)
    const { data, error } = await query
    if (error) throw error
    return setCache(key, data as EbookWithInstructor[])
  },

  async getById(id: number) {
    const { data, error } = await supabase
      .from('ebooks')
      .select('*, instructor:instructors(id, name)')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as EbookWithInstructor
  },

  async getByInstructor(instructorId: number) {
    const { data, error } = await supabase
      .from('ebooks')
      .select('*, instructor:instructors(id, name)')
      .eq('instructor_id', instructorId)
      .eq('is_published', true)
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as EbookWithInstructor[]
  },

  invalidate() { clearCache('ebooks') },

  async create(ebook: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('ebooks')
      .insert(ebook as never)
      .select()
      .single()
    if (error) throw error
    this.invalidate()
    return data
  },

  async update(id: number, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('ebooks')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    this.invalidate()
    return data
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('ebooks')
      .delete()
      .eq('id', id)
    if (error) throw error
    this.invalidate()
  },
}
