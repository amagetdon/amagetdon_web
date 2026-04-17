import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
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
  const [search, setSearch] = useState('')

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

  type SortKey = 'title' | 'instructor' | 'type' | 'price' | 'created' | 'enrollments' | 'reviews' | 'rating'
  const [sortKey, setSortKey] = useState<SortKey>('created')
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)
  const PER_PAGE = 10

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === 'title' || key === 'instructor') }
    setPage(1)
  }

  const filtered = courses.filter((c) => c.title.includes(search) || (c.instructor?.name || '').includes(search))

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortAsc ? 1 : -1
    const sa = stats[a.id] ?? { enrollmentCount: 0, reviewCount: 0, avgRating: 0 }
    const sb = stats[b.id] ?? { enrollmentCount: 0, reviewCount: 0, avgRating: 0 }
    switch (sortKey) {
      case 'title': return dir * a.title.localeCompare(b.title)
      case 'instructor': return dir * (a.instructor?.name || '').localeCompare(b.instructor?.name || '')
      case 'type': return dir * a.course_type.localeCompare(b.course_type)
      case 'price': return dir * ((a.sale_price ?? 0) - (b.sale_price ?? 0))
      case 'created': return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      case 'enrollments': return dir * (sa.enrollmentCount - sb.enrollmentCount)
      case 'reviews': return dir * (sa.reviewCount - sb.reviewCount)
      case 'rating': return dir * (sa.avgRating - sb.avgRating)
      default: return 0
    }
  })

  const totalPages = Math.ceil(sorted.length / PER_PAGE)
  const paged = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE)

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

      <div className="mb-4">
        <div className="relative max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="강의 검색..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]" />
        </div>
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
                    <SortHeader label="등록일" k="created" className="text-center max-lg:hidden" />
                    <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 강의가 없습니다.'}</td></tr>
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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${course.course_type === 'free' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {course.course_type === 'free' ? '무료' : '프리미엄'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 max-md:hidden">
                        {course.course_type === 'free' ? '무료' : course.sale_price ? `${course.sale_price.toLocaleString()}원` : '-'}
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
                      <td className="px-4 py-3 text-center text-gray-400 text-xs max-lg:hidden">
                        {new Date(course.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => navigate(`/admin/courses/${course.id}`)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
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
    </AdminLayout>
  )
}
