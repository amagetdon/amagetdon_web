import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import VideoUrlInput from '../../components/admin/VideoUrlInput'
import { bannerService } from '../../services/bannerService'
import { resultService } from '../../services/resultService'
import { supabase } from '../../lib/supabase'
import type { Banner, Result } from '../../types'

type SectionTab = 'banners' | 'results' | 'bottomLinks' | 'general' | 'legal'

interface BusinessInfo {
  mallName: string
  mallNameEn: string
  siteTitle: string
  logoUrl: string
  faviconUrl: string
  companyName: string
  bizNumber: string
  ceoName: string
  bizType: string
  bizCategory: string
  email: string
  address: string
  phone: string
  ecommerceNumber: string
  remoteAcademyNumber: string
}

const defaultBusinessInfo: BusinessInfo = {
  mallName: '',
  mallNameEn: '',
  siteTitle: '',
  logoUrl: '',
  faviconUrl: '',
  companyName: '',
  bizNumber: '',
  ceoName: '',
  bizType: '',
  bizCategory: '',
  email: '',
  address: '',
  phone: '',
  ecommerceNumber: '',
  remoteAcademyNumber: '',
}

export default function AdminSiteSettings() {
  const [tab, setTab] = useState<SectionTab>('general')

  // 배너
  type BannerSubTab = 'hero' | 'reviews' | 'results'
  const [bannerSubTab, setBannerSubTab] = useState<BannerSubTab>('hero')
  const [allBanners, setAllBanners] = useState<Record<string, Banner[]>>({ hero: [], reviews: [], results: [], reviews_event: [], results_event: [] })
  const [bannerEditing, setBannerEditing] = useState<Record<string, unknown> | null>(null)
  const [bannerSaving, setBannerSaving] = useState(false)
  const [bannerDeleteTarget, setBannerDeleteTarget] = useState<number | null>(null)
  const [editingPageKey, setEditingPageKey] = useState<string>('hero')
  const banners = allBanners[bannerSubTab]
  const eventKey = `${bannerSubTab}_event` as string
  const eventBanners = allBanners[eventKey] || []

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

  // 일반 설정
  const [promoVideoUrl, setPromoVideoUrl] = useState('')
  const [kakaoLink, setKakaoLink] = useState('')
  const [kakaoLinkTarget, setKakaoLinkTarget] = useState<'_blank' | '_self'>('_blank')
  const [companyLink, setCompanyLink] = useState('')
  const [companyLinkTarget, setCompanyLinkTarget] = useState<'_blank' | '_self'>('_blank')
  const [recruitLink, setRecruitLink] = useState('')
  const [recruitLinkTarget, setRecruitLinkTarget] = useState<'_blank' | '_self'>('_blank')
  const [bannerSettings, setBannerSettings] = useState<Record<string, { height: string; speed: string }>>({
    hero: { height: 'auto', speed: '5' },
    reviews: { height: 'auto', speed: '5' },
    results: { height: 'auto', speed: '5' },
  })
  const [bannerSettingSaving, setBannerSettingSaving] = useState(false)
  const [generalSaving, setGeneralSaving] = useState(false)
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(defaultBusinessInfo)
  const [bizSaving, setBizSaving] = useState(false)

  // 약관
  const [termsHtml, setTermsHtml] = useState('')
  const [privacyHtml, setPrivacyHtml] = useState('')
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy'>('terms')
  const [legalSaving, setLegalSaving] = useState(false)
  const [legalPreview, setLegalPreview] = useState(false)

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const [heroBanners, reviewsBanners, resultsBanners, reviewsEvent, resultsEvent, resultData, linkData, settingsData] = await withTimeout(Promise.all([
        bannerService.getAllByPage('hero'),
        bannerService.getAllByPage('reviews'),
        bannerService.getAllByPage('results'),
        bannerService.getAllByPage('reviews_event'),
        bannerService.getAllByPage('results_event'),
        resultService.getAll({ perPage: 50 }),
        bannerService.getAllByPage('bottom_links'),
        supabase.from('site_settings').select('*'),
      ]))
      setAllBanners({ hero: heroBanners, reviews: reviewsBanners, results: resultsBanners, reviews_event: reviewsEvent, results_event: resultsEvent })
      setResults(resultData.data)
      setBottomLinks(linkData)
      if (settingsData.data) {
        for (const s of settingsData.data as { key: string; value: Record<string, string> }[]) {
          if (s.key === 'promo_video') setPromoVideoUrl(s.value?.url || '')
          if (s.key === 'kakao_link') { setKakaoLink(s.value?.url || ''); if (s.value?.target) setKakaoLinkTarget(s.value.target as '_blank' | '_self') }
          if (s.key === 'company_link') { setCompanyLink(s.value?.url || ''); if (s.value?.target) setCompanyLinkTarget(s.value.target as '_blank' | '_self') }
          if (s.key === 'recruit_link') { setRecruitLink(s.value?.url || ''); if (s.value?.target) setRecruitLinkTarget(s.value.target as '_blank' | '_self') }
          if (s.key === 'business_info') setBusinessInfo({ ...defaultBusinessInfo, ...s.value as BusinessInfo })
          if (s.key === 'terms_html') setTermsHtml((s.value as Record<string, string>)?.html || '')
          if (s.key === 'privacy_html') setPrivacyHtml((s.value as Record<string, string>)?.html || '')
          if (s.key === 'banner_settings') {
            const val = s.value as Record<string, { height?: string; speed?: string }>
            setBannerSettings((prev) => ({
              ...prev,
              hero: { height: val.hero?.height || 'auto', speed: val.hero?.speed || '5' },
              reviews: { height: val.reviews?.height || 'auto', speed: val.reviews?.speed || '5' },
              results: { height: val.results?.height || 'auto', speed: val.results?.speed || '5' },
            }))
          }
        }
      }
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])
  useVisibilityRefresh(fetchData)

  // ── 일반 설정 저장 ──
  const handleGeneralSave = async () => {
    try {
      setGeneralSaving(true)
      await supabase.from('site_settings').upsert({ key: 'promo_video', value: { url: promoVideoUrl } } as never, { onConflict: 'key' })
      toast.success('설정이 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setGeneralSaving(false)
    }
  }

  // ── 사업자 정보 저장 ──
  const handleBizSave = async () => {
    if (!businessInfo.mallName.trim()) { toast.error('몰 이름을 입력해주세요.'); return }
    if (!businessInfo.companyName.trim()) { toast.error('상호명을 입력해주세요.'); return }
    try {
      setBizSaving(true)
      await Promise.all([
        supabase.from('site_settings').upsert({ key: 'business_info', value: businessInfo } as never, { onConflict: 'key' }),
        supabase.from('site_settings').upsert({ key: 'kakao_link', value: { url: kakaoLink, target: kakaoLinkTarget } } as never, { onConflict: 'key' }),
        supabase.from('site_settings').upsert({ key: 'company_link', value: { url: companyLink, target: companyLinkTarget } } as never, { onConflict: 'key' }),
        supabase.from('site_settings').upsert({ key: 'recruit_link', value: { url: recruitLink, target: recruitLinkTarget } } as never, { onConflict: 'key' }),
      ])
      toast.success('사업자 정보가 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setBizSaving(false)
    }
  }

  // ── 약관 저장 ──
  const handleLegalSave = async () => {
    try {
      setLegalSaving(true)
      await Promise.all([
        supabase.from('site_settings').upsert({ key: 'terms_html', value: { html: termsHtml } } as never, { onConflict: 'key' }),
        supabase.from('site_settings').upsert({ key: 'privacy_html', value: { html: privacyHtml } } as never, { onConflict: 'key' }),
      ])
      toast.success('약관이 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setLegalSaving(false)
    }
  }

  // ── 배너 설정 저장 ──
  const handleBannerSettingSave = async () => {
    try {
      setBannerSettingSaving(true)
      await supabase.from('site_settings').upsert({ key: 'banner_settings', value: bannerSettings } as never, { onConflict: 'key' })
      toast.success('배너 설정이 저장되었습니다.')
    } catch { toast.error('저장에 실패했습니다.') } finally { setBannerSettingSaving(false) }
  }

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
          video_url: null,
          media_type: 'image',
          link_url: (linkEditing.link_url as string) || null,
          overlay_opacity: null,
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
      <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1.5 w-fit mb-6 flex-wrap">
        <button
          onClick={() => setTab('general')}
          className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
            tab === 'general' ? 'bg-[#2ED573] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          일반 설정
        </button>
        <button
          onClick={() => setTab('banners')}
          className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
            tab === 'banners' ? 'bg-[#2ED573] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          히어로 배너
        </button>
        <button
          onClick={() => setTab('results')}
          className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
            tab === 'results' ? 'bg-[#2ED573] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          리얼 성과
        </button>
        <button
          onClick={() => setTab('bottomLinks')}
          className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
            tab === 'bottomLinks' ? 'bg-[#2ED573] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          하단 링크
        </button>
        <button
          onClick={() => setTab('legal')}
          className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
            tab === 'legal' ? 'bg-[#2ED573] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          약관 관리
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-16 bg-gray-100 rounded" />)}
        </div>
      ) : tab === 'general' ? (
        /* ── 일반 설정 ── */
        <>
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

          <button
            onClick={handleGeneralSave}
            disabled={generalSaving}
            className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50"
          >
            {generalSaving ? '저장 중...' : '전체 저장'}
          </button>

        </div>

        {/* ── 사업자 정보 ── */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6 mt-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">사업자 정보</h2>
            <p className="text-xs text-gray-400 mt-1">푸터에 표시되는 사업자 정보를 관리합니다.</p>
          </div>

          {/* 기본 정보 */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3">기본 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  <span className="text-red-400">*</span> 몰 이름
                </label>
                <input
                  value={businessInfo.mallName}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, mallName: e.target.value }))}
                  placeholder="몰 이름을 입력해 주세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  영문 몰 이름 <span className="text-gray-400">(선택)</span>
                </label>
                <input
                  value={businessInfo.mallNameEn}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, mallNameEn: e.target.value }))}
                  placeholder="영문 몰 이름을 입력해 주세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  <span className="text-red-400">*</span> 몰 상단 타이틀 명
                </label>
                <input
                  value={businessInfo.siteTitle}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, siteTitle: e.target.value }))}
                  placeholder="브라우저 탭에 표시되는 타이틀"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
            </div>
          </div>

          {/* 링크 설정 */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">링크 설정</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  <span className="text-red-400">*</span> 회사소개 링크
                </label>
                <p className="text-xs text-gray-400 mb-1.5">푸터 "회사소개" 클릭 시 이동할 URL. 비워두면 공지사항 페이지로 이동합니다.</p>
                <div className="flex gap-2">
                  <input
                    value={companyLink}
                    onChange={(e) => setCompanyLink(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                  />
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setCompanyLinkTarget('_blank')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer transition-colors whitespace-nowrap ${companyLinkTarget === '_blank' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                      새 탭
                    </button>
                    <button type="button" onClick={() => setCompanyLinkTarget('_self')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer transition-colors whitespace-nowrap ${companyLinkTarget === '_self' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                      현재 탭
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  인재채용 링크 <span className="text-gray-400">(선택)</span>
                </label>
                <p className="text-xs text-gray-400 mb-1.5">푸터 "인재채용" 클릭 시 이동할 URL. 비워두면 비활성 상태입니다.</p>
                <div className="flex gap-2">
                  <input
                    value={recruitLink}
                    onChange={(e) => setRecruitLink(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                  />
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setRecruitLinkTarget('_blank')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer transition-colors whitespace-nowrap ${recruitLinkTarget === '_blank' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                      새 탭
                    </button>
                    <button type="button" onClick={() => setRecruitLinkTarget('_self')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer transition-colors whitespace-nowrap ${recruitLinkTarget === '_self' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                      현재 탭
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  카카오채널 링크 <span className="text-gray-400">(선택)</span>
                </label>
                <p className="text-xs text-gray-400 mb-1.5">헤더 네비게이션에 카카오채널 링크로 표시됩니다.</p>
                <div className="flex gap-2">
                  <input
                    value={kakaoLink}
                    onChange={(e) => setKakaoLink(e.target.value)}
                    placeholder="https://pf.kakao.com/..."
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                  />
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setKakaoLinkTarget('_blank')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer transition-colors whitespace-nowrap ${kakaoLinkTarget === '_blank' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                      새 탭
                    </button>
                    <button type="button" onClick={() => setKakaoLinkTarget('_self')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer transition-colors whitespace-nowrap ${kakaoLinkTarget === '_self' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                      현재 탭
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 로고 & 파비콘 */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">로고 / 파비콘</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">
                  <span className="text-red-400">*</span> 로고 설정
                </label>
                <ImageUploader
                  bucket="banners"
                  path={`site/logo-${Date.now()}`}
                  currentUrl={businessInfo.logoUrl || null}
                  onUpload={(url) => setBusinessInfo((v) => ({ ...v, logoUrl: url }))}
                  className="h-24"
                  objectFit="contain"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">
                  <span className="text-red-400">*</span> 파비콘 설정
                </label>
                <ImageUploader
                  bucket="banners"
                  path={`site/favicon-${Date.now()}`}
                  currentUrl={businessInfo.faviconUrl || null}
                  onUpload={(url) => setBusinessInfo((v) => ({ ...v, faviconUrl: url }))}
                  className="w-20 h-20"
                  objectFit="contain"
                />
              </div>
            </div>
          </div>

          {/* 상세 사업자 정보 */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">상세 사업자 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  <span className="text-red-400">*</span> 상호명
                </label>
                <input
                  value={businessInfo.companyName}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, companyName: e.target.value }))}
                  placeholder="상호명을 입력해 주세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  <span className="text-red-400">*</span> 사업자등록번호
                </label>
                <input
                  value={businessInfo.bizNumber}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, bizNumber: e.target.value }))}
                  placeholder="000-00-00000"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  <span className="text-red-400">*</span> 대표자 명
                </label>
                <input
                  value={businessInfo.ceoName}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, ceoName: e.target.value }))}
                  placeholder="대표자 명을 입력해 주세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  <span className="text-red-400">*</span> 업태
                </label>
                <input
                  value={businessInfo.bizType}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, bizType: e.target.value }))}
                  placeholder="업태를 입력해 주세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  <span className="text-red-400">*</span> 업종
                </label>
                <input
                  value={businessInfo.bizCategory}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, bizCategory: e.target.value }))}
                  placeholder="업종을 입력해 주세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  <span className="text-red-400">*</span> 대표 이메일
                </label>
                <input
                  value={businessInfo.email}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, email: e.target.value }))}
                  placeholder="info@example.com"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  <span className="text-red-400">*</span> 사업장 주소
                </label>
                <input
                  value={businessInfo.address}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, address: e.target.value }))}
                  placeholder="사업장 주소를 입력해 주세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  <span className="text-red-400">*</span> 대표 전화번호
                </label>
                <input
                  value={businessInfo.phone}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, phone: e.target.value }))}
                  placeholder="02-0000-0000"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
            </div>
          </div>

          {/* 신고번호 */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">신고번호</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  통신판매신고번호 <span className="text-gray-400">(선택)</span>
                </label>
                <input
                  value={businessInfo.ecommerceNumber}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, ecommerceNumber: e.target.value }))}
                  placeholder="통신판매신고번호를 입력해 주세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  원격학원신고번호 <span className="text-gray-400">(선택)</span>
                </label>
                <input
                  value={businessInfo.remoteAcademyNumber}
                  onChange={(e) => setBusinessInfo((v) => ({ ...v, remoteAcademyNumber: e.target.value }))}
                  placeholder="원격학원신고번호를 입력해 주세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleBizSave}
            disabled={bizSaving}
            className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50"
          >
            {bizSaving ? '저장 중...' : '사업자 정보 저장'}
          </button>
        </div>
        </>
      ) : tab === 'banners' ? (
        /* ── 배너 관리 ── */
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
          {/* 배너 높이 / 전환속도 설정 */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600 whitespace-nowrap">높이</span>
              <div className="flex gap-1">
                {[
                  { value: 'auto', label: '자동' },
                  { value: '300px', label: '300' },
                  { value: '400px', label: '400' },
                  { value: '500px', label: '500' },
                  { value: '600px', label: '600' },
                  { value: '100vh', label: '전체' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBannerSettings((prev) => ({ ...prev, [bannerSubTab]: { ...prev[bannerSubTab], height: opt.value } }))}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                      bannerSettings[bannerSubTab]?.height === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600 whitespace-nowrap">전환</span>
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

          {/* 이벤트 안내 (reviews/results 서브탭만) */}
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
        /* ── 리얼 성과 ── */
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
      ) : tab === 'bottomLinks' ? (
        /* ── 하단 링크 ── */
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">메인 페이지 하단에 표시되는 링크 카드입니다. (브랜드 페이지, 유튜브 등)</p>
            <button
              onClick={() => setLinkEditing({ title: '', subtitle: '', image_url: '', link_url: '', sort_order: bottomLinks.length, is_published: true })}
              className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20 flex items-center gap-1.5 shrink-0 ml-4"
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
      ) : tab === 'legal' ? (
        /* ── 약관 관리 ── */
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => { setLegalTab('terms'); setLegalPreview(false) }}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${legalTab === 'terms' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}
              >
                이용약관
              </button>
              <button
                onClick={() => { setLegalTab('privacy'); setLegalPreview(false) }}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${legalTab === 'privacy' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}
              >
                개인정보처리방침
              </button>
            </div>
            <button
              type="button"
              onClick={() => setLegalPreview((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${legalPreview ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}
            >
              <i className={`ti ${legalPreview ? 'ti-code' : 'ti-eye'} mr-1`} />
              {legalPreview ? '편집' : '미리보기'}
            </button>
          </div>

          {legalPreview ? (
            <div className="border border-gray-200 rounded-lg p-6 min-h-[400px] max-h-[600px] overflow-y-auto">
              <div
                className="legal-content"
                dangerouslySetInnerHTML={{ __html: legalTab === 'terms' ? termsHtml : privacyHtml }}
              />
              {!(legalTab === 'terms' ? termsHtml : privacyHtml) && (
                <p className="text-sm text-gray-400 text-center py-20">내용이 없습니다. 편집 모드에서 HTML을 입력해주세요.</p>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-2">
                HTML 형식으로 작성합니다. {legalTab === 'terms' ? '이용약관' : '개인정보처리방침'} 내용을 입력하세요.
              </p>
              <textarea
                value={legalTab === 'terms' ? termsHtml : privacyHtml}
                onChange={(e) => legalTab === 'terms' ? setTermsHtml(e.target.value) : setPrivacyHtml(e.target.value)}
                rows={20}
                placeholder={`<h3>제1조 (목적)</h3>\n<p>이 약관은...</p>`}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#2ED573] font-mono resize-y min-h-[400px]"
              />
            </>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleLegalSave}
              disabled={legalSaving}
              className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50"
            >
              {legalSaving ? '저장 중...' : '약관 저장'}
            </button>
          </div>
        </div>
      ) : null}

      {/* 하단 링크 모달 */}
      <AdminFormModal isOpen={!!linkEditing} onClose={() => setLinkEditing(null)} title={linkEditing?.id ? '링크 수정' : '새 링크 등록'} onSubmit={handleLinkSave} loading={linkSaving}>
        {linkEditing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">제목 *</label>
              <input value={(linkEditing.title as string) || ''} onChange={(e) => setLinkEditing({ ...linkEditing, title: e.target.value })}
                placeholder="아마겟돈 브랜드 페이지"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">링크 URL</label>
              <input value={(linkEditing.link_url as string) || ''} onChange={(e) => setLinkEditing({ ...linkEditing, link_url: e.target.value })}
                placeholder="https://..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">썸네일 이미지</label>
              <ImageUploader bucket="banners" path={`bottom/${linkEditing.id || 'new'}-${Date.now()}`}
                currentUrl={linkEditing.image_url as string} onUpload={(url) => setLinkEditing({ ...linkEditing, image_url: url })} className="h-[180px]" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">검은 오버레이 투명도</label>
              <input type="number" min={0} max={100} value={(linkEditing.subtitle as number) ?? 0} onChange={(e) => setLinkEditing({ ...linkEditing, subtitle: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              <p className="text-xs text-gray-400 mt-1">0 = 검정, 50 = 반투명, 100 = 선명</p>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">정렬 순서</label>
              <input type="number" value={(linkEditing.sort_order as number) ?? 0} onChange={(e) => setLinkEditing({ ...linkEditing, sort_order: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={linkEditing.is_published !== false} onChange={(e) => setLinkEditing({ ...linkEditing, is_published: e.target.checked })} className="accent-[#2ED573]" />
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
            {/* 미리보기 */}
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

      <ConfirmDialog isOpen={!!bannerDeleteTarget} onClose={() => setBannerDeleteTarget(null)} onConfirm={handleBannerDelete} title="배너 삭제" message="이 배너를 삭제하시겠습니까?" />
      <ConfirmDialog isOpen={!!resultDeleteTarget} onClose={() => setResultDeleteTarget(null)} onConfirm={handleResultDelete} title="성과 삭제" message="이 성과를 삭제하시겠습니까?" />
      <ConfirmDialog isOpen={!!linkDeleteTarget} onClose={() => setLinkDeleteTarget(null)} onConfirm={handleLinkDelete} title="링크 삭제" message="이 링크를 삭제하시겠습니까?" />
    </AdminLayout>
  )
}
