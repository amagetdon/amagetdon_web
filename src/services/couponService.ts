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
      .select('coupon_id, coupons(*)')
      .eq('user_id', userId)
      .is('used_at', null)
    if (error) throw error
    return (data ?? [])
      .map((d: { coupon_id: number; coupons: Coupon }) => d.coupons)
      .filter((c: Coupon) => c.is_published && (!c.expires_at || new Date(c.expires_at) > new Date()))
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
