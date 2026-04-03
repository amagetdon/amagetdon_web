import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import { instructorService } from '../../services/instructorService'
import type { Instructor } from '../../types'

export default function AdminInstructors() {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Instructor> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const data = await withTimeout(instructorService.getAll())
      setInstructors(data)
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])
  useVisibilityRefresh(fetchData)

  const handleSave = async () => {
    if (!editing?.name || !editing?.title) {
      toast.error('이름과 직함은 필수입니다.')
      return
    }
    try {
      setSaving(true)
      if (editing.id) {
        await instructorService.update(editing.id, editing)
        toast.success('강사 정보가 수정되었습니다.')
      } else {
        await instructorService.create(editing as Omit<Instructor, 'id' | 'created_at' | 'updated_at'>)
        toast.success('새 강사가 등록되었습니다.')
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
      await instructorService.delete(deleteTarget)
      toast.success('강사가 삭제되었습니다.')
      setDeleteTarget(null)
      await fetchData()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const filtered = instructors.filter((i) =>
    i.name.includes(search) || i.title.includes(search)
  )

  const newInstructor = (): Partial<Instructor> => ({
    name: '', title: '', headline: '', bio: '', careers: [], image_url: null,
    has_active_course: false, is_published: true,
  })

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">강사 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">등록된 강사 {instructors.length}명</p>
        </div>
        <button
          onClick={() => setEditing(newInstructor())}
          className="bg-[#04F87F] text-white px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors shadow-sm shadow-[#04F87F]/20 flex items-center gap-1.5"
        >
          <i className="ti ti-plus text-sm" /> 강사 추가
        </button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <i className="ti ti-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="강사 검색..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">강사</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider max-sm:hidden">직함</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">상태</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider w-[100px]">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-16 text-center">
                  <i className="ti ti-users-minus text-4xl text-gray-200 block mb-2" />
                  <p className="text-sm text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 강사가 없습니다.'}</p>
                </td></tr>
              ) : filtered.map((inst) => (
                <tr key={inst.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                        {inst.image_url ? <img src={inst.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><i className="ti ti-user" /></div>}
                      </div>
                      <span className="font-semibold text-gray-900">{inst.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 max-sm:hidden">{inst.title}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${inst.is_published ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${inst.is_published ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {inst.is_published ? '공개' : '비공개'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditing(inst)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정">
                        <i className="ti ti-pencil text-sm" />
                      </button>
                      <button onClick={() => setDeleteTarget(inst.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제">
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

      {/* 등록/수정 모달 */}
      <AdminFormModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? '강사 수정' : '새 강사 등록'}
        onSubmit={handleSave}
        loading={saving}
      >
        {editing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-bold block mb-1">이름 *</label>
              <input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">직함 *</label>
              <input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">헤드라인</label>
              <input value={editing.headline || ''} onChange={(e) => setEditing({ ...editing, headline: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">소개글</label>
              <textarea value={editing.bio || ''} onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
                rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-[#04F87F]" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">경력 (줄바꿈으로 구분)</label>
              <textarea value={(editing.careers || []).join('\n')} onChange={(e) => setEditing({ ...editing, careers: e.target.value.split('\n').filter(Boolean) })}
                rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-[#04F87F]" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">프로필 이미지</label>
              <ImageUploader
                bucket="instructors"
                path={`${editing.id || 'new'}/profile-${Date.now()}`}
                currentUrl={editing.image_url}
                onUpload={(url) => setEditing({ ...editing, image_url: url })}
                className="h-[180px]"
              />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">썸네일 이미지</label>
              <p className="text-xs text-gray-400 mb-1">미등록 시 메인 페이지 강사 소개에 표시되지 않습니다.</p>
              <ImageUploader
                bucket="instructors"
                path={`${editing.id || 'new'}/thumbnail-${Date.now()}`}
                currentUrl={editing.thumbnail_url}
                onUpload={(url) => setEditing({ ...editing, thumbnail_url: url })}
                className="h-[140px]"
              />
            </div>
            <div className="flex flex-col gap-3 justify-center">
              <label className="text-sm font-bold block mb-1">옵션</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.is_published ?? true} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-[#04F87F]" /> 공개</label>
              </div>
            </div>
          </div>
        )}
      </AdminFormModal>

      {/* 삭제 확인 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="강사 삭제"
        message="이 강사를 삭제하시겠습니까? 관련 강의와 전자책은 유지됩니다."
      />
    </AdminLayout>
  )
}
