import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { courseService } from '../../services/courseService'
import { instructorService } from '../../services/instructorService'
import type { CourseWithInstructor, Instructor } from '../../types'

export default function AdminCourses() {
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [c, i] = await Promise.all([courseService.getAll(), instructorService.getAll()])
      setCourses(c)
      setInstructors(i)
    } catch { alert('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!editing || !editing.title) return
    try {
      setSaving(true)
      if (editing.id) {
        const { id, instructor, curriculum_items, created_at, updated_at, ...updates } = editing
        void instructor; void curriculum_items; void created_at; void updated_at
        await courseService.update(id as number, updates)
      } else {
        await courseService.create(editing as never)
      }
      setEditing(null)
      await fetchData()
    } catch { alert('저장에 실패했습니다.') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try { await courseService.delete(id); await fetchData() } catch { alert('삭제에 실패했습니다.') }
  }

  const handleTypeChange = (type: string) => {
    if (type === 'free') {
      setEditing({ ...editing, course_type: type, original_price: 0, sale_price: 0 })
    } else {
      setEditing({ ...editing, course_type: type })
    }
  }

  const isFree = editing?.course_type === 'free'

  const newCourse = () => ({
    title: '', instructor_id: null, course_type: 'free', description: '',
    original_price: 0, sale_price: 0, is_published: true,
    enrollment_deadline: null, enrollment_start: null,
  })

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">강의 관리</h1>
        <button onClick={() => setEditing(newCourse())} className="bg-[#04F87F] text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border-none">
          + 강의 추가
        </button>
      </div>

      {editing && (
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-bold mb-4">{editing.id ? '강의 수정' : '새 강의'}</h2>
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">강의명 *</label>
              <input value={(editing.title as string) || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">강사</label>
              <select value={(editing.instructor_id as number) || ''} onChange={(e) => setEditing({ ...editing, instructor_id: e.target.value ? Number(e.target.value) : null })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">선택</option>
                {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">유형</label>
              <select value={(editing.course_type as string) || 'free'} onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none">
                <option value="free">무료</option>
                <option value="premium">프리미엄</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">정가 (원)</label>
              <input type="number" value={isFree ? 0 : (editing.original_price as number) || ''}
                onChange={(e) => setEditing({ ...editing, original_price: e.target.value ? Number(e.target.value) : null })}
                disabled={isFree}
                className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${isFree ? 'bg-gray-100 text-gray-400' : ''}`} />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">할인가 (원)</label>
              <input type="number" value={isFree ? 0 : (editing.sale_price as number) || ''}
                onChange={(e) => setEditing({ ...editing, sale_price: e.target.value ? Number(e.target.value) : null })}
                disabled={isFree}
                className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${isFree ? 'bg-gray-100 text-gray-400' : ''}`} />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">수강 시작일</label>
              <input type="date"
                value={(editing.enrollment_start as string)?.slice(0, 10) || ''}
                onChange={(e) => setEditing({ ...editing, enrollment_start: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">수강 마감일</label>
              <input type="date"
                value={(editing.enrollment_deadline as string)?.slice(0, 10) || ''}
                onChange={(e) => setEditing({ ...editing, enrollment_deadline: e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : null })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="bg-[#04F87F] text-white px-6 py-2 rounded-lg text-sm font-bold cursor-pointer border-none disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => setEditing(null)} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm cursor-pointer border-none">취소</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">불러오는 중...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600">강의명</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 max-sm:hidden">강사</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">유형</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">가격</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">등록일</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {courses.map((course) => (
                <tr key={course.id}>
                  <td className="px-4 py-3 font-medium">{course.title}</td>
                  <td className="px-4 py-3 text-gray-500 max-sm:hidden">{course.instructor?.name || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${course.course_type === 'free' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {course.course_type === 'free' ? '무료' : '프리미엄'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">
                    {course.course_type === 'free' ? '무료' : course.sale_price ? `${course.sale_price.toLocaleString()}원` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden">
                    {new Date(course.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setEditing(course as unknown as Record<string, unknown>)} className="text-blue-500 text-xs cursor-pointer bg-transparent border-none mr-2">수정</button>
                    <button onClick={() => handleDelete(course.id)} className="text-red-500 text-xs cursor-pointer bg-transparent border-none">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
