import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import { ebookService } from '../../services/ebookService'
import { instructorService } from '../../services/instructorService'
import type { EbookWithInstructor, Instructor } from '../../types'

export default function AdminEbooks() {
  const [ebooks, setEbooks] = useState<EbookWithInstructor[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    try { setLoading(true); const [e, i] = await Promise.all([ebookService.getAll(), instructorService.getAll()]); setEbooks(e); setInstructors(i) }
    catch { toast.error('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!editing || !editing.title) { toast.error('제목은 필수입니다.'); return }
    try {
      setSaving(true)
      if (editing.id) {
        const { id, instructor, created_at, updated_at, ...updates } = editing; void instructor; void created_at; void updated_at
        await ebookService.update(id as number, updates); toast.success('전자책이 수정되었습니다.')
      } else { await ebookService.create(editing); toast.success('새 전자책이 등록되었습니다.') }
      setEditing(null); await fetchData()
    } catch { toast.error('저장에 실패했습니다.') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try { await ebookService.delete(deleteTarget); toast.success('전자책이 삭제되었습니다.'); setDeleteTarget(null); await fetchData() }
    catch { toast.error('삭제에 실패했습니다.') }
  }

  const filtered = ebooks.filter((e) => e.title.includes(search) || (e.instructor?.name || '').includes(search))

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">전자책 관리</h1>
        <button onClick={() => setEditing({ title: '', instructor_id: null, is_free: false, is_hot: false, original_price: null, sale_price: null, is_published: true, duration_days: 30 })}
          className="bg-[#04F87F] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors shadow-sm shadow-[#04F87F]/20 flex items-center gap-1.5"><i className="ti ti-plus text-sm" /> 전자책 추가</button>
      </div>

      <div className="mb-4"><div className="relative max-w-xs">
        <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="전자책 검색..."
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#04F87F]" />
      </div></div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="px-4 py-3 text-left font-bold text-gray-600">제목</th>
              <th className="px-4 py-3 text-left font-bold text-gray-600 max-sm:hidden">강사</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600">가격</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
            </tr></thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 전자책이 없습니다.'}</td></tr>
              ) : filtered.map((eb) => (
                <tr key={eb.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{eb.title}{eb.is_hot && <span className="ml-2 text-xs bg-[#04F87F] text-white px-1.5 py-0.5 rounded">HOT</span>}</td>
                  <td className="px-4 py-3 text-gray-500 max-sm:hidden">{eb.instructor?.name || '-'}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{eb.is_free ? '무료' : eb.sale_price ? `${eb.sale_price.toLocaleString()}원` : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditing(eb as unknown as Record<string, unknown>)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
                      <button onClick={() => setDeleteTarget(eb.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminFormModal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? '전자책 수정' : '새 전자책 등록'} onSubmit={handleSave} loading={saving}>
        {editing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">제목 *</label>
              <input value={(editing.title as string) || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#04F87F]" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">강사</label>
              <select value={(editing.instructor_id as number) || ''} onChange={(e) => setEditing({ ...editing, instructor_id: e.target.value ? Number(e.target.value) : null })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#04F87F]">
                <option value="">선택</option>
                {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">오픈일</label>
              <input type="date" value={(editing.open_date as string)?.slice(0, 10) || ''}
                onChange={(e) => setEditing({ ...editing, open_date: e.target.value ? e.target.value + 'T00:00:00+09:00' : null })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#04F87F]" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">마감일</label>
              <input type="date" value={(editing.close_date as string)?.slice(0, 10) || ''}
                onChange={(e) => setEditing({ ...editing, close_date: e.target.value ? e.target.value + 'T23:59:59+09:00' : null })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#04F87F]" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">정가 (원)</label>
              <input type="number" value={editing.is_free ? 0 : (editing.original_price as number) || ''} disabled={!!editing.is_free}
                onChange={(e) => setEditing({ ...editing, original_price: e.target.value ? Number(e.target.value) : null })}
                className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none ${editing.is_free ? 'bg-gray-100 text-gray-400' : 'focus:border-[#04F87F]'}`} />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">할인가 (원)</label>
              <input type="number" value={editing.is_free ? 0 : (editing.sale_price as number) || ''} disabled={!!editing.is_free}
                onChange={(e) => setEditing({ ...editing, sale_price: e.target.value ? Number(e.target.value) : null })}
                className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none ${editing.is_free ? 'bg-gray-100 text-gray-400' : 'focus:border-[#04F87F]'}`} />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">표지 이미지</label>
              <ImageUploader bucket="ebooks" path={`${editing.id || 'new'}/thumb-${Date.now()}`}
                currentUrl={editing.thumbnail_url as string} onUpload={(url) => setEditing({ ...editing, thumbnail_url: url })} className="h-[140px]" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-2">뱃지 / 옵션</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!editing.is_free} onChange={(e) => setEditing({ ...editing, is_free: e.target.checked, ...(e.target.checked ? { original_price: 0, sale_price: 0 } : {}) })} className="accent-[#04F87F]" /> 무료</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!editing.is_hot} onChange={(e) => setEditing({ ...editing, is_hot: e.target.checked })} className="accent-[#04F87F]" /> HOT</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!editing.is_new} onChange={(e) => setEditing({ ...editing, is_new: e.target.checked })} className="accent-[#04F87F]" /> NEW</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.is_published !== false} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-[#04F87F]" /> 공개</label>
              </div>
            </div>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="전자책 삭제" message="이 전자책을 삭제하시겠습니까?" />
    </AdminLayout>
  )
}
