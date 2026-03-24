import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import ImageUploader from '../../components/admin/ImageUploader'
import { instructorService } from '../../services/instructorService'
import type { Instructor } from '../../types'

export default function AdminInstructors() {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Instructor> | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const data = await instructorService.getAll()
      setInstructors(data)
    } catch { alert('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!editing?.name || !editing?.title) return
    try {
      setSaving(true)
      if (editing.id) {
        await instructorService.update(editing.id, editing)
      } else {
        await instructorService.create(editing as Omit<Instructor, 'id' | 'created_at' | 'updated_at'>)
      }
      setEditing(null)
      await fetchData()
    } catch { alert('저장에 실패했습니다.') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await instructorService.delete(id)
      await fetchData()
    } catch { alert('삭제에 실패했습니다.') }
  }

  const newInstructor = (): Partial<Instructor> => ({
    name: '', title: '', headline: '', bio: '', careers: [], image_url: null,
    has_active_course: false, sort_order: 0, is_published: true,
  })

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">강사 관리</h1>
        <button
          onClick={() => setEditing(newInstructor())}
          className="bg-[#04F87F] text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border-none"
        >
          + 강사 추가
        </button>
      </div>

      {editing && (
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-bold mb-4">{editing.id ? '강사 수정' : '새 강사'}</h2>
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-bold block mb-1">이름 *</label>
              <input
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">직함 *</label>
              <input
                value={editing.title || ''}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">헤드라인</label>
              <input
                value={editing.headline || ''}
                onChange={(e) => setEditing({ ...editing, headline: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">정렬 순서</label>
              <input
                type="number"
                value={editing.sort_order ?? 0}
                onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">소개글</label>
              <textarea
                value={editing.bio || ''}
                onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
                rows={4}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">경력 (줄바꿈으로 구분)</label>
              <textarea
                value={(editing.careers || []).join('\n')}
                onChange={(e) => setEditing({ ...editing, careers: e.target.value.split('\n').filter(Boolean) })}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">프로필 이미지</label>
              <ImageUploader
                bucket="instructors"
                path={`${editing.id || 'new'}/profile-${Date.now()}`}
                currentUrl={editing.image_url}
                onUpload={(url) => setEditing({ ...editing, image_url: url })}
                className="h-[200px]"
              />
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.has_active_course ?? false}
                  onChange={(e) => setEditing({ ...editing, has_active_course: e.target.checked })}
                />
                진행중인 강의 있음
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.is_published ?? true}
                  onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
                />
                공개
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="bg-[#04F87F] text-white px-6 py-2 rounded-lg text-sm font-bold cursor-pointer border-none disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => setEditing(null)} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm cursor-pointer border-none">
              취소
            </button>
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
                <th className="px-4 py-3 text-left font-bold text-gray-600">이름</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 max-sm:hidden">직함</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">상태</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">순서</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {instructors.map((inst) => (
                <tr key={inst.id}>
                  <td className="px-4 py-3 font-medium">{inst.name}</td>
                  <td className="px-4 py-3 text-gray-500 max-sm:hidden">{inst.title}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${inst.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {inst.is_published ? '공개' : '비공개'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{inst.sort_order}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setEditing(inst)} className="text-blue-500 text-xs cursor-pointer bg-transparent border-none mr-2">수정</button>
                    <button onClick={() => handleDelete(inst.id)} className="text-red-500 text-xs cursor-pointer bg-transparent border-none">삭제</button>
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
