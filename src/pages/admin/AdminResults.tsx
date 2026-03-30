import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import VideoUrlInput from '../../components/admin/VideoUrlInput'
import { resultService } from '../../services/resultService'
import type { Result } from '../../types'

export default function AdminResults() {
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data } = await resultService.getAll({ perPage: 50 })
      setResults(data)
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!editing) return
    if (!editing.author_name || !editing.title) {
      toast.error('작성자명과 제목은 필수입니다.')
      return
    }
    try {
      setSaving(true)
      if (editing.id) {
        const { id, created_at, ...updates } = editing
        void created_at
        await resultService.update(id as number, updates)
        toast.success('성과가 수정되었습니다.')
      } else {
        await resultService.create({
          author_name: editing.author_name as string,
          title: editing.title as string,
          preview: (editing.preview as string) || null,
          content: (editing.content as string) || '',
          image_url: (editing.image_url as string) || null,
          video_url: (editing.video_url as string) || null,
          user_id: null,
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

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await resultService.delete(deleteTarget)
      toast.success('성과가 삭제되었습니다.')
      setDeleteTarget(null)
      await fetchData()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const filtered = results.filter((r) => r.author_name.includes(search) || r.title.includes(search))

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">성과 관리</h1>
        <button
          onClick={() => setEditing({ author_name: '', title: '', preview: '', content: '', image_url: null, video_url: null, is_published: true })}
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
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">좋아요</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">날짜</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 성과가 없습니다.'}</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.author_name}</td>
                  <td className="px-4 py-3 text-gray-700">{r.title}</td>
                  <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">{r.likes_count}</td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden">{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setEditing(r as unknown as Record<string, unknown>)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors"
                        aria-label="수정"
                      >
                        <i className="ti ti-pencil text-sm" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(r.id)}
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
              <label className="text-sm font-bold block mb-1">제목 *</label>
              <input
                value={(editing.title as string) || ''}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">미리보기 텍스트</label>
              <input
                value={(editing.preview as string) || ''}
                onChange={(e) => setEditing({ ...editing, preview: e.target.value })}
                placeholder="카드에 표시될 짧은 설명"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">내용</label>
              <textarea
                value={(editing.content as string) || ''}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                rows={4}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">썸네일 이미지</label>
              <ImageUploader
                bucket="results"
                path={`${editing.id || 'new'}/thumb-${Date.now()}`}
                currentUrl={editing.image_url as string}
                onUpload={(url) => setEditing({ ...editing, image_url: url })}
                className="h-[140px]"
              />
            </div>
            <div>
              <VideoUrlInput
                value={(editing.video_url as string) || null}
                onChange={(url) => setEditing({ ...editing, video_url: url })}
                label="동영상"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-2">옵션</label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_published !== false}
                  onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
                  className="accent-[#04F87F]"
                />
                공개
              </label>
            </div>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="성과 삭제" message="이 성과를 삭제하시겠습니까?" />
    </AdminLayout>
  )
}
