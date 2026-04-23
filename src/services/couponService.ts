import { supabase } from '../lib/supabase'
import type { Coupon } from '../types'

export const couponService = {
  async getPublished() {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Coupon[]
  },

  async getAll() {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Coupon[]
  },

  async create(coupon: Omit<Coupon, 'id' | 'created_at' | 'claims_count'>) {
    const { data, error } = await supabase
      .from('coupons')
      .insert({ ...coupon, claims_count: 0 } as never)
      .select()
      .single()
    if (error) throw error
    return data as Coupon
  },

  async update(id: number, updates: Partial<Omit<Coupon, 'id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('coupons')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Coupon
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async claim(couponId: number, userId: string) {
    const { data: existing } = await supabase
      .from('coupon_claims')
      .select('id')
      .eq('coupon_id', couponId)
      .eq('user_id', userId)
      .maybeSingle()
    if (existing) throw new Error('이미 받은 쿠폰입니다.')

    const { error: claimError } = await supabase
      .from('coupon_claims')
      .insert({ coupon_id: couponId, user_id: userId } as never)
    if (claimError) throw claimError

    await supabase.rpc('increment_coupon_claims', { coupon_id_input: couponId } as never)

    // 쿠폰 발급 알림톡 트리거 (실패해도 메인 흐름에 영향 없음)
    try {
      const [{ data: coupon }, { data: profile }] = await Promise.all([
        supabase.from('coupons').select('title, discount_type, discount_value, expires_at, use_days').eq('id', couponId).maybeSingle(),
        supabase.from('profiles').select('name, phone, email').eq('id', userId).maybeSingle(),
      ])
      const c = coupon as { title?: string; discount_type?: string; discount_value?: number; expires_at?: string | null; use_days?: number | null } | null
      const p = profile as { name?: string | null; phone?: string | null; email?: string | null } | null
      if (c && p) {
        const expiresAt = c.expires_at
          ? new Date(c.expires_at).toLocaleDateString('ko-KR')
          : c.use_days
          ? new Date(Date.now() + c.use_days * 86400_000).toLocaleDateString('ko-KR')
          : ''
        const { webhookService } = await import('./webhookService')
        webhookService.fireCustomEvent('coupon_issued', {
          coupon_name: c.title ?? '',
          coupon_value: c.discount_type === 'percent' ? `${c.discount_value}%` : `${(c.discount_value ?? 0).toLocaleString()}원`,
          expires_at: expiresAt,
        }, {
          userId,
          userName: p.name ?? '',
          userPhone: p.phone ?? '',
          userEmail: p.email ?? '',
          title: c.title ?? '',
        }).catch(() => {})
      }
    } catch {
      // noop
    }
  },

  async getUserClaims(userId: string) {
    const { data, error } = await supabase
      .from('coupon_claims')
      .select('coupon_id')
      .eq('user_id', userId)
    if (error) throw error
    return new Set((data ?? []).map((d: { coupon_id: number }) => d.coupon_id))
  },

  /** 사용 가능한(받았지만 아직 안 쓴) 쿠폰 목록 */
  async getUsableCoupons(userId: string) {
    const { data, error } = await supabase
      .from('coupon_claims')
      .select('coupon_id, claimed_at, coupons(*)')
      .eq('user_id', userId)
      .is('used_at', null)
    if (error) throw error
    const now = Date.now()
    return (data ?? [])
      .filter((d: { coupon_id: number; claimed_at: string; coupons: Coupon }) => {
        const c = d.coupons
        if (!c.is_published) return false
        if (c.expires_at && new Date(c.expires_at).getTime() < now) return false
        if (c.use_days && d.claimed_at) {
          const deadline = new Date(d.claimed_at).getTime() + c.use_days * 86400000
          if (deadline < now) return false
        }
        return true
      })
      .map((d: { coupon_id: number; claimed_at: string; coupons: Coupon }) => {
        const c = d.coupons
        // use_days가 있으면 claimed_at 기준 만료일 계산해서 expires_at에 덮어씌움
        if (c.use_days && d.claimed_at) {
          const deadline = new Date(new Date(d.claimed_at).getTime() + c.use_days * 86400000).toISOString()
          return { ...c, expires_at: c.expires_at && c.expires_at < deadline ? c.expires_at : deadline }
        }
        return c
      })
  },

  /** 쿠폰 사용 처리 */
  async useCoupon(couponId: number, userId: string) {
    const { error } = await supabase
      .from('coupon_claims')
      .update({ used_at: new Date().toISOString() } as never)
      .eq('coupon_id', couponId)
      .eq('user_id', userId)
      .is('used_at', null)
    if (error) throw error
  },
}
