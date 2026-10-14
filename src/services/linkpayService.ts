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

  /**
   * 토스 상품을 캐시에 동기화하고 캐시 전체를 반환.
   * full=false: 신규 상품만 추가 / full=true: 전체 재동기화 (수정·삭제 반영)
   */
  async syncTossProducts(full = false): Promise<{ products: TossProduct[]; syncedCount: number; full: boolean }> {
    const { data, error } = await supabase.functions.invoke('linkpay-products', { body: { full } })
    if (error) {
      const msg = (data as { error?: string } | null)?.error
      throw new Error(msg || error.message)
    }
    const payload = (data as { products?: TossProduct[]; error?: string; syncedCount?: number; full?: boolean }) ?? {}
    if (payload.error) throw new Error(payload.error)
    return { products: payload.products ?? [], syncedCount: payload.syncedCount ?? 0, full: !!payload.full }
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

  /**
   * 이미 부여된 결제를 다른 수강생 계정·강의로 옮긴다 (RPC admin_move_linkpay_payment).
   * 원래 구매가 분할 합산이면 금액만 빼고, 아니면 revokeOld 에 따라 원래 수강권을 회수하거나 0원으로 남긴다.
   */
  async movePayment(
    payment: LinkpayPayment,
    opts: { userId: string; courseId: number | null; ebookId: number | null; title: string; expiresAt: string | null; revokeOld: boolean },
  ): Promise<{ mode: 'attached' | 'top_up' | 'inserted'; oldAction: 'subtracted' | 'revoked' | 'zeroed' | 'none' }> {
    const { data, error } = await supabase.rpc('admin_move_linkpay_payment', {
      p_linkpay_id: payment.id,
      p_user_id: opts.userId,
      p_course_id: opts.courseId,
      p_ebook_id: opts.ebookId,
      p_title: opts.title,
      p_expires_at: opts.expiresAt,
      p_revoke_old: opts.revokeOld,
    } as never)
    if (error) throw error
    const r = (data ?? {}) as { mode?: 'attached' | 'top_up' | 'inserted'; old_action?: 'subtracted' | 'revoked' | 'zeroed' | 'none' }
    return { mode: r.mode ?? 'inserted', oldAction: r.old_action ?? 'none' }
  },

  /**
   * 미부여 결제를 회원·강의에 연결 (RPC admin_attach_linkpay_payment).
   * 같은 회원·강의에 0원 수강권이 있으면 거기에 결제를 붙이고(attached), 유료 구매가 있으면 금액을 더하고(top_up, 차액·분할),
   * 없으면 새 구매를 만든다(inserted). 예전엔 늘 새로 만들어 팀이 준 0원 수강권과 중복됐다.
   */
  async manualGrant(
    payment: LinkpayPayment,
    opts: { userId: string; courseId: number | null; ebookId: number | null; title: string; expiresAt: string | null },
  ): Promise<{ mode: 'attached' | 'top_up' | 'inserted'; purchaseId: number }> {
    const { data, error } = await supabase.rpc('admin_attach_linkpay_payment', {
      p_linkpay_id: payment.id,
      p_user_id: opts.userId,
      p_course_id: opts.courseId,
      p_ebook_id: opts.ebookId,
      p_title: opts.title,
      p_expires_at: opts.expiresAt,
    } as never)
    if (error) throw error
    const r = (data ?? {}) as { mode?: 'attached' | 'top_up' | 'inserted'; purchase_id?: number }
    return { mode: r.mode ?? 'inserted', purchaseId: r.purchase_id ?? 0 }
  },
}
