import { supabase } from '../lib/supabase'
import type { Instructor } from '../types'

export const instructorService = {
  async getAll() {
    const { data, error } = await supabase
      .from('instructors')
      .select('*')
      .order('sort_order')
    if (error) throw error
    return data as Instructor[]
  },

  async getFeatured(limit = 4) {
    const { data, error } = await supabase
      .from('instructors')
      .select('*')
      .eq('has_active_course', true)
      .order('sort_order')
      .limit(limit)
    if (error) throw error
    return data as Instructor[]
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

  async create(instructor: Omit<Instructor, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('instructors')
      .insert(instructor as never)
      .select()
      .single()
    if (error) throw error
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
    return data as Instructor
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('instructors')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
