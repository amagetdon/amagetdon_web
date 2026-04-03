import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { achievementService } from '../../services/achievementService'
import type { Achievement } from '../../types'

export default function AdminAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<number | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data } = await withTimeout(achievementService.getAllAdmin({ perPage: 100 }))
      setAchievements(data)
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleTogglePublish = async (item: Achievement) => {
    try {
      setToggling(item.id)
      await achievementService.update(item.id, { is_published: !item.is_published })
      toast.success(item.is_published ? '비공개 처리되었습니다.' : '공개 처리되었습니다.')
      await fetchData()
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await achievementService.delete(deleteTarget)
      toast.success('성과가 삭제되었습니다.')
      setDeleteTarget(null)
      await fetchData()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const filtered = achievements.filter(
    (a) => a.author_name.includes(search) || a.title.includes(search)
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">수강 성과 관리</h1>
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
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">이미지</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">날짜</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">공개</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    {search ? '검색 결과가 없습니다.' : '등록된 성과가 없습니다.'}
                  </td>
                </tr>
              ) : filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.author_name}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{item.title}</td>
                  <td className="px-4 py-3 text-center max-sm:hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-10 h-10 object-cover rounded mx-auto" />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden">
                    {new Date(item.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleTogglePublish(item)}
                      disabled={toggling === item.id}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg border-none cursor-pointer transition-colors mx-auto ${
                        item.is_published
                          ? 'text-[#04F87F] hover:bg-green-50 bg-transparent'
                          : 'text-gray-300 hover:bg-gray-100 bg-transparent'
                      } disabled:opacity-50`}
                      aria-label={item.is_published ? '비공개로 전환' : '공개로 전환'}
                    >
                      <i className={`ti ${item.is_published ? 'ti-eye' : 'ti-eye-off'} text-sm`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setDeleteTarget(item.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors mx-auto"
                      aria-label="삭제"
                    >
                      <i className="ti ti-trash text-sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="성과 삭제"
        message="이 성과를 삭제하시겠습니까?"
      />
    </AdminLayout>
  )
}
