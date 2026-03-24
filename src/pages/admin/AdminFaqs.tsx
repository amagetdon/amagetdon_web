import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { faqService } from '../../services/faqService'
import type { Faq } from '../../types'

export default function AdminFaqs() {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Faq> | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data } = await faqService.getAll({ perPage: 100 })
      setFaqs(data)
    } catch { /* */ } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!editing?.question || !editing?.answer) return
    try {
      setSaving(true)
      if (editing.id) {
        await faqService.update(editing.id, editing)
      } else {
        await faqService.create(editing as Omit<Faq, 'id' | 'created_at' | 'updated_at'>)
      }
      setEditing(null)
      await fetchData()
    } catch { /* */ } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try { await faqService.delete(id); await fetchData() } catch { /* */ }
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">FAQ 관리</h1>
        <button
          onClick={() => setEditing({ question: '', answer: '', sort_order: 0, is_published: true })}
          className="bg-[#04F87F] text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border-none"
        >
          + FAQ 추가
        </button>
      </div>

      {editing && (
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-bold mb-4">{editing.id ? 'FAQ 수정' : '새 FAQ'}</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-bold block mb-1">질문 *</label>
              <input value={editing.question || ''} onChange={(e) => setEditing({ ...editing, question: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">답변 *</label>
              <textarea value={editing.answer || ''} onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
                rows={4} className="w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold block mb-1">정렬 순서</label>
                <input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.is_published ?? true} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} />
                  공개
                </label>
              </div>
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
                <th className="px-4 py-3 text-left font-bold text-gray-600">질문</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">상태</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">순서</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {faqs.map((faq) => (
                <tr key={faq.id}>
                  <td className="px-4 py-3 font-medium">{faq.question}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${faq.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {faq.is_published ? '공개' : '비공개'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{faq.sort_order}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setEditing(faq)} className="text-blue-500 text-xs cursor-pointer bg-transparent border-none mr-2">수정</button>
                    <button onClick={() => handleDelete(faq.id)} className="text-red-500 text-xs cursor-pointer bg-transparent border-none">삭제</button>
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
