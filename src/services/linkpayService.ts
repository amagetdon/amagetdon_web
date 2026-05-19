import { supabase } from '../lib/supabase'

export interface LinkpayLink {
  id: number
  product_key: string
  course_id: number | null
  ebook_id: number | null
  label: string | null
  created_at: string
}

export interface LinkpayPayment {
  id: number
  order_key: string
  payment_key: string | null
  product_key: string | null
  order_name: string | null
  customer_name: string | null
  customer_phone: string | null
  amount: number | null
  status: string | null
  course_id: number | null
  ebook_id: number | null
  matched_user_id: string | null
  granted: boolean
  purchase_id: number | null
  approved_at: string | null
  created_at: string
}

export const linkpayService = {
  async getLinks(): Promise<LinkpayLink[]> {
    const { data, error } = await supabase
      .from('linkpay_links')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as LinkpayLink[]
  },

  async createLink(input: { product_key: string; course_id: number | null; ebook_id: number | null; label: string | null }): Promise<void> {
    const { error } = await supabase.from('linkpay_links').insert(input as never)
    if (error) throw error
  },

  async deleteLink(id: number): Promise<void> {
    const { error } = await supabase.from('linkpay_links').delete().eq('id', id)
    if (error) throw error
  },

  async getPayments(): Promise<LinkpayPayment[]> {
    const { data, error } = await supabase
      .from('linkpay_payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) throw error
    return (data ?? []) as LinkpayPayment[]
  },

  /** 미매칭 결제를 회원·강의에 수동 연결해 수강권 부여 */
  async manualGrant(
    payment: LinkpayPayment,
    opts: { userId: string; courseId: number | null; ebookId: number | null; title: string; expiresAt: string | null },
  ): Promise<void> {
    const { data: purchase, error } = await supabase
      .from('purchases')
      .insert({
        user_id: opts.userId,
        course_id: opts.courseId,
        ebook_id: opts.ebookId,
        title: opts.title,
        price: payment.amount ?? 0,
        payment_key: payment.payment_key,
        payment_method: 'linkpay',
        expires_at: opts.expiresAt,
      } as never)
      .select('id')
      .single()
    if (error) throw error

    const { error: upErr } = await supabase
      .from('linkpay_payments')
      .update({
        granted: true,
        purchase_id: (purchase as { id: number }).id,
        matched_user_id: opts.userId,
        course_id: opts.courseId,
        ebook_id: opts.ebookId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', payment.id)
    if (upErr) throw upErr
  },
}
