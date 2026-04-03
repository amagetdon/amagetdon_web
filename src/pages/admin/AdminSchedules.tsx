import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
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
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [courseSearch, setCourseSearch] = useState('')

  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [s, c, i] = await withTimeout(Promise.all([scheduleService.getByMonth(year, month), courseService.getAll(), instructorService.getAll()]))
      setSchedules(s); setCourses(c); setInstructors(i)
    } catch { toast.error('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [year, month])
  useVisibilityRefresh(fetchData)

  const handleSave = async () => {
    if (!editing || !editing.title || !editing.scheduled_at) { toast.error('제목과 일시는 필수입니다.'); return }
    try {
      setSaving(true)
      if (editing.id) {
        const { id, course, instructor, created_at, ...updates } = editing; void course; void instructor; void created_at
        await scheduleService.update(id as number, updates); toast.success('일정이 수정되었습니다.')
      } else {
        await scheduleService.create(editing as { title: string; scheduled_at: string; course_id?: number; instructor_id?: number })
        toast.success('새 일정이 등록되었습니다.')
      }
      setEditing(null); await fetchData()
    } catch { toast.error('저장에 실패했습니다.') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try { await scheduleService.delete(deleteTarget); toast.success('일정이 삭제되었습니다.'); setDeleteTarget(null); await fetchData() }
    catch { toast.error('삭제에 실패했습니다.') }
  }

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12) } else setMonth(month - 1) }
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1) } else setMonth(month + 1) }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">일정 관리</h1>
        <button onClick={() => setEditing({ title: '', scheduled_at: '', course_id: null, instructor_id: null })}
          className="bg-[#04F87F] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors shadow-sm shadow-[#04F87F]/20 flex items-center gap-1.5"><i className="ti ti-plus text-sm" /> 일정 추가</button>
      </div>

      {/* 월 네비게이션 */}
      <div className="flex items-center gap-4 mb-4">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white cursor-pointer"><i className="ti ti-chevron-left text-sm" /></button>
        <span className="text-sm font-bold text-gray-900">{year}년 {month}월</span>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white cursor-pointer"><i className="ti ti-chevron-right text-sm" /></button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="px-4 py-3 text-left font-bold text-gray-600">제목</th>
              <th className="px-4 py-3 text-left font-bold text-gray-600 max-sm:hidden">강사</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600">일시</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {schedules.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">{year}년 {month}월 일정이 없습니다.</td></tr>
              ) : schedules.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.title}</td>
                  <td className="px-4 py-3 text-gray-500 max-sm:hidden">{s.instructor?.name || '-'}</td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">{new Date(s.scheduled_at).toLocaleString('ko-KR')}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditing(s as unknown as Record<string, unknown>)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
                      <button onClick={() => setDeleteTarget(s.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminFormModal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? '일정 수정' : '새 일정 등록'} onSubmit={handleSave} loading={saving}>
        {editing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">제목 *</label>
              <input value={(editing.title as string) || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">일시 *</label>
              <input type="datetime-local" value={(() => {
                  const v = editing.scheduled_at as string
                  if (!v) return ''
                  const d = new Date(v)
                  const kr = new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 60000)
                  return `${kr.getFullYear()}-${String(kr.getMonth()+1).padStart(2,'0')}-${String(kr.getDate()).padStart(2,'0')}T${String(kr.getHours()).padStart(2,'0')}:${String(kr.getMinutes()).padStart(2,'0')}`
                })()}
                onChange={(e) => setEditing({ ...editing, scheduled_at: e.target.value ? e.target.value + ':00+09:00' : '' })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">강사</label>
              <select value={(editing.instructor_id as number) || ''} onChange={(e) => {
                const instructorId = e.target.value ? Number(e.target.value) : null
                setEditing({ ...editing, instructor_id: instructorId, course_id: null })
              }}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all">
                <option value="">전체</option>
                {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
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
                    className="w-full pl-8 pr-3 py-2 text-sm border-none outline-none border-b border-gray-200"
                    style={{ borderBottom: '1px solid #e5e7eb' }}
                  />
                </div>
                <div className="max-h-[160px] overflow-y-auto">
                  {(() => {
                    const filteredCourses = courses
                      .filter((c) => !editing.instructor_id || c.instructor?.id === (editing.instructor_id as number))
                      .filter((c) => !courseSearch || c.title.includes(courseSearch) || (c.instructor?.name || '').includes(courseSearch))
                    if (filteredCourses.length === 0) return (
                      <div className="px-3 py-4 text-sm text-gray-400 text-center">강의가 없습니다.</div>
                    )
                    return filteredCourses.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          const isSelected = (editing.course_id as number) === c.id
                          if (isSelected) {
                            setEditing({ ...editing, course_id: null })
                          } else {
                            setEditing({
                              ...editing,
                              course_id: c.id,
                              ...(c.instructor?.id && !editing.instructor_id ? { instructor_id: c.instructor.id } : {}),
                            })
                          }
                        }}
                        className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer transition-colors flex items-center justify-between ${
                          (editing.course_id as number) === c.id
                            ? 'bg-[#04F87F]/10 text-gray-900'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>
                          {c.instructor?.name && <span className="text-xs text-gray-400 mr-1">[{c.instructor.name}]</span>}
                          {c.title}
                        </span>
                        {(editing.course_id as number) === c.id && <i className="ti ti-check text-[#04F87F] text-sm" />}
                      </button>
                    ))
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="일정 삭제" message="이 일정을 삭제하시겠습니까?" />
    </AdminLayout>
  )
}
