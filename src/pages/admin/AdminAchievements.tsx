import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import { achievementService } from '../../services/achievementService'
import { courseService } from '../../services/courseService'
import { useAuth } from '../../contexts/AuthContext'
import type { AchievementWithCourse, CourseWithInstructor } from '../../types'

export default function AdminAchievements() {
  const { user } = useAuth()
  const [achievements, setAchievements] = useState<AchievementWithCourse[]>([])
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<number | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [achData, courseData] = await withTimeout(Promise.all([
        achievementService.getAllAdmin({ perPage: 100 }),
        courseService.getAll(),
      ]))
      setAchievements(achData.data)
      setCourses(courseData)
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!editing || !editing.title || !editing.content) {
      toast.error('제목과 내용은 필수입니다.')
      return
    }
    if (!editing.course_id) {
      toast.error('강의를 선택해주세요.')
      return
    }
    try {
      setSaving(true)
      if (editing.id) {
        await achievementService.update(editing.id as number, {
          author_name: (editing.author_name as string) || '관리자',
          title: (editing.title as string).trim(),
          content: (editing.content as string).trim(),
          image_url: (editing.image_url as string) || null,
          course_id: (editing.course_id as number) || null,
          likes_count: (editing.likes_count as number) ?? 0,
          is_published: editing.is_published !== false,
        })
        toast.success('성과가 수정되었습니다.')
      } else {
        await achievementService.create({
          user_id: user?.id || '',
          author_name: (editing.author_name as string) || '관리자',
          title: (editing.title as string).trim(),
          content: (editing.content as string).trim(),
          image_url: (editing.image_url as string) || null,
          course_id: (editing.course_id as number) || null,
        })
        toast.success('새 성과가 등록되었습니다.')
      }
      setEditing(null)
      await fetchData()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePublish = async (item: Achievement) => {
    try {
      setToggling(item.id)
      await achievementService.update(item.id, { is_published: !item.is_published })
      toast.success(item.is_published ? '비공개 처리되었습니다.' : '공개 처리되었습니다.')
      await fetchData()
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await achievementService.delete(deleteTarget)
      toast.success('성과가 삭제되었습니다.')
      setDeleteTarget(null)
      await fetchData()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const filtered = achievements.filter(
    (a) => a.author_name.includes(search) || a.title.includes(search)
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">수강 성과 관리</h1>
        <button
          onClick={() => setEditing({ author_name: '관리자', title: '', content: '', image_url: '', course_id: null, likes_count: 0, is_published: true })}
          className="bg-[#04F87F] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors shadow-sm shadow-[#04F87F]/20 flex items-center gap-1.5"
        >
          <i className="ti ti-plus text-sm" /> 성과 추가
        </button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="성과 검색..."
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
                <th className="px-4 py-3 text-left font-bold text-gray-600 max-sm:hidden">강의</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">좋아요</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">날짜</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">공개</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    {search ? '검색 결과가 없습니다.' : '등록된 성과가 없습니다.'}
                  </td>
                </tr>
              ) : filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.author_name}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{item.title}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-sm:hidden max-w-[150px] truncate">
                    {item.course?.title || '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">
                    {item.likes_count}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden">
                    {new Date(item.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleTogglePublish(item)}
                      disabled={toggling === item.id}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg border-none cursor-pointer transition-colors mx-auto ${
                        item.is_published
                          ? 'text-[#04F87F] hover:bg-green-50 bg-transparent'
                          : 'text-gray-300 hover:bg-gray-100 bg-transparent'
                      } disabled:opacity-50`}
                      aria-label={item.is_published ? '비공개로 전환' : '공개로 전환'}
                    >
                      <i className={`ti ${item.is_published ? 'ti-eye' : 'ti-eye-off'} text-sm`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setEditing(item as unknown as Record<string, unknown>)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors"
                        aria-label="수정"
                      >
                        <i className="ti ti-pencil text-sm" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item.id)}
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

      {/* 성과 추가/수정 모달 */}
      <AdminFormModal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? '성과 수정' : '새 성과 등록'} onSubmit={handleSave} loading={saving}>
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
              <label className="text-sm font-bold block mb-1">좋아요 수</label>
              <input
                type="number"
                value={(editing.likes_count as number) ?? 0}
                onChange={(e) => setEditing({ ...editing, likes_count: Number(e.target.value) || 0 })}
                min={0}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">강의</label>
              <select
                value={(editing.course_id as number) || ''}
                onChange={(e) => setEditing({ ...editing, course_id: e.target.value ? Number(e.target.value) : null })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
              >
                <option value="">선택 안함</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.instructor?.name ? `[${c.instructor.name}] ` : ''}{c.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
                <input type="checkbox" checked={editing.is_published !== false} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-[#04F87F]" />
                공개
              </label>
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
                rows={6}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all resize-none"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">이미지</label>
              <ImageUploader
                bucket="achievements"
                path={`admin/${editing.id || 'new'}-${Date.now()}`}
                currentUrl={editing.image_url as string}
                onUpload={(url) => setEditing({ ...editing, image_url: url })}
                className="h-[160px]"
              />
            </div>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="성과 삭제"
        message="이 성과를 삭제하시겠습니까?"
      />
    </AdminLayout>
  )
}
