import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { ebookService } from '../../services/ebookService'
import { supabase } from '../../lib/supabase'
import type { EbookWithInstructor } from '../../types'

interface EbookStats {
  buyerCount: number
}

export default function AdminEbooks() {
  const navigate = useNavigate()
  const [ebooks, setEbooks] = useState<EbookWithInstructor[]>([])
  const [stats, setStats] = useState<Record<number, EbookStats>>({})
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const [e, purchaseRes] = await withTimeout(Promise.all([
        ebookService.getAll(),
        supabase.from('purchases').select('ebook_id').not('ebook_id', 'is', null),
      ]))
      setEbooks(e)

      const map: Record<number, EbookStats> = {}
      for (const row of (purchaseRes.data ?? []) as { ebook_id: number }[]) {
        map[row.ebook_id] = map[row.ebook_id] ?? { buyerCount: 0 }
        map[row.ebook_id].buyerCount += 1
      }
      setStats(map)
    } catch { toast.error('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])
  useVisibilityRefresh(fetchData)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try { await ebookService.delete(deleteTarget); toast.success('전자책이 삭제되었습니다.'); setDeleteTarget(null); await fetchData() }
    catch { toast.error('삭제에 실패했습니다.') }
  }

  const filtered = ebooks.filter((e) => e.title.includes(search) || (e.instructor?.name || '').includes(search))

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">전자책 관리</h1>
          <p className="text-sm text-gray-500 mt-1">전체 {ebooks.length}개</p>
        </div>
        <button onClick={() => navigate('/admin/ebooks/new')}
          className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20 flex items-center gap-1.5"><i className="ti ti-plus text-sm" /> 전자책 추가</button>
      </div>

      <div className="mb-4"><div className="relative max-w-xs">
        <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="전자책 검색..."
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]" />
      </div></div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-[100px]">표지</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600">제목</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 max-sm:hidden">강사</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">가격</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-md:hidden">구매자 / 정원</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 전자책이 없습니다.'}</td></tr>
                ) : filtered.map((eb) => {
                  const s = stats[eb.id] ?? { buyerCount: 0 }
                  return (
                  <tr key={eb.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/ebooks/${eb.id}`)}>
                    <td className="px-4 py-2">
                      <div className="w-[72px] h-[96px] bg-gray-100 rounded-lg overflow-hidden">
                        {eb.thumbnail_url ? (
                          <img src={eb.thumbnail_url} alt={eb.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">표지 없음</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{eb.title}{eb.is_hot && <span className="ml-2 text-xs bg-[#2ED573] text-white px-1.5 py-0.5 rounded">HOT</span>}</td>
                    <td className="px-4 py-3 text-gray-500 max-sm:hidden">{eb.instructor?.name || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{eb.is_free ? '무료' : eb.sale_price ? `${eb.sale_price.toLocaleString()}원` : '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-700 text-xs max-md:hidden">
                      {s.buyerCount.toLocaleString()} / {eb.max_purchases != null && eb.max_purchases > 0 ? `${eb.max_purchases.toLocaleString()}명` : '무제한'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => navigate(`/admin/ebooks/${eb.id}`)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
                        <button onClick={() => setDeleteTarget(eb.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="전자책 삭제" message="이 전자책을 삭제하시겠습니까?" />
    </AdminLayout>
  )
}
