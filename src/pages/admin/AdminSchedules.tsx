import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { scheduleService } from '../../services/scheduleService'
import { courseService } from '../../services/courseService'
import { instructorService } from '../../services/instructorService'
import type { ScheduleWithDetails, CourseWithInstructor, Instructor } from '../../types'

export default function AdminSchedules() {
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([])
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)

  const now = new Date()

  const fetchData = async () => {
    try {
      setLoading(true)
      const [s, c, i] = await Promise.all([
        scheduleService.getByMonth(now.getFullYear(), now.getMonth() + 1),
        courseService.getAll(),
        instructorService.getAll(),
      ])
      setSchedules(s); setCourses(c); setInstructors(i)
    } catch { alert('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!editing || !editing.title || !editing.scheduled_at) return
    try {
      setSaving(true)
      if (editing.id) {
        const { id, course, instructor, created_at, ...updates } = editing
        void course; void instructor; void created_at
        await scheduleService.update(id as number, updates)
      } else {
        await scheduleService.create(editing as { title: string; scheduled_at: string; course_id?: number; instructor_id?: number })
      }
      setEditing(null); await fetchData()
    } catch { alert('저장에 실패했습니다.') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try { await scheduleService.delete(id); await fetchData() } catch { alert('삭제에 실패했습니다.') }
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">일정 관리</h1>
        <button onClick={() => setEditing({ title: '', scheduled_at: '', course_id: null, instructor_id: null })}
          className="bg-[#04F87F] text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border-none">+ 일정 추가</button>
      </div>

      {editing && (
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-bold mb-4">{editing.id ? '일정 수정' : '새 일정'}</h2>
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">제목 *</label>
              <input value={(editing.title as string) || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">일시 *</label>
              <input type="datetime-local" value={(editing.scheduled_at as string)?.slice(0, 16) || ''} onChange={(e) => setEditing({ ...editing, scheduled_at: new Date(e.target.value).toISOString() })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">강의</label>
              <select value={(editing.course_id as number) || ''} onChange={(e) => setEditing({ ...editing, course_id: e.target.value ? Number(e.target.value) : null })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">선택</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">강사</label>
              <select value={(editing.instructor_id as number) || ''} onChange={(e) => setEditing({ ...editing, instructor_id: e.target.value ? Number(e.target.value) : null })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">선택</option>
                {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="bg-[#04F87F] text-white px-6 py-2 rounded-lg text-sm font-bold cursor-pointer border-none disabled:opacity-50">{saving ? '저장 중...' : '저장'}</button>
            <button onClick={() => setEditing(null)} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm cursor-pointer border-none">취소</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-10 text-gray-400">불러오는 중...</div> : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600">제목</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 max-sm:hidden">강사</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">일시</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.title}</td>
                  <td className="px-4 py-3 text-gray-500 max-sm:hidden">{s.instructor?.name || '-'}</td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">{new Date(s.scheduled_at).toLocaleString('ko-KR')}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setEditing(s as unknown as Record<string, unknown>)} className="text-blue-500 text-xs cursor-pointer bg-transparent border-none mr-2">수정</button>
                    <button onClick={() => handleDelete(s.id)} className="text-red-500 text-xs cursor-pointer bg-transparent border-none">삭제</button>
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">이번 달 일정이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
