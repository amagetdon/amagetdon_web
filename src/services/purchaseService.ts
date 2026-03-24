import { supabase } from '../lib/supabase'
import type { Purchase } from '../types'

export const purchaseService = {
  async getByUser(userId: string) {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false })
    if (error) throw error
    return data as Purchase[]
  },

  async getMyClassroom(userId: string) {
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        *,
        course:courses(
          *,
          instructor:instructors(id, name),
          curriculum_items(*)
        )
      `)
      .eq('user_id', userId)
      .not('course_id', 'is', null)
      .order('purchased_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getMyEbooks(userId: string) {
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        *,
        ebook:ebooks(
          *,
          instructor:instructors(id, name)
        )
      `)
      .eq('user_id', userId)
      .not('ebook_id', 'is', null)
      .order('purchased_at', { ascending: false })
    if (error) throw error
    return data
  },
}
