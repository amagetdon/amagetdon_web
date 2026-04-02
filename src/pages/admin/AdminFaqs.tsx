import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import VideoUrlInput from '../../components/admin/VideoUrlInput'
import { faqService } from '../../services/faqService'
import type { Faq } from '../../types'

export default function AdminFaqs() {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Faq> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    try { setLoading(true); const { data } = await withTimeout(faqService.getAll({ perPage: 100 })); setFaqs(data) }
    catch { toast.error('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!editing?.question || !editing?.answer) { toast.error('질문과 답변은 필수입니다.'); return }
    try {
      setSaving(true)
      if (editing.id) { await faqService.update(editing.id, editing); toast.success('FAQ가 수정되었습니다.') }
      else { await faqService.create(editing as Omit<Faq, 'id' | 'created_at' | 'updated_at'>); toast.success('새 FAQ가 등록되었습니다.') }
      setEditing(null); await fetchData()
    } catch { toast.error('저장에 실패했습니다.') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try { await faqService.delete(deleteTarget); toast.success('FAQ가 삭제되었습니다.'); setDeleteTarget(null); await fetchData() }
    catch { toast.error('삭제에 실패했습니다.') }
  }

  const filtered = faqs.filter((f) => f.question.includes(search) || f.answer.includes(search))

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">FAQ 관리</h1>
        <button onClick={() => setEditing({ question: '', answer: '', is_published: true })}
          className="bg-[#04F87F] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors shadow-sm shadow-[#04F87F]/20 flex items-center gap-1.5"><i className="ti ti-plus text-sm" /> FAQ 추가</button>
      </div>

      <div className="mb-4"><div className="relative max-w-xs">
        <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="FAQ 검색..."
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#04F87F]" />
      </div></div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="px-4 py-3 text-left font-bold text-gray-600">질문</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600">상태</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 FAQ가 없습니다.'}</td></tr>
              ) : filtered.map((faq) => (
                <tr key={faq.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{faq.question}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${faq.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {faq.is_published ? '공개' : '비공개'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditing(faq)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
                      <button onClick={() => setDeleteTarget(faq.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminFormModal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'FAQ 수정' : '새 FAQ 등록'} onSubmit={handleSave} loading={saving}>
        {editing && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-bold block mb-1">질문 *</label>
              <input value={editing.question || ''} onChange={(e) => setEditing({ ...editing, question: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">답변 *</label>
              <textarea value={editing.answer || ''} onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
                rows={5} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-[#04F87F]" />
            </div>
            <div>
              <VideoUrlInput
                value={editing.video_url || null}
                onChange={(url) => setEditing({ ...editing, video_url: url })}
                label="영상"
              />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">첨부파일 URL</label>
              <input value={editing.file_url || ''} onChange={(e) => setEditing({ ...editing, file_url: e.target.value || null })} placeholder="https://..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">첨부파일명</label>
              <input value={editing.file_name || ''} onChange={(e) => setEditing({ ...editing, file_name: e.target.value || null })} placeholder="파일명.xlsx"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={editing.is_published ?? true} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-[#04F87F]" /> 공개
            </label>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="FAQ 삭제" message="이 FAQ를 삭제하시겠습니까?" />
    </AdminLayout>
  )
}
