import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import { useSessionState, useScrollRestore } from '../../hooks/useListStatePersistence'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { courseService } from '../../services/courseService'
import { supabase } from '../../lib/supabase'
import type { CourseWithInstructor } from '../../types'

interface CourseStats {
  enrollmentCount: number
  reviewCount: number
  avgRating: number
}

export default function AdminCourses() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [stats, setStats] = useState<Record<number, CourseStats>>({})
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [duplicateTarget, setDuplicateTarget] = useState<number | null>(null)
  const [duplicating, setDuplicating] = useState(false)
  const [search, setSearch] = useSessionState('admin:courses:search', '')

  const fetchData = async () => {
    try {
      setLoading(true)
      const [c, purchaseRes, reviewRes] = await withTimeout(Promise.all([
        courseService.getAll(),
        supabase.from('purchases').select('course_id').not('course_id', 'is', null),
        supabase.from('reviews').select('course_id, rating').not('course_id', 'is', null),
      ]))
      setCourses(c)

      const map: Record<number, CourseStats> = {}
      for (const row of (purchaseRes.data ?? []) as { course_id: number }[]) {
        map[row.course_id] = map[row.course_id] ?? { enrollmentCount: 0, reviewCount: 0, avgRating: 0 }
        map[row.course_id].enrollmentCount += 1
      }
      const ratingSumByCourse: Record<number, number> = {}
      for (const row of (reviewRes.data ?? []) as { course_id: number; rating: number }[]) {
        map[row.course_id] = map[row.course_id] ?? { enrollmentCount: 0, reviewCount: 0, avgRating: 0 }
        map[row.course_id].reviewCount += 1
        ratingSumByCourse[row.course_id] = (ratingSumByCourse[row.course_id] ?? 0) + row.rating
      }
      for (const idStr of Object.keys(map)) {
        const id = Number(idStr)
        const s = map[id]
        s.avgRating = s.reviewCount > 0 ? (ratingSumByCourse[id] ?? 0) / s.reviewCount : 0
      }
      setStats(map)
    } catch { toast.error('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])
  useVisibilityRefresh(fetchData)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await courseService.delete(deleteTarget)
      toast.success('강의가 삭제되었습니다.')
      setDeleteTarget(null); await fetchData()
    } catch { toast.error('삭제에 실패했습니다.') }
  }

  const handleDuplicate = async (isPublished: boolean) => {
    if (!duplicateTarget || duplicating) return
    try {
      setDuplicating(true)
      await courseService.duplicate(duplicateTarget, { isPublished })
      toast.success(isPublished ? '강의가 공개 상태로 복사되었습니다.' : '강의가 비공개 상태로 복사되었습니다.')
      setDuplicateTarget(null)
      await fetchData()
    } catch {
      toast.error('복사에 실패했습니다.')
    } finally {
      setDuplicating(false)
    }
  }

  type SortKey = 'title' | 'instructor' | 'type' | 'price' | 'created' | 'enrollments' | 'reviews' | 'rating' | 'scheduled'
  const [sortKey, setSortKey] = useSessionState<SortKey>('admin:courses:sortKey', 'created')
  const [sortAsc, setSortAsc] = useSessionState('admin:courses:sortAsc', false)
  const [page, setPage] = useSessionState('admin:courses:page', 1)
  const PER_PAGE = 10

  type TypeFilter = 'all' | 'free' | 'premium' | 'pre_alert'
  type PriceFilter = 'all' | 'free' | 'lt200' | '200to400' | '400to600' | 'gte600'
  type RatingFilter = 'all' | 'gte4_5' | 'gte4' | 'gte3' | 'noreview'
  type ScheduleFilter = 'all' | 'upcoming' | 'past' | 'none'
  type EnrollStartFilter = 'all' | 'pending' | 'opened' | 'none'
  type EnrollEndFilter = 'all' | 'open' | 'closed' | 'none'
  type CreatedFilter = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year'
  const [typeFilter, setTypeFilter] = useSessionState<TypeFilter>('admin:courses:typeFilter', 'all')
  const [priceFilter, setPriceFilter] = useSessionState<PriceFilter>('admin:courses:priceFilter', 'all')
  const [ratingFilter, setRatingFilter] = useSessionState<RatingFilter>('admin:courses:ratingFilter', 'all')
  const [scheduleFilter, setScheduleFilter] = useSessionState<ScheduleFilter>('admin:courses:scheduleFilter', 'all')
  const [enrollStartFilter, setEnrollStartFilter] = useSessionState<EnrollStartFilter>('admin:courses:enrollStartFilter', 'all')
  const [enrollEndFilter, setEnrollEndFilter] = useSessionState<EnrollEndFilter>('admin:courses:enrollEndFilter', 'all')
  const [instructorFilter, setInstructorFilter] = useSessionState<string>('admin:courses:instructorFilter', 'all')
  const [createdFilter, setCreatedFilter] = useSessionState<CreatedFilter>('admin:courses:createdFilter', 'all')

  const instructorOptions = Array.from(
    new Map(
      courses
        .filter((c) => c.instructor?.id != null)
        .map((c) => [c.instructor!.id, { id: c.instructor!.id, name: c.instructor!.name }] as const)
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  useScrollRestore('admin:courses:scroll', !loading)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === 'title' || key === 'instructor') }
    setPage(1)
  }

  const effectivePrice = (c: CourseWithInstructor): number | null => {
    if (c.course_type === 'free' || c.course_type === 'pre_alert' || c.sale_price === 0) return 0
    const p = (c.sale_price && c.sale_price > 0) ? c.sale_price : c.original_price
    return p ?? null
  }

  const filtered = courses.filter((c) => {
    if (search && !c.title.includes(search) && !(c.instructor?.name || '').includes(search)) return false
    if (typeFilter !== 'all' && c.course_type !== typeFilter) return false
    if (priceFilter !== 'all') {
      const p = effectivePrice(c)
      if (priceFilter === 'free' && p !== 0) return false
      if (priceFilter === 'lt200' && (p == null || p === 0 || p >= 2_000_000)) return false
      if (priceFilter === '200to400' && (p == null || p < 2_000_000 || p >= 4_000_000)) return false
      if (priceFilter === '400to600' && (p == null || p < 4_000_000 || p >= 6_000_000)) return false
      if (priceFilter === 'gte600' && (p == null || p < 6_000_000)) return false
    }
    if (instructorFilter !== 'all' && String(c.instructor?.id ?? '') !== instructorFilter) return false
    if (createdFilter !== 'all') {
      const created = new Date(c.created_at).getTime()
      const now = Date.now()
      const ms = {
        today: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        quarter: 90 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000,
      }[createdFilter]
      if (now - created > ms) return false
    }
    if (ratingFilter !== 'all') {
      const s = stats[c.id] ?? { enrollmentCount: 0, reviewCount: 0, avgRating: 0 }
      if (ratingFilter === 'noreview' && s.reviewCount > 0) return false
      if (ratingFilter === 'gte4_5' && (s.reviewCount === 0 || s.avgRating < 4.5)) return false
      if (ratingFilter === 'gte4' && (s.reviewCount === 0 || s.avgRating < 4)) return false
      if (ratingFilter === 'gte3' && (s.reviewCount === 0 || s.avgRating < 3)) return false
    }
    if (scheduleFilter !== 'all') {
      const t = c.scheduled_at ? new Date(c.scheduled_at).getTime() : null
      const now = Date.now()
      if (scheduleFilter === 'none' && t != null) return false
      if (scheduleFilter === 'upcoming' && (t == null || t < now)) return false
      if (scheduleFilter === 'past' && (t == null || t >= now)) return false
    }
    if (enrollStartFilter !== 'all') {
      const t = c.enrollment_start ? new Date(c.enrollment_start).getTime() : null
      const now = Date.now()
      if (enrollStartFilter === 'none' && t != null) return false
      if (enrollStartFilter === 'pending' && (t == null || t <= now)) return false
      if (enrollStartFilter === 'opened' && (t == null || t > now)) return false
    }
    if (enrollEndFilter !== 'all') {
      const t = c.enrollment_deadline ? new Date(c.enrollment_deadline).getTime() : null
      const now = Date.now()
      if (enrollEndFilter === 'none' && t != null) return false
      if (enrollEndFilter === 'open' && (t == null || t <= now)) return false
      if (enrollEndFilter === 'closed' && (t == null || t > now)) return false
    }
    return true
  })

  const filterActive = typeFilter !== 'all' || priceFilter !== 'all' || ratingFilter !== 'all' || scheduleFilter !== 'all' || enrollStartFilter !== 'all' || enrollEndFilter !== 'all' || instructorFilter !== 'all' || createdFilter !== 'all'
  const resetFilters = () => {
    setTypeFilter('all'); setPriceFilter('all'); setRatingFilter('all'); setScheduleFilter('all'); setEnrollStartFilter('all'); setEnrollEndFilter('all'); setInstructorFilter('all'); setCreatedFilter('all'); setPage(1)
  }

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortAsc ? 1 : -1
    const sa = stats[a.id] ?? { enrollmentCount: 0, reviewCount: 0, avgRating: 0 }
    const sb = stats[b.id] ?? { enrollmentCount: 0, reviewCount: 0, avgRating: 0 }
    switch (sortKey) {
      case 'title': return dir * a.title.localeCompare(b.title)
      case 'instructor': return dir * (a.instructor?.name || '').localeCompare(b.instructor?.name || '')
      case 'type': return dir * a.course_type.localeCompare(b.course_type)
      case 'price': return dir * ((a.sale_price ?? a.original_price ?? 0) - (b.sale_price ?? b.original_price ?? 0))
      case 'scheduled': {
        const av = a.scheduled_at ? new Date(a.scheduled_at).getTime() : -Infinity
        const bv = b.scheduled_at ? new Date(b.scheduled_at).getTime() : -Infinity
        return dir * (av - bv)
      }
      case 'created': return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      case 'enrollments': return dir * (sa.enrollmentCount - sb.enrollmentCount)
      case 'reviews': return dir * (sa.reviewCount - sb.reviewCount)
      case 'rating': return dir * (sa.avgRating - sb.avgRating)
      default: return 0
    }
  })

  const totalPages = Math.ceil(sorted.length / PER_PAGE)
  const paged = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // 데이터가 줄어들어 저장된 페이지가 범위를 벗어나면 1페이지로 보정.
  useEffect(() => {
    if (!loading && totalPages > 0 && page > totalPages) setPage(1)
  }, [loading, totalPages, page, setPage])

  const SortHeader = ({ label, k, className = '' }: { label: string; k: SortKey; className?: string }) => (
    <th
      className={`px-4 py-3 font-bold text-gray-600 cursor-pointer select-none hover:text-gray-900 transition-colors ${className}`}
      onClick={() => handleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k ? (
          <i className={`ti ti-chevron-${sortAsc ? 'up' : 'down'} text-[#2ED573] text-xs`} />
        ) : (
          <i className="ti ti-selector text-gray-300 text-xs" />
        )}
      </span>
    </th>
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">강의 관리</h1>
          <p className="text-sm text-gray-500 mt-1">전체 {courses.length}개</p>
        </div>
        <button onClick={() => navigate('/admin/courses/new')}
          className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20 flex items-center gap-1.5"><i className="ti ti-plus text-sm" /> 강의 추가</button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="강의 검색..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]" />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as TypeFilter); setPage(1) }}
          className={`py-2 px-3 bg-white border rounded-lg text-sm outline-none cursor-pointer ${typeFilter !== 'all' ? 'border-[#2ED573] text-[#2ED573] font-medium' : 'border-gray-200 text-gray-600'}`}>
          <option value="all">유형: 전체</option>
          <option value="free">유형: 무료</option>
          <option value="premium">유형: 프리미엄</option>
          <option value="pre_alert">유형: 사전 알림</option>
        </select>
        <select value={instructorFilter} onChange={(e) => { setInstructorFilter(e.target.value); setPage(1) }}
          className={`py-2 px-3 bg-white border rounded-lg text-sm outline-none cursor-pointer ${instructorFilter !== 'all' ? 'border-[#2ED573] text-[#2ED573] font-medium' : 'border-gray-200 text-gray-600'}`}>
          <option value="all">강사: 전체</option>
          {instructorOptions.map((i) => <option key={i.id} value={String(i.id)}>{i.name}</option>)}
        </select>
        <select value={priceFilter} onChange={(e) => { setPriceFilter(e.target.value as PriceFilter); setPage(1) }}
          className={`py-2 px-3 bg-white border rounded-lg text-sm outline-none cursor-pointer ${priceFilter !== 'all' ? 'border-[#2ED573] text-[#2ED573] font-medium' : 'border-gray-200 text-gray-600'}`}>
          <option value="all">가격: 전체</option>
          <option value="free">무료 (0원)</option>
          <option value="lt200">200만원 미만</option>
          <option value="200to400">200만~400만원</option>
          <option value="400to600">400만~600만원</option>
          <option value="gte600">600만원 이상</option>
        </select>
        <select value={ratingFilter} onChange={(e) => { setRatingFilter(e.target.value as RatingFilter); setPage(1) }}
          className={`py-2 px-3 bg-white border rounded-lg text-sm outline-none cursor-pointer ${ratingFilter !== 'all' ? 'border-[#2ED573] text-[#2ED573] font-medium' : 'border-gray-200 text-gray-600'}`}>
          <option value="all">평점: 전체</option>
          <option value="gte4_5">★ 4.5 이상</option>
          <option value="gte4">★ 4.0 이상</option>
          <option value="gte3">★ 3.0 이상</option>
          <option value="noreview">후기 없음</option>
        </select>
        <select value={scheduleFilter} onChange={(e) => { setScheduleFilter(e.target.value as ScheduleFilter); setPage(1) }}
          className={`py-2 px-3 bg-white border rounded-lg text-sm outline-none cursor-pointer ${scheduleFilter !== 'all' ? 'border-[#2ED573] text-[#2ED573] font-medium' : 'border-gray-200 text-gray-600'}`}>
          <option value="all">강의일시: 전체</option>
          <option value="upcoming">예정</option>
          <option value="past">종료</option>
          <option value="none">미설정</option>
        </select>
        <select value={enrollStartFilter} onChange={(e) => { setEnrollStartFilter(e.target.value as EnrollStartFilter); setPage(1) }}
          className={`py-2 px-3 bg-white border rounded-lg text-sm outline-none cursor-pointer ${enrollStartFilter !== 'all' ? 'border-[#2ED573] text-[#2ED573] font-medium' : 'border-gray-200 text-gray-600'}`}>
          <option value="all">오픈일시: 전체</option>
          <option value="pending">오픈 예정</option>
          <option value="opened">오픈됨</option>
          <option value="none">미설정</option>
        </select>
        <select value={enrollEndFilter} onChange={(e) => { setEnrollEndFilter(e.target.value as EnrollEndFilter); setPage(1) }}
          className={`py-2 px-3 bg-white border rounded-lg text-sm outline-none cursor-pointer ${enrollEndFilter !== 'all' ? 'border-[#2ED573] text-[#2ED573] font-medium' : 'border-gray-200 text-gray-600'}`}>
          <option value="all">마감일시: 전체</option>
          <option value="open">마감 전</option>
          <option value="closed">마감됨</option>
          <option value="none">미설정</option>
        </select>
        <select value={createdFilter} onChange={(e) => { setCreatedFilter(e.target.value as CreatedFilter); setPage(1) }}
          className={`py-2 px-3 bg-white border rounded-lg text-sm outline-none cursor-pointer ${createdFilter !== 'all' ? 'border-[#2ED573] text-[#2ED573] font-medium' : 'border-gray-200 text-gray-600'}`}>
          <option value="all">등록일: 전체</option>
          <option value="today">오늘</option>
          <option value="week">7일 이내</option>
          <option value="month">30일 이내</option>
          <option value="quarter">90일 이내</option>
          <option value="year">1년 이내</option>
        </select>
        {filterActive && (
          <button onClick={resetFilters}
            className="py-2 px-3 text-xs text-gray-500 hover:text-gray-900 bg-transparent border-none cursor-pointer flex items-center gap-1">
            <i className="ti ti-x text-sm" /> 필터 초기화
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-600 w-[220px]">썸네일</th>
                    <SortHeader label="강의명" k="title" className="text-left" />
                    <SortHeader label="강사" k="instructor" className="text-left max-sm:hidden" />
                    <SortHeader label="유형" k="type" className="text-center" />
                    <SortHeader label="가격" k="price" className="text-center max-md:hidden" />
                    <SortHeader label="수강생 / 정원" k="enrollments" className="text-center max-md:hidden" />
                    <SortHeader label="후기" k="reviews" className="text-center max-md:hidden" />
                    <SortHeader label="평점" k="rating" className="text-center max-md:hidden" />
                    <SortHeader label="강의일시" k="scheduled" className="text-center max-lg:hidden" />
                    <SortHeader label="등록일" k="created" className="text-center max-lg:hidden" />
                    <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.length === 0 ? (
                    <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 강의가 없습니다.'}</td></tr>
                  ) : paged.map((course) => {
                    const s = stats[course.id] ?? { enrollmentCount: 0, reviewCount: 0, avgRating: 0 }
                    return (
                    <tr key={course.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/courses/${course.id}`)}>
                      <td className="px-4 py-2">
                        <div className="w-[192px] h-[108px] bg-gray-100 rounded-lg overflow-hidden">
                          {course.thumbnail_url ? (
                            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">썸네일 없음</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{course.title}</td>
                      <td className="px-4 py-3 text-gray-500 max-sm:hidden">{course.instructor?.name || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${course.course_type === 'free' ? 'bg-blue-100 text-blue-700' : course.course_type === 'pre_alert' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                          {course.course_type === 'free' ? '무료' : course.course_type === 'pre_alert' ? '사전 알림' : '프리미엄'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 max-md:hidden">
                        {(() => {
                          // pre_alert 은 무료강의와 동일 동작 — 가격 표시도 '무료' 로 통일.
                          if (course.course_type === 'free' || course.course_type === 'pre_alert' || course.sale_price === 0) return '무료'
                          const price = (course.sale_price && course.sale_price > 0) ? course.sale_price : course.original_price
                          if (price == null) return '-'
                          return `${price.toLocaleString()}원`
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 text-xs max-md:hidden">
                        {s.enrollmentCount.toLocaleString()} / {course.max_enrollments != null && course.max_enrollments > 0 ? `${course.max_enrollments.toLocaleString()}명` : '무제한'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 text-xs max-md:hidden">
                        {s.reviewCount.toLocaleString()}개
                      </td>
                      <td className="px-4 py-3 text-center text-xs max-md:hidden">
                        {s.reviewCount > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-gray-700">
                            <span className="text-yellow-400">★</span>{s.avgRating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 text-xs max-lg:hidden whitespace-nowrap">
                        {course.scheduled_at
                          ? new Date(course.scheduled_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400 text-xs max-lg:hidden">
                        {new Date(course.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => navigate(`/admin/courses/${course.id}`)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
                          <button onClick={() => setDuplicateTarget(course.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#2ED573] hover:bg-[#2ED573]/10 bg-transparent border-none cursor-pointer transition-colors" aria-label="복사" title="복사"><i className="ti ti-copy text-sm" /></button>
                          <button onClick={() => setDeleteTarget(course.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                <i className="ti ti-chevron-left" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-sm border-none cursor-pointer ${
                    p === page ? 'bg-[#2ED573] text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
                  }`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                <i className="ti ti-chevron-right" />
              </button>
            </div>
          )}
        </>
      )}


      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="강의 삭제" message="이 강의를 삭제하시겠습니까? 관련 커리큘럼도 함께 삭제됩니다." />

      <Dialog
        open={!!duplicateTarget}
        onClose={() => { if (!duplicating) setDuplicateTarget(null) }}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-[#2ED573]/10">
              <i className="ti ti-copy text-xl text-[#2ED573]" />
            </div>
            <DialogTitle className="text-base font-bold text-gray-900">강의 복사</DialogTitle>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              모든 정보와 커리큘럼이 동일하게 복제되며, 제목 뒤에 '(1)' 이 붙어 목록 하단에 생성됩니다.<br />
              <span className="text-gray-700 font-medium">복제본을 어떻게 시작할까요?</span>
            </p>
            <div className="flex flex-col gap-2 mt-6">
              <button
                type="button"
                onClick={() => handleDuplicate(false)}
                disabled={duplicating}
                className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl cursor-pointer border-none hover:bg-gray-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <i className="ti ti-eye-off text-sm" />
                비공개로 복사 (검토 후 직접 공개)
              </button>
              <button
                type="button"
                onClick={() => handleDuplicate(true)}
                disabled={duplicating}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#2ED573] rounded-xl cursor-pointer border-none hover:bg-[#25B866] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <i className="ti ti-eye text-sm" />
                공개로 복사 (즉시 사이트 노출)
              </button>
              <button
                type="button"
                onClick={() => setDuplicateTarget(null)}
                disabled={duplicating}
                className="w-full px-4 py-2 text-xs text-gray-500 bg-transparent border-none cursor-pointer hover:text-gray-700 disabled:opacity-50"
              >
                {duplicating ? '복사 중...' : '취소'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </AdminLayout>
  )
}
