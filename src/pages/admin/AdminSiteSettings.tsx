import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import { bannerService } from '../../services/bannerService'
import { supabase } from '../../lib/supabase'
import { invalidateSeoSettings } from '../../hooks/useSeoSettings'
import type { Banner } from '../../types'

type SectionTab = 'general' | 'legal' | 'seo'

interface SeoSettingsForm {
  title: string
  author: string
  description: string
  keywords: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  twitterTitle: string
  twitterDescription: string
  twitterImage: string
  rssUrl: string
  sitemapUrl: string
}

const defaultSeoSettings: SeoSettingsForm = {
  title: '',
  author: '',
  description: '',
  keywords: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  twitterTitle: '',
  twitterDescription: '',
  twitterImage: '',
  rssUrl: '',
  sitemapUrl: '',
}

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

  // 하단 링크
  const [bottomLinks, setBottomLinks] = useState<Banner[]>([])
  const [linkEditing, setLinkEditing] = useState<Record<string, unknown> | null>(null)
  const [linkSaving, setLinkSaving] = useState(false)
  const [linkDeleteTarget, setLinkDeleteTarget] = useState<number | null>(null)

  // 일반 설정
  const [kakaoLink, setKakaoLink] = useState('')
  const [kakaoLinkTarget, setKakaoLinkTarget] = useState<'_blank' | '_self'>('_blank')
  const [companyLink, setCompanyLink] = useState('')
  const [companyLinkTarget, setCompanyLinkTarget] = useState<'_blank' | '_self'>('_blank')
  const [recruitLink, setRecruitLink] = useState('')
  const [recruitLinkTarget, setRecruitLinkTarget] = useState<'_blank' | '_self'>('_blank')
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(defaultBusinessInfo)
  const [bizSaving, setBizSaving] = useState(false)

  // 토스 페이먼츠
  const [tossClientKey, setTossClientKey] = useState('')
  const [tossSecretKey, setTossSecretKey] = useState('')
  const [tossSaving, setTossSaving] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)

  // 약관
  const [termsHtml, setTermsHtml] = useState('')
  const [privacyHtml, setPrivacyHtml] = useState('')
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy'>('terms')
  const [legalSaving, setLegalSaving] = useState(false)
  const [legalPreview, setLegalPreview] = useState(false)

  // SEO
  const [seoSettings, setSeoSettings] = useState<SeoSettingsForm>(defaultSeoSettings)
  const [seoSaving, setSeoSaving] = useState(false)

  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [linkData, settingsData] = await withTimeout(Promise.all([
        bannerService.getAllByPage('bottom_links'),
        supabase.from('site_settings').select('*'),
      ]))
      setBottomLinks(linkData)
      if (settingsData.data) {
        for (const s of settingsData.data as { key: string; value: Record<string, string> }[]) {
          if (s.key === 'kakao_link') { setKakaoLink(s.value?.url || ''); if (s.value?.target) setKakaoLinkTarget(s.value.target as '_blank' | '_self') }
          if (s.key === 'company_link') { setCompanyLink(s.value?.url || ''); if (s.value?.target) setCompanyLinkTarget(s.value.target as '_blank' | '_self') }
          if (s.key === 'recruit_link') { setRecruitLink(s.value?.url || ''); if (s.value?.target) setRecruitLinkTarget(s.value.target as '_blank' | '_self') }
          if (s.key === 'business_info') setBusinessInfo({ ...defaultBusinessInfo, ...s.value as unknown as BusinessInfo })
          if (s.key === 'terms_html') setTermsHtml((s.value as Record<string, string>)?.html || '')
          if (s.key === 'privacy_html') setPrivacyHtml((s.value as Record<string, string>)?.html || '')
          if (s.key === 'toss_payments') {
            setTossClientKey((s.value as unknown as Record<string, string>)?.clientKey || '')
            setTossSecretKey((s.value as unknown as Record<string, string>)?.secretKey || '')
          }
          if (s.key === 'seo_settings') {
            setSeoSettings({ ...defaultSeoSettings, ...(s.value as unknown as SeoSettingsForm) })
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

  // ── 토스 페이먼츠 저장 ──
  const handleTossSave = async () => {
    if (!tossClientKey.trim()) { toast.error('클라이언트 키를 입력해주세요.'); return }
    if (!tossSecretKey.trim()) { toast.error('시크릿 키를 입력해주세요.'); return }
    try {
      setTossSaving(true)
      await supabase.from('site_settings').upsert({ key: 'toss_payments', value: { clientKey: tossClientKey, secretKey: tossSecretKey } } as never, { onConflict: 'key' })
      toast.success('토스 페이먼츠 설정이 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setTossSaving(false)
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

  // ── SEO 저장 ──
  const handleSeoSave = async () => {
    if (!seoSettings.title.trim()) { toast.error('meta title을 입력해주세요.'); return }
    try {
      setSeoSaving(true)
      await supabase.from('site_settings').upsert({ key: 'seo_settings', value: seoSettings } as never, { onConflict: 'key' })
      invalidateSeoSettings()
      toast.success('SEO 설정이 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSeoSaving(false)
    }
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
          onClick={() => setTab('legal')}
          className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
            tab === 'legal' ? 'bg-[#2ED573] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          약관 관리
        </button>
        <button
          onClick={() => setTab('seo')}
          className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
            tab === 'seo' ? 'bg-[#2ED573] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          SEO 설정
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-16 bg-gray-100 rounded" />)}
        </div>
      ) : tab === 'general' ? (
        /* ── 일반 설정 ── */
        <>
        {/* ── 사업자 정보 ── */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
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

        {/* ── 하단 링크 ── */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4 mt-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">하단 링크</h2>
              <p className="text-xs text-gray-400 mt-1">메인 페이지 하단에 표시되는 링크 카드입니다. (브랜드 페이지, 유튜브 등)</p>
            </div>
            <button
              onClick={() => setLinkEditing({ title: '', subtitle: '', image_url: '', link_url: '', sort_order: bottomLinks.length, is_published: true })}
              className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20 flex items-center gap-1.5 shrink-0 ml-4"
            >
              <i className="ti ti-plus text-sm" /> 링크 추가
            </button>
          </div>

          {bottomLinks.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 text-sm">등록된 하단 링크가 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {bottomLinks.map((link) => (
                <div key={link.id} className="bg-gray-50 rounded-xl overflow-hidden">
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
        </div>

        {/* ── 토스 페이먼츠 ── */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-5 mt-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">토스 페이먼츠</h2>
            <p className="text-xs text-gray-400 mt-1">결제 시스템 연동에 필요한 API 키를 설정합니다.</p>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">
              <span className="text-red-400">*</span> 클라이언트 키
            </label>
            <input
              value={tossClientKey}
              onChange={(e) => setTossClientKey(e.target.value)}
              placeholder="test_ck_..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">
              <span className="text-red-400">*</span> 시크릿 키
            </label>
            <div className="relative">
              <input
                type={showSecretKey ? 'text' : 'password'}
                value={tossSecretKey}
                onChange={(e) => setTossSecretKey(e.target.value)}
                placeholder="test_sk_..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowSecretKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
              >
                <i className={`ti ${showSecretKey ? 'ti-eye-off' : 'ti-eye'} text-sm`} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">시크릿 키는 서버에서만 사용되며 클라이언트에 노출되지 않습니다.</p>
          </div>

          <button
            onClick={handleTossSave}
            disabled={tossSaving}
            className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50"
          >
            {tossSaving ? '저장 중...' : '토스 설정 저장'}
          </button>
        </div>
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
      ) : tab === 'seo' ? (
        /* ── SEO 설정 ── */
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-8">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">SEO 태그 설정</h3>
            <p className="text-xs text-gray-400 mb-4">검색엔진 최적화 및 SNS 공유 시 표시되는 메타 정보입니다.</p>

            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-bold block mb-1"><span className="text-red-500">*</span> title</label>
                <input value={seoSettings.title} onChange={(e) => setSeoSettings({ ...seoSettings, title: e.target.value })}
                  placeholder="meta title을 입력해 주세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">author</label>
                <input value={seoSettings.author} onChange={(e) => setSeoSettings({ ...seoSettings, author: e.target.value })}
                  placeholder="meta author를 입력해 주세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              </div>
              <div className="col-span-2 max-sm:col-span-1">
                <label className="text-sm font-bold block mb-1">description</label>
                <input value={seoSettings.description} onChange={(e) => setSeoSettings({ ...seoSettings, description: e.target.value })}
                  placeholder="meta description을 입력해 주세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              </div>
              <div className="col-span-2 max-sm:col-span-1">
                <label className="text-sm font-bold block mb-1">keywords</label>
                <input value={seoSettings.keywords} onChange={(e) => setSeoSettings({ ...seoSettings, keywords: e.target.value })}
                  placeholder="meta keywords를 입력해 주세요 (쉼표로 구분)"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Open Graph (SNS 공유)</h3>
            <p className="text-xs text-gray-400 mb-4">페이스북, 카카오톡 등에서 링크 공유 시 표시되는 이미지/제목입니다.</p>

            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-bold block mb-1">og:title</label>
                <input value={seoSettings.ogTitle} onChange={(e) => setSeoSettings({ ...seoSettings, ogTitle: e.target.value })}
                  placeholder="비워두면 meta title과 동일하게 적용됩니다"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">og:description</label>
                <input value={seoSettings.ogDescription} onChange={(e) => setSeoSettings({ ...seoSettings, ogDescription: e.target.value })}
                  placeholder="비워두면 meta description과 동일하게 적용됩니다"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              </div>
              <div className="col-span-2 max-sm:col-span-1">
                <label className="text-sm font-bold block mb-1">og:image</label>
                <p className="text-xs text-gray-400 mb-1">권장 크기: 1200 × 627 (jpg, png)</p>
                <ImageUploader
                  bucket="banners"
                  path={`seo/og-${Date.now()}`}
                  currentUrl={seoSettings.ogImage}
                  onUpload={(url) => setSeoSettings({ ...seoSettings, ogImage: url })}
                  className="h-[160px]"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Twitter 카드</h3>
            <p className="text-xs text-gray-400 mb-4">Twitter(X)에서 링크 공유 시 표시되는 정보입니다.</p>

            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-bold block mb-1">twitter:title</label>
                <input value={seoSettings.twitterTitle} onChange={(e) => setSeoSettings({ ...seoSettings, twitterTitle: e.target.value })}
                  placeholder="비워두면 og:title과 동일하게 적용됩니다"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">twitter:description</label>
                <input value={seoSettings.twitterDescription} onChange={(e) => setSeoSettings({ ...seoSettings, twitterDescription: e.target.value })}
                  placeholder="비워두면 og:description과 동일하게 적용됩니다"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              </div>
              <div className="col-span-2 max-sm:col-span-1">
                <label className="text-sm font-bold block mb-1">twitter:image</label>
                <p className="text-xs text-gray-400 mb-1">권장 크기: 1200 × 627 (jpg, png)</p>
                <ImageUploader
                  bucket="banners"
                  path={`seo/twitter-${Date.now()}`}
                  currentUrl={seoSettings.twitterImage}
                  onUpload={(url) => setSeoSettings({ ...seoSettings, twitterImage: url })}
                  className="h-[160px]"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold text-gray-900 mb-1">RSS / 사이트맵</h3>
            <p className="text-xs text-gray-400 mb-4">검색엔진 인덱싱용 XML 파일 URL을 입력하세요.</p>

            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-bold block mb-1">RSS URL</label>
                <input value={seoSettings.rssUrl} onChange={(e) => setSeoSettings({ ...seoSettings, rssUrl: e.target.value })}
                  placeholder="https://.../rss.xml"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">Sitemap URL</label>
                <input value={seoSettings.sitemapUrl} onChange={(e) => setSeoSettings({ ...seoSettings, sitemapUrl: e.target.value })}
                  placeholder="https://.../sitemap.xml"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={handleSeoSave}
              disabled={seoSaving}
              className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <i className="ti ti-check text-sm" /> {seoSaving ? '저장 중...' : 'SEO 설정 저장'}
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


      <ConfirmDialog isOpen={!!linkDeleteTarget} onClose={() => setLinkDeleteTarget(null)} onConfirm={handleLinkDelete} title="링크 삭제" message="이 링크를 삭제하시겠습니까?" />
    </AdminLayout>
  )
}
