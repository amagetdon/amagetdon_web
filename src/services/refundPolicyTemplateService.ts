import { supabase } from '../lib/supabase'
import type { RefundPolicyTemplate } from '../types'

export const refundPolicyTemplateService = {
  async getAll() {
    const { data, error } = await supabase
      .from('refund_policy_templates')
      .select('*')
      .order('sort_order')
      .order('id')
    if (error) throw error
    return (data ?? []) as RefundPolicyTemplate[]
  },

  async create(payload: { name: string; content: string; sort_order?: number }) {
    const { data, error } = await supabase
      .from('refund_policy_templates')
      .insert(payload as never)
      .select()
      .single()
    if (error) throw error
    return data as RefundPolicyTemplate
  },

  async update(id: number, updates: Partial<Pick<RefundPolicyTemplate, 'name' | 'content' | 'sort_order'>>) {
    const { data, error } = await supabase
      .from('refund_policy_templates')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as RefundPolicyTemplate
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('refund_policy_templates')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async getDefault() {
    const { data, error } = await supabase
      .from('refund_policy_templates')
      .select('*')
      .eq('is_default', true)
      .maybeSingle()
    if (error) throw error
    return (data as RefundPolicyTemplate | null) ?? null
  },

  async setDefault(id: number | null) {
    const { error: unsetErr } = await supabase
      .from('refund_policy_templates')
      .update({ is_default: false } as never)
      .eq('is_default', true)
    if (unsetErr) throw unsetErr
    if (id == null) return
    const { error: setErr } = await supabase
      .from('refund_policy_templates')
      .update({ is_default: true } as never)
      .eq('id', id)
    if (setErr) throw setErr
  },
}
