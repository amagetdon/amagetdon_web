import { supabase } from '../lib/supabase'
import type { Purchase } from '../types'
import { CURRICULUM_PUBLIC_COLUMNS, withCurriculumVideos } from './courseService'
import { EBOOK_PUBLIC_COLUMNS } from './ebookService'

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
          curriculum_items(${CURRICULUM_PUBLIC_COLUMNS})
        )
      `)
      .eq('user_id', userId)
      .not('course_id', 'is', null)
      .order('purchased_at', { ascending: false })
    if (error) throw error
    // 영상 주소는 서버 함수로 — 만료 전 구매 강의만 받아진다
    type Row = { course: { id: number; curriculum_items?: { id: number }[] } | null }
    // 기수제 재신청으로 같은 강의 신청이 여러 줄일 수 있다 — 강의당 가장 최근 줄만 보여 준다 (최근 순 정렬이라 처음 만난 줄)
    const seen = new Set<number>()
    const rows = ((data ?? []) as unknown as Row[]).filter((r) => {
      const cid = r.course?.id
      if (cid == null) return true
      if (seen.has(cid)) return false
      seen.add(cid)
      return true
    })
    const courseIds = [...new Set(rows.map((r) => r.course?.id).filter((x): x is number => !!x))]
    const allItems = rows.flatMap((r) => r.course?.curriculum_items ?? [])
    const merged = new Map((await withCurriculumVideos(courseIds, allItems)).map((i) => [i.id, i]))
    return rows.map((r) => (r.course
      ? { ...r, course: { ...r.course, curriculum_items: (r.course.curriculum_items ?? []).map((i) => merged.get(i.id) ?? i) } }
      : r)) as typeof data
  },

  async getMyEbooks(userId: string) {
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        *,
        ebook:ebooks(
          ${EBOOK_PUBLIC_COLUMNS},
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

  // 강의 상세의 '이미 신청' 판단 — 기수제 무료 강의는 진행 중인 기수에 신청했는지만 본다
  // (지난 기수 신청자는 다시 신청할 수 있어야 그 기수 신청으로 잡힌다). 그 외 강의는 checkOwnership 과 같다.
  // 서버 함수 has_current_enrollment 가 없거나 실패하면 예전 방식(구매 기록 유무)으로 판단한다.
  async checkCourseEnrollment(userId: string, courseId: number): Promise<boolean> {
    const { data, error } = await supabase.rpc('has_current_enrollment' as never, { p_course_id: courseId } as never)
    if (error || typeof data !== 'boolean') return this.checkOwnership(userId, courseId)
    return data
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

