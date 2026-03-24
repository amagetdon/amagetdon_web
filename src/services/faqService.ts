import { supabase } from '../lib/supabase'
import type { Faq } from '../types'

export const faqService = {
  async getAll(options?: { search?: string; page?: number; perPage?: number }) {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 3
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    let query = supabase
      .from('faqs')
      .select('*', { count: 'exact' })
      .order('sort_order')

    if (options?.search) {
      query = query.or(`question.ilike.%${options.search}%,answer.ilike.%${options.search}%`)
    }

    const { data, error, count } = await query.range(from, to)
    if (error) throw error
    return { data: data as Faq[], count: count ?? 0 }
  },

  async create(faq: Omit<Faq, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('faqs')
      .insert(faq as never)
      .select()
      .single()
    if (error) throw error
    return data as Faq
  },

  async update(id: number, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('faqs')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Faq
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('faqs')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
