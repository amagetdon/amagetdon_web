import { supabase } from '../lib/supabase'
import type { EbookWithInstructor } from '../types'

export const ebookService = {
  async getAll(options?: { isFree?: boolean; limit?: number }) {
    let query = supabase
      .from('ebooks')
      .select('*, instructor:instructors(id, name)')
      .order('sort_order')
    if (options?.isFree !== undefined) query = query.eq('is_free', options.isFree)
    if (options?.limit) query = query.limit(options.limit)
    const { data, error } = await query
    if (error) throw error
    return data as EbookWithInstructor[]
  },

  async getByInstructor(instructorId: number) {
    const { data, error } = await supabase
      .from('ebooks')
      .select('*, instructor:instructors(id, name)')
      .eq('instructor_id', instructorId)
      .order('sort_order')
    if (error) throw error
    return data as EbookWithInstructor[]
  },

  async create(ebook: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('ebooks')
      .insert(ebook as never)
      .select()
      .single()
    if (error) throw error
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
    return data
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('ebooks')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
