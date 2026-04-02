import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import VideoUrlInput from '../../components/admin/VideoUrlInput'
import { bannerService } from '../../services/bannerService'
import { resultService } from '../../services/resultService'
import type { Banner, Result } from '../../types'

type SectionTab = 'banners' | 'results' | 'bottomLinks'

export default function AdminSiteSettings() {
  const [tab, setTab] = useState<SectionTab>('banners')

  // 배너
  const [banners, setBanners] = useState<Banner[]>([])
  const [bannerEditing, setBannerEditing] = useState<Record<string, unknown> | null>(null)
  const [bannerSaving, setBannerSaving] = useState(false)
  const [bannerDeleteTarget, setBannerDeleteTarget] = useState<number | null>(null)

  // 성과
  const [results, setResults] = useState<Result[]>([])
  const [resultEditing, setResultEditing] = useState<Record<string, unknown> | null>(null)
  const [resultSaving, setResultSaving] = useState(false)
  const [resultDeleteTarget, setResultDeleteTarget] = useState<number | null>(null)

  // 하단 링크
  const [bottomLinks, setBottomLinks] = useState<Banner[]>([])
  const [linkEditing, setLinkEditing] = useState<Record<string, unknown> | null>(null)
  const [linkSaving, setLinkSaving] = useState(false)
  const [linkDeleteTarget, setLinkDeleteTarget] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const [bannerData, resultData, linkData] = await withTimeout(Promise.all([
        bannerService.getAllByPage('hero'),
        resultService.getAll({ perPage: 50 }),
        bannerService.getAllByPage('bottom_links'),
      ]))
      setBanners(bannerData)
      setResults(resultData.data)
      setBottomLinks(linkData)
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // ── 배너 CRUD ──
  const handleBannerSave = async () => {
    if (!bannerEditing || !bannerEditing.title) { toast.error('타이틀은 필수입니다.'); return }
    try {
      setBannerSaving(true)
      if (bannerEditing.id) {
        const { id, created_at, ...updates } = bannerEditing
        void created_at
        await bannerService.update(id as number, updates as Partial<Banner>)
        toast.success('배너가 수정되었습니다.')
      } else {
        await bannerService.create({
          page_key: 'hero',
          title: (bannerEditing.title as string) || null,
          subtitle: (bannerEditing.subtitle as string) || null,
          image_url: (bannerEditing.image_url as string) || '',
          link_url: (bannerEditing.link_url as string) || null,
          sort_order: (bannerEditing.sort_order as number) || 0,
          is_published: bannerEditing.is_published !== false,
        })
        toast.success('새 배너가 등록되었습니다.')
      }
      setBannerEditing(null)
      await fetchData()
    } catch { toast.error('저장에 실패했습니다.') } finally { setBannerSaving(false) }
  }

  const handleBannerDelete = async () => {
    if (!bannerDeleteTarget) return
    try {
      await bannerService.delete(bannerDeleteTarget)
      toast.success('배너가 삭제되었습니다.')
      setBannerDeleteTarget(null)
      await fetchData()
    } catch { toast.error('삭제에 실패했습니다.') }
  }

  // ── 성과 CRUD ──
  const handleResultSave = async () => {
    if (!resultEditing) return
    if (!resultEditing.author_name || !resultEditing.title) { toast.error('작성자명과 제목은 필수입니다.'); return }
    try {
      setResultSaving(true)
      if (resultEditing.id) {
        const { id, created_at, ...updates } = resultEditing
        void created_at
        await resultService.update(id as number, updates)
        toast.success('성과가 수정되었습니다.')
      } else {
        await resultService.create({
          author_name: resultEditing.author_name as string,
          title: resultEditing.title as string,
          preview: (resultEditing.preview as string) || null,
          content: (resultEditing.content as string) || '',
          image_url: (resultEditing.image_url as string) || null,
          video_url: (resultEditing.video_url as string) || null,
          link_url: (resultEditing.link_url as string) || null,
          user_id: null,
        })
        toast.success('새 성과가 등록되었습니다.')
      }
      setResultEditing(null)
      await fetchData()
    } catch { toast.error('저장에 실패했습니다.') } finally { setResultSaving(false) }
  }

  const handleResultDelete = async () => {
    if (!resultDeleteTarget) return
    try {
      await resultService.delete(resultDeleteTarget)
      toast.success('성과가 삭제되었습니다.')
      setResultDeleteTarget(null)
      await fetchData()
    } catch { toast.error('삭제에 실패했습니다.') }
  }

  // ── 하단 링크 CRUD ──
  const handleLinkSave = async () => {
    if (!linkEditing || !linkEditing.title) { toast.error('제목은 필수입니다.'); return }
    try {
      setLinkSaving(true)
      if (linkEditing.id) {
        const { id, created_at, ...updates } = linkEditing
        void created_at
        await bannerService.update(id as number, updates as Partial<Banner>)
        toast.success('링크가 수정되었습니다.')
      } else {
        await bannerService.create({
          page_key: 'bottom_links',
          title: (linkEditing.title as string) || null,
          subtitle: (linkEditing.subtitle as string) || null,
          image_url: (linkEditing.image_url as string) || '',
          link_url: (linkEditing.link_url as string) || null,
          sort_order: (linkEditing.sort_order as number) || 0,
          is_published: linkEditing.is_published !== false,
        })
        toast.success('새 링크가 등록되었습니다.')
      }
      setLinkEditing(null)
      await fetchData()
    } catch { toast.error('저장에 실패했습니다.') } finally { setLinkSaving(false) }
  }

  const handleLinkDelete = async () => {
    if (!linkDeleteTarget) return
    try {
      await bannerService.delete(linkDeleteTarget)
      toast.success('링크가 삭제되었습니다.')
      setLinkDeleteTarget(null)
      await fetchData()
    } catch { toast.error('삭제에 실패했습니다.') }
  }

  const filteredResults = results.filter((r) => r.author_name.includes(search) || r.title.includes(search))

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">사이트 설정</h1>
        <p className="text-sm text-gray-500 mt-1">메인 페이지 콘텐츠를 관리합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1.5 w-fit mb-6">
        <button
          onClick={() => setTab('banners')}
          className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
            tab === 'banners' ? 'bg-[#04F87F] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          히어로 배너
        </button>
        <button
          onClick={() => setTab('results')}
          className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
            tab === 'results' ? 'bg-[#04F87F] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          리얼 성과
        </button>
        <button
          onClick={() => setTab('bottomLinks')}
          className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
            tab === 'bottomLinks' ? 'bg-[#04F87F] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          하단 링크
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-16 bg-gray-100 rounded" />)}
        </div>
      ) : tab === 'banners' ? (
        /* ── 히어로 배너 ── */
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">등록된 배너 {banners.length}개</p>
            <button
              onClick={() => setBannerEditing({ title: '', subtitle: '', image_url: '', link_url: '', sort_order: banners.length, is_published: true })}
              className="bg-[#04F87F] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors shadow-sm shadow-[#04F87F]/20 flex items-center gap-1.5"
            >
              <i className="ti ti-plus text-sm" /> 배너 추가
            </button>
          </div>

          {banners.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">등록된 배너가 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {banners.map((banner) => (
                <div key={banner.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-stretch">
                    <div className="relative w-[240px] max-sm:w-[120px] shrink-0 bg-black flex items-center justify-center overflow-hidden">
                      {banner.image_url ? (
                        <img src={banner.image_url} alt="" className="w-full h-full object-cover opacity-60" />
                      ) : (
                        <div className="text-gray-600 text-xs">이미지 없음</div>
                      )}
                      <div className="absolute inset-0 flex flex-col justify-center px-3">
                        {banner.subtitle && <span className="text-[8px] text-gray-300 border border-gray-500 rounded-full px-1.5 py-0.5 self-start mb-1">{banner.subtitle}</span>}
                        <p className="text-[10px] text-white font-bold leading-tight line-clamp-2 whitespace-pre-line">{banner.title}</p>
                      </div>
                    </div>
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
                        <button onClick={() => setBannerEditing(banner as unknown as Record<string, unknown>)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
                        <button onClick={() => setBannerDeleteTarget(banner.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : tab === 'results' ? (
        /* ── 리얼 성과 ── */
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="relative max-w-xs">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="성과 검색..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#04F87F]" />
            </div>
            <button
              onClick={() => setResultEditing({ author_name: '', title: '', preview: '', content: '', image_url: null, video_url: null, link_url: null, sort_order: results.length, is_published: true })}
              className="bg-[#04F87F] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors shadow-sm shadow-[#04F87F]/20 flex items-center gap-1.5"
            >
              <i className="ti ti-plus text-sm" /> 성과 추가
            </button>
          </div>

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
                {filteredResults.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 성과가 없습니다.'}</td></tr>
                ) : filteredResults.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.author_name}</td>
                    <td className="px-4 py-3 text-gray-700">{r.title}</td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">{r.likes_count}</td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden">{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setResultEditing(r as unknown as Record<string, unknown>)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
                        <button onClick={() => setResultDeleteTarget(r.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* ── 하단 링크 ── */
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">메인 페이지 하단에 표시되는 링크 카드입니다. (브랜드 페이지, 유튜브 등)</p>
            <button
              onClick={() => setLinkEditing({ title: '', subtitle: '', image_url: '', link_url: '', sort_order: bottomLinks.length, is_published: true })}
              className="bg-[#04F87F] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors shadow-sm shadow-[#04F87F]/20 flex items-center gap-1.5 shrink-0 ml-4"
            >
              <i className="ti ti-plus text-sm" /> 링크 추가
            </button>
          </div>

          {bottomLinks.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">등록된 하단 링크가 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {bottomLinks.map((link) => (
                <div key={link.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-stretch">
                    <div className="relative w-[200px] max-sm:w-[100px] shrink-0 bg-gray-900 flex items-center justify-center overflow-hidden">
                      {link.image_url ? (
                        <img src={link.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-gray-600 text-xs">이미지 없음</div>
                      )}
                    </div>
                    <div className="flex-1 p-4 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${link.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {link.is_published ? '공개' : '비공개'}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-gray-900 truncate">{link.title}</p>
                        {link.link_url && <p className="text-xs text-gray-400 truncate mt-0.5">{link.link_url}</p>}
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <button onClick={() => setLinkEditing(link as unknown as Record<string, unknown>)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
                        <button onClick={() => setLinkDeleteTarget(link.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 하단 링크 모달 */}
      <AdminFormModal isOpen={!!linkEditing} onClose={() => setLinkEditing(null)} title={linkEditing?.id ? '링크 수정' : '새 링크 등록'} onSubmit={handleLinkSave} loading={linkSaving}>
        {linkEditing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">제목 *</label>
              <input value={(linkEditing.title as string) || ''} onChange={(e) => setLinkEditing({ ...linkEditing, title: e.target.value })}
                placeholder="아마겟돈 브랜드 페이지"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">링크 URL</label>
              <input value={(linkEditing.link_url as string) || ''} onChange={(e) => setLinkEditing({ ...linkEditing, link_url: e.target.value })}
                placeholder="https://..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">썸네일 이미지</label>
              <ImageUploader bucket="banners" path={`bottom/${linkEditing.id || 'new'}-${Date.now()}`}
                currentUrl={linkEditing.image_url as string} onUpload={(url) => setLinkEditing({ ...linkEditing, image_url: url })} className="h-[180px]" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">검은 오버레이 투명도</label>
              <input type="number" min={0} max={100} value={(linkEditing.subtitle as number) ?? 0} onChange={(e) => setLinkEditing({ ...linkEditing, subtitle: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
              <p className="text-xs text-gray-400 mt-1">0 = 없음, 50 = 반투명, 100 = 완전 검정</p>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">정렬 순서</label>
              <input type="number" value={(linkEditing.sort_order as number) ?? 0} onChange={(e) => setLinkEditing({ ...linkEditing, sort_order: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={linkEditing.is_published !== false} onChange={(e) => setLinkEditing({ ...linkEditing, is_published: e.target.checked })} className="accent-[#04F87F]" />
                공개
              </label>
            </div>
          </div>
        )}
      </AdminFormModal>

      {/* 배너 모달 */}
      <AdminFormModal isOpen={!!bannerEditing} onClose={() => setBannerEditing(null)} title={bannerEditing?.id ? '배너 수정' : '새 배너 등록'} onSubmit={handleBannerSave} loading={bannerSaving}>
        {bannerEditing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">타이틀 *</label>
              <textarea value={(bannerEditing.title as string) || ''} onChange={(e) => setBannerEditing({ ...bannerEditing, title: e.target.value })}
                placeholder="한번 배워서 평생 써먹는&#10;300 벌고 시작하는 보험 비즈니스" rows={3}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all resize-none" />
              <p className="text-xs text-gray-400 mt-1">줄바꿈은 Enter로 구분됩니다.</p>
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">뱃지 텍스트</label>
              <input value={(bannerEditing.subtitle as string) || ''} onChange={(e) => setBannerEditing({ ...bannerEditing, subtitle: e.target.value })}
                placeholder="무료강의 | 12월 25일(목) 19:30"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">배경 이미지</label>
              <ImageUploader bucket="banners" path={`hero/${bannerEditing.id || 'new'}-${Date.now()}`}
                currentUrl={bannerEditing.image_url as string} onUpload={(url) => setBannerEditing({ ...bannerEditing, image_url: url })} className="h-[160px]" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">링크 URL</label>
              <input value={(bannerEditing.link_url as string) || ''} onChange={(e) => setBannerEditing({ ...bannerEditing, link_url: e.target.value })}
                placeholder="https://..." className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">정렬 순서</label>
              <input type="number" value={(bannerEditing.sort_order as number) ?? 0} onChange={(e) => setBannerEditing({ ...bannerEditing, sort_order: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={bannerEditing.is_published !== false} onChange={(e) => setBannerEditing({ ...bannerEditing, is_published: e.target.checked })} className="accent-[#04F87F]" />
                공개
              </label>
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <p className="text-xs text-gray-400 mb-2">미리보기</p>
              <div className="relative rounded-xl overflow-hidden bg-black py-8 px-5">
                {(bannerEditing.image_url as string) && <img src={bannerEditing.image_url as string} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
                <div className="relative">
                  {(bannerEditing.subtitle as string) && (
                    <div className="inline-block px-3 py-1 border border-gray-500 rounded-full mb-3">
                      <span className="text-[10px] text-gray-300">{bannerEditing.subtitle as string}</span>
                    </div>
                  )}
                  <p className="text-lg text-white font-bold leading-tight whitespace-pre-line">{(bannerEditing.title as string) || '타이틀을 입력하세요'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminFormModal>

      {/* 성과 모달 */}
      <AdminFormModal isOpen={!!resultEditing} onClose={() => setResultEditing(null)} title={resultEditing?.id ? '성과 수정' : '새 성과 등록'} onSubmit={handleResultSave} loading={resultSaving}>
        {resultEditing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-bold block mb-1">작성자명 *</label>
              <input value={(resultEditing.author_name as string) || ''} onChange={(e) => setResultEditing({ ...resultEditing, author_name: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">제목 *</label>
              <input value={(resultEditing.title as string) || ''} onChange={(e) => setResultEditing({ ...resultEditing, title: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">미리보기 텍스트</label>
              <input value={(resultEditing.preview as string) || ''} onChange={(e) => setResultEditing({ ...resultEditing, preview: e.target.value })}
                placeholder="어떻게 하루에 잠깐 일하고 **월 4천**을 벌까요?"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
              <p className="text-xs text-gray-400 mt-1">**텍스트** 로 감싸면 <strong>볼드 강조</strong>됩니다.</p>
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">메모</label>
              <textarea value={(resultEditing.content as string) || ''} onChange={(e) => setResultEditing({ ...resultEditing, content: e.target.value })}
                placeholder="관리용 메모 (외부에 노출되지 않습니다)"
                rows={2} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all resize-none" />
              <p className="text-xs text-gray-400 mt-1">외부에 노출되지 않는 관리용 메모입니다.</p>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">썸네일 이미지</label>
              <ImageUploader bucket="results" path={`${resultEditing.id || 'new'}/thumb-${Date.now()}`}
                currentUrl={resultEditing.image_url as string} onUpload={(url) => setResultEditing({ ...resultEditing, image_url: url })} className="h-[140px]" />
            </div>
            <div>
              <VideoUrlInput value={(resultEditing.video_url as string) || null} onChange={(url) => setResultEditing({ ...resultEditing, video_url: url })} label="동영상 URL" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">링크 URL</label>
              <input value={(resultEditing.link_url as string) || ''} onChange={(e) => setResultEditing({ ...resultEditing, link_url: e.target.value })}
                placeholder="https://... (동영상 없을 때 클릭 시 이동할 링크)"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
              <p className="text-xs text-gray-400 mt-1">동영상 URL이 있으면 동영상이 우선 재생됩니다.</p>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">정렬 순서</label>
              <input type="number" value={(resultEditing.sort_order as number) ?? 0} onChange={(e) => setResultEditing({ ...resultEditing, sort_order: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all" />
              <p className="text-xs text-gray-400 mt-1">숫자가 작을수록 먼저 표시됩니다.</p>
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={resultEditing.is_published !== false} onChange={(e) => setResultEditing({ ...resultEditing, is_published: e.target.checked })} className="accent-[#04F87F]" />
                공개
              </label>
            </div>
            {/* 미리보기 */}
            <div className="col-span-2 max-sm:col-span-1">
              <p className="text-xs text-gray-400 mb-2">미리보기</p>
              <div className="bg-[#0a0a0a] rounded-xl p-6 flex flex-col items-center">
                <span className="inline-block bg-[#04F87F] text-black text-xs font-bold px-4 py-1.5 rounded-full mb-3">
                  {(resultEditing.author_name as string) || '작성자'}
                </span>
                <p className="text-sm text-gray-300 mb-3 text-center" dangerouslySetInnerHTML={{
                  __html: ((resultEditing.preview as string) || '미리보기 텍스트').replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
                }} />
                <div className="relative rounded-xl overflow-hidden aspect-video w-full max-w-[300px] bg-gray-800">
                  {(resultEditing.image_url as string) ? (
                    <img src={resultEditing.image_url as string} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">썸네일</div>
                  )}
                  {(resultEditing.video_url as string) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-black/40 rounded-full flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-xs text-white font-bold drop-shadow-lg">{(resultEditing.title as string) || '제목'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog isOpen={!!bannerDeleteTarget} onClose={() => setBannerDeleteTarget(null)} onConfirm={handleBannerDelete} title="배너 삭제" message="이 배너를 삭제하시겠습니까?" />
      <ConfirmDialog isOpen={!!resultDeleteTarget} onClose={() => setResultDeleteTarget(null)} onConfirm={handleResultDelete} title="성과 삭제" message="이 성과를 삭제하시겠습니까?" />
      <ConfirmDialog isOpen={!!linkDeleteTarget} onClose={() => setLinkDeleteTarget(null)} onConfirm={handleLinkDelete} title="링크 삭제" message="이 링크를 삭제하시겠습니까?" />
    </AdminLayout>
  )
}
