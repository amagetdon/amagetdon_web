import { supabase } from '../lib/supabase'

export interface CourseProgress {
  id: number
  user_id: string
  course_id: number
  curriculum_item_id: number
  is_completed: boolean
  completed_at: string | null
  last_watched_at: string
  created_at: string
}

export const progressService = {
  async getCourseProgress(userId: string, courseId: number): Promise<CourseProgress[]> {
    const { data, error } = await supabase
      .from('course_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('course_id', courseId)
    if (error) throw error
    return data as CourseProgress[]
  },

  async markCompleted(userId: string, courseId: number, curriculumItemId: number): Promise<void> {
    const { error } = await supabase
      .from('course_progress')
      .upsert(
        {
          user_id: userId,
          course_id: courseId,
          curriculum_item_id: curriculumItemId,
          is_completed: true,
          completed_at: new Date().toISOString(),
          last_watched_at: new Date().toISOString(),
        } as never,
        { onConflict: 'user_id,curriculum_item_id' }
      )
    if (error) throw error
  },

  async toggleCompleted(
    userId: string,
    courseId: number,
    curriculumItemId: number,
    isCompleted: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('course_progress')
      .upsert(
        {
          user_id: userId,
          course_id: courseId,
          curriculum_item_id: curriculumItemId,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          last_watched_at: new Date().toISOString(),
        } as never,
        { onConflict: 'user_id,curriculum_item_id' }
      )
    if (error) throw error
  },

  async getCourseCompletion(userId: string, courseId: number): Promise<number> {
    const { data: items, error: itemsError } = await supabase
      .from('curriculum_items')
      .select('id')
      .eq('course_id', courseId)
    if (itemsError) throw itemsError

    const totalItems = items?.length ?? 0
    if (totalItems === 0) return 0

    const { data: completed, error: completedError } = await supabase
      .from('course_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('is_completed', true)
    if (completedError) throw completedError

    const completedCount = completed?.length ?? 0
    return Math.round((completedCount / totalItems) * 100)
  },
}
