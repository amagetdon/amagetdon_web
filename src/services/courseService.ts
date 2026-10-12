import { supabase } from '../lib/supabase'
import { getCached, setCache, clearCache } from '../lib/cache'
import type { CourseWithInstructor, CourseWithCurriculum } from '../types'

// 영상 주소(video_url·video_urls)는 공개 조회 권한이 없다 — curriculum_items 는 select('*') 금지.
// 영상은 withCurriculumVideos(구매자·관리자만 서버 함수로 받음)로 붙인다.
export const CURRICULUM_PUBLIC_COLUMNS = 'id, course_id, week, label, description, is_redirect, sort_order, created_at'

type CurriculumVideoRow = { id: number; course_id: number; video_url: string | null; video_urls: unknown }

/** 구매자(만료 전)·관리자에게만 영상 주소를 받아 커리큘럼 항목에 합친다. 권한 없는 강의는 영상 없이 그대로 */
export async function withCurriculumVideos<T extends { id: number }>(courseIds: number[], items: T[]) {
  if (courseIds.length === 0 || items.length === 0) return items
  const { data, error } = await supabase.rpc('get_curriculum_videos', { p_course_ids: courseIds } as never)
  if (error) throw error
  const byId = new Map(((data ?? []) as CurriculumVideoRow[]).map((v) => [v.id, v]))
  return items.map((item) => {
    const v = byId.get(item.id)
    return { ...item, video_url: v?.video_url ?? null, video_urls: Array.isArray(v?.video_urls) ? v.video_urls : [] }
  })
}

export const courseService = {
  async getAll(type?: 'free' | 'premium') {
    const key = `courses:${type || 'all'}`
    const cached = getCached<CourseWithInstructor[]>(key)
    if (cached) return cached
    let query = supabase
      .from('courses')
      .select('*, instructor:instructors(id, name)')
      .order('sort_order')
      .order('created_at', { ascending: false })
    // 'free' 카테고리에는 pre_alert (사전 알림 신청) 강의도 포함 — 무료강의와 동일 분류, 알림톡만 분기.
    if (type === 'free') query = query.in('course_type', ['free', 'pre_alert'])
    else if (type) query = query.eq('course_type', type)
    const { data, error } = await query
    if (error) throw error
    return setCache(key, data as CourseWithInstructor[])
  },

  async getAllPublic(type?: 'free' | 'premium') {
    const key = `courses:public:${type || 'all'}`
    const cached = getCached<CourseWithInstructor[]>(key)
    if (cached) return cached
    const nowIso = new Date().toISOString()
    let query = supabase
      .from('courses')
      .select('*, instructor:instructors(id, name)')
      .eq('is_published', true)
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    if (type === 'free') {
      // 무료 카테고리에 pre_alert 도 포함. pre_alert 는 enrollment_start 가 미래여도 노출(오픈 전 신청 받기 의도).
      query = query
        .in('course_type', ['free', 'pre_alert'])
        .or(`course_type.eq.pre_alert,enrollment_start.is.null,enrollment_start.lte.${nowIso}`)
    } else if (type) {
      query = query
        .eq('course_type', type)
        .or(`enrollment_start.is.null,enrollment_start.lte.${nowIso}`)
    } else {
      query = query.or(`enrollment_start.is.null,enrollment_start.lte.${nowIso}`)
    }
    const { data, error } = await query
    if (error) throw error
    return setCache(key, data as CourseWithInstructor[])
  },

  async getByInstructor(instructorId: number) {
    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from('courses')
      .select('*, instructor:instructors(id, name)')
      .eq('instructor_id', instructorId)
      .eq('is_published', true)
      .or(`enrollment_start.is.null,enrollment_start.lte.${nowIso}`)
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as CourseWithInstructor[]
  },

  async getById(id: number) {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        instructor:instructors(id, name),
        curriculum_items(${CURRICULUM_PUBLIC_COLUMNS})
      `)
      .eq('id', id)
      .order('sort_order', { referencedTable: 'curriculum_items' })
      .single()
    if (error) throw error
    return data as unknown as CourseWithCurriculum
  },

  /** 관리자 편집·복제용 — 커리큘럼에 영상 주소까지 붙여서 반환 */
  async getByIdWithVideos(id: number) {
    const course = await this.getById(id)
    const items = await withCurriculumVideos([id], course.curriculum_items ?? [])
    return { ...course, curriculum_items: items } as CourseWithCurriculum
  },

  invalidate() { clearCache('courses') },

  async create(course: Omit<CourseWithInstructor, 'id' | 'created_at' | 'updated_at' | 'instructor'>) {
    const { data, error } = await supabase
      .from('courses')
      .insert(course as never)
      .select()
      .single()
    if (error) throw error
    this.invalidate()
    return data
  },

  async update(id: number, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('courses')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    this.invalidate()
    return data
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)
    if (error) throw error
    this.invalidate()
  },

  /**
   * 강의 + 커리큘럼을 통째로 복제합니다. 새 제목은 "원본 (1)", 이미 존재하면 (2), (3)…
   * sort_order 는 현재 최댓값 + 1 로 설정해 목록 하단에 위치하게 합니다.
   * options.isPublished 를 명시하면 그 값으로 복제본 공개 여부를 지정 (생략 시 원본 그대로).
   */
  async duplicate(id: number, options?: { isPublished?: boolean }) {
    const original = await this.getByIdWithVideos(id)

    const { data: allRows, error: allErr } = await supabase
      .from('courses')
      .select('title, sort_order')
    if (allErr) throw allErr
    const all = (allRows ?? []) as { title: string; sort_order: number | null }[]
    const titles = new Set(all.map((c) => c.title))
    const maxOrder = all.reduce((acc, c) => Math.max(acc, c.sort_order ?? 0), 0)

    const baseTitle = original.title
    let suffix = 1
    let newTitle = `${baseTitle} (${suffix})`
    while (titles.has(newTitle)) {
      suffix += 1
      newTitle = `${baseTitle} (${suffix})`
    }

    // 복제에서 제외할 필드: id/타임스탬프/조인 결과/커리큘럼.
    const {
      id: _origId,
      created_at: _origCreated,
      updated_at: _origUpdated,
      instructor: _origInstructor,
      curriculum_items: _origCurriculum,
      ...rest
    } = original as CourseWithCurriculum & { instructor?: unknown }
    void _origId; void _origCreated; void _origUpdated; void _origInstructor; void _origCurriculum

    const insertPayload = {
      ...rest,
      title: newTitle,
      sort_order: maxOrder + 1,
      ...(options?.isPublished !== undefined ? { is_published: options.isPublished } : {}),
    }

    const { data: created, error: insErr } = await supabase
      .from('courses')
      .insert(insertPayload as never)
      .select()
      .single()
    if (insErr) throw insErr
    const newCourseId = (created as { id: number }).id

    const items = original.curriculum_items ?? []
    if (items.length > 0) {
      const curriculumPayload = items.map((item) => {
        const { id: _ciId, course_id: _ciCourseId, created_at: _ciCreated, ...crest } = item
        void _ciId; void _ciCourseId; void _ciCreated
        return { ...crest, course_id: newCourseId }
      })
      const { error: cuErr } = await supabase
        .from('curriculum_items')
        .insert(curriculumPayload as never)
      if (cuErr) {
        // 커리큘럼 복제 실패 시 새로 생성된 강의도 같이 롤백 — 반쪽짜리 강의가 남지 않도록.
        await supabase.from('courses').delete().eq('id', newCourseId)
        throw cuErr
      }
    }

    this.invalidate()
    return created
  },
}
