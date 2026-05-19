import { supabase } from '../lib/supabase'

export interface LinkpayLink {
  id: number
  product_key: string
  course_id: number | null
  ebook_id: number | null
  label: string | null
  created_at: string
}

export interface TossProduct {
  productKey: string
  name: string
  amount: number
  status: string | null
  thumbnail: string | null
  createdAt: string | null
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
    // product_key 가 이미 있으면 갱신 (재매핑 허용)
    const { error } = await supabase
      .from('linkpay_links')
      .upsert(input as never, { onConflict: 'product_key' })
    if (error) throw error
  },

  async deleteLink(id: number): Promise<void> {
    const { error } = await supabase.from('linkpay_links').delete().eq('id', id)
    if (error) throw error
  },

  /** DB 캐시에 저장된 토스 상품 목록 (페이지 로드 시 즉시 표시용) */
  async getCachedProducts(): Promise<TossProduct[]> {
    const { data, error } = await supabase
      .from('linkpay_products')
      .select('product_key, name, amount, thumbnail, status, toss_created_at')
      .order('toss_created_at', { ascending: false, nullsFirst: false })
    if (error) throw error
    return (data ?? []).map((r) => {
      const row = r as Record<string, unknown>
      return {
        productKey: row.product_key as string,
        name: (row.name as string) ?? '',
        amount: (row.amount as number) ?? 0,
        thumbnail: (row.thumbnail as string) ?? null,
        status: (row.status as string) ?? null,
        createdAt: (row.toss_created_at as string) ?? null,
      }
    })
  },

  /** 토스에서 신규 상품만 추가 조회해 캐시에 저장하고, 캐시 전체를 반환 */
  async syncTossProducts(): Promise<{ products: TossProduct[]; newCount: number }> {
    const { data, error } = await supabase.functions.invoke('linkpay-products')
    if (error) {
      const msg = (data as { error?: string } | null)?.error
      throw new Error(msg || error.message)
    }
    const payload = (data as { products?: TossProduct[]; error?: string; newCount?: number }) ?? {}
    if (payload.error) throw new Error(payload.error)
    return { products: payload.products ?? [], newCount: payload.newCount ?? 0 }
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
