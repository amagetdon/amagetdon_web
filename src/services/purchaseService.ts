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

  async checkOwnership(
    userId: string,
    courseId?: number | null,
    ebookId?: number | null
  ): Promise<boolean> {
    let query = supabase
      .from('purchases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (courseId) {
      query = query.eq('course_id', courseId)
    } else if (ebookId) {
      query = query.eq('ebook_id', ebookId)
    } else {
      return false
    }

    const { count, error } = await query
    if (error) throw error
    return (count ?? 0) > 0
  },

  async purchaseWithPoints(
    userId: string,
    item: { courseId?: number | null; ebookId?: number | null },
    title: string,
    price: number,
    durationDays?: number | null,
    couponId?: number | null,
    originalPrice?: number | null,
    startFrom?: string | null,
  ): Promise<void> {
    // 1. 현재 포인트 잔액 확인
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', userId)
      .single<{ points: number }>()
    if (profileError) throw profileError
    if (!profile || profile.points < price) {
      throw new Error('포인트가 부족합니다.')
    }

    // 2. 이미 구매했는지 확인
    const owned = await this.checkOwnership(userId, item.courseId, item.ebookId)
    if (owned) {
      throw new Error('이미 구매한 상품입니다.')
    }

    const newBalance = profile.points - price
    const expiresAt = durationDays
      ? new Date((startFrom ? new Date(startFrom).getTime() : Date.now()) + durationDays * 86400000).toISOString()
      : null

    // 3. 포인트 차감 (optimistic locking: points 값이 예상과 다르면 실패)
    const { data: updatedRows, error: deductError } = await supabase
      .from('profiles')
      .update({ points: newBalance } as never)
      .eq('id', userId)
      .gte('points', price)
      .select('id')
    if (deductError) throw new Error('포인트 차감에 실패했습니다.')
    if (!updatedRows || updatedRows.length === 0) throw new Error('포인트가 부족합니다.')

    try {
      // 4. purchases 레코드 생성
      const { error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          user_id: userId,
          course_id: item.courseId ?? null,
          ebook_id: item.ebookId ?? null,
          coupon_id: couponId ?? null,
          title,
          original_price: originalPrice ?? price,
          price,
          expires_at: expiresAt,
        } as never)
      if (purchaseError) throw purchaseError

      // 5. point_logs 기록 (SECURITY DEFINER 함수로 RLS 우회)
      const { error: logError } = await supabase.rpc('insert_point_log', {
        p_user_id: userId,
        p_amount: -price,
        p_balance: newBalance,
        p_type: 'use',
        p_memo: `${title} 구매`,
      } as never)
      if (logError) throw logError
    } catch (err) {
      // 롤백: 차감한 만큼만 복구 (increment)
      await supabase.rpc('add_points', { user_id_input: userId, amount_input: price } as never)
      throw err
    }

    // 6. 강의 수강 포인트 지급
    await grantPurchaseRewardPoints(userId, item.courseId, item.ebookId, title)
  },

  async enrollFree(
    userId: string,
    item: { courseId?: number | null; ebookId?: number | null },
    title: string,
    durationDays?: number | null,
    startFrom?: string | null,
  ): Promise<void> {
    const owned = await this.checkOwnership(userId, item.courseId, item.ebookId)
    if (owned) {
      throw new Error('이미 등록한 상품입니다.')
    }

    const expiresAt = durationDays
      ? new Date((startFrom ? new Date(startFrom).getTime() : Date.now()) + durationDays * 86400000).toISOString()
      : null

    const { error } = await supabase
      .from('purchases')
      .insert({
        user_id: userId,
        course_id: item.courseId ?? null,
        ebook_id: item.ebookId ?? null,
        title,
        price: 0,
        expires_at: expiresAt,
      } as never)
    if (error) throw error

    await grantPurchaseRewardPoints(userId, item.courseId, item.ebookId, title)
  },
}

async function grantPurchaseRewardPoints(userId: string, courseId: number | null | undefined, ebookId: number | null | undefined, title: string) {
  if (!courseId && !ebookId) return
  try {
    const table = courseId ? 'courses' : 'ebooks'
    const targetId = courseId ?? ebookId!
    const { data } = await supabase.from(table).select('reward_points').eq('id', targetId).maybeSingle()
    const reward = (data as { reward_points?: number } | null)?.reward_points ?? 0
    if (reward > 0) {
      await supabase.rpc('add_points', { user_id_input: userId, amount_input: reward } as never)
      const { data: profile } = await supabase.from('profiles').select('points').eq('id', userId).single<{ points: number }>()
      await supabase.rpc('insert_point_log', {
        p_user_id: userId,
        p_amount: reward,
        p_balance: profile?.points ?? reward,
        p_type: 'charge',
        p_memo: `${title} 수강 적립`,
      } as never)
    }
  } catch {
    // 포인트 지급 실패는 구매 자체를 롤백하지 않음 (로그만 실패해도 구매는 유효)
  }
}
