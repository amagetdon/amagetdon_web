import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
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

  const fetchData = async () => {
    try {
      setLoading(true)
      const [r, c] = await Promise.all([
        reviewService.getAll({ perPage: 50 }),
        courseService.getAll(),
      ])
      setReviews(r.data)
      setCourses(c)
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!editing) return
    if (!editing.author_name || !editing.title || !editing.content) {
      toast.error('작성자명, 제목, 내용은 필수입니다.')
      return
    }
    try {
      setSaving(true)
      if (editing.id) {
        const { id, created_at, course, ...updates } = editing
        void created_at; void course
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

  const filtered = reviews.filter((r) => r.author_name.includes(search) || r.title.includes(search))

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">후기 관리</h1>
        <button
          onClick={() => setEditing({ author_name: '', title: '', content: '', rating: 5, course_id: null, is_published: true })}
          className="bg-[#04F87F] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors shadow-sm shadow-[#04F87F]/20 flex items-center gap-1.5"
        >
          <i className="ti ti-plus text-sm" /> 후기 추가
        </button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="후기 검색..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#04F87F]"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600">작성자</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600">제목</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">별점</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">날짜</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 후기가 없습니다.'}</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.author_name}</td>
                  <td className="px-4 py-3 text-gray-700">{r.title}</td>
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
      )}

      <AdminFormModal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? '후기 수정' : '새 후기 등록'} onSubmit={handleSave} loading={saving}>
        {editing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-bold block mb-1">작성자명 *</label>
              <input
                value={(editing.author_name as string) || ''}
                onChange={(e) => setEditing({ ...editing, author_name: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
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
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">내용 *</label>
              <textarea
                value={(editing.content as string) || ''}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                rows={5}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">강의</label>
              <select
                value={(editing.course_id as number) || ''}
                onChange={(e) => {
                  const courseId = e.target.value ? Number(e.target.value) : null
                  const course = courses.find((c) => c.id === courseId)
                  setEditing({ ...editing, course_id: courseId, instructor_id: course?.instructor_id ?? null })
                }}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
              >
                <option value="">선택 안함</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold block mb-2">옵션</label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_published !== false}
                  onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
                  className="accent-[#04F87F]"
                />
                공개
              </label>
            </div>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="후기 삭제" message="이 후기를 삭제하시겠습니까?" />
    </AdminLayout>
  )
}
