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

  // 포인트 구매 — 서버 함수 purchase_with_points 가 가격(정가·할인 기간)·쿠폰을 DB 값으로 다시 계산하고
  // 포인트 차감·구매 행·쿠폰 사용 처리·포인트 로그·수강 적립을 한 트랜잭션으로 처리한다.
  // 반환값의 final_price 가 실제 차감액(화면 계산과 다르면 서버 값이 기준).
  async purchaseWithPoints(
    item: { courseId?: number | null; ebookId?: number | null },
    couponId?: number | null,
  ): Promise<{ final_price: number; price: number; discount: number; balance: number }> {
    const kind = item.courseId ? 'course' : item.ebookId ? 'ebook' : null
    const id = item.courseId ?? item.ebookId
    if (!kind || !id) throw new Error('잘못된 상품입니다.')
    const { data, error } = await supabase.rpc('purchase_with_points' as never, { p_kind: kind, p_id: id, p_coupon_id: couponId ?? null } as never)
    if (error) throw new Error(error.message || '구매에 실패했습니다.')
    return data as unknown as { final_price: number; price: number; discount: number; balance: number }
  },


  // 무료 신청 — 서버 함수 enroll_free 가 DB 값으로 무료 여부·판매 중·모집 기간·정원·보유를 검사하고
  // 구매 행 생성 + 수강 적립까지 처리한다(브라우저가 purchases·포인트를 직접 바꾸지 않음).
  // 수강 기간·제목·적립금도 서버가 DB 값으로 정한다.
  async enrollFree(item: { courseId?: number | null; ebookId?: number | null }): Promise<void> {
    const kind = item.courseId ? 'course' : item.ebookId ? 'ebook' : null
    const id = item.courseId ?? item.ebookId
    if (!kind || !id) throw new Error('잘못된 상품입니다.')
    const { error } = await supabase.rpc('enroll_free' as never, { p_kind: kind, p_id: id } as never)
    if (error) throw new Error(error.message || '등록에 실패했습니다.')
  },

}

