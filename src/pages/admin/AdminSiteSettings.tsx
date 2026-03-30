import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import { bannerService } from '../../services/bannerService'
import type { Banner } from '../../types'

export default function AdminSiteSettings() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const data = await bannerService.getAllByPage('hero')
      setBanners(data)
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!editing) return
    if (!editing.title) {
      toast.error('타이틀은 필수입니다.')
      return
    }
    try {
      setSaving(true)
      if (editing.id) {
        const { id, created_at, ...updates } = editing
        void created_at
        await bannerService.update(id as number, updates as Partial<Banner>)
        toast.success('배너가 수정되었습니다.')
      } else {
        await bannerService.create({
          page_key: 'hero',
          title: (editing.title as string) || null,
          subtitle: (editing.subtitle as string) || null,
          image_url: (editing.image_url as string) || '',
          link_url: (editing.link_url as string) || null,
          sort_order: (editing.sort_order as number) || 0,
          is_published: editing.is_published !== false,
        })
        toast.success('새 배너가 등록되었습니다.')
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
      await bannerService.delete(deleteTarget)
      toast.success('배너가 삭제되었습니다.')
      setDeleteTarget(null)
      await fetchData()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사이트 설정</h1>
          <p className="text-sm text-gray-500 mt-1">메인 페이지 히어로 배너를 관리합니다.</p>
        </div>
        <button
          onClick={() => setEditing({ title: '', subtitle: '', image_url: '', link_url: '', sort_order: banners.length, is_published: true })}
          className="bg-[#04F87F] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors shadow-sm shadow-[#04F87F]/20 flex items-center gap-1.5"
        >
          <i className="ti ti-plus text-sm" /> 배너 추가
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-20 bg-gray-100 rounded" />)}
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          등록된 히어로 배너가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <div key={banner.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-stretch">
                {/* 미리보기 */}
                <div className="relative w-[240px] max-sm:w-[120px] shrink-0 bg-black flex items-center justify-center overflow-hidden">
                  {banner.image_url ? (
                    <img src={banner.image_url} alt="" className="w-full h-full object-cover opacity-60" />
                  ) : (
                    <div className="text-gray-600 text-xs">이미지 없음</div>
                  )}
                  <div className="absolute inset-0 flex flex-col justify-center px-3">
                    {banner.subtitle && (
                      <span className="text-[8px] text-gray-300 border border-gray-500 rounded-full px-1.5 py-0.5 self-start mb-1">{banner.subtitle}</span>
                    )}
                    <p className="text-[10px] text-white font-bold leading-tight line-clamp-2 whitespace-pre-line">{banner.title}</p>
                  </div>
                </div>

                {/* 정보 */}
                <div className="flex-1 p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${banner.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {banner.is_published ? '공개' : '비공개'}
                      </span>
                      <span className="text-[10px] text-gray-400">순서: {banner.sort_order}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 truncate">{banner.title}</p>
                    {banner.subtitle && <p className="text-xs text-gray-500 truncate mt-0.5">{banner.subtitle}</p>}
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={() => setEditing(banner as unknown as Record<string, unknown>)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors"
                      aria-label="수정"
                    >
                      <i className="ti ti-pencil text-sm" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(banner.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors"
                      aria-label="삭제"
                    >
                      <i className="ti ti-trash text-sm" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminFormModal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? '배너 수정' : '새 배너 등록'} onSubmit={handleSave} loading={saving}>
        {editing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">타이틀 *</label>
              <textarea
                value={(editing.title as string) || ''}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="한번 배워서 평생 써먹는&#10;300 벌고 시작하는 보험 비즈니스"
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">줄바꿈은 Enter로 구분됩니다.</p>
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">뱃지 텍스트</label>
              <input
                value={(editing.subtitle as string) || ''}
                onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                placeholder="무료강의 | 12월 25일(목) 19:30"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">배경 이미지</label>
              <ImageUploader
                bucket="banners"
                path={`hero/${editing.id || 'new'}-${Date.now()}`}
                currentUrl={editing.image_url as string}
                onUpload={(url) => setEditing({ ...editing, image_url: url })}
                className="h-[160px]"
              />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">링크 URL</label>
              <input
                value={(editing.link_url as string) || ''}
                onChange={(e) => setEditing({ ...editing, link_url: e.target.value })}
                placeholder="https://..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">정렬 순서</label>
              <input
                type="number"
                value={(editing.sort_order as number) ?? 0}
                onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
              />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
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

            {/* 미리보기 */}
            <div className="col-span-2 max-sm:col-span-1">
              <p className="text-xs text-gray-400 mb-2">미리보기</p>
              <div className="relative rounded-xl overflow-hidden bg-black py-8 px-5">
                {(editing.image_url as string) && (
                  <img src={editing.image_url as string} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                )}
                <div className="relative">
                  {(editing.subtitle as string) && (
                    <div className="inline-block px-3 py-1 border border-gray-500 rounded-full mb-3">
                      <span className="text-[10px] text-gray-300">{editing.subtitle as string}</span>
                    </div>
                  )}
                  <p className="text-lg text-white font-bold leading-tight whitespace-pre-line">
                    {(editing.title as string) || '타이틀을 입력하세요'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="배너 삭제" message="이 배너를 삭제하시겠습니까?" />
    </AdminLayout>
  )
}
