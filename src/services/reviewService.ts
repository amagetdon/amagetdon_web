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

    if (options?.instructorId) {
      // 강사에 직접 연결된 후기 + 강사의 강의에 달린 후기 모두 가져오기
      const { data: courseData } = await supabase
        .from('courses')
        .select('id')
        .eq('instructor_id', options.instructorId)
      const ids = (courseData as { id: number }[] | null)?.map((c) => c.id) || []
      if (ids.length > 0) {
        query = query.or(`instructor_id.eq.${options.instructorId},course_id.in.(${ids.join(',')})`)
      } else {
        query = query.eq('instructor_id', options.instructorId)
      }
    }

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

  async update(id: number, updates: Partial<Omit<Review, 'id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('reviews')
      .update(updates as never)
      .eq('id', id)
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
