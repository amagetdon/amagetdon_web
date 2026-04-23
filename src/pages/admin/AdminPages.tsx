import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import VideoUrlInput from '../../components/admin/VideoUrlInput'
import { landingCategoryService } from '../../services/landingCategoryService'
import { bannerService } from '../../services/bannerService'
import { resultService } from '../../services/resultService'
import { supabase } from '../../lib/supabase'
import { invalidateAcademySettings } from '../../hooks/useAcademySettings'
import type { LandingCategory, LandingCategorySeo, Banner, Result } from '../../types'

interface EditingForm {
  id?: number
  slug: string
  name: string
  is_published: boolean
  sort_order: number
  seo: LandingCategorySeo
}

const emptyForm: EditingForm = {
  slug: '',
  name: '',
  is_published: true,
  sort_order: 0,
  seo: {},
}

type PageTab = 'landing' | 'academy' | 'hero' | 'results'
type BannerSubTab = 'hero' | 'reviews' | 'results'

const PAGE_TABS: { key: PageTab; label: string }[] = [
  { key: 'landing', label: '랜딩 페이지' },
  { key: 'academy', label: '아카데미' },
  { key: 'hero', label: '히어로 배너' },
  { key: 'results', label: '리얼 성과' },
]

export default function AdminPages() {
  const [tab, setTab] = useState<PageTab>('landing')

  // 랜딩 페이지
  const [categories, setCategories] = useState<LandingCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditingForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  // 아카데미 프로모 영상 + 설정
  const [promoVideoUrl, setPromoVideoUrl] = useState('')
  const [closedVisualEffect, setClosedVisualEffect] = useState(true)
  const [academySaving, setAcademySaving] = useState(false)

  // 배너
  const [bannerSubTab, setBannerSubTab] = useState<BannerSubTab>('hero')
  const [allBanners, setAllBanners] = useState<Record<string, Banner[]>>({ hero: [], reviews: [], results: [], reviews_event: [], results_event: [] })
  const [bannerEditing, setBannerEditing] = useState<Record<string, unknown> | null>(null)
  const [bannerSaving, setBannerSaving] = useState(false)
  const [bannerDeleteTarget, setBannerDeleteTarget] = useState<number | null>(null)
  const [editingPageKey, setEditingPageKey] = useState<string>('hero')
  const banners = allBanners[bannerSubTab]
  const eventKey = `${bannerSubTab}_event` as string
  const eventBanners = allBanners[eventKey] || []

  const [bannerSettings, setBannerSettings] = useState<Record<string, { height: string; heightMobile: string; speed: string; fit: string; fitMobile: string }>>({
    hero: { height: 'auto', heightMobile: 'auto', speed: '5', fit: 'cover', fitMobile: 'cover' },
    reviews: { height: 'auto', heightMobile: 'auto', speed: '5', fit: 'cover', fitMobile: 'cover' },
    results: { height: 'auto', heightMobile: 'auto', speed: '5', fit: 'cover', fitMobile: 'cover' },
    reviews_event: { height: 'auto', heightMobile: 'auto', speed: '5', fit: 'cover', fitMobile: 'cover' },
    results_event: { height: 'auto', heightMobile: 'auto', speed: '5', fit: 'cover', fitMobile: 'cover' },
  })
  const [bannerSettingSaving, setBannerSettingSaving] = useState(false)

  // 리얼 성과
  const [results, setResults] = useState<Result[]>([])
  const [resultEditing, setResultEditing] = useState<Record<string, unknown> | null>(null)
  const [resultSaving, setResultSaving] = useState(false)
  const [resultDeleteTarget, setResultDeleteTarget] = useState<number | null>(null)

  const [search, setSearch] = useState('')

  const filteredResults = results.filter((r) => r.author_name.includes(search) || r.title.includes(search))

  const fetchData = async () => {
    try {
      setLoading(true)
      const [data, promoRes, heroBanners, reviewsBanners, resultsBanners, reviewsEvent, resultsEvent, resultData, settingsData, academyRes] = await Promise.all([
        landingCategoryService.getAll(),
        supabase.from('site_settings').select('value').eq('key', 'promo_video').maybeSingle(),
        bannerService.getAllByPage('hero'),
        bannerService.getAllByPage('reviews'),
        bannerService.getAllByPage('results'),
        bannerService.getAllByPage('reviews_event'),
        bannerService.getAllByPage('results_event'),
        resultService.getAll({ perPage: 50 }),
        supabase.from('site_settings').select('*').eq('key', 'banner_settings').maybeSingle(),
        supabase.from('site_settings').select('value').eq('key', 'academy_settings').maybeSingle(),
      ])
      setCategories(data)
      const promoValue = (promoRes.data as { value?: { url?: string } } | null)?.value
      setPromoVideoUrl(promoValue?.url || '')
      const academyValue = (academyRes.data as { value?: { closedVisualEffect?: boolean } } | null)?.value
      setClosedVisualEffect(academyValue?.closedVisualEffect !== false)
      setAllBanners({ hero: heroBanners, reviews: reviewsBanners, results: resultsBanners, reviews_event: reviewsEvent, results_event: resultsEvent })
      setResults(resultData.data)
      const settingsValue = (settingsData.data as { value?: Record<string, { height?: string; heightMobile?: string; speed?: string; fit?: string; fitMobile?: string }> } | null)?.value
      if (settingsValue) {
        const normalize = (s?: { height?: string; heightMobile?: string; speed?: string; fit?: string; fitMobile?: string }) => ({
          height: s?.height || 'auto',
          heightMobile: s?.heightMobile || 'auto',
          speed: s?.speed || '5',
          fit: s?.fit || 'cover',
          fitMobile: s?.fitMobile || 'cover',
        })
        setBannerSettings((prev) => ({
          ...prev,
          hero: normalize(settingsValue.hero),
          reviews: normalize(settingsValue.reviews),
          results: normalize(settingsValue.results),
          reviews_event: normalize(settingsValue.reviews_event),
          results_event: normalize(settingsValue.results_event),
        }))
      }
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleAcademySave = async () => {
    try {
      setAcademySaving(true)
      await Promise.all([
        supabase.from('site_settings').upsert({ key: 'promo_video', value: { url: promoVideoUrl } } as never, { onConflict: 'key' }),
        supabase.from('site_settings').upsert({ key: 'academy_settings', value: { closedVisualEffect } } as never, { onConflict: 'key' }),
      ])
      invalidateAcademySettings()
      toast.success('아카데미 설정이 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setAcademySaving(false)
    }
  }

  // 랜딩 CRUD
  const handleSave = async () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('이름을 입력해주세요.'); return }
    if (!editing.slug.trim()) { toast.error('슬러그(URL)를 입력해주세요.'); return }
    if (!/^[a-z0-9-]+$/.test(editing.slug)) {
      toast.error('슬러그는 영문 소문자, 숫자, 하이픈(-)만 가능합니다.')
      return
    }
    try {
      setSaving(true)
      const available = await landingCategoryService.checkSlugAvailable(editing.slug, editing.id)
      if (!available) {
        toast.error('이미 사용 중인 슬러그입니다.')
        setSaving(false)
        return
      }

      const payload = {
        slug: editing.slug,
        name: editing.name,
        is_published: editing.is_published,
        sort_order: editing.sort_order,
        seo: editing.seo,
      }

      if (editing.id) {
        await landingCategoryService.update(editing.id, payload)
        toast.success('랜딩 카테고리가 수정되었습니다.')
      } else {
        await landingCategoryService.create(payload)
        toast.success('새 랜딩 카테고리가 등록되었습니다.')
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
    if (deleteTarget == null) return
    try {
      await landingCategoryService.delete(deleteTarget)
      toast.success('삭제되었습니다.')
      setDeleteTarget(null)
      await fetchData()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  // 배너 설정 저장
  const handleBannerSettingSave = async () => {
    try {
      setBannerSettingSaving(true)
      await supabase.from('site_settings').upsert({ key: 'banner_settings', value: bannerSettings } as never, { onConflict: 'key' })
      toast.success('배너 설정이 저장되었습니다.')
    } catch { toast.error('저장에 실패했습니다.') } finally { setBannerSettingSaving(false) }
  }

  // 배너 CRUD
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
          page_key: editingPageKey,
          title: (bannerEditing.title as string) || null,
          subtitle: (bannerEditing.subtitle as string) || null,
          image_url: (bannerEditing.image_url as string) || '',
          video_url: (bannerEditing.video_url as string) || null,
          media_type: (bannerEditing.media_type as 'image' | 'video') || 'image',
          link_url: (bannerEditing.link_url as string) || null,
          overlay_opacity: (bannerEditing.overlay_opacity as number) ?? 30,
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

  // 성과 CRUD
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

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">페이지 관리</h1>
        <p className="text-sm text-gray-400 mt-0.5">사이트에 노출되는 페이지 콘텐츠와 커스텀 랜딩을 관리합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1.5 w-fit mb-6 flex-wrap">
        {PAGE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
              tab === t.key ? 'bg-[#2ED573] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'landing' ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">시즌별 커스텀 페이지를 만들고 상단 메뉴에 노출합니다.</p>
            <button
              onClick={() => setEditing({ ...emptyForm })}
              className="bg-[#2ED573] text-white px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors flex items-center gap-1.5"
            >
              <i className="ti ti-plus text-sm" /> 랜딩 페이지 추가
            </button>
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
                    <th className="px-4 py-3 text-left font-bold text-gray-600">이름</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">슬러그 (URL)</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-600">정렬</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-600">공개</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categories.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">등록된 랜딩 페이지가 없습니다.</td></tr>
                  ) : categories.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">/landing/{c.slug}</td>
                      <td className="px-4 py-3 text-center text-gray-400 text-xs">{c.sort_order}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${c.is_published ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.is_published ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          {c.is_published ? '공개' : '비공개'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setEditing({
                            id: c.id,
                            slug: c.slug,
                            name: c.name,
                            is_published: c.is_published,
                            sort_order: c.sort_order,
                            seo: c.seo ?? {},
                          })} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정">
                            <i className="ti ti-pencil text-sm" />
                          </button>
                          <button onClick={() => setDeleteTarget(c.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제">
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
        </>
      ) : tab === 'academy' ? (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-8">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">아카데미 프로모 영상</h3>
            <p className="text-xs text-gray-400 mb-3">아카데미 페이지 상단에 표시되는 홍보/인트로 영상 URL (유튜브, 비메오)</p>
            <VideoUrlInput
              value={promoVideoUrl || null}
              onChange={(url) => setPromoVideoUrl(url || '')}
              label="프로모 영상 URL"
            />
          </div>
          <div className="pt-6 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-1">마감 시 시각적 효과</h3>
            <p className="text-xs text-gray-400 mb-3">목록에서 마감된 강의·전자책의 제목에 취소선과 "(마감)" 라벨을 표시합니다.</p>
            <label className="inline-flex items-center gap-3 cursor-pointer select-none">
              <span className="relative">
                <input
                  type="checkbox"
                  checked={closedVisualEffect}
                  onChange={(e) => setClosedVisualEffect(e.target.checked)}
                  className="sr-only peer"
                />
                <span className="block w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-[#2ED573] transition-colors" />
                <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
              </span>
              <span className="text-sm text-gray-700">{closedVisualEffect ? '사용' : '미사용'}</span>
            </label>
          </div>
          <button
            onClick={handleAcademySave}
            disabled={academySaving}
            className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50"
          >
            {academySaving ? '저장 중...' : '전체 저장'}
          </button>
        </div>
      ) : tab === 'hero' ? (
        <>
          <div className="flex gap-2 mb-4">
            {([['hero', '메인 히어로'], ['reviews', '수강 후기'], ['results', '수강 성과']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setBannerSubTab(key)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                  bannerSubTab === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-col gap-3">
            {([
              { device: 'PC', heightField: 'height', fitField: 'fit' },
              { device: '모바일', heightField: 'heightMobile', fitField: 'fitMobile' },
            ] as const).map(({ device, heightField, fitField }) => {
              const heightPresets = [
                { value: 'auto', label: '자동' },
                { value: '300px', label: '300' },
                { value: '400px', label: '400' },
                { value: '500px', label: '500' },
                { value: '600px', label: '600' },
                { value: '100vh', label: '전체' },
              ]
              const fitPresets = [
                {
                  value: 'cover',
                  label: '채우기',
                  icon: (
                    <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0">
                      <rect x="0.5" y="0.5" width="13" height="9" rx="1" fill="currentColor" />
                    </svg>
                  ),
                },
                {
                  value: 'width',
                  label: '가로',
                  icon: (
                    <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0">
                      <rect x="0.5" y="0.5" width="13" height="9" rx="1" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" />
                      <rect x="0.5" y="3.5" width="13" height="3" fill="currentColor" />
                    </svg>
                  ),
                },
                {
                  value: 'height',
                  label: '세로',
                  icon: (
                    <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0">
                      <rect x="0.5" y="0.5" width="13" height="9" rx="1" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" />
                      <rect x="5" y="0.5" width="4" height="9" fill="currentColor" />
                    </svg>
                  ),
                },
              ]
              const currentHeight = bannerSettings[bannerSubTab]?.[heightField] || 'auto'
              const currentFit = bannerSettings[bannerSubTab]?.[fitField] || 'cover'
              const isCustom = !heightPresets.some((p) => p.value === currentHeight)
              const customValue = isCustom ? (currentHeight.replace(/px$/, '') || '') : ''
              return (
                <div key={device} className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-600 whitespace-nowrap w-12">{device}</span>
                    <span className="text-xs font-bold text-gray-400 whitespace-nowrap">높이</span>
                    <div className="flex gap-1">
                      {heightPresets.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setBannerSettings((prev) => ({ ...prev, [bannerSubTab]: { ...prev[bannerSubTab], [heightField]: opt.value } }))}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                            currentHeight === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <div className={`flex items-center rounded border transition-colors ${isCustom ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="직접"
                          value={customValue}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '')
                            setBannerSettings((prev) => ({ ...prev, [bannerSubTab]: { ...prev[bannerSubTab], [heightField]: val ? `${val}px` : 'auto' } }))
                          }}
                          className={`w-14 px-1.5 py-1 rounded text-[11px] font-medium outline-none border-none bg-transparent text-right ${isCustom ? 'text-white placeholder:text-gray-400' : 'text-gray-600 placeholder:text-gray-400'}`}
                        />
                        <span className={`pr-1.5 text-[10px] ${isCustom ? 'text-gray-300' : 'text-gray-400'}`}>px</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 whitespace-nowrap">맞춤</span>
                    <div className="flex gap-1">
                      {fitPresets.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setBannerSettings((prev) => ({ ...prev, [bannerSubTab]: { ...prev[bannerSubTab], [fitField]: opt.value } }))}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                            currentFit === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
            <div className="flex items-center gap-6 flex-wrap border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600 whitespace-nowrap w-12">전환</span>
                <div className="flex gap-1">
                  {[
                    { value: '3', label: '3초' },
                    { value: '5', label: '5초' },
                    { value: '7', label: '7초' },
                    { value: '10', label: '10초' },
                    { value: '15', label: '15초' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBannerSettings((prev) => ({ ...prev, [bannerSubTab]: { ...prev[bannerSubTab], speed: opt.value } }))}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                        bannerSettings[bannerSubTab]?.speed === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleBannerSettingSave}
                disabled={bannerSettingSaving}
                className="bg-[#2ED573] text-white px-4 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50 ml-auto"
              >
                {bannerSettingSaving ? '저장 중...' : '설정 저장'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">등록된 배너 {banners.length}개</p>
            <button
              onClick={() => { setEditingPageKey(bannerSubTab); setBannerEditing({ title: '', subtitle: '', image_url: '', video_url: '', media_type: 'image', link_url: '', overlay_opacity: 30, sort_order: banners.length, is_published: true }) }}
              className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20 flex items-center gap-1.5"
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
                      {banner.media_type === 'video' && banner.video_url ? (
                        <video src={banner.video_url} className="w-full h-full object-cover opacity-60" muted playsInline />
                      ) : banner.image_url ? (
                        <img src={banner.image_url} alt="" className="w-full h-full object-cover opacity-60" />
                      ) : (
                        <div className="text-gray-600 text-xs">미디어 없음</div>
                      )}
                      <div className="absolute inset-0 flex flex-col justify-center px-3">
                        {banner.media_type === 'video' && <span className="text-[8px] text-white bg-red-500/80 rounded px-1 py-0.5 self-start mb-1"><i className="ti ti-video text-[8px]" /> 동영상</span>}
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
                        <button onClick={() => { setEditingPageKey(banner.page_key); setBannerEditing(banner as unknown as Record<string, unknown>) }} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
                        <button onClick={() => setBannerDeleteTarget(banner.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {bannerSubTab !== 'hero' && (
            <>
              <div className="flex items-center justify-between mb-4 mt-8 pt-6 border-t border-gray-200">
                <div>
                  <p className="text-sm font-bold text-gray-900">이벤트 안내 이미지</p>
                  <p className="text-xs text-gray-400 mt-0.5">배너 아래에 표시되는 이벤트/안내 이미지 ({eventBanners.length}개)</p>
                </div>
                <button
                  onClick={() => { setEditingPageKey(eventKey); setBannerEditing({ title: '이벤트 안내', subtitle: '', image_url: '', link_url: '', overlay_opacity: 0, sort_order: eventBanners.length, is_published: true }) }}
                  className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20 flex items-center gap-1.5"
                >
                  <i className="ti ti-plus text-sm" /> 이벤트 안내 추가
                </button>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-col gap-3">
                {([
                  { device: 'PC', heightField: 'height', fitField: 'fit' },
                  { device: '모바일', heightField: 'heightMobile', fitField: 'fitMobile' },
                ] as const).map(({ device, heightField, fitField }) => {
                  const heightPresets = [
                    { value: 'auto', label: '자동' },
                    { value: '300px', label: '300' },
                    { value: '400px', label: '400' },
                    { value: '500px', label: '500' },
                    { value: '600px', label: '600' },
                    { value: '100vh', label: '전체' },
                  ]
                  const fitPresets = [
                    {
                      value: 'cover',
                      label: '채우기',
                      icon: (
                        <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0">
                          <rect x="0.5" y="0.5" width="13" height="9" rx="1" fill="currentColor" />
                        </svg>
                      ),
                    },
                    {
                      value: 'width',
                      label: '가로',
                      icon: (
                        <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0">
                          <rect x="0.5" y="0.5" width="13" height="9" rx="1" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" />
                          <rect x="0.5" y="3.5" width="13" height="3" fill="currentColor" />
                        </svg>
                      ),
                    },
                    {
                      value: 'height',
                      label: '세로',
                      icon: (
                        <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0">
                          <rect x="0.5" y="0.5" width="13" height="9" rx="1" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" />
                          <rect x="5" y="0.5" width="4" height="9" fill="currentColor" />
                        </svg>
                      ),
                    },
                  ]
                  const currentHeight = bannerSettings[eventKey]?.[heightField] || 'auto'
                  const currentFit = bannerSettings[eventKey]?.[fitField] || 'cover'
                  const isCustom = !heightPresets.some((p) => p.value === currentHeight)
                  const customValue = isCustom ? (currentHeight.replace(/px$/, '') || '') : ''
                  return (
                    <div key={device} className="flex items-center gap-6 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-600 whitespace-nowrap w-12">{device}</span>
                        <span className="text-xs font-bold text-gray-400 whitespace-nowrap">높이</span>
                        <div className="flex gap-1">
                          {heightPresets.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setBannerSettings((prev) => ({ ...prev, [eventKey]: { ...prev[eventKey], [heightField]: opt.value } }))}
                              className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                                currentHeight === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                          <div className={`flex items-center rounded border transition-colors ${isCustom ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="직접"
                              value={customValue}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '')
                                setBannerSettings((prev) => ({ ...prev, [eventKey]: { ...prev[eventKey], [heightField]: val ? `${val}px` : 'auto' } }))
                              }}
                              className={`w-14 px-1.5 py-1 rounded text-[11px] font-medium outline-none border-none bg-transparent text-right ${isCustom ? 'text-white placeholder:text-gray-400' : 'text-gray-600 placeholder:text-gray-400'}`}
                            />
                            <span className={`pr-1.5 text-[10px] ${isCustom ? 'text-gray-300' : 'text-gray-400'}`}>px</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 whitespace-nowrap">맞춤</span>
                        <div className="flex gap-1">
                          {fitPresets.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setBannerSettings((prev) => ({ ...prev, [eventKey]: { ...prev[eventKey], [fitField]: opt.value } }))}
                              className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                                currentFit === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              {opt.icon}
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center gap-6 flex-wrap border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-600 whitespace-nowrap w-12">전환</span>
                    <div className="flex gap-1">
                      {[
                        { value: '3', label: '3초' },
                        { value: '5', label: '5초' },
                        { value: '7', label: '7초' },
                        { value: '10', label: '10초' },
                        { value: '15', label: '15초' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setBannerSettings((prev) => ({ ...prev, [eventKey]: { ...prev[eventKey], speed: opt.value } }))}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                            bannerSettings[eventKey]?.speed === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleBannerSettingSave}
                    disabled={bannerSettingSaving}
                    className="bg-[#2ED573] text-white px-4 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50 ml-auto"
                  >
                    {bannerSettingSaving ? '저장 중...' : '설정 저장'}
                  </button>
                </div>
              </div>
              {eventBanners.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">등록된 이벤트 안내가 없습니다.</div>
              ) : (
                <div className="space-y-3">
                  {eventBanners.map((banner) => (
                    <div key={banner.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="flex items-stretch">
                        <div className="relative w-[240px] max-sm:w-[120px] shrink-0 bg-black flex items-center justify-center overflow-hidden">
                          {banner.image_url ? (
                            <img src={banner.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-gray-600 text-xs">이미지 없음</div>
                          )}
                        </div>
                        <div className="flex-1 p-4 flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${banner.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {banner.is_published ? '공개' : '비공개'}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-gray-900 truncate">{banner.title || '이벤트 안내'}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-3">
                            <button onClick={() => { setEditingPageKey(banner.page_key); setBannerEditing(banner as unknown as Record<string, unknown>) }} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
                            <button onClick={() => setBannerDeleteTarget(banner.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : tab === 'results' ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="relative max-w-xs">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="성과 검색..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]" />
            </div>
            <button
              onClick={() => setResultEditing({ author_name: '', title: '', preview: '', content: '', image_url: null, video_url: null, link_url: null, sort_order: results.length, is_published: true })}
              className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20 flex items-center gap-1.5"
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
      ) : null}

      {/* 랜딩 편집 모달 */}
      <AdminFormModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? '랜딩 페이지 수정' : '새 랜딩 페이지 등록'}
        onSubmit={handleSave}
        loading={saving}
      >
        {editing && (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">기본 정보</h3>
              <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
                <div>
                  <label className="text-sm font-bold block mb-1"><span className="text-red-500">*</span> 이름 (메뉴 표시명)</label>
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="예: 2026 봄학기"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1"><span className="text-red-500">*</span> 슬러그 (URL)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 shrink-0">/landing/</span>
                    <input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase() })}
                      placeholder="spring-2026"
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all font-mono" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">영문 소문자, 숫자, 하이픈(-) 만 사용</p>
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1">정렬 순서</label>
                  <input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                  <p className="text-xs text-gray-400 mt-1">숫자가 작을수록 메뉴 앞쪽에 표시</p>
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1">공개 여부</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer py-2.5">
                    <input type="checkbox" checked={editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-[#2ED573]" />
                    상단 메뉴에 노출
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-bold text-gray-900 mb-1">SEO 태그</h3>
              <p className="text-xs text-gray-400 mb-3">비워두면 사이트 설정의 기본 SEO가 사용됩니다.</p>
              <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
                <div>
                  <label className="text-sm font-bold block mb-1">title</label>
                  <input value={editing.seo.title || ''} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, title: e.target.value } })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1">author</label>
                  <input value={editing.seo.author || ''} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, author: e.target.value } })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                </div>
                <div className="col-span-2 max-sm:col-span-1">
                  <label className="text-sm font-bold block mb-1">description</label>
                  <input value={editing.seo.description || ''} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, description: e.target.value } })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                </div>
                <div className="col-span-2 max-sm:col-span-1">
                  <label className="text-sm font-bold block mb-1">keywords</label>
                  <input value={editing.seo.keywords || ''} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, keywords: e.target.value } })}
                    placeholder="쉼표로 구분"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1">og:title</label>
                  <input value={editing.seo.ogTitle || ''} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, ogTitle: e.target.value } })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1">og:description</label>
                  <input value={editing.seo.ogDescription || ''} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, ogDescription: e.target.value } })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                </div>
                <div className="col-span-2 max-sm:col-span-1">
                  <label className="text-sm font-bold block mb-1">og:image</label>
                  <p className="text-xs text-gray-400 mb-1">권장 크기: 1200 × 627</p>
                  <ImageUploader
                    bucket="banners"
                    path={`seo/landing-og-${editing.slug || 'new'}-${Date.now()}`}
                    currentUrl={editing.seo.ogImage || ''}
                    onUpload={(url) => setEditing({ ...editing, seo: { ...editing.seo, ogImage: url } })}
                    className="h-[140px]"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1">twitter:title</label>
                  <input value={editing.seo.twitterTitle || ''} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, twitterTitle: e.target.value } })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1">twitter:description</label>
                  <input value={editing.seo.twitterDescription || ''} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, twitterDescription: e.target.value } })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                </div>
                <div className="col-span-2 max-sm:col-span-1">
                  <label className="text-sm font-bold block mb-1">twitter:image</label>
                  <p className="text-xs text-gray-400 mb-1">권장 크기: 1200 × 627</p>
                  <ImageUploader
                    bucket="banners"
                    path={`seo/landing-tw-${editing.slug || 'new'}-${Date.now()}`}
                    currentUrl={editing.seo.twitterImage || ''}
                    onUpload={(url) => setEditing({ ...editing, seo: { ...editing.seo, twitterImage: url } })}
                    className="h-[140px]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminFormModal>

      {/* 배너 편집 모달 */}
      <AdminFormModal isOpen={!!bannerEditing} onClose={() => setBannerEditing(null)} title={bannerEditing?.id ? '배너 수정' : '새 배너 등록'} onSubmit={handleBannerSave} loading={bannerSaving}>
        {bannerEditing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">타이틀 *</label>
              <textarea value={(bannerEditing.title as string) || ''} onChange={(e) => setBannerEditing({ ...bannerEditing, title: e.target.value })}
                placeholder="한번 배워서 평생 써먹는&#10;300 벌고 시작하는 보험 비즈니스" rows={3}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all resize-none" />
              <p className="text-xs text-gray-400 mt-1">줄바꿈은 Enter로 구분됩니다.</p>
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">뱃지 텍스트</label>
              <input value={(bannerEditing.subtitle as string) || ''} onChange={(e) => setBannerEditing({ ...bannerEditing, subtitle: e.target.value })}
                placeholder="무료강의 | 12월 25일(목) 19:30"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">미디어 타입</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setBannerEditing({ ...bannerEditing, media_type: 'image' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${(bannerEditing.media_type || 'image') === 'image' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                  <i className="ti ti-photo" /> 이미지
                </button>
                <button type="button" onClick={() => setBannerEditing({ ...bannerEditing, media_type: 'video' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${bannerEditing.media_type === 'video' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                  <i className="ti ti-video" /> 동영상
                </button>
              </div>
            </div>
            {bannerEditing.media_type === 'video' ? (
              <>
                <div className="col-span-2 max-sm:col-span-1">
                  <label className="text-sm font-bold block mb-1">동영상 URL</label>
                  <input value={(bannerEditing.video_url as string) || ''} onChange={(e) => setBannerEditing({ ...bannerEditing, video_url: e.target.value })}
                    placeholder="https://youtu.be/... 또는 MP4/WebM 직접 링크"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                  <p className="text-xs text-gray-400 mt-1">유튜브, 비메오, MP4/WebM 링크를 지원합니다. 자동 반복 재생됩니다.</p>
                </div>
                <div className="col-span-2 max-sm:col-span-1">
                  <label className="text-sm font-bold block mb-1">포스터 이미지 (선택)</label>
                  <ImageUploader bucket="banners" path={`hero/${bannerEditing.id || 'new'}-poster-${Date.now()}`}
                    currentUrl={bannerEditing.image_url as string} onUpload={(url) => setBannerEditing({ ...bannerEditing, image_url: url })} className="h-[120px]" />
                  <p className="text-xs text-gray-400 mt-1">동영상 로딩 중 표시될 이미지 (없으면 검정 배경)</p>
                </div>
              </>
            ) : (
              <div className="col-span-2 max-sm:col-span-1">
                <label className="text-sm font-bold block mb-1">배경 이미지</label>
                <ImageUploader bucket="banners" path={`hero/${bannerEditing.id || 'new'}-${Date.now()}`}
                  currentUrl={bannerEditing.image_url as string} onUpload={(url) => setBannerEditing({ ...bannerEditing, image_url: url })} className="h-[160px]" />
              </div>
            )}
            <div>
              <label className="text-sm font-bold block mb-1">링크 URL</label>
              <input value={(bannerEditing.link_url as string) || ''} onChange={(e) => setBannerEditing({ ...bannerEditing, link_url: e.target.value })}
                placeholder="https://..." className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">정렬 순서</label>
              <input type="number" value={(bannerEditing.sort_order as number) ?? 0} onChange={(e) => setBannerEditing({ ...bannerEditing, sort_order: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">배경 밝기 ({(bannerEditing.overlay_opacity as number) ?? 30}%)</label>
              <input type="range" min={0} max={100} value={(bannerEditing.overlay_opacity as number) ?? 30}
                onChange={(e) => setBannerEditing({ ...bannerEditing, overlay_opacity: Number(e.target.value) })}
                className="w-full accent-[#2ED573]" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0 = 검정</span>
                <span>50 = 반투명</span>
                <span>100 = 선명</span>
              </div>
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={bannerEditing.is_published !== false} onChange={(e) => setBannerEditing({ ...bannerEditing, is_published: e.target.checked })} className="accent-[#2ED573]" />
                공개
              </label>
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <p className="text-xs text-gray-400 mb-2">미리보기</p>
              <div className="relative rounded-xl overflow-hidden bg-black py-8 px-5">
                {bannerEditing.media_type === 'video' && (bannerEditing.video_url as string) ? (
                  <video src={bannerEditing.video_url as string} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: ((bannerEditing.overlay_opacity as number) ?? 30) / 100 }} muted autoPlay loop playsInline />
                ) : (bannerEditing.image_url as string) ? (
                  <img src={bannerEditing.image_url as string} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: ((bannerEditing.overlay_opacity as number) ?? 30) / 100 }} />
                ) : null}
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
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">제목 *</label>
              <input value={(resultEditing.title as string) || ''} onChange={(e) => setResultEditing({ ...resultEditing, title: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">미리보기 텍스트</label>
              <input value={(resultEditing.preview as string) || ''} onChange={(e) => setResultEditing({ ...resultEditing, preview: e.target.value })}
                placeholder="어떻게 하루에 잠깐 일하고 **월 4천**을 벌까요?"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              <p className="text-xs text-gray-400 mt-1">**텍스트** 로 감싸면 <strong>볼드 강조</strong>됩니다.</p>
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">메모</label>
              <textarea value={(resultEditing.content as string) || ''} onChange={(e) => setResultEditing({ ...resultEditing, content: e.target.value })}
                placeholder="관리용 메모 (외부에 노출되지 않습니다)"
                rows={2} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all resize-none" />
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
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              <p className="text-xs text-gray-400 mt-1">동영상 URL이 있으면 동영상이 우선 재생됩니다.</p>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">정렬 순서</label>
              <input type="number" value={(resultEditing.sort_order as number) ?? 0} onChange={(e) => setResultEditing({ ...resultEditing, sort_order: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              <p className="text-xs text-gray-400 mt-1">숫자가 작을수록 먼저 표시됩니다.</p>
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={resultEditing.is_published !== false} onChange={(e) => setResultEditing({ ...resultEditing, is_published: e.target.checked })} className="accent-[#2ED573]" />
                공개
              </label>
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <p className="text-xs text-gray-400 mb-2">미리보기</p>
              <div className="bg-[#0a0a0a] rounded-xl p-6 flex flex-col items-center">
                <span className="inline-block bg-[#2ED573] text-black text-xs font-bold px-4 py-1.5 rounded-full mb-3">
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

      <ConfirmDialog
        isOpen={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="랜딩 페이지 삭제"
        message="정말 삭제하시겠습니까? 연결된 강의의 카테고리는 해제되지만 강의 자체는 유지됩니다."
      />
      <ConfirmDialog isOpen={!!bannerDeleteTarget} onClose={() => setBannerDeleteTarget(null)} onConfirm={handleBannerDelete} title="배너 삭제" message="이 배너를 삭제하시겠습니까?" />
      <ConfirmDialog isOpen={!!resultDeleteTarget} onClose={() => setResultDeleteTarget(null)} onConfirm={handleResultDelete} title="성과 삭제" message="이 성과를 삭제하시겠습니까?" />
    </AdminLayout>
  )
}
