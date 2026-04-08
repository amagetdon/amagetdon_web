import { supabase } from '../lib/supabase'
import { getCached, setCache, clearCache } from '../lib/cache'
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
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (options?.instructorId) {
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
    const key = `reviews:featured:${limit}`
    const cached = getCached<ReviewWithCourse[]>(key)
    if (cached) return cached
    const { data, error } = await supabase
      .from('reviews')
      .select('*, course:courses(id, title)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return setCache(key, data as ReviewWithCourse[])
  },

  async getByCourse(courseId: number, page = 1, perPage = 4) {
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    const { data, error, count } = await supabase
      .from('reviews')
      .select('*', { count: 'exact' })
      .eq('course_id', courseId)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    return { data: data as Review[], count: count ?? 0 }
  },

  async getCourseStats(courseId: number) {
    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('course_id', courseId)
      .eq('is_published', true)
    if (error) throw error
    const ratings = (data as { rating: number }[]) || []
    const count = ratings.length
    const avg = count > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / count : 0
    return { avgRating: avg, totalCount: count }
  },

  async getByUser(userId: string, courseId: number) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .limit(1)

    if (error) throw error
    return data.length > 0 ? (data[0] as Review) : null
  },

  invalidate() { clearCache('reviews') },

  async create(review: Omit<Review, 'id' | 'created_at' | 'is_published'>) {
    const { data, error } = await supabase
      .from('reviews')
      .insert(review as never)
      .select()
      .single()
    if (error) throw error
    this.invalidate()
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
    this.invalidate()
    return data as Review
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id)
    if (error) throw error
    this.invalidate()
  },
}
