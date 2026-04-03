import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import VideoUrlInput from '../../components/admin/VideoUrlInput'
import { courseService } from '../../services/courseService'
import { instructorService } from '../../services/instructorService'
import { supabase } from '../../lib/supabase'
import type { CourseWithInstructor, Instructor } from '../../types'

interface CurriculumItem {
  id?: number
  course_id?: number
  week: number | null
  label: string
  description: string | null
  video_url: string | null
  sort_order: number
}

export default function AdminCourses() {
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [curriculumItems, setCurriculumItems] = useState<CurriculumItem[]>([])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [c, i] = await withTimeout(Promise.all([courseService.getAll(), instructorService.getAll()]))
      setCourses(c); setInstructors(i)
    } catch { toast.error('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])
  useVisibilityRefresh(fetchData)

  useEffect(() => {
    const loadCurriculum = async (courseId: number) => {
      try {
        const { data, error } = await supabase
          .from('curriculum_items')
          .select('*')
          .eq('course_id', courseId)
          .order('sort_order')
        if (error) throw error
        setCurriculumItems((data || []).map((item: Record<string, unknown>) => ({
          id: item.id as number,
          course_id: item.course_id as number,
          week: item.week as number | null,
          label: item.label as string,
          description: item.description as string | null,
          video_url: item.video_url as string | null,
          sort_order: item.sort_order as number,
        })))
      } catch {
        toast.error('커리큘럼을 불러오는데 실패했습니다.')
      }
    }
    if (editing?.id) {
      loadCurriculum(editing.id as number)
    } else {
      setCurriculumItems([])
    }
  }, [editing?.id])

  const saveCurriculum = async (courseId: number) => {
    const { error: deleteError } = await supabase.from('curriculum_items').delete().eq('course_id', courseId)
    if (deleteError) throw deleteError
    const validItems = curriculumItems.filter((item) => item.label.trim())
    if (validItems.length > 0) {
      const items = validItems.map((item, idx) => ({
        course_id: courseId,
        week: item.week || null,
        label: item.label.trim(),
        description: item.description?.trim() || null,
        video_url: item.video_url || null,
        sort_order: idx + 1,
      }))
      const { error } = await supabase.from('curriculum_items').insert(items as never)
      if (error) throw error
    }
  }

  const handleSave = async () => {
    if (!editing || !editing.title) { toast.error('강의명은 필수입니다.'); return }
    try {
      setSaving(true)
      const courseData = {
        title: editing.title,
        instructor_id: editing.instructor_id ?? null,
        course_type: editing.course_type ?? 'free',
        original_price: editing.original_price ?? null,
        sale_price: editing.sale_price ?? null,
        thumbnail_url: editing.thumbnail_url ?? null,
        landing_image_url: editing.landing_image_url ?? null,
        video_url: editing.video_url ?? null,
        enrollment_deadline: editing.enrollment_deadline ?? null,
        duration_days: editing.duration_days ?? 30,
        is_published: editing.is_published !== false,
        sort_order: editing.sort_order ?? 0,
        description: editing.description ?? null,
      }
      if (editing.id) {
        await courseService.update(editing.id as number, courseData)
        await saveCurriculum(editing.id as number)
        toast.success('강의가 수정되었습니다.')
      } else {
        const created = await courseService.create(courseData as never) as { id: number }
        await saveCurriculum(created.id)
        toast.success('새 강의가 등록되었습니다.')
      }
      setEditing(null); await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await courseService.delete(deleteTarget)
      toast.success('강의가 삭제되었습니다.')
      setDeleteTarget(null); await fetchData()
    } catch { toast.error('삭제에 실패했습니다.') }
  }

  const handleTypeChange = (type: string) => {
    if (type === 'free') setEditing({ ...editing, course_type: type, original_price: 0, sale_price: 0 })
    else setEditing({ ...editing, course_type: type })
  }

  const addCurriculumItem = () => {
    setCurriculumItems([...curriculumItems, { week: null, label: '', description: null, video_url: null, sort_order: curriculumItems.length + 1 }])
  }

  const updateCurriculumItem = (index: number, field: keyof CurriculumItem, value: unknown) => {
    setCurriculumItems(curriculumItems.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const removeCurriculumItem = (index: number) => {
    setCurriculumItems(curriculumItems.filter((_, i) => i !== index))
  }

  const isFree = editing?.course_type === 'free'

  type SortKey = 'title' | 'instructor' | 'type' | 'price' | 'created'
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
    switch (sortKey) {
      case 'title': return dir * a.title.localeCompare(b.title)
      case 'instructor': return dir * (a.instructor?.name || '').localeCompare(b.instructor?.name || '')
      case 'type': return dir * a.course_type.localeCompare(b.course_type)
      case 'price': return dir * ((a.sale_price ?? 0) - (b.sale_price ?? 0))
      case 'created': return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
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
          <i className={`ti ti-chevron-${sortAsc ? 'up' : 'down'} text-[#04F87F] text-xs`} />
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
        <button onClick={() => setEditing({ title: '', instructor_id: null, course_type: 'free', original_price: 0, sale_price: 0, is_published: true, enrollment_deadline: null, video_url: null })}
          className="bg-[#04F87F] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors shadow-sm shadow-[#04F87F]/20 flex items-center gap-1.5"><i className="ti ti-plus text-sm" /> 강의 추가</button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="강의 검색..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#04F87F]" />
        </div>
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
                  <SortHeader label="강의명" k="title" className="text-left" />
                  <SortHeader label="강사" k="instructor" className="text-left max-sm:hidden" />
                  <SortHeader label="유형" k="type" className="text-center" />
                  <SortHeader label="가격" k="price" className="text-center max-sm:hidden" />
                  <SortHeader label="등록일" k="created" className="text-center max-sm:hidden" />
                  <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paged.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 강의가 없습니다.'}</td></tr>
                ) : paged.map((course) => (
                  <tr key={course.id} className="hover:bg-gray-50">
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
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditing(course as unknown as Record<string, unknown>)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
                        <button onClick={() => setDeleteTarget(course.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    p === page ? 'bg-[#04F87F] text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
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

      <AdminFormModal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? '강의 수정' : '새 강의 등록'} onSubmit={handleSave} loading={saving}>
        {editing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">강의명 *</label>
              <input value={(editing.title as string) || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">강사</label>
              <select value={(editing.instructor_id as number) || ''} onChange={(e) => setEditing({ ...editing, instructor_id: e.target.value ? Number(e.target.value) : null })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all">
                <option value="">선택</option>
                {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">유형</label>
              <select value={(editing.course_type as string) || 'free'} onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all">
                <option value="free">무료</option>
                <option value="premium">프리미엄</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">정가 (원)</label>
              <input type="number" value={isFree ? 0 : (editing.original_price as number) || ''} disabled={isFree}
                onChange={(e) => setEditing({ ...editing, original_price: e.target.value ? Number(e.target.value) : null })}
                className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none ${isFree ? 'bg-gray-100 text-gray-400' : 'focus:border-[#04F87F]'}`} />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">할인가 (원)</label>
              <input type="number" value={isFree ? 0 : (editing.sale_price as number) || ''} disabled={isFree}
                onChange={(e) => setEditing({ ...editing, sale_price: e.target.value ? Number(e.target.value) : null })}
                className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none ${isFree ? 'bg-gray-100 text-gray-400' : 'focus:border-[#04F87F]'}`} />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">오픈일</label>
              <input type="date" value={(editing.enrollment_start as string)?.slice(0, 10) || ''}
                onChange={(e) => setEditing({ ...editing, enrollment_start: e.target.value ? e.target.value + 'T00:00:00+09:00' : null })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">마감일</label>
              <input type="date" value={(editing.enrollment_deadline as string)?.slice(0, 10) || ''}
                onChange={(e) => setEditing({ ...editing, enrollment_deadline: e.target.value ? e.target.value + 'T23:59:59+09:00' : null })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">썸네일 이미지</label>
              <ImageUploader bucket="courses" path={`${editing.id || 'new'}/thumb-${Date.now()}`}
                currentUrl={editing.thumbnail_url as string} onUpload={(url) => setEditing({ ...editing, thumbnail_url: url })} className="h-[140px]" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">랜딩 이미지</label>
              <ImageUploader bucket="courses" path={`${editing.id || 'new'}/landing-${Date.now()}`}
                currentUrl={editing.landing_image_url as string} onUpload={(url) => setEditing({ ...editing, landing_image_url: url })} className="h-[140px]" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <VideoUrlInput
                value={(editing.video_url as string) || null}
                onChange={(url) => setEditing({ ...editing, video_url: url })}
                label="홍보 영상"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-2">뱃지 / 옵션</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!editing.is_hot} onChange={(e) => setEditing({ ...editing, is_hot: e.target.checked })} className="accent-[#04F87F]" /> HOT</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!editing.is_new} onChange={(e) => setEditing({ ...editing, is_new: e.target.checked })} className="accent-[#04F87F]" /> NEW</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.is_published !== false} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-[#04F87F]" /> 공개</label>
              </div>
            </div>

            <div className="col-span-2 max-sm:col-span-1 border-t border-gray-200 pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold">커리큘럼 관리</label>
                <button type="button" onClick={addCurriculumItem}
                  className="bg-[#04F87F] text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors flex items-center gap-1">
                  <i className="ti ti-plus text-xs" /> 항목 추가
                </button>
              </div>
              {curriculumItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">등록된 커리큘럼이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {curriculumItems.map((item, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-xl p-3 bg-gray-50 relative">
                      <button type="button" onClick={() => removeCurriculumItem(idx)}
                        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors"
                        aria-label="커리큘럼 항목 삭제">
                        <i className="ti ti-x text-sm" />
                      </button>
                      <div className="grid grid-cols-[60px_1fr] max-sm:grid-cols-1 gap-2 pr-6">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">주차</label>
                          <input type="number" value={item.week ?? ''} placeholder="-"
                            onChange={(e) => updateCurriculumItem(idx, 'week', e.target.value ? Number(e.target.value) : null)}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#04F87F]" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">강의명</label>
                          <input type="text" value={item.label} placeholder="강의 제목을 입력하세요"
                            onChange={(e) => updateCurriculumItem(idx, 'label', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#04F87F]" />
                        </div>
                        <div className="col-span-full">
                          <label className="text-xs text-gray-500 block mb-1">설명</label>
                          <textarea value={item.description ?? ''} placeholder="강의 설명 (선택)"
                            onChange={(e) => updateCurriculumItem(idx, 'description', e.target.value || null)}
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#04F87F] resize-none" />
                        </div>
                        <div className="col-span-full">
                          <VideoUrlInput
                            value={item.video_url}
                            onChange={(url) => updateCurriculumItem(idx, 'video_url', url)}
                            label="영상 URL"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="강의 삭제" message="이 강의를 삭제하시겠습니까? 관련 커리큘럼도 함께 삭제됩니다." />
    </AdminLayout>
  )
}
