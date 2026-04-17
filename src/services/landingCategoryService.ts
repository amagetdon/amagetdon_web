import { supabase } from '../lib/supabase'
import { getCached, setCache, clearCache } from '../lib/cache'
import type { LandingCategory } from '../types'

export const landingCategoryService = {
  async getAll() {
    const { data, error } = await supabase
      .from('landing_categories')
      .select('*')
      .order('sort_order')
      .order('id')
    if (error) throw error
    return (data as LandingCategory[]) ?? []
  },

  async getPublished() {
    const cached = getCached<LandingCategory[]>('landing_categories:published')
    if (cached) return cached
    const { data, error } = await supabase
      .from('landing_categories')
      .select('*')
      .eq('is_published', true)
      .order('sort_order')
      .order('id')
    if (error) throw error
    return setCache('landing_categories:published', (data as LandingCategory[]) ?? [])
  },

  async getBySlug(slug: string) {
    const { data, error } = await supabase
      .from('landing_categories')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle()
    if (error) throw error
    return data as LandingCategory | null
  },

  invalidate() { clearCache('landing_categories') },

  async create(input: Omit<LandingCategory, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('landing_categories')
      .insert(input as never)
      .select()
      .single()
    if (error) throw error
    this.invalidate()
    return data as LandingCategory
  },

  async update(id: number, updates: Partial<Omit<LandingCategory, 'id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('landing_categories')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    this.invalidate()
    return data as LandingCategory
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('landing_categories')
      .delete()
      .eq('id', id)
    if (error) throw error
    this.invalidate()
  },

  async checkSlugAvailable(slug: string, excludeId?: number): Promise<boolean> {
    let query = supabase.from('landing_categories').select('id').eq('slug', slug)
    if (excludeId != null) query = query.neq('id', excludeId)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).length === 0
  },
}
