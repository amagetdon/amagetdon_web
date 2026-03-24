import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { ebookService } from '../../services/ebookService'
import { instructorService } from '../../services/instructorService'
import type { EbookWithInstructor, Instructor } from '../../types'

export default function AdminEbooks() {
  const [ebooks, setEbooks] = useState<EbookWithInstructor[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [e, i] = await Promise.all([ebookService.getAll(), instructorService.getAll()])
      setEbooks(e); setInstructors(i)
    } catch { alert('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!editing || !editing.title) return
    try {
      setSaving(true)
      if (editing.id) {
        const { id, instructor, created_at, updated_at, ...updates } = editing
        void instructor; void created_at; void updated_at
        await ebookService.update(id as number, updates)
      } else {
        await ebookService.create(editing)
      }
      setEditing(null); await fetchData()
    } catch { alert('저장에 실패했습니다.') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try { await ebookService.delete(id); await fetchData() } catch { alert('삭제에 실패했습니다.') }
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">전자책 관리</h1>
        <button onClick={() => setEditing({ title: '', instructor_id: null, is_free: false, is_hot: false, original_price: null, sale_price: null, is_published: true, duration_days: 30 })}
          className="bg-[#04F87F] text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border-none">+ 전자책 추가</button>
      </div>

      {editing && (
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-bold mb-4">{editing.id ? '전자책 수정' : '새 전자책'}</h2>
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">제목 *</label>
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
              <label className="text-sm font-bold block mb-1">정가 (원)</label>
              <input type="number" value={editing.is_free ? 0 : (editing.original_price as number) || ''}
                onChange={(e) => setEditing({ ...editing, original_price: e.target.value ? Number(e.target.value) : null })}
                disabled={!!editing.is_free}
                className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${editing.is_free ? 'bg-gray-100 text-gray-400' : ''}`} />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">할인가 (원)</label>
              <input type="number" value={editing.is_free ? 0 : (editing.sale_price as number) || ''}
                onChange={(e) => setEditing({ ...editing, sale_price: e.target.value ? Number(e.target.value) : null })}
                disabled={!!editing.is_free}
                className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${editing.is_free ? 'bg-gray-100 text-gray-400' : ''}`} />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">열람 기간 (일)</label>
              <input type="number" value={(editing.duration_days as number) || 30} onChange={(e) => setEditing({ ...editing, duration_days: Number(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_free} onChange={(e) => setEditing({ ...editing, is_free: e.target.checked })} /> 무료</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_hot} onChange={(e) => setEditing({ ...editing, is_hot: e.target.checked })} /> HOT 배지</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_published !== false} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} /> 공개</label>
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
                <th className="px-4 py-3 text-center font-bold text-gray-600">가격</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ebooks.map((eb) => (
                <tr key={eb.id}>
                  <td className="px-4 py-3 font-medium">
                    {eb.title}
                    {eb.is_hot && <span className="ml-2 text-xs bg-[#04F87F] text-white px-1.5 py-0.5 rounded">HOT</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-sm:hidden">{eb.instructor?.name || '-'}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{eb.is_free ? '무료' : eb.sale_price ? `${eb.sale_price.toLocaleString()}원` : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setEditing(eb as unknown as Record<string, unknown>)} className="text-blue-500 text-xs cursor-pointer bg-transparent border-none mr-2">수정</button>
                    <button onClick={() => handleDelete(eb.id)} className="text-red-500 text-xs cursor-pointer bg-transparent border-none">삭제</button>
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
