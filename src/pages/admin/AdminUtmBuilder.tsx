import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import { supabase } from '../../lib/supabase'

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

// 예전 버전이 브라우저에만 저장하던 링크 — 보관함으로 가져오기용
const LEGACY_HISTORY_KEY = 'utm_history'

interface UtmParams {
  baseUrl: string
  customUrl: string
  source: string
  medium: string
  campaign: string
  content: string
  term: string
}

interface Option { id: number; name: string; instructor_id?: number | null }

interface UtmLink {
  id: number
  url: string
  landing_path: string
  utm_source: string
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  instructor_id: number | null
  course_id: number | null
  ebook_id: number | null
  memo: string | null
  created_at: string
}

/** 저장된 URL 에서 경로·UTM 을 다시 읽음 (예전 브라우저 저장분 가져오기) */
function parseUtmUrl(url: string) {
  try {
    const u = new URL(url)
    const q = u.searchParams
    return {
      landing_path: u.pathname,
      utm_source: q.get('utm_source') || '',
      utm_medium: q.get('utm_medium'),
      utm_campaign: q.get('utm_campaign'),
      utm_content: q.get('utm_content'),
      utm_term: q.get('utm_term'),
    }
  } catch {
    return null
  }
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
  // 기록 정보 — 어떤 강사의 어떤 강의/전자책에서 어떻게 쓴 링크인지
  const [instructorId, setInstructorId] = useState<number | ''>('')
  const [target, setTarget] = useState('') // 'course:12' | 'ebook:3' | ''
  const [memo, setMemo] = useState('')

  const [instructors, setInstructors] = useState<Option[]>([])
  const [courses, setCourses] = useState<Option[]>([])
  const [ebooks, setEbooks] = useState<Option[]>([])
  const [links, setLinks] = useState<UtmLink[]>([])
  const [linksLoading, setLinksLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [legacyCount, setLegacyCount] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem(LEGACY_HISTORY_KEY) || '[]') as unknown[]).length
    } catch { return 0 }
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

  // 첫 로딩만 스켈레톤(linksLoading 초기값 true) — 저장/가져오기 후 재조회는 목록을 그대로 둔 채 갱신
  const fetchLinks = useCallback(() => {
    supabase
      .from('utm_links' as never)
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error('저장된 링크를 불러오지 못했습니다.')
        setLinks((data ?? []) as unknown as UtmLink[])
        setLinksLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchLinks()
    Promise.all([
      supabase.from('instructors').select('id, name').order('name'),
      supabase.from('courses').select('id, title, instructor_id').order('id', { ascending: false }),
      supabase.from('ebooks').select('id, title, instructor_id').order('id', { ascending: false }),
    ]).then(([ins, crs, ebs]) => {
      setInstructors(((ins.data ?? []) as { id: number; name: string }[]).map((r) => ({ id: r.id, name: r.name })))
      setCourses(((crs.data ?? []) as { id: number; title: string; instructor_id: number | null }[]).map((r) => ({ id: r.id, name: r.title, instructor_id: r.instructor_id })))
      setEbooks(((ebs.data ?? []) as { id: number; title: string; instructor_id: number | null }[]).map((r) => ({ id: r.id, name: r.title, instructor_id: r.instructor_id })))
    })
  }, [fetchLinks])

  const instructorName = useMemo(() => new Map(instructors.map((i) => [i.id, i.name])), [instructors])
  const courseName = useMemo(() => new Map(courses.map((c) => [c.id, c.name])), [courses])
  const ebookName = useMemo(() => new Map(ebooks.map((e) => [e.id, e.name])), [ebooks])

  // 강사를 고르면 그 강사의 강의/전자책만 보여줌
  const targetCourses = instructorId ? courses.filter((c) => c.instructor_id === instructorId) : courses
  const targetEbooks = instructorId ? ebooks.filter((e) => e.instructor_id === instructorId) : ebooks

  const handleTargetChange = (value: string) => {
    setTarget(value)
    // 강의/전자책을 고르고 강사를 비워 뒀다면 그 상품의 강사로 채움
    const [kind, idStr] = value.split(':')
    const item = (kind === 'course' ? courses : ebooks).find((x) => x.id === Number(idStr))
    if (item?.instructor_id && !instructorId) setInstructorId(item.instructor_id)
  }

  const useTargetAsLanding = () => {
    const [kind, id] = target.split(':')
    if (!id) return
    update('customUrl', `/${kind}/${id}`)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedUrl)
    toast.success('URL이 복사되었습니다.')
  }

  const handleSave = async () => {
    if (!params.source) { toast.error('소스를 입력해주세요.'); return }
    if (saving) return
    setSaving(true)
    const [kind, idStr] = target.split(':')
    const { error } = await supabase.from('utm_links' as never).insert({
      url: generatedUrl,
      landing_path: path,
      utm_source: params.source,
      utm_medium: params.medium || null,
      utm_campaign: params.campaign || null,
      utm_content: params.content || null,
      utm_term: params.term || null,
      instructor_id: instructorId || null,
      course_id: kind === 'course' ? Number(idStr) : null,
      ebook_id: kind === 'ebook' ? Number(idStr) : null,
      memo: memo.trim() || null,
    } as never)
    setSaving(false)
    if (error) { toast.error('저장에 실패했습니다.'); return }
    toast.success('보관함에 저장되었습니다.')
    setMemo('')
    fetchLinks()
  }

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('utm_links' as never).delete().eq('id', id)
    if (error) { toast.error('삭제에 실패했습니다.'); return }
    setLinks((prev) => prev.filter((l) => l.id !== id))
  }

  // 예전 버전(브라우저 저장) 링크를 보관함으로 이전 — 성공하면 브라우저 저장분은 비움
  const importLegacy = async () => {
    let legacy: { url: string; created?: string }[] = []
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_HISTORY_KEY) || '[]') } catch { /* 무시 */ }
    const rows = legacy
      .map((h) => {
        const p = parseUtmUrl(h.url)
        return p?.utm_source ? { url: h.url, ...p, memo: '이전 브라우저 저장분', created_at: h.created || new Date().toISOString() } : null
      })
      .filter(Boolean)
    if (rows.length === 0) { toast.error('가져올 링크가 없습니다.'); return }
    const { error } = await supabase.from('utm_links' as never).insert(rows as never)
    if (error) { toast.error('가져오기에 실패했습니다.'); return }
    localStorage.removeItem(LEGACY_HISTORY_KEY)
    setLegacyCount(0)
    toast.success(`${rows.length}개 링크를 보관함으로 가져왔습니다.`)
    fetchLinks()
  }

  const update = (key: keyof UtmParams, value: string) => setParams((p) => ({ ...p, [key]: value }))

  const targetLabel = (l: UtmLink) =>
    l.course_id ? `강의 · ${courseName.get(l.course_id) ?? `#${l.course_id}`}`
      : l.ebook_id ? `전자책 · ${ebookName.get(l.ebook_id) ?? `#${l.ebook_id}`}`
        : ''

  const q = search.trim().toLowerCase()
  const filteredLinks = q
    ? links.filter((l) => [
      l.url, l.memo, l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content, l.utm_term,
      l.instructor_id ? instructorName.get(l.instructor_id) : '', targetLabel(l),
    ].some((v) => (v ?? '').toLowerCase().includes(q)))
    : links

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] bg-white'

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">UTM 링크 생성</h1>
        <p className="text-sm text-gray-500 mt-1">마케팅 채널별 유입 추적을 위한 UTM 링크를 생성하고, 어디에 쓴 링크인지 함께 보관합니다.</p>
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
                      onClick={() => { update('baseUrl', u.value); update('customUrl', '') }}
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
                  className={inputCls}
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
                  className={inputCls} />
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
                  className={inputCls} />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1.5">utm_campaign <span className="text-xs font-normal text-gray-400">캠페인명</span></label>
                <input value={params.campaign} onChange={(e) => update('campaign', e.target.value)}
                  placeholder="예: 2026_spring_event, free_ebook_promo"
                  className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1.5">utm_content <span className="text-xs font-normal text-gray-400">콘텐츠 구분</span></label>
                  <input value={params.content} onChange={(e) => update('content', e.target.value)}
                    placeholder="예: banner_top, cta_button"
                    className={inputCls} />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1.5">utm_term <span className="text-xs font-normal text-gray-400">키워드</span></label>
                  <input value={params.term} onChange={(e) => update('term', e.target.value)}
                    placeholder="예: 트레이딩, 재테크"
                    className={inputCls} />
                </div>
              </div>
            </div>
          </div>

          {/* 기록 정보 — 보관함에 함께 저장 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-1">기록 정보</h2>
            <p className="text-xs text-gray-400 mb-4">어떤 강사의 어떤 강의·전자책에서 어떻게 쓴 링크인지 남겨 두면, 나중에 수강생 목록의 유입 경로를 보고 바로 찾을 수 있습니다.</p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="utm-instructor" className="text-sm font-bold text-gray-700 block mb-1.5">강사</label>
                  <select id="utm-instructor" value={instructorId}
                    onChange={(e) => { setInstructorId(e.target.value ? Number(e.target.value) : ''); setTarget('') }}
                    className={inputCls}>
                    <option value="">선택 안 함</option>
                    {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="utm-target" className="text-sm font-bold text-gray-700 block mb-1.5">강의 / 전자책</label>
                  <select id="utm-target" value={target} onChange={(e) => handleTargetChange(e.target.value)} className={inputCls}>
                    <option value="">선택 안 함</option>
                    {targetCourses.length > 0 && (
                      <optgroup label="강의">
                        {targetCourses.map((c) => <option key={`c${c.id}`} value={`course:${c.id}`}>{c.name}</option>)}
                      </optgroup>
                    )}
                    {targetEbooks.length > 0 && (
                      <optgroup label="전자책">
                        {targetEbooks.map((e) => <option key={`e${e.id}`} value={`ebook:${e.id}`}>{e.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                  {target && (
                    <button type="button" onClick={useTargetAsLanding}
                      className="mt-1.5 text-xs text-[#2ED573] bg-transparent border-none p-0 cursor-pointer hover:underline">
                      이 상세 페이지를 랜딩으로 사용
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="utm-memo" className="text-sm font-bold text-gray-700 block mb-1.5">활용 메모</label>
                <textarea id="utm-memo" value={memo} onChange={(e) => setMemo(e.target.value)} rows={2}
                  placeholder="예: 인스타 릴스 프로필 링크 / 10월 무료특강 카톡 공지 / 메타 광고 소재 B"
                  className={`${inputCls} resize-y`} />
              </div>
            </div>
          </div>

          {/* 생성된 URL */}
          <div className="bg-gray-900 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 font-medium">생성된 URL</p>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white border-none cursor-pointer hover:bg-white/20 transition-colors disabled:opacity-50">
                  <i className="ti ti-bookmark text-xs" /> {saving ? '저장 중...' : '보관함에 저장'}
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

        {/* 오른쪽: UTM 보관함 */}
        <div>
          <div className="bg-white rounded-xl shadow-sm p-5 sticky top-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">UTM 보관함 ({links.length})</h2>
            {legacyCount > 0 && (
              <button type="button" onClick={importLegacy}
                className="w-full mb-3 text-xs px-3 py-2 rounded-lg border border-dashed border-[#2ED573] text-[#2ED573] bg-white cursor-pointer hover:bg-emerald-50">
                이 브라우저에 저장된 예전 링크 {legacyCount}개 가져오기
              </button>
            )}
            <div className="relative mb-3">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="강사·강의·캠페인·메모 검색"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-[#2ED573]" />
            </div>
            {linksLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-lg" />)}</div>
            ) : filteredLinks.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">{q ? '검색 결과가 없습니다.' : '저장된 링크가 없습니다.'}</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredLinks.map((l) => (
                  <div key={l.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-900 break-all">
                        {l.utm_source}{l.utm_medium ? ` / ${l.utm_medium}` : ''}{l.utm_campaign ? ` · ${l.utm_campaign}` : ''}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { navigator.clipboard.writeText(l.url); toast.success('복사됨') }}
                          aria-label="링크 복사"
                          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-[#2ED573] bg-transparent border-none cursor-pointer"
                        >
                          <i className="ti ti-copy text-xs" />
                        </button>
                        <button
                          onClick={() => handleDelete(l.id)}
                          aria-label="링크 삭제"
                          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer"
                        >
                          <i className="ti ti-x text-xs" />
                        </button>
                      </div>
                    </div>
                    {(l.instructor_id || l.course_id || l.ebook_id) && (
                      <p className="text-[11px] text-gray-600">
                        {l.instructor_id ? instructorName.get(l.instructor_id) ?? `강사 #${l.instructor_id}` : ''}
                        {l.instructor_id && (l.course_id || l.ebook_id) ? ' · ' : ''}
                        {targetLabel(l)}
                      </p>
                    )}
                    {l.memo && <p className="text-[11px] text-gray-500 mt-0.5 whitespace-pre-wrap">{l.memo}</p>}
                    <p className="text-[10px] text-gray-400 break-all font-mono mt-1">{l.url}</p>
                    <p className="text-[10px] text-gray-300 mt-1">{new Date(l.created_at).toLocaleDateString('ko-KR')}</p>
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
