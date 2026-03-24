import { supabase } from '../lib/supabase'
import type { Review, ReviewWithCourse } from '../types'

export const reviewService = {
  async getAll(options?: { page?: number; perPage?: number; instructorId?: number }) {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 8
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    let query = supabase
      .from('reviews')
      .select('*, course:courses(id, title)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (options?.instructorId) query = query.eq('instructor_id', options.instructorId)

    const { data, error, count } = await query
    if (error) throw error
    return { data: data as ReviewWithCourse[], count: count ?? 0 }
  },

  async getFeatured(limit = 5) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, course:courses(id, title)')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data as ReviewWithCourse[]
  },

  async create(review: Omit<Review, 'id' | 'created_at' | 'is_published'>) {
    const { data, error } = await supabase
      .from('reviews')
      .insert(review as never)
      .select()
      .single()
    if (error) throw error
    return data as Review
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
