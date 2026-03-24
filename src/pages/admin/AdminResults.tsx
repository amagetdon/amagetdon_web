import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { resultService } from '../../services/resultService'
import type { Result } from '../../types'

export default function AdminResults() {
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data } = await resultService.getAll({ perPage: 50 })
      setResults(data)
    } catch { alert('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try { await resultService.delete(id); await fetchData() } catch { alert('삭제에 실패했습니다.') }
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">성과 관리</h1>
      {loading ? <div className="text-center py-10 text-gray-400">불러오는 중...</div> : (
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
            <tbody className="divide-y">
              {results.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.author_name}</td>
                  <td className="px-4 py-3 text-gray-700">{r.title}</td>
                  <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">{r.likes_count}</td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden">{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDelete(r.id)} className="text-red-500 text-xs cursor-pointer bg-transparent border-none">삭제</button>
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
