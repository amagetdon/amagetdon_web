import { supabase } from '../lib/supabase'
import type { Banner } from '../types'

export const bannerService = {
  async getByPage(pageKey: string) {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('page_key', pageKey)
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data as Banner[]
  },

  async getAllByPage(pageKey: string) {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('page_key', pageKey)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data as Banner[]
  },

  async create(banner: Omit<Banner, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('banners')
      .insert(banner as never)
      .select()
      .single()
    if (error) throw error
    return data as Banner
  },

  async update(id: number, updates: Partial<Omit<Banner, 'id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('banners')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Banner
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('banners')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
