import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { reviewService } from '../../services/reviewService'
import type { ReviewWithCourse } from '../../types'

export default function AdminReviews() {
  const [reviews, setReviews] = useState<ReviewWithCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [viewing, setViewing] = useState<ReviewWithCourse | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    try { setLoading(true); const { data } = await reviewService.getAll({ perPage: 50 }); setReviews(data) }
    catch { toast.error('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try { await reviewService.delete(deleteTarget); toast.success('후기가 삭제되었습니다.'); setDeleteTarget(null); await fetchData() }
    catch { toast.error('삭제에 실패했습니다.') }
  }

  const filtered = reviews.filter((r) => r.author_name.includes(search) || r.title.includes(search))

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">후기 관리</h1>

      <div className="mb-4"><div className="relative max-w-xs">
        <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="후기 검색..."
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#04F87F]" />
      </div></div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="px-4 py-3 text-left font-bold text-gray-600">작성자</th>
              <th className="px-4 py-3 text-left font-bold text-gray-600">제목</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">별점</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">날짜</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
            </tr></thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">후기가 없습니다.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewing(r)}>
                  <td className="px-4 py-3 font-medium">{r.author_name}</td>
                  <td className="px-4 py-3 text-gray-700">{r.title}</td>
                  <td className="px-4 py-3 text-center text-yellow-500 max-sm:hidden">{'★'.repeat(r.rating)}</td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden">{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(r.id) }} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 상세보기 모달 */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[80vh] overflow-y-auto">
            {viewing && (<>
              <DialogTitle className="text-lg font-bold text-gray-900 mb-1">{viewing.title}</DialogTitle>
              <p className="text-xs text-gray-400 mb-1">{viewing.author_name} | {new Date(viewing.created_at).toLocaleDateString('ko-KR')}</p>
              <p className="text-yellow-500 text-sm mb-4">{'★'.repeat(viewing.rating)}</p>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{viewing.content}</p>
              {viewing.course && <p className="text-xs text-[#04F87F] mt-4">강의: {viewing.course.title}</p>}
              <button onClick={() => setViewing(null)} className="mt-6 w-full py-2 bg-gray-100 text-gray-600 rounded-lg cursor-pointer border-none text-sm hover:bg-gray-200">닫기</button>
            </>)}
          </DialogPanel>
        </div>
      </Dialog>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="후기 삭제" message="이 후기를 삭제하시겠습니까?" />
    </AdminLayout>
  )
}
