import { supabase } from '../lib/supabase'
import { getCached, setCache, clearCache } from '../lib/cache'
import type { Instructor } from '../types'

export const instructorService = {
  async getAll() {
    const cached = getCached<Instructor[]>('instructors:all')
    if (cached) return cached
    const { data, error } = await supabase
      .from('instructors')
      .select('*')
      .order('sort_order')
    if (error) throw error
    return setCache('instructors:all', data as Instructor[])
  },

  async getFeatured(limit = 6) {
    const key = `instructors:featured:${limit}`
    const cached = getCached<Instructor[]>(key)
    if (cached) return cached
    const { data, error } = await supabase
      .from('instructors')
      .select('*')
      .eq('is_published', true)
      .order('sort_order')
      .limit(limit)
    if (error) throw error
    return setCache(key, data as Instructor[])
  },

  async getById(id: number) {
    const { data, error } = await supabase
      .from('instructors')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as Instructor
  },

  invalidate() { clearCache('instructors') },

  async create(instructor: Omit<Instructor, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('instructors')
      .insert(instructor as never)
      .select()
      .single()
    if (error) throw error
    this.invalidate()
    return data as Instructor
  },

  async update(id: number, updates: Partial<Instructor>) {
    const { data, error } = await supabase
      .from('instructors')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    this.invalidate()
    return data as Instructor
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('instructors')
      .delete()
      .eq('id', id)
    if (error) throw error
    this.invalidate()
  },
}
