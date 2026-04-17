import { supabase } from '../lib/supabase'
import { getCached, setCache, clearCache } from '../lib/cache'
import type { ScheduleWithDetails } from '../types'

export const scheduleService = {
  async getByMonth(year: number, month: number) {
    const key = `schedules:${year}-${month}`
    const cached = getCached<ScheduleWithDetails[]>(key)
    if (cached) return cached
    const startDate = new Date(year, month - 1, 1).toISOString()
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()

    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        course:courses(id, title),
        instructor:instructors(id, name, image_url, thumbnail_url)
      `)
      .gte('scheduled_at', startDate)
      .lte('scheduled_at', endDate)
      .order('scheduled_at')
    if (error) throw error
    return setCache(key, data as ScheduleWithDetails[])
  },

  invalidate() { clearCache('schedules') },

  async create(schedule: { course_id?: number; instructor_id?: number; scheduled_at: string; title: string }) {
    const { data, error } = await supabase
      .from('schedules')
      .insert(schedule as never)
      .select()
      .single()
    if (error) throw error
    this.invalidate()
    return data
  },

  async update(id: number, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('schedules')
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
      .from('schedules')
      .delete()
      .eq('id', id)
    if (error) throw error
    this.invalidate()
  },
}
