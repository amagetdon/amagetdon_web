import { supabase } from '../lib/supabase'
import type { CourseWithInstructor, CourseWithCurriculum } from '../types'

export const courseService = {
  async getAll(type?: 'free' | 'premium') {
    let query = supabase
      .from('courses')
      .select('*, instructor:instructors(id, name)')
      .order('sort_order')
    if (type) query = query.eq('course_type', type)
    const { data, error } = await query
    if (error) throw error
    return data as CourseWithInstructor[]
  },

  async getByInstructor(instructorId: number) {
    const { data, error } = await supabase
      .from('courses')
      .select('*, instructor:instructors(id, name)')
      .eq('instructor_id', instructorId)
      .order('sort_order')
    if (error) throw error
    return data as CourseWithInstructor[]
  },

  async getById(id: number) {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        instructor:instructors(id, name),
        curriculum_items(*)
      `)
      .eq('id', id)
      .order('sort_order', { referencedTable: 'curriculum_items' })
      .single()
    if (error) throw error
    return data as CourseWithCurriculum
  },

  async create(course: Omit<CourseWithInstructor, 'id' | 'created_at' | 'updated_at' | 'instructor'>) {
    const { data, error } = await supabase
      .from('courses')
      .insert(course as never)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: number, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('courses')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
