import { useState } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'

const BASE_URLS = [
  { label: '메인', value: '/' },
  { label: '아카데미', value: '/academy' },
  { label: '회원가입', value: '/signup' },
  { label: '강사소개', value: '/instructors' },
  { label: '수강 후기', value: '/reviews' },
  { label: '수강 성과', value: '/results' },
  { label: 'FAQ', value: '/faq' },
]

const SOURCE_PRESETS = ['kakao', 'instagram', 'naver', 'youtube', 'facebook', 'google', 'tiktok', 'blog', 'email']
const MEDIUM_PRESETS = ['social', 'cpc', 'cpm', 'banner', 'email', 'referral', 'organic', 'affiliate']

interface UtmParams {
  baseUrl: string
  customUrl: string
  source: string
  medium: string
  campaign: string
  content: string
  term: string
}

export default function AdminUtmBuilder() {
  const [params, setParams] = useState<UtmParams>({
    baseUrl: '/signup',
    customUrl: '',
    source: '',
    medium: '',
    campaign: '',
    content: '',
    term: '',
  })
  const [history, setHistory] = useState<{ url: string; label: string; created: string }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('utm_history') || '[]')
    } catch { return [] }
  })

  const domain = window.location.origin
  const path = params.customUrl || params.baseUrl
  const utmParts = [
    params.source && `utm_source=${encodeURIComponent(params.source)}`,
    params.medium && `utm_medium=${encodeURIComponent(params.medium)}`,
    params.campaign && `utm_campaign=${encodeURIComponent(params.campaign)}`,
    params.content && `utm_content=${encodeURIComponent(params.content)}`,
    params.term && `utm_term=${encodeURIComponent(params.term)}`,
  ].filter(Boolean)
  const generatedUrl = utmParts.length > 0 ? `${domain}${path}?${utmParts.join('&')}` : `${domain}${path}`

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedUrl)
    toast.success('URL이 복사되었습니다.')
  }

  const handleSave = () => {
    if (!params.source) { toast.error('소스를 입력해주세요.'); return }
    const label = `${params.source}${params.campaign ? ` / ${params.campaign}` : ''}`
    const newHistory = [{ url: generatedUrl, label, created: new Date().toISOString() }, ...history].slice(0, 20)
    setHistory(newHistory)
    localStorage.setItem('utm_history', JSON.stringify(newHistory))
    toast.success('저장되었습니다.')
  }

  const handleDeleteHistory = (idx: number) => {
    const newHistory = history.filter((_, i) => i !== idx)
    setHistory(newHistory)
    localStorage.setItem('utm_history', JSON.stringify(newHistory))
  }

  const update = (key: keyof UtmParams, value: string) => setParams((p) => ({ ...p, [key]: value }))

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">UTM 링크 생성</h1>
        <p className="text-sm text-gray-500 mt-1">마케팅 채널별 유입 추적을 위한 UTM 링크를 생성합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 입력 폼 */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">기본 설정</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1.5">랜딩 페이지</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {BASE_URLS.map((u) => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => update('baseUrl', u.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                        params.baseUrl === u.value && !params.customUrl ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
                <input
                  value={params.customUrl}
                  onChange={(e) => update('customUrl', e.target.value)}
                  placeholder="또는 직접 경로 입력 (예: /course/1)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1.5">utm_source <span className="text-red-400">*</span> <span className="text-xs font-normal text-gray-400">유입 소스</span></label>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {SOURCE_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update('source', s)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                        params.source === s ? 'bg-[#2ED573] text-white border-[#2ED573]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input value={params.source} onChange={(e) => update('source', e.target.value)}
                  placeholder="예: kakao, instagram, naver_blog"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]" />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1.5">utm_medium <span className="text-xs font-normal text-gray-400">매체/방식</span></label>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {MEDIUM_PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => update('medium', m)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                        params.medium === m ? 'bg-[#2ED573] text-white border-[#2ED573]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <input value={params.medium} onChange={(e) => update('medium', e.target.value)}
                  placeholder="예: social, cpc, banner, email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]" />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1.5">utm_campaign <span className="text-xs font-normal text-gray-400">캠페인명</span></label>
                <input value={params.campaign} onChange={(e) => update('campaign', e.target.value)}
                  placeholder="예: 2026_spring_event, free_ebook_promo"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1.5">utm_content <span className="text-xs font-normal text-gray-400">콘텐츠 구분</span></label>
                  <input value={params.content} onChange={(e) => update('content', e.target.value)}
                    placeholder="예: banner_top, cta_button"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]" />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1.5">utm_term <span className="text-xs font-normal text-gray-400">키워드</span></label>
                  <input value={params.term} onChange={(e) => update('term', e.target.value)}
                    placeholder="예: 트레이딩, 재테크"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]" />
                </div>
              </div>
            </div>
          </div>

          {/* 생성된 URL */}
          <div className="bg-gray-900 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 font-medium">생성된 URL</p>
              <div className="flex gap-2">
                <button onClick={handleSave}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white border-none cursor-pointer hover:bg-white/20 transition-colors">
                  <i className="ti ti-bookmark text-xs" /> 저장
                </button>
                <button onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2ED573] text-white border-none cursor-pointer hover:bg-[#25B866] transition-colors">
                  <i className="ti ti-copy text-xs" /> 복사
                </button>
              </div>
            </div>
            <p className="text-sm text-white break-all font-mono leading-relaxed">{generatedUrl}</p>
          </div>

          {/* 파라미터 설명 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-3">UTM 파라미터 설명</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-gray-600">파라미터</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600">설명</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600">예시</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="px-3 py-2 font-mono text-xs text-[#2ED573]">utm_source</td><td className="px-3 py-2 text-gray-600">유입 소스 (필수)</td><td className="px-3 py-2 text-gray-400">kakao, instagram, naver</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs text-[#2ED573]">utm_medium</td><td className="px-3 py-2 text-gray-600">매체/방식</td><td className="px-3 py-2 text-gray-400">social, cpc, banner, email</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs text-[#2ED573]">utm_campaign</td><td className="px-3 py-2 text-gray-600">캠페인명</td><td className="px-3 py-2 text-gray-400">spring_event, free_promo</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs text-[#2ED573]">utm_content</td><td className="px-3 py-2 text-gray-600">콘텐츠 구분</td><td className="px-3 py-2 text-gray-400">banner_top, cta_button</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs text-[#2ED573]">utm_term</td><td className="px-3 py-2 text-gray-600">키워드</td><td className="px-3 py-2 text-gray-400">트레이딩, 재테크</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 오른쪽: 저장된 링크 */}
        <div>
          <div className="bg-white rounded-xl shadow-sm p-5 sticky top-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">저장된 링크 ({history.length})</h2>
            {history.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">저장된 링크가 없습니다.</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900">{h.label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { navigator.clipboard.writeText(h.url); toast.success('복사됨') }}
                          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-[#2ED573] bg-transparent border-none cursor-pointer"
                        >
                          <i className="ti ti-copy text-xs" />
                        </button>
                        <button
                          onClick={() => handleDeleteHistory(i)}
                          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer"
                        >
                          <i className="ti ti-x text-xs" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 break-all font-mono">{h.url}</p>
                    <p className="text-[10px] text-gray-300 mt-1">{new Date(h.created).toLocaleDateString('ko-KR')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
