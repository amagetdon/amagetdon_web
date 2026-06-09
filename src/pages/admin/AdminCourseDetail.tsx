import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import MultiImageUploader from '../../components/admin/MultiImageUploader'
import VideoUrlInput from '../../components/admin/VideoUrlInput'
import RefundPolicyEditor from '../../components/admin/RefundPolicyEditor'
import RichTextEditor from '../../components/admin/RichTextEditor'
import WebhookScheduleEditor from '../../components/admin/WebhookScheduleEditor'
import CourseWebhookVariablesEditor from '../../components/admin/CourseWebhookVariablesEditor'
import InstructorFormModal, { newInstructor } from '../../components/admin/InstructorFormModal'
import { courseService } from '../../services/courseService'
import { scheduleService } from '../../services/scheduleService'
import { reviewService } from '../../services/reviewService'
import { instructorService } from '../../services/instructorService'
import { landingCategoryService } from '../../services/landingCategoryService'
import { refundPolicyTemplateService } from '../../services/refundPolicyTemplateService'
import { supabase } from '../../lib/supabase'
import type { CourseWithCurriculum, Review, Instructor, LandingCategory } from '../../types'

interface CurriculumVideo {
  url: string
  is_redirect: boolean
  label: string | null
}

interface CurriculumRow {
  id?: number
  week: number | null
  label: string
  description: string | null
  // 한 항목 안에 여러 영상/외부 링크. 빈 배열이면 영상 없음.
  video_urls: CurriculumVideo[]
  sort_order: number
}

interface CourseSeoShape {
  title?: string
  author?: string
  description?: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
}

const toKstDatetimeLocal = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 16)
}

type DetailTab = 'info' | 'curriculum' | 'reviews' | 'members' | 'webhooks'

const TABS: { key: DetailTab; label: string; icon: string }[] = [
  { key: 'info', label: '기본 정보', icon: 'ti-info-circle' },
  { key: 'curriculum', label: '커리큘럼', icon: 'ti-list' },
  { key: 'reviews', label: '수강 후기', icon: 'ti-message-star' },
  { key: 'members', label: '수강생', icon: 'ti-users' },
  { key: 'webhooks', label: '예약 알림톡', icon: 'ti-bell-ringing' },
]

export default function AdminCourseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const courseId = isNew ? null : id ? Number(id) : null
  const [course, setCourse] = useState<CourseWithCurriculum | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [stats, setStats] = useState<{ enrollmentCount: number; reviewCount: number; avgRating: number }>({ enrollmentCount: 0, reviewCount: 0, avgRating: 0 })
  const [tab, setTab] = useState<DetailTab>('info')

  // 기본 정보 편집 상태
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [instructors, setInstructors] = useState<Instructor[]>([])
  // 강사 select 옆 '+추가' 버튼으로 여는 강사 등록 모달
  const [instructorEditing, setInstructorEditing] = useState<Partial<Instructor> | null>(null)
  const [landingCategories, setLandingCategories] = useState<LandingCategory[]>([])
  const [allCourses, setAllCourses] = useState<{ id: number; title: string }[]>([])

  // 커리큘럼 편집 상태
  const [curriculumItems, setCurriculumItems] = useState<CurriculumRow[]>([])
  const [curriculumSaving, setCurriculumSaving] = useState(false)
  const [curriculumDragIndex, setCurriculumDragIndex] = useState<number | null>(null)
  // 호버 중인 카드 인덱스와 마우스 Y 기준 위/아래 위치 — 인접 카드끼리 swap 과 끝자리 이동을 모두 지원.
  const [curriculumDragOver, setCurriculumDragOver] = useState<{ idx: number; position: 'above' | 'below' } | null>(null)
  // 삭제 직전 확인 — 항목에 내용이 있을 때만 다이얼로그 띄움
  const [curriculumDeleteIdx, setCurriculumDeleteIdx] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 수강생
  interface MemberRow {
    purchase_id: number
    purchased_at: string
    expires_at: string | null
    price: number
    original_price: number | null
    payment_method: string | null
    user_id: string
    user_name: string | null
    user_email: string | null
    user_phone: string | null
    completion_rate: number
  }
  const MEMBERS_PER_PAGE = 10
  const [members, setMembers] = useState<MemberRow[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersPage, setMembersPage] = useState(1)
  const [membersSearch, setMembersSearch] = useState('')

  const fetchMembers = useCallback(async () => {
    if (!courseId) return
    setMembersLoading(true)
    try {
      const [purchaseRes, progressRes, itemsRes] = await Promise.all([
        supabase
          .from('purchases')
          .select('id, purchased_at, expires_at, price, original_price, payment_method, user_id, profile:profiles(id, name, email, phone)')
          .eq('course_id', courseId)
          .order('purchased_at', { ascending: false }),
        supabase
          .from('course_progress')
          .select('user_id')
          .eq('course_id', courseId)
          .eq('is_completed', true),
        supabase
          .from('curriculum_items')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', courseId),
      ])
      if (purchaseRes.error) throw purchaseRes.error

      const totalItems = itemsRes.count ?? 0
      const completedByUser = new Map<string, number>()
      for (const row of (progressRes.data ?? []) as { user_id: string }[]) {
        completedByUser.set(row.user_id, (completedByUser.get(row.user_id) ?? 0) + 1)
      }

      const rows: MemberRow[] = (purchaseRes.data ?? []).map((p) => {
        const purchase = p as unknown as {
          id: number; purchased_at: string; expires_at: string | null; price: number
          original_price: number | null; payment_method: string | null; user_id: string
          profile: { id: string; name: string | null; email: string | null; phone: string | null } | null
        }
        const completed = completedByUser.get(purchase.user_id) ?? 0
        return {
          purchase_id: purchase.id,
          purchased_at: purchase.purchased_at,
          expires_at: purchase.expires_at,
          price: purchase.price,
          original_price: purchase.original_price,
          payment_method: purchase.payment_method,
          user_id: purchase.user_id,
          user_name: purchase.profile?.name ?? null,
          user_email: purchase.profile?.email ?? null,
          user_phone: purchase.profile?.phone ?? null,
          completion_rate: totalItems > 0 ? Math.round((completed / totalItems) * 100) : 0,
        }
      })
      setMembers(rows)
    } catch {
      toast.error('수강생 목록을 불러오는데 실패했습니다.')
    } finally {
      setMembersLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    if (tab === 'members' && courseId) fetchMembers()
  }, [tab, courseId, fetchMembers])

  const filteredMembers = members.filter((m) => {
    if (!membersSearch.trim()) return true
    const q = membersSearch.toLowerCase()
    return (m.user_name ?? '').toLowerCase().includes(q)
      || (m.user_email ?? '').toLowerCase().includes(q)
      || (m.user_phone ?? '').includes(q)
  })
  const membersTotalPages = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE))
  const pagedMembers = filteredMembers.slice((membersPage - 1) * MEMBERS_PER_PAGE, membersPage * MEMBERS_PER_PAGE)

  const formatKoDate = (iso: string | null | undefined) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('ko-KR')
  }

  // 수강 후기
  const REVIEWS_PER_PAGE = 8
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsTotal, setReviewsTotal] = useState(0)
  const [reviewsPage, setReviewsPage] = useState(1)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewDeleteTarget, setReviewDeleteTarget] = useState<Review | null>(null)
  const [reviewDeleting, setReviewDeleting] = useState(false)
  const [reviewTogglingId, setReviewTogglingId] = useState<number | null>(null)

  const fetchReviews = useCallback(async (page: number) => {
    if (!courseId) return
    setReviewsLoading(true)
    try {
      const from = (page - 1) * REVIEWS_PER_PAGE
      const to = from + REVIEWS_PER_PAGE - 1
      const { data, count, error } = await supabase
        .from('reviews')
        .select('*', { count: 'exact' })
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      setReviews((data as Review[]) ?? [])
      setReviewsTotal(count ?? 0)
    } catch {
      toast.error('후기를 불러오는데 실패했습니다.')
    } finally {
      setReviewsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    if (tab === 'reviews' && courseId) fetchReviews(reviewsPage)
  }, [tab, courseId, reviewsPage, fetchReviews])

  const togglePublish = async (review: Review) => {
    if (reviewTogglingId != null) return
    setReviewTogglingId(review.id)
    try {
      await reviewService.update(review.id, { is_published: !review.is_published })
      toast.success(review.is_published ? '비공개로 전환했습니다.' : '공개로 전환했습니다.')
      await fetchReviews(reviewsPage)
    } catch {
      toast.error('변경에 실패했습니다.')
    } finally {
      setReviewTogglingId(null)
    }
  }

  const handleReviewDelete = async () => {
    if (!reviewDeleteTarget) return
    setReviewDeleting(true)
    try {
      await reviewService.delete(reviewDeleteTarget.id)
      toast.success('후기가 삭제되었습니다.')
      setReviewDeleteTarget(null)
      await fetchReviews(reviewsPage)
    } catch {
      toast.error('삭제에 실패했습니다.')
    } finally {
      setReviewDeleting(false)
    }
  }

  const reviewsTotalPages = Math.max(1, Math.ceil(reviewsTotal / REVIEWS_PER_PAGE))

  const loadCourse = useCallback(async () => {
    if (!courseId) return
    setLoading(true)
    try {
      const data = await courseService.getById(courseId)
      setCourse(data)
      const raw = data as unknown as { landing_image_urls?: string[] | null; landing_image_links?: string[] | null }
      const rawUrls = Array.isArray(raw.landing_image_urls) ? raw.landing_image_urls : []
      const rawLinks = Array.isArray(raw.landing_image_links) ? raw.landing_image_links : []
      let normalizedUrls: string[]
      let normalizedLinks: string[]
      if (rawUrls.length > 0) {
        // url 이 빈 항목은 버리되, 링크는 같은 인덱스끼리 짝지어 함께 정리한다.
        const pairs = rawUrls.map((u, i) => ({ u, l: rawLinks[i] ?? '' })).filter((p) => !!p.u)
        normalizedUrls = pairs.map((p) => p.u)
        normalizedLinks = pairs.map((p) => p.l)
      } else if (data.landing_image_url) {
        normalizedUrls = [data.landing_image_url]
        normalizedLinks = ['']
      } else {
        normalizedUrls = []
        normalizedLinks = []
      }
      setEditing({ ...(data as unknown as Record<string, unknown>), landing_image_urls: normalizedUrls, landing_image_links: normalizedLinks })
      setCurriculumItems(
        (data.curriculum_items ?? []).map((item) => {
          const raw = (item as { video_urls?: unknown }).video_urls
          let videos: CurriculumVideo[] = []
          if (Array.isArray(raw)) {
            videos = (raw as Array<Record<string, unknown>>).map((v) => ({
              url: typeof v.url === 'string' ? v.url : '',
              is_redirect: !!v.is_redirect,
              label: typeof v.label === 'string' ? v.label : null,
            })).filter((v) => v.url)
          }
          // jsonb 배열이 비어있는데 옛 video_url 이 있다면 흡수 — 마이그레이션 누락된 환경 대비 안전망.
          if (videos.length === 0 && item.video_url) {
            videos = [{
              url: item.video_url,
              is_redirect: !!(item as { is_redirect?: boolean }).is_redirect,
              label: null,
            }]
          }
          return {
            id: item.id,
            week: item.week,
            label: item.label,
            description: item.description,
            video_urls: videos,
            sort_order: item.sort_order,
          }
        })
      )
    } catch {
      toast.error('강의를 불러오는데 실패했습니다.')
      navigate('/admin/courses')
    } finally {
      setLoading(false)
    }
  }, [courseId, navigate])

  useEffect(() => {
    if (isNew) {
      setEditing({
        title: '',
        instructor_id: null,
        course_type: 'free',
        original_price: 0,
        sale_price: 0,
        installment_months: 12,
        is_published: true,
        is_on_sale: true,
        reviews_enabled: true,
        allow_guest_purchase: false,
        landing_category_ids: [],
        related_course_ids: [],
        landing_image_urls: [],
        landing_image_links: [],
        strengths: [],
        features: [],
        seo: {},
        reward_points: 0,
        refund_policy: '',
        duration_days: 40,
        applicants_min: null,
        applicants_max: null,
        applicants_refresh_min: -1,
        applicants_refresh_max: 2,
        applicants_daily_growth: null,
        scheduled_at: null,
        webhook_variables: {},
      })
      refundPolicyTemplateService.getDefault()
        .then((tpl) => {
          if (tpl) setEditing((prev) => (prev ? { ...prev, refund_policy: tpl.content } : prev))
        })
        .catch(() => {})
      return
    }
    loadCourse()
  }, [isNew, loadCourse])

  useEffect(() => {
    Promise.all([
      instructorService.getAll(),
      landingCategoryService.getAll(),
      supabase.from('courses').select('id, title').order('sort_order'),
    ])
      .then(([ins, lcs, coursesRes]) => {
        setInstructors(ins)
        setLandingCategories(lcs)
        setAllCourses(((coursesRes.data ?? []) as { id: number; title: string }[]).filter((c) => c.id !== courseId))
      })
      .catch(() => {})
  }, [courseId])

  // 강의 요약 통계 (수강 인원, 후기 개수, 평균 별점)
  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    Promise.all([
      supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('course_id', courseId),
      supabase.from('reviews').select('rating').eq('course_id', courseId),
    ]).then(([purchaseRes, reviewRes]) => {
      if (cancelled) return
      const ratings = ((reviewRes.data ?? []) as { rating: number }[]).map((r) => r.rating)
      const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
      setStats({
        enrollmentCount: purchaseRes.count ?? 0,
        reviewCount: ratings.length,
        avgRating: avg,
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [courseId])

  const isFree = editing?.course_type === 'free'
  const isPreAlert = editing?.course_type === 'pre_alert'
  // 결제가 없는 유형(무료/사전알림) — 가격/할부 입력 비활성화 일괄 처리.
  const pricingDisabled = isFree || isPreAlert

  const handleTypeChange = (type: string) => {
    if (!editing) return
    // 무료·사전알림 모두 결제 없음 → 가격 0 으로 자동 설정.
    if (type === 'free' || type === 'pre_alert') {
      setEditing({ ...editing, course_type: type, original_price: 0, sale_price: 0 })
    } else {
      const next: Record<string, unknown> = { ...editing, course_type: type }
      if (editing.original_price === 0) next.original_price = null
      if (editing.sale_price === 0) next.sale_price = null
      setEditing(next as typeof editing)
    }
  }

  // 강의일시(scheduled_at)를 schedules 테이블에도 1:1 동기화. 홈/캘린더·예약 알림톡이 기존처럼 동작하도록.
  const syncCourseSchedule = async (cid: number, scheduledAt: string | null, title: string, instructorId: number | null) => {
    if (!scheduledAt) {
      await supabase.from('schedules').delete().eq('course_id', cid)
      scheduleService.invalidate()
      return
    }
    const { data: existing } = await supabase
      .from('schedules')
      .select('id')
      .eq('course_id', cid)
      .limit(1)
      .maybeSingle()
    const row = { course_id: cid, scheduled_at: scheduledAt, title, instructor_id: instructorId }
    const existingId = (existing as { id?: number } | null)?.id
    if (existingId) {
      await supabase.from('schedules').update(row as never).eq('id', existingId)
    } else {
      await supabase.from('schedules').insert(row as never)
    }
    // 홈 캘린더가 즉시 새 일시를 보여주도록 캐시 무효화
    scheduleService.invalidate()
  }

  const handleInfoSave = async () => {
    if (!editing) return
    const title = (editing.title as string)?.trim()
    if (!title) { toast.error('강의명은 필수입니다.'); return }
    if (!editing.scheduled_at) { toast.error('강의일시는 필수입니다.'); return }
    try {
      setSaving(true)
      const courseData = {
        title,
        instructor_id: editing.instructor_id ?? null,
        course_type: editing.course_type ?? 'free',
        original_price: editing.original_price ?? null,
        sale_price: editing.sale_price ?? null,
        installment_months: (editing.installment_months as number | undefined) ?? 12,
        thumbnail_url: editing.thumbnail_url ?? null,
        landing_image_url: ((editing.landing_image_urls as string[]) ?? [])[0] ?? null,
        landing_image_urls: (editing.landing_image_urls as string[]) ?? [],
        landing_image_links: (editing.landing_image_links as string[]) ?? [],
        video_url: editing.video_url ?? null,
        promo_image_url: editing.promo_image_url ?? null,
        enrollment_start: editing.enrollment_start ?? null,
        enrollment_deadline: editing.enrollment_deadline ?? null,
        scheduled_at: editing.scheduled_at ?? null,
        webhook_variables: (editing.webhook_variables as Record<string, string>) ?? {},
        is_published: editing.is_published !== false,
        is_on_sale: editing.is_on_sale !== false,
        reviews_enabled: editing.reviews_enabled !== false,
        allow_guest_purchase: editing.allow_guest_purchase === true,
        search_keywords: editing.search_keywords ?? null,
        strengths: ((editing.strengths as string[]) || []).filter((s) => s.trim()),
        features: ((editing.features as string[]) || []).filter((s) => s.trim()),
        seo: editing.seo ?? {},
        reward_points: editing.reward_points ?? 0,
        max_enrollments: editing.max_enrollments ?? null,
        discount_start: editing.discount_start ?? null,
        discount_end: editing.discount_end ?? null,
        landing_category_ids: (editing.landing_category_ids as number[]) ?? [],
        related_course_ids: (editing.related_course_ids as number[]) ?? [],
        sort_order: editing.sort_order ?? 0,
        description: editing.description ?? null,
        landing_category_id: ((editing.landing_category_ids as number[]) ?? [])[0] ?? null,
        refund_policy: ((editing.refund_policy as string) || '').trim() || null,
        after_purchase_url: ((editing.after_purchase_url as string) || '').trim() || null,
        duration_days: editing.duration_days ?? 40,
        applicants_min: editing.applicants_min ?? null,
        applicants_max: editing.applicants_max ?? null,
        applicants_refresh_min: editing.applicants_refresh_min ?? null,
        applicants_refresh_max: editing.applicants_refresh_max ?? null,
        applicants_daily_growth: editing.applicants_daily_growth ?? null,
      }
      if (isNew) {
        const created = await courseService.create(courseData as never) as { id: number }
        await syncCourseSchedule(created.id, courseData.scheduled_at as string | null, courseData.title, courseData.instructor_id as number | null)
        toast.success('새 강의가 등록되었습니다.')
        navigate(`/admin/courses/${created.id}`, { replace: true })
        return
      }
      if (!courseId) return
      await courseService.update(courseId, courseData)
      await syncCourseSchedule(courseId, courseData.scheduled_at as string | null, courseData.title, courseData.instructor_id as number | null)
      toast.success('강의가 수정되었습니다.')
      await loadCourse()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const addCurriculumItem = () => {
    // 같은 주차에 영상/URL 을 연속 추가할 때 매번 주차를 다시 입력하지 않도록 마지막 항목의 week 를 복사.
    const lastWeek = curriculumItems.length > 0 ? curriculumItems[curriculumItems.length - 1].week : null
    setCurriculumItems([...curriculumItems, { week: lastWeek, label: '', description: null, video_urls: [], sort_order: curriculumItems.length + 1 }])
  }

  const addCurriculumVideo = (rowIdx: number) => {
    setCurriculumItems((prev) => prev.map((item, i) => i === rowIdx
      ? { ...item, video_urls: [...item.video_urls, { url: '', is_redirect: false, label: null }] }
      : item))
  }

  const updateCurriculumVideo = (rowIdx: number, videoIdx: number, patch: Partial<CurriculumVideo>) => {
    setCurriculumItems((prev) => prev.map((item, i) => i === rowIdx
      ? { ...item, video_urls: item.video_urls.map((v, j) => j === videoIdx ? { ...v, ...patch } : v) }
      : item))
  }

  const removeCurriculumVideo = (rowIdx: number, videoIdx: number) => {
    setCurriculumItems((prev) => prev.map((item, i) => i === rowIdx
      ? { ...item, video_urls: item.video_urls.filter((_, j) => j !== videoIdx) }
      : item))
  }

  const updateCurriculumItem = (index: number, field: keyof CurriculumRow, value: unknown) => {
    // 같은 사용자 액션에서 여러 필드를 연속 업데이트하는 경우(예: URL 붙여넣기 + is_redirect 자동 토글)
    // 두 번째 호출이 첫 번째 업데이트를 덮지 않도록 함수형 업데이트 사용.
    setCurriculumItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const removeCurriculumItem = (index: number) => {
    setCurriculumItems(curriculumItems.filter((_, i) => i !== index))
  }

  // 항목이 사실상 비어있는지 — 비어있으면 삭제 시 경고 없이 바로 제거.
  const isCurriculumItemEmpty = (item: CurriculumRow): boolean =>
    item.week == null &&
    !item.label.trim() &&
    !item.description?.trim() &&
    item.video_urls.length === 0

  const moveCurriculumItem = (from: number, to: number) => {
    setCurriculumItems((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const handleCurriculumSave = async () => {
    if (!courseId) return
    try {
      setCurriculumSaving(true)
      const { error: delErr } = await supabase.from('curriculum_items').delete().eq('course_id', courseId)
      if (delErr) throw delErr
      const validItems = curriculumItems.filter((item) => item.label.trim())
      if (validItems.length > 0) {
        const items = validItems.map((item, idx) => {
          const videos = item.video_urls
            .map((v) => ({
              url: v.url.trim(),
              is_redirect: !!v.is_redirect,
              label: v.label?.trim() || null,
            }))
            .filter((v) => v.url)
          // 옛 video_url / is_redirect 컬럼도 첫 영상으로 동기화 (storage-orphans, 구버전 코드 호환).
          const firstVideo = videos[0] ?? null
          return {
            course_id: courseId,
            week: item.week || null,
            label: item.label.trim(),
            description: item.description?.trim() || null,
            video_urls: videos,
            video_url: firstVideo?.url ?? null,
            is_redirect: !!firstVideo?.is_redirect,
            sort_order: idx + 1,
          }
        })
        const { error } = await supabase.from('curriculum_items').insert(items as never)
        if (error) throw error
      }
      toast.success('커리큘럼이 저장되었습니다.')
      await loadCourse()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setCurriculumSaving(false)
    }
  }

  const handleCourseDelete = async () => {
    if (!courseId) return
    try {
      setDeleting(true)
      await courseService.delete(courseId)
      toast.success('강의가 삭제되었습니다.')
      navigate('/admin/courses')
    } catch {
      toast.error('삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  if (!courseId && !isNew) return null
  const visibleTabs = isNew ? TABS.filter((t) => t.key === 'info') : TABS
  // 상세(detail) 타입 랜딩은 강의를 노출하지 않으므로 강의 카테고리 선택지에서 제외한다.
  const courseLandingCategories = landingCategories.filter((lc) => lc.type !== 'detail')

  return (
    <AdminLayout>
      <div className="mb-6">
        <Link to="/admin/courses" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 no-underline mb-3">
          <i className="ti ti-arrow-left text-sm" /> 강의 목록
        </Link>
        {isNew ? (
          <div>
            <h1 className="text-2xl font-bold text-gray-900">새 강의 등록</h1>
            <p className="text-sm text-gray-400 mt-0.5">강의 기본 정보를 입력하고 저장하면 커리큘럼·후기·수강생 관리 탭이 활성화됩니다.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-4">
            <div className="w-[120px] h-[68px] bg-gray-200 rounded-lg animate-pulse" />
            <div className="flex-1">
              <div className="h-6 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
              <div className="h-3 bg-gray-200 rounded w-32 animate-pulse" />
            </div>
          </div>
        ) : course ? (
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-[120px] h-[68px] bg-gray-100 rounded-lg overflow-hidden shrink-0">
              {course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">썸네일</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{course.title}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {course.instructor?.name ? `강사 ${course.instructor.name}` : '강사 미지정'}
                {' · '}
                {course.course_type === 'free' ? '무료' : course.course_type === 'pre_alert' ? '사전 알림 신청' : '유료'}
                {' · '}
                <span className={course.is_published ? 'text-emerald-600' : 'text-gray-400'}>
                  {course.is_published ? '공개' : '비공개'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <div className="text-center">
                <div className="text-[10px] text-gray-400 mb-0.5">수강생</div>
                <div className="text-sm font-bold text-gray-900">{stats.enrollmentCount.toLocaleString()}명</div>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="text-center">
                <div className="text-[10px] text-gray-400 mb-0.5">후기</div>
                <div className="text-sm font-bold text-gray-900">{stats.reviewCount.toLocaleString()}개</div>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="text-center">
                <div className="text-[10px] text-gray-400 mb-0.5">평균 별점</div>
                <div className="text-sm font-bold text-gray-900 flex items-center justify-center gap-1">
                  <span className="text-yellow-400">★</span>
                  {stats.reviewCount > 0 ? stats.avgRating.toFixed(1) : '-'}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {visibleTabs.length > 1 && (
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1.5 w-fit mb-6 flex-wrap">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all flex items-center gap-1.5 ${
                tab === t.key ? 'bg-[#2ED573] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
              }`}
            >
              <i className={`ti ${t.icon} text-sm`} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'info' ? (
        editing ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex flex-wrap gap-4">
              <div className="w-full">
                <label className="text-sm font-bold block mb-1">랜딩 카테고리 (복수 선택)</label>
                {courseLandingCategories.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">등록된 강의 랜딩 페이지가 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-xl bg-gray-50">
                    {courseLandingCategories.map((lc) => {
                      const ids = (editing.landing_category_ids as number[]) || []
                      const checked = ids.includes(lc.id)
                      return (
                        <label key={lc.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-colors ${
                          checked ? 'bg-[#2ED573] text-white border-[#2ED573]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}>
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            const next = e.target.checked ? [...ids, lc.id] : ids.filter((i) => i !== lc.id)
                            setEditing({ ...editing, landing_category_ids: next, landing_category_id: next[0] ?? null })
                          }} className="hidden" />
                          {lc.name}{!lc.is_published && ' (비공개)'}
                        </label>
                      )
                    })}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">선택한 모든 랜딩 페이지에 강의가 노출됩니다. 기본 강의 목록에도 동일하게 표시됩니다.</p>
              </div>
              <div className="w-full">
                <label className="text-sm font-bold block mb-1">강의명 *</label>
                <input value={(editing.title as string) || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              </div>
              <div className="w-[300px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">강사</label>
                <div className="flex items-center gap-1.5">
                  <select value={(editing.instructor_id as number) || ''} onChange={(e) => setEditing({ ...editing, instructor_id: e.target.value ? Number(e.target.value) : null })}
                    className="flex-1 min-w-0 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all">
                    <option value="">선택</option>
                    {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setInstructorEditing(newInstructor())}
                    className="shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-600 cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors whitespace-nowrap"
                    title="새 강사 등록"
                  >
                    <i className="ti ti-plus text-sm" />추가
                  </button>
                </div>
              </div>
              <div className="w-[140px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">유형</label>
                <select value={(editing.course_type as string) || 'free'} onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all">
                  <option value="free">무료</option>
                  <option value="premium">프리미엄</option>
                  <option value="pre_alert">사전 알림 신청</option>
                </select>
              </div>
              <div className="w-[180px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">정가 (원)</label>
                <input type="number" value={pricingDisabled ? 0 : ((editing.original_price as number | null) ?? '')} disabled={pricingDisabled}
                  onChange={(e) => setEditing({ ...editing, original_price: e.target.value === '' ? null : Number(e.target.value) })}
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none ${pricingDisabled ? 'bg-gray-100 text-gray-400' : 'focus:border-[#2ED573]'}`} />
                <p className="text-xs text-gray-400 mt-1">강의 정가 (할인가 비워두면 이 값으로 표시)</p>
              </div>
              <div className="w-[180px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">할인가 (원)</label>
                <input type="number" value={pricingDisabled ? 0 : ((editing.sale_price as number | null) ?? '')} disabled={pricingDisabled}
                  onChange={(e) => setEditing({ ...editing, sale_price: e.target.value === '' ? null : Number(e.target.value) })}
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none ${pricingDisabled ? 'bg-gray-100 text-gray-400' : 'focus:border-[#2ED573]'}`} />
                <p className="text-xs text-gray-400 mt-1">0 입력 시 무료 / 비우면 정가로 표시</p>
              </div>
              <div className="w-[140px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">할부 개월수</label>
                <input type="number" min={0} value={pricingDisabled ? 0 : ((editing.installment_months as number | undefined) ?? 12)} disabled={pricingDisabled}
                  onChange={(e) => setEditing({ ...editing, installment_months: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) })}
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none ${pricingDisabled ? 'bg-gray-100 text-gray-400' : 'focus:border-[#2ED573]'}`} />
                <p className="text-xs text-gray-400 mt-1">0 = 할부 미표시 / 12 = 월 가격으로 표시</p>
              </div>
              <div className="w-[140px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">정원 (명)</label>
                <input type="number" min={0} value={(editing.max_enrollments as number) ?? ''}
                  onChange={(e) => setEditing({ ...editing, max_enrollments: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="무제한"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">비우면 무제한</p>
              </div>
              <div className="w-[140px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">수강 적립 포인트</label>
                <input type="number" min={0} value={(editing.reward_points as number) ?? 0}
                  onChange={(e) => setEditing({ ...editing, reward_points: e.target.value === '' ? 0 : Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">0 = 미지급</p>
              </div>
              <div className="w-[140px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">다시보기 (일)</label>
                <input type="number" min={0} value={(editing.duration_days as number) ?? 0}
                  onChange={(e) => setEditing({ ...editing, duration_days: e.target.value === '' ? 0 : Number(e.target.value) })}
                  placeholder="40"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">마감일시 이후 N일간 다시보기 가능</p>
              </div>
              <div className="w-full">
                <label className="text-sm font-bold block mb-1">신청자 수 표시 (지금 N명 신청 중)</label>
                <div className="flex flex-wrap gap-3">
                  <div className="w-[140px] max-sm:w-[calc(50%-6px)]">
                    <input type="number" min={0} value={(editing.applicants_min as number) ?? ''}
                      onChange={(e) => setEditing({ ...editing, applicants_min: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="최소"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                    <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">신청자 최소 수</p>
                  </div>
                  <div className="w-[140px] max-sm:w-[calc(50%-6px)]">
                    {(() => {
                      const minV = editing.applicants_min as number | null
                      const maxV = editing.applicants_max as number | null
                      const warn = minV != null && maxV != null && maxV - minV >= 10
                      return (
                        <input type="number" min={0} value={(editing.applicants_max as number) ?? ''}
                          onChange={(e) => setEditing({ ...editing, applicants_max: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="최대"
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all ${warn ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 bg-red-50' : 'border-gray-300 focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10'}`} />
                      )
                    })()}
                    <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">신청자 최대 수</p>
                  </div>
                  <div className="w-[140px] max-sm:w-[calc(50%-6px)]">
                    <input type="number" value={(editing.applicants_refresh_min as number) ?? ''}
                      onChange={(e) => setEditing({ ...editing, applicants_refresh_min: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="-1"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                    <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">새로고침 변동 최소 (음수 가능)</p>
                  </div>
                  <div className="w-[140px] max-sm:w-[calc(50%-6px)]">
                    <input type="number" value={(editing.applicants_refresh_max as number) ?? ''}
                      onChange={(e) => setEditing({ ...editing, applicants_refresh_max: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="2"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                    <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">새로고침 변동 최대</p>
                  </div>
                  <div className="w-[140px] max-sm:w-[calc(50%-6px)]">
                    <input type="number" min={0} value={(editing.applicants_daily_growth as number) ?? ''}
                      onChange={(e) => setEditing({ ...editing, applicants_daily_growth: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="매일 증가"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                    <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">매일 증가량 (오픈일 기준)</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">최소~최대 사이 랜덤 표시, 새로고침마다 변동폭(±)만큼 가감. 매일 오픈일 기준 (증가량 × 경과 일수)만큼 위로 시프트. 비우면 미표시.</p>
                {(() => {
                  const minV = editing.applicants_min as number | null
                  const maxV = editing.applicants_max as number | null
                  if (minV == null || maxV == null) return null
                  if (maxV - minV < 10) return null
                  return (
                    <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
                      <i className="ti ti-alert-triangle mt-px shrink-0" />
                      <span>신청자 수는 현재 매일 증가량으로 인해 순차적으로 자연스럽게 올라갑니다.<br />현재 최소/최대값 차이가 커 브라우저를 열고 닫을 때 값이 크게 튈 수 있으므로 두 값의 차이를 낮추시는걸 권장드립니다.</span>
                    </p>
                  )
                })()}
              </div>
              <div className="flex gap-3 max-sm:w-full max-sm:flex-col">
                <div className="w-[220px] max-sm:w-full">
                  <label className="text-sm font-bold block mb-1">할인 시작일시</label>
                  <input type="datetime-local" value={toKstDatetimeLocal(editing.discount_start as string)} disabled={pricingDisabled}
                    onChange={(e) => setEditing({ ...editing, discount_start: e.target.value ? e.target.value + ':00+09:00' : null })}
                    className={`w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none transition-all ${pricingDisabled ? 'bg-gray-100 text-gray-400' : 'focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10'}`} />
                  <p className="text-xs text-gray-400 mt-1">비우면 할인가 상시 적용</p>
                </div>
                <div className="w-[220px] max-sm:w-full">
                  <label className="text-sm font-bold block mb-1">할인 종료일시</label>
                  <input type="datetime-local" value={toKstDatetimeLocal(editing.discount_end as string)} disabled={pricingDisabled}
                    onChange={(e) => setEditing({ ...editing, discount_end: e.target.value ? e.target.value + ':00+09:00' : null })}
                    className={`w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none transition-all ${pricingDisabled ? 'bg-gray-100 text-gray-400' : 'focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10'}`} />
                  <p className="text-xs text-gray-400 mt-1">이후 정가로 판매</p>
                </div>
              </div>
              <div className="w-[220px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">오픈일시</label>
                <input type="datetime-local" value={toKstDatetimeLocal(editing.enrollment_start as string)}
                  onChange={(e) => setEditing({ ...editing, enrollment_start: e.target.value ? e.target.value + ':00+09:00' : null })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1">비우면 바로 오픈</p>
              </div>
              <div className="w-[220px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">마감일시</label>
                <input type="datetime-local" value={toKstDatetimeLocal(editing.enrollment_deadline as string)}
                  onChange={(e) => setEditing({ ...editing, enrollment_deadline: e.target.value ? e.target.value + ':00+09:00' : null })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1">이후 구매 회원도 시청 불가</p>
              </div>
              <div className="w-[220px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">강의일시 <span className="text-red-500">*</span></label>
                <input type="datetime-local" value={toKstDatetimeLocal(editing.scheduled_at as string)}
                  onChange={(e) => setEditing({ ...editing, scheduled_at: e.target.value ? e.target.value + ':00+09:00' : null })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1">홈/일정 캘린더 · 알림톡 변수에 사용</p>
              </div>
              <div className="w-[140px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">우선순위</label>
                <input type="number" value={(editing.sort_order as number) ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: e.target.value === '' ? 0 : Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1">강의일시 동일 시 작은 값이 먼저</p>
              </div>
              <div className="w-full">
                <label className="text-sm font-bold block mb-1">구매 후 안내 링크</label>
                <input
                  type="url"
                  value={(editing.after_purchase_url as string) || ''}
                  onChange={(e) => setEditing({ ...editing, after_purchase_url: e.target.value })}
                  placeholder="https://open.kakao.com/o/..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">구매 직후 새 창으로 자동 이동시킬 URL (오픈채팅방 등). 비워두면 표시되지 않습니다.</p>
              </div>
              <div className="w-full">
                <label className="text-sm font-bold block mb-1">연관 키워드</label>
                <input value={(editing.search_keywords as string) || ''} onChange={(e) => setEditing({ ...editing, search_keywords: e.target.value })}
                  placeholder="쉼표로 구분 (예: 인스타, 릴스, 마케팅)"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1">사이트 검색 시 이 키워드로도 강의가 노출됩니다.</p>
              </div>
              <div className="w-[260px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">썸네일 이미지</label>
                <ImageUploader bucket="courses" path={`${courseId ?? 'new'}/thumb-${Date.now()}`}
                  currentUrl={editing.thumbnail_url as string} onUpload={(url) => setEditing({ ...editing, thumbnail_url: url })} className="h-[140px]" compress={false} />
                <p className="text-xs text-gray-400 mt-1">제품 클릭 전, 보이는 제품 썸네일 이미지 (메인, 아카데미 노출)</p>
              </div>
              <div className="w-full">
                <label className="text-sm font-bold block mb-1">상세페이지 이미지 (분할 업로드)</label>
                <MultiImageUploader
                  bucket="courses"
                  pathPrefix={`${courseId ?? 'new'}/landing`}
                  values={(editing.landing_image_urls as string[]) || []}
                  links={(editing.landing_image_links as string[]) || []}
                  enableLinks
                  onChange={(urls, links) => setEditing({ ...editing, landing_image_urls: urls, landing_image_links: links })}
                  compress={false}
                  helperText="여러 장을 선택하면 한 번에 업로드됩니다. 위→아래 순서로 강의 상세 페이지에 표시됩니다. 각 이미지에 링크를 넣으면 클릭 시 해당 페이지로 이동합니다."
                />
              </div>
              <div className="w-full">
                {(() => {
                  // 탭 활성 상태는 명시적 _promoType 우선, 없으면 데이터에서 추론.
                  const promoType: 'video' | 'image' =
                    (editing._promoType as 'video' | 'image' | undefined)
                    ?? (editing.promo_image_url ? 'image' : 'video')
                  return (
                    <>
                      <div className="flex items-center justify-between mb-1.5 gap-3 flex-wrap">
                        <label className="block text-sm font-medium text-gray-700">홍보 영상 / 이미지</label>
                        <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => setEditing({ ...editing, _promoType: 'video', promo_image_url: null })}
                            className={`px-3 py-1.5 rounded-md font-medium border-none cursor-pointer flex items-center gap-1 transition-colors ${
                              promoType === 'video' ? 'bg-white text-gray-900 shadow-sm' : 'bg-transparent text-gray-500 hover:text-gray-800'
                            }`}
                          >
                            <i className="ti ti-player-play text-xs" />
                            영상
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing({ ...editing, _promoType: 'image', video_url: null })}
                            className={`px-3 py-1.5 rounded-md font-medium border-none cursor-pointer flex items-center gap-1 transition-colors ${
                              promoType === 'image' ? 'bg-white text-gray-900 shadow-sm' : 'bg-transparent text-gray-500 hover:text-gray-800'
                            }`}
                          >
                            <i className="ti ti-photo text-xs" />
                            이미지
                          </button>
                        </div>
                      </div>
                      {promoType === 'video' ? (
                        <VideoUrlInput
                          value={(editing.video_url as string) || null}
                          onChange={(url) => setEditing({ ...editing, video_url: url })}
                        />
                      ) : (
                        <ImageUploader
                          bucket="courses"
                          path={`${courseId ?? 'new'}/promo`}
                          currentUrl={(editing.promo_image_url as string) || null}
                          onUpload={(url) => setEditing({ ...editing, promo_image_url: url || null })}
                          className="h-[200px]"
                        />
                      )}
                      <p className="text-xs text-gray-400 mt-1">강의 상세 페이지 최상단에 표시됩니다. 영상과 이미지 중 하나만 설정할 수 있습니다.</p>
                    </>
                  )
                })()}
              </div>
              <div className="w-full">
                <label className="text-sm font-bold block mb-1">강의 소개</label>
                <RichTextEditor
                  value={(editing.description as string) || ''}
                  onChange={(html) => setEditing({ ...editing, description: html })}
                  placeholder="강의 소개글을 작성해 주세요"
                  minHeight={220}
                />
                <p className="text-xs text-gray-400 mt-1">강의 상세 페이지 상단(강의 강점/특징 위)에 표시됩니다.</p>
              </div>
              <div className="w-full">
                <label className="text-sm font-bold block mb-2">뱃지 / 옵션</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!editing.is_hot} onChange={(e) => setEditing({ ...editing, is_hot: e.target.checked })} className="accent-[#2ED573]" /> HOT</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!editing.is_new} onChange={(e) => setEditing({ ...editing, is_new: e.target.checked })} className="accent-[#2ED573]" /> NEW</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.is_published !== false} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-[#2ED573]" /> 공개</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.is_on_sale !== false} onChange={(e) => setEditing({ ...editing, is_on_sale: e.target.checked })} className="accent-[#2ED573]" /> 판매 중</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.reviews_enabled !== false} onChange={(e) => setEditing({ ...editing, reviews_enabled: e.target.checked })} className="accent-[#2ED573]" /> 후기 사용</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.allow_guest_purchase === true} onChange={(e) => setEditing({ ...editing, allow_guest_purchase: e.target.checked })} className="accent-[#2ED573]" /> 비회원 구매 가능</label>
                </div>
                <p className="text-xs text-gray-400 mt-1">판매 중지 시 결제 버튼이 비활성화됩니다. 후기 미사용 시 후기 섹션이 숨겨집니다. 비회원 구매 가능 시 로그인 없이도 신청할 수 있습니다.</p>
              </div>
            </div>

            {/* 강의 강점 / 특징 */}
            <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-2 max-sm:grid-cols-1 gap-6">
              <div>
                <label className="text-sm font-bold block mb-2">강의 강점</label>
                <div className="space-y-2">
                  {((editing.strengths as string[]) || []).map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={s} onChange={(e) => {
                        const arr = [...((editing.strengths as string[]) || [])]
                        arr[idx] = e.target.value
                        setEditing({ ...editing, strengths: arr })
                      }}
                        placeholder="강점을 입력해 주세요"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
                      <button type="button" onClick={() => {
                        const arr = [...((editing.strengths as string[]) || [])]
                        arr.splice(idx, 1)
                        setEditing({ ...editing, strengths: arr })
                      }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border border-gray-200 cursor-pointer">
                        <i className="ti ti-x text-sm" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditing({ ...editing, strengths: [...((editing.strengths as string[]) || []), ''] })}
                    className="w-full py-2 rounded-lg text-xs font-medium border border-dashed border-gray-300 text-gray-500 bg-white cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors">
                    <i className="ti ti-plus text-xs" /> 강점 추가
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-bold block mb-2">강의 특징</label>
                <div className="space-y-2">
                  {((editing.features as string[]) || []).map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={s} onChange={(e) => {
                        const arr = [...((editing.features as string[]) || [])]
                        arr[idx] = e.target.value
                        setEditing({ ...editing, features: arr })
                      }}
                        placeholder="특징을 입력해 주세요"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
                      <button type="button" onClick={() => {
                        const arr = [...((editing.features as string[]) || [])]
                        arr.splice(idx, 1)
                        setEditing({ ...editing, features: arr })
                      }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border border-gray-200 cursor-pointer">
                        <i className="ti ti-x text-sm" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditing({ ...editing, features: [...((editing.features as string[]) || []), ''] })}
                    className="w-full py-2 rounded-lg text-xs font-medium border border-dashed border-gray-300 text-gray-500 bg-white cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors">
                    <i className="ti ti-plus text-xs" /> 특징 추가
                  </button>
                </div>
              </div>
            </div>

            {/* 관련 강의 */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-1">관련 강의</h3>
              <p className="text-xs text-gray-400 mb-3">이 강의 상세 페이지 하단에 추천 카드로 표시됩니다.</p>
              {allCourses.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">다른 강의가 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-xl bg-gray-50 max-h-[200px] overflow-y-auto">
                  {allCourses.map((c) => {
                    const ids = (editing.related_course_ids as number[]) || []
                    const checked = ids.includes(c.id)
                    return (
                      <label key={c.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-colors ${
                        checked ? 'bg-[#2ED573] text-white border-[#2ED573]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}>
                        <input type="checkbox" checked={checked} onChange={(e) => {
                          const next = e.target.checked ? [...ids, c.id] : ids.filter((i) => i !== c.id)
                          setEditing({ ...editing, related_course_ids: next })
                        }} className="hidden" />
                        {c.title}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 환불규정 */}
            <RefundPolicyEditor
              value={(editing.refund_policy as string) || ''}
              onChange={(v) => setEditing({ ...editing, refund_policy: v })}
            />

            {/* 강의별 SEO */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-1">SEO 태그 (이 강의 전용)</h3>
              <p className="text-xs text-gray-400 mb-3">비워두면 사이트 기본 SEO가 사용됩니다.</p>
              <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
                {(() => {
                  const seo = (editing.seo as CourseSeoShape) || {}
                  const updateSeo = (patch: Partial<CourseSeoShape>) => setEditing({ ...editing, seo: { ...seo, ...patch } })
                  return (
                    <>
                      <div><label className="text-sm font-bold block mb-1">title</label>
                        <input value={seo.title || ''} onChange={(e) => updateSeo({ title: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div><label className="text-sm font-bold block mb-1">author</label>
                        <input value={seo.author || ''} onChange={(e) => updateSeo({ author: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div className="col-span-2 max-sm:col-span-1"><label className="text-sm font-bold block mb-1">description</label>
                        <input value={seo.description || ''} onChange={(e) => updateSeo({ description: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div className="col-span-2 max-sm:col-span-1"><label className="text-sm font-bold block mb-1">keywords</label>
                        <input value={seo.keywords || ''} onChange={(e) => updateSeo({ keywords: e.target.value })}
                          placeholder="쉼표로 구분"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div><label className="text-sm font-bold block mb-1">og:title</label>
                        <input value={seo.ogTitle || ''} onChange={(e) => updateSeo({ ogTitle: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div><label className="text-sm font-bold block mb-1">og:description</label>
                        <input value={seo.ogDescription || ''} onChange={(e) => updateSeo({ ogDescription: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div className="col-span-2 max-sm:col-span-1">
                        <label className="text-sm font-bold block mb-1">og:image</label>
                        <p className="text-xs text-gray-400 mb-1">권장 크기: 1200 × 627</p>
                        <ImageUploader bucket="courses" path={`${courseId ?? 'new'}/seo-og-${Date.now()}`}
                          currentUrl={seo.ogImage || ''} onUpload={(url) => updateSeo({ ogImage: url })} className="h-[140px]" compress={false} />
                      </div>
                      <div><label className="text-sm font-bold block mb-1">twitter:title</label>
                        <input value={seo.twitterTitle || ''} onChange={(e) => updateSeo({ twitterTitle: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div><label className="text-sm font-bold block mb-1">twitter:description</label>
                        <input value={seo.twitterDescription || ''} onChange={(e) => updateSeo({ twitterDescription: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div className="col-span-2 max-sm:col-span-1">
                        <label className="text-sm font-bold block mb-1">twitter:image</label>
                        <p className="text-xs text-gray-400 mb-1">권장 크기: 1200 × 627</p>
                        <ImageUploader bucket="courses" path={`${courseId ?? 'new'}/seo-tw-${Date.now()}`}
                          currentUrl={seo.twitterImage || ''} onUpload={(url) => updateSeo({ twitterImage: url })} className="h-[140px]" compress={false} />
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleInfoSave}
                  disabled={saving}
                  className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50"
                >
                  {saving ? '저장 중...' : isNew ? '강의 등록' : '기본 정보 저장'}
                </button>
                {!isNew && courseId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!editing) return
                      // 저장하지 않은 편집 상태를 localStorage 에 넣고, 미리보기 페이지가 이를 overlay 한다.
                      // editing 에는 instructor_id 만 있어 페이지 표시용 instructor 객체를 동봉.
                      const instructor = instructors.find((i) => i.id === editing.instructor_id) ?? null
                      try {
                        localStorage.setItem(`preview_course_${courseId}`, JSON.stringify({ ...editing, instructor }))
                      } catch {
                        toast.error('미리보기 데이터를 저장하지 못했습니다.')
                        return
                      }
                      window.open(`/course/${courseId}?preview=1`, '_blank', 'noopener,noreferrer')
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors"
                    title="저장하지 않은 편집 상태로 새 탭에서 상품 페이지를 엽니다"
                  >
                    <i className="ti ti-external-link text-sm" />
                    미리보기
                  </button>
                )}
              </div>
              {!isNew && courseId && (
                <button
                  onClick={() => setDeleteTarget(courseId)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium border border-red-200 text-red-500 bg-white cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-1.5"
                >
                  <i className="ti ti-trash text-sm" /> 강의 삭제
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400 text-sm">불러오는 중...</div>
        )
      ) : tab === 'curriculum' ? (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">커리큘럼 관리</h3>
              <p className="text-xs text-gray-400 mt-0.5">항목은 아래 순서대로 저장되며, 저장 시 기존 목록이 교체됩니다.</p>
            </div>
            <button type="button" onClick={addCurriculumItem}
              className="bg-[#2ED573] text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors flex items-center gap-1">
              <i className="ti ti-plus text-xs" /> 항목 추가
            </button>
          </div>

          {curriculumItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8 border border-dashed border-gray-200 rounded-xl">등록된 커리큘럼이 없습니다. "항목 추가"를 눌러 시작하세요.</p>
          ) : (
            <div className="space-y-3">
              {curriculumItems.map((item, idx) => (
                <div
                  key={idx}
                  onDragOver={(e) => {
                    if (curriculumDragIndex === null || curriculumDragIndex === idx) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    const rect = e.currentTarget.getBoundingClientRect()
                    const position: 'above' | 'below' = e.clientY > rect.top + rect.height / 2 ? 'below' : 'above'
                    if (curriculumDragOver?.idx !== idx || curriculumDragOver?.position !== position) {
                      setCurriculumDragOver({ idx, position })
                    }
                  }}
                  onDrop={() => {
                    if (curriculumDragIndex !== null && curriculumDragOver !== null) {
                      const from = curriculumDragIndex
                      // position='above' 면 호버 카드 앞 자리(idx), 'below' 면 호버 카드 다음 자리(idx+1) 에 삽입.
                      // splice 동작상 from < target 인 경우 1 보정.
                      let target = curriculumDragOver.position === 'above' ? curriculumDragOver.idx : curriculumDragOver.idx + 1
                      if (from < target) target -= 1
                      if (target !== from) moveCurriculumItem(from, target)
                    }
                    setCurriculumDragIndex(null)
                    setCurriculumDragOver(null)
                  }}
                  className={`relative flex items-stretch gap-2 ${curriculumDragIndex === idx ? 'opacity-40' : ''}`}
                >
                  {curriculumDragIndex !== null && curriculumDragIndex !== idx && curriculumDragOver?.idx === idx && curriculumDragOver?.position === 'above' && (
                    <div className="absolute -top-2 left-0 right-0 h-1 bg-[#2ED573] rounded-full z-10 shadow-[0_0_0_3px_rgba(46,213,115,0.25)] pointer-events-none" aria-hidden />
                  )}
                  {curriculumDragIndex !== null && curriculumDragIndex !== idx && curriculumDragOver?.idx === idx && curriculumDragOver?.position === 'below' && (
                    <div className="absolute -bottom-2 left-0 right-0 h-1 bg-[#2ED573] rounded-full z-10 shadow-[0_0_0_3px_rgba(46,213,115,0.25)] pointer-events-none" aria-hidden />
                  )}
                  <div
                    draggable
                    onDragStart={(e) => {
                      // 일부 브라우저는 dataTransfer 에 data 가 없으면 첫 드래그를 즉시 cancel 한다.
                      // 더미 페이로드를 한 번 set 해서 native drag 가 활성화되도록 한다.
                      e.dataTransfer.setData('text/plain', String(idx))
                      e.dataTransfer.effectAllowed = 'move'
                      setCurriculumDragIndex(idx)
                    }}
                    onDragEnd={() => {
                      setCurriculumDragIndex(null)
                      setCurriculumDragOver(null)
                    }}
                    className="flex flex-col items-center justify-center px-1.5 text-gray-300 hover:text-gray-500 transition-colors cursor-grab active:cursor-grabbing select-none"
                    title="드래그하여 순서 변경"
                  >
                    <i className="ti ti-grip-vertical text-base" />
                    <span className="text-[10px] font-bold mt-0.5">{idx + 1}</span>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex-1 min-w-0">
                    <div className="flex gap-2 max-sm:flex-col">
                      <div className="w-[200px] max-sm:w-full flex flex-col gap-2">
                        <input type="number" value={item.week ?? ''} placeholder="주차"
                          onChange={(e) => updateCurriculumItem(idx, 'week', e.target.value ? Number(e.target.value) : null)}
                          className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm outline-none focus:border-[#2ED573]" />
                        <input type="text" value={item.label} placeholder="강의 제목"
                          onChange={(e) => updateCurriculumItem(idx, 'label', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm outline-none focus:border-[#2ED573]" />
                      </div>
                      <textarea value={item.description ?? ''} placeholder="강의 설명 (선택)"
                        onChange={(e) => updateCurriculumItem(idx, 'description', e.target.value || null)}
                        className="flex-1 border border-gray-300 rounded-md px-2.5 py-2 text-sm outline-none focus:border-[#2ED573] resize-none min-h-[76px] max-sm:min-h-[60px]" />
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
                      {item.video_urls.map((v, vIdx) => (
                        <div key={vIdx} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={v.label ?? ''}
                            onChange={(e) => updateCurriculumVideo(idx, vIdx, { label: e.target.value || null })}
                            placeholder="설명 (선택)"
                            className="w-80 shrink-0 border border-gray-300 rounded-md px-2 py-2 text-sm outline-none focus:border-[#2ED573]"
                          />
                          <div className="flex-1 min-w-0">
                            <VideoUrlInput
                              value={v.url || null}
                              onChange={(url) => updateCurriculumVideo(idx, vIdx, { url: url || '' })}
                              isRedirect={v.is_redirect}
                              onIsRedirectChange={(next) => updateCurriculumVideo(idx, vIdx, { is_redirect: next })}
                              compact
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCurriculumVideo(idx, vIdx)}
                            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 bg-white border border-gray-200 cursor-pointer transition-colors"
                            aria-label="영상 항목 삭제"
                          >
                            <i className="ti ti-x text-sm" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addCurriculumVideo(idx)}
                        className="w-full py-1.5 rounded-md text-xs font-medium border border-dashed border-gray-300 text-gray-500 bg-white cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="ti ti-plus text-xs" /> 영상/링크 추가
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 justify-center">
                    <button type="button" onClick={() => moveCurriculumItem(idx, idx - 1)} disabled={idx === 0}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 bg-white border border-gray-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="위로 이동">
                      <i className="ti ti-chevron-up text-sm" />
                    </button>
                    <button type="button" onClick={() => moveCurriculumItem(idx, idx + 1)} disabled={idx === curriculumItems.length - 1}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 bg-white border border-gray-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="아래로 이동">
                      <i className="ti ti-chevron-down text-sm" />
                    </button>
                    <button type="button"
                      onClick={() => {
                        if (isCurriculumItemEmpty(item)) removeCurriculumItem(idx)
                        else setCurriculumDeleteIdx(idx)
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 bg-white border border-gray-200 cursor-pointer transition-colors"
                      aria-label="커리큘럼 항목 삭제">
                      <i className="ti ti-x text-sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end mt-6 pt-5 border-t border-gray-100">
            <button
              onClick={handleCurriculumSave}
              disabled={curriculumSaving}
              className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50"
            >
              {curriculumSaving ? '저장 중...' : '커리큘럼 저장'}
            </button>
          </div>
        </div>
      ) : tab === 'reviews' ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              전체 {reviewsTotal}개 {reviewsTotal > 0 && `(공개 ${reviews.filter((r) => r.is_published).length}개 · 비공개 ${reviews.filter((r) => !r.is_published).length}개 · 현재 페이지 기준)`}
            </p>
          </div>

          {reviewsLoading ? (
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-16 bg-gray-100 rounded" />)}
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400 text-sm">
              아직 작성된 후기가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{r.author_name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.is_published ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                          {r.is_published ? '공개' : '비공개'}
                        </span>
                        <span className="text-yellow-400 text-xs">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-800 mb-1 truncate">{r.title}</h4>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line line-clamp-3">{r.content}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => togglePublish(r)}
                        disabled={reviewTogglingId === r.id}
                        className={`px-2.5 py-1 text-xs rounded-lg border cursor-pointer transition-colors disabled:opacity-50 ${
                          r.is_published
                            ? 'border-gray-200 text-gray-500 bg-white hover:border-gray-400'
                            : 'border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        {r.is_published ? '비공개 전환' : '공개 전환'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewDeleteTarget(r)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-white border border-gray-200 cursor-pointer transition-colors"
                        aria-label="후기 삭제"
                      >
                        <i className="ti ti-trash text-sm" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {reviewsTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setReviewsPage(Math.max(1, reviewsPage - 1))} disabled={reviewsPage <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                <i className="ti ti-chevron-left" />
              </button>
              {Array.from({ length: reviewsTotalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setReviewsPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-sm border-none cursor-pointer ${
                    p === reviewsPage ? 'bg-[#2ED573] text-white' : 'bg-white text-gray-500 border border-gray-300'
                  }`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setReviewsPage(Math.min(reviewsTotalPages, reviewsPage + 1))} disabled={reviewsPage >= reviewsTotalPages}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                <i className="ti ti-chevron-right" />
              </button>
            </div>
          )}

          <ConfirmDialog
            isOpen={!!reviewDeleteTarget}
            onClose={() => { if (!reviewDeleting) setReviewDeleteTarget(null) }}
            onConfirm={handleReviewDelete}
            title="후기 삭제"
            message={reviewDeleteTarget ? `"${reviewDeleteTarget.title}" 후기를 삭제하시겠습니까?` : ''}
            loading={reviewDeleting}
          />
        </div>
      ) : tab === 'members' ? (
        <div>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <p className="text-sm text-gray-500">
              전체 수강생 {members.length}명{membersSearch && ` · 검색 결과 ${filteredMembers.length}명`}
            </p>
            <div className="relative max-w-xs">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                value={membersSearch}
                onChange={(e) => { setMembersSearch(e.target.value); setMembersPage(1) }}
                placeholder="이름/이메일/전화 검색..."
                className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573] w-[280px]"
              />
            </div>
          </div>

          {membersLoading ? (
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}
            </div>
          ) : pagedMembers.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400 text-sm">
              {membersSearch ? '검색 결과가 없습니다.' : '아직 수강생이 없습니다.'}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-gray-600">이름</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-600 max-sm:hidden">이메일</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-600 max-md:hidden">전화</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-600 max-md:hidden">결제일</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">결제수단</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-600 max-md:hidden">금액</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-600">진도율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedMembers.map((m) => (
                      <tr key={m.purchase_id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/admin/members?user=${m.user_id}`)}>
                        <td className="px-4 py-3 font-medium">{m.user_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-500 max-sm:hidden">{m.user_email || '-'}</td>
                        <td className="px-4 py-3 text-gray-500 max-md:hidden">{m.user_phone || '-'}</td>
                        <td className="px-4 py-3 text-center text-gray-400 text-xs max-md:hidden">{formatKoDate(m.purchased_at)}</td>
                        <td className="px-4 py-3 text-center max-sm:hidden">
                          {m.payment_method === 'toss' ? (
                            <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">카드</span>
                          ) : m.price > 0 ? (
                            <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full">포인트</span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">무료/부여</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500 max-md:hidden">
                          {m.price > 0 ? (
                            <>
                              {m.original_price && m.original_price !== m.price && (
                                <span className="text-[10px] text-gray-400 line-through mr-1">{m.original_price.toLocaleString()}</span>
                              )}
                              <span className="text-xs">{m.price.toLocaleString()}{m.payment_method === 'toss' ? '원' : 'P'}</span>
                            </>
                          ) : '무료'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="flex-1 bg-gray-100 rounded-full overflow-hidden h-1.5 min-w-[60px] max-w-[120px]">
                              <div className="h-full rounded-full transition-all" style={{ width: `${m.completion_rate}%`, backgroundColor: m.completion_rate === 100 ? '#2ED573' : m.completion_rate > 0 ? '#3B82F6' : '#d1d5db' }} />
                            </div>
                            <span className="text-xs text-gray-500 w-9 text-right">{m.completion_rate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {membersTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setMembersPage(Math.max(1, membersPage - 1))} disabled={membersPage <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                <i className="ti ti-chevron-left" />
              </button>
              {Array.from({ length: membersTotalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setMembersPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-sm border-none cursor-pointer ${
                    p === membersPage ? 'bg-[#2ED573] text-white' : 'bg-white text-gray-500 border border-gray-300'
                  }`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setMembersPage(Math.min(membersTotalPages, membersPage + 1))} disabled={membersPage >= membersTotalPages}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                <i className="ti ti-chevron-right" />
              </button>
            </div>
          )}
        </div>
      ) : tab === 'webhooks' ? (
        courseId ? (
          <div className="space-y-6">
            <CourseWebhookVariablesEditor
              value={(editing?.webhook_variables as Record<string, string>) ?? {}}
              onChange={(next) => setEditing((prev) => (prev ? { ...prev, webhook_variables: next } : prev))}
              onSave={handleInfoSave}
              saving={saving}
            />
            <WebhookScheduleEditor scope="course" scopeId={courseId} />
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-12">강의를 먼저 저장한 뒤 예약 알림톡을 설정할 수 있습니다.</p>
        )
      ) : null}

      <ConfirmDialog
        isOpen={deleteTarget != null}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        onConfirm={handleCourseDelete}
        title="강의 삭제"
        message="이 강의를 삭제하시겠습니까? 관련 커리큘럼도 함께 삭제됩니다."
        loading={deleting}
      />

      <ConfirmDialog
        isOpen={curriculumDeleteIdx != null}
        onClose={() => setCurriculumDeleteIdx(null)}
        onConfirm={() => {
          if (curriculumDeleteIdx != null) removeCurriculumItem(curriculumDeleteIdx)
          setCurriculumDeleteIdx(null)
        }}
        title="커리큘럼 항목 삭제"
        message="이 항목에 입력한 내용이 모두 사라집니다. 정말 삭제하시겠습니까?"
      />

      {/* 강사 select 옆 '+추가' 버튼으로 여는 강사 등록 모달 */}
      <InstructorFormModal
        editing={instructorEditing}
        onChange={setInstructorEditing}
        onClose={() => setInstructorEditing(null)}
        onSaved={async (saved) => {
          try {
            const list = await instructorService.getAll()
            setInstructors(list)
          } catch { /* 목록 갱신 실패는 치명적이지 않음 */ }
          // 방금 등록한 강사를 이 강의의 강사로 자동 선택
          setEditing((prev) => (prev ? { ...prev, instructor_id: saved.id } : prev))
        }}
      />
    </AdminLayout>
  )
}
