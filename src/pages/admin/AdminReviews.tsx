import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ReviewBulkUploadModal from '../../components/admin/ReviewBulkUploadModal'
import { reviewService } from '../../services/reviewService'
import { courseService } from '../../services/courseService'
import type { ReviewWithCourse, CourseWithInstructor } from '../../types'

export default function AdminReviews() {
  const [reviews, setReviews] = useState<ReviewWithCourse[]>([])
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState<number | 'all'>('all')
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all')
  const [page, setPage] = useState(0)
  const [courseSearch, setCourseSearch] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [r, c] = await withTimeout(Promise.all([
        reviewService.getAll({ perPage: 1000 }),
        courseService.getAll(),
      ]))
      setReviews(r.data)
      setCourses(c)
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])
  useVisibilityRefresh(fetchData)

  const handleSave = async () => {
    if (!editing) return
    if (!editing.author_name || !editing.title || !editing.content) {
      toast.error('작성자명, 제목, 내용은 필수입니다.')
      return
    }
    if (!editing.course_id) {
      toast.error('강의를 선택해 주세요.')
      return
    }
    try {
      setSaving(true)
      if (editing.id) {
        // is_low_rating 은 rating 으로부터 자동 계산되는 generated column — 업데이트 대상에서 제외
        const { id, created_at, course, is_low_rating, ...updates } = editing
        void created_at; void course; void is_low_rating
        await reviewService.update(id as number, updates)
        toast.success('후기가 수정되었습니다.')
      } else {
        await reviewService.create({
          author_name: editing.author_name as string,
          title: editing.title as string,
          content: editing.content as string,
          rating: (editing.rating as number) || 5,
          course_id: (editing.course_id as number) || null,
          instructor_id: (editing.instructor_id as number) || null,
          user_id: null,
          email: null,
          phone: null,
        })
        toast.success('새 후기가 등록되었습니다.')
      }
      setEditing(null)
      await fetchData()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await reviewService.delete(deleteTarget)
      toast.success('후기가 삭제되었습니다.')
      setDeleteTarget(null)
      await fetchData()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const filtered = reviews.filter((r) =>
    (r.author_name.includes(search) || r.title.includes(search))
    && (courseFilter === 'all' || r.course_id === courseFilter)
    && (ratingFilter === 'all' || r.rating === ratingFilter),
  )
  const PER_PAGE = 20
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageClamped = Math.min(page, totalPages - 1)
  const paged = filtered.slice(pageClamped * PER_PAGE, (pageClamped + 1) * PER_PAGE)
  useEffect(() => { setPage(0) }, [search, courseFilter, ratingFilter])

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">후기 관리</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBulkOpen(true)}
            className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors flex items-center gap-1.5"
          >
            <i className="ti ti-file-spreadsheet text-sm" /> 엑셀 일괄 업로드
          </button>
          <button
            onClick={() => setEditing({ author_name: '', title: '', content: '', rating: 5, course_id: null, is_published: true })}
            className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20 flex items-center gap-1.5"
          >
            <i className="ti ti-plus text-sm" /> 후기 추가
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="후기 검색..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]"
          />
        </div>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573] cursor-pointer max-w-[240px]"
        >
          <option value="all">전체 강의</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573] cursor-pointer"
        >
          <option value="all">전체 별점</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{n}점</option>
          ))}
        </select>
        {(search || courseFilter !== 'all' || ratingFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setCourseFilter('all'); setRatingFilter('all') }}
            className="py-2 px-3 text-sm text-gray-500 bg-transparent border-none cursor-pointer hover:text-gray-800"
          >
            필터 초기화
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
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600">작성자</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600">제목</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 max-sm:hidden">강의명</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">별점</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">날짜</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 후기가 없습니다.'}</td></tr>
              ) : paged.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.author_name}</td>
                  <td className="px-4 py-3 text-gray-700">{r.title}</td>
                  <td className="px-4 py-3 text-gray-500 max-sm:hidden">{r.course?.title ?? '-'}</td>
                  <td className="px-4 py-3 text-center text-yellow-500 max-sm:hidden">{'★'.repeat(r.rating)}</td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden">{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setEditing(r as unknown as Record<string, unknown>)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors"
                        aria-label="수정"
                      >
                        <i className="ti ti-pencil text-sm" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(r.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors"
                        aria-label="삭제"
                      >
                        <i className="ti ti-trash text-sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-4">
            <button
              onClick={() => setPage(Math.max(0, pageClamped - 1))}
              disabled={pageClamped === 0}
              className="px-3 py-1.5 rounded-lg text-sm text-gray-500 bg-white border border-gray-200 cursor-pointer hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              이전
            </button>
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter((i) => Math.abs(i - pageClamped) <= 2 || i === 0 || i === totalPages - 1)
              .map((i, idx, arr) => (
                <span key={i} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== i - 1 && <span className="px-1 text-gray-300 text-sm">…</span>}
                  <button
                    onClick={() => setPage(i)}
                    className={`min-w-[32px] px-2 py-1.5 rounded-lg text-sm cursor-pointer border ${
                      i === pageClamped
                        ? 'bg-[#2ED573] text-white border-[#2ED573] font-bold'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                </span>
              ))}
            <button
              onClick={() => setPage(Math.min(totalPages - 1, pageClamped + 1))}
              disabled={pageClamped >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-sm text-gray-500 bg-white border border-gray-200 cursor-pointer hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
        )}
        </>
      )}

      <AdminFormModal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? '후기 수정' : '새 후기 등록'} onSubmit={handleSave} loading={saving}>
        {editing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-bold block mb-1">작성자명 *</label>
              <input
                value={(editing.author_name as string) || ''}
                onChange={(e) => setEditing({ ...editing, author_name: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">별점</label>
              <div className="flex items-center gap-1 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setEditing({ ...editing, rating: star })}
                    className={`text-2xl bg-transparent border-none cursor-pointer transition-colors ${
                      star <= ((editing.rating as number) || 5) ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">제목 *</label>
              <input
                value={(editing.title as string) || ''}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">내용 *</label>
              <textarea
                value={(editing.content as string) || ''}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                rows={5}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all resize-none"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">강의</label>
              <div className="border border-gray-300 rounded-xl overflow-hidden">
                <div className="relative">
                  <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder="강의 검색..."
                    className="w-full pl-8 pr-3 py-2 text-sm border-none outline-none"
                    style={{ borderBottom: '1px solid #e5e7eb' }}
                  />
                </div>
                <div className="max-h-[160px] overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, course_id: null, instructor_id: null })}
                    className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer transition-colors ${
                      !editing.course_id ? 'bg-[#2ED573]/10 text-gray-900' : 'bg-white text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    선택 안함
                  </button>
                  {[...courses]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .filter((c) => {
                      const q = courseSearch.trim().toLowerCase()
                      return !q || c.title.toLowerCase().includes(q) || (c.instructor?.name || '').toLowerCase().includes(q)
                    })
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          const isSelected = (editing.course_id as number) === c.id
                          if (isSelected) {
                            setEditing({ ...editing, course_id: null, instructor_id: null })
                          } else {
                            setEditing({ ...editing, course_id: c.id, instructor_id: c.instructor_id ?? null })
                          }
                        }}
                        className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer transition-colors flex items-center justify-between ${
                          (editing.course_id as number) === c.id
                            ? 'bg-[#2ED573]/10 text-gray-900'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>
                          {c.instructor?.name && <span className="text-xs text-gray-400 mr-1">[{c.instructor.name}]</span>}
                          {c.title}
                        </span>
                        {(editing.course_id as number) === c.id && <i className="ti ti-check text-[#2ED573] text-sm" />}
                      </button>
                    ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold block mb-2">옵션</label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_published !== false}
                  onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
                  className="accent-[#2ED573]"
                />
                공개
              </label>
            </div>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="후기 삭제" message="이 후기를 삭제하시겠습니까?" />

      <ReviewBulkUploadModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        courses={courses}
        onComplete={fetchData}
      />
    </AdminLayout>
  )
}
