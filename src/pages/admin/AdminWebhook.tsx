import { useState, useEffect, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import { webhookService, defaultWebhookConfig, type WebhookConfig, type WebhookScope } from '../../services/webhookService'
import { supabase } from '../../lib/supabase'

// 기본정보 예약어 (모든 이벤트 공통)
const BASIC_VARS = [
  { name: '상품/랜딩 타이틀', var: '{#TITLE#}', desc: '강의·전자책 제목' },
  { name: '날짜(yyyy.mm.dd)', var: '{#DATE#}', desc: '2026.04.23 (접수 날짜)' },
  { name: '시간(hh:ii)', var: '{#TIME#}', desc: '14:30 (접수 시간)' },
  { name: '시간(hh:ii:ss)', var: '{#TIMES#}', desc: '14:30:05 (접수 시:분:초)' },
  { name: '고유번호', var: '{#DBNO#}', desc: '접수 데이터의 고유번호' },
  { name: '신청자 IP', var: '{#IP#}', desc: '참여 신청자의 접속 IP' },
  { name: '신청자 Agent', var: '{#AGENT#}', desc: 'User-Agent 문자열' },
  { name: '모바일 구분', var: '{#MOBILE#}', desc: 'PC=W, 모바일=M' },
  { name: '유입경로', var: '{#REFERER#}', desc: '신청자의 유입경로' },
]

// 추가정보 예약어 - 공통 (폼 필드 + UTM)
const EXTRA_COMMON_VARS = [
  { name: '항목1(이름)', var: '{#ITEM1#}', desc: '고객 이름' },
  { name: '항목2(연락처)', var: '{#ITEM2#}', desc: '010-xxxx-xxxx' },
  { name: '항목2 하이픈 제거', var: '{#ITEM2_NOH#}', desc: '01012345678 (하이픈 제외)' },
  { name: 'utm_source(출처)', var: '{#U_SO#}', desc: '유입 UTM 출처' },
  { name: 'utm_medium(매체/방식)', var: '{#U_ME#}', desc: '유입 UTM 매체' },
  { name: 'utm_campaign(캠페인)', var: '{#U_CA#}', desc: '유입 UTM 캠페인' },
  { name: 'utm_content(콘텐츠)', var: '{#U_CO#}', desc: '유입 UTM 콘텐츠' },
  { name: 'utm_term(키워드)', var: '{#U_TE#}', desc: '유입 UTM 키워드' },
]

// 회원가입 전용
const SIGNUP_EXTRA_VARS = [
  { name: '이메일', var: '{#email#}', desc: '회원 이메일' },
  { name: '성별', var: '{#gender#}', desc: 'male/female' },
  { name: '주소', var: '{#address#}', desc: '우편번호|주소|상세' },
  { name: '생년월일', var: '{#birth_date#}', desc: 'YYYY-MM-DD' },
  { name: '가입 방법', var: '{#provider#}', desc: 'email/kakao/google' },
]

// 구매 전용
const PURCHASE_EXTRA_VARS = [
  { name: '구매자 이메일', var: '{#user_email#}', desc: '구매자 이메일' },
  { name: '구매자 이름', var: '{#user_name#}', desc: '구매자 이름' },
  { name: '구매자 전화번호', var: '{#user_phone#}', desc: '구매자 전화번호' },
  { name: '결제 금액', var: '{#price#}', desc: '포인트 금액' },
  { name: '상품 유형', var: '{#type#}', desc: 'course 또는 ebook' },
]

interface ProductRef {
  id: number
  title: string
}

interface ReservedVar {
  name: string
  var: string
  desc: string
}

function ReservedWordTable({ title, rows, onInsert, onInsertHeader }: { title: string; rows: ReservedVar[]; onInsert: (v: string) => void; onInsertHeader: (v: string) => void }) {
  const copy = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast.success(`${text} 복사됨`)).catch(() => {})
    }
  }
  return (
    <div>
      <h3 className="text-xs font-bold text-gray-700 mb-2">{title}</h3>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-bold text-gray-600">이름</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">변수명</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">내용</th>
              <th className="px-3 py-2 text-center font-bold text-gray-600 w-28">추가</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((v) => (
              <tr key={v.var} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{v.name}</td>
                <td className="px-3 py-2">
                  <code className="text-[#2ED573] bg-green-50 px-1.5 py-0.5 rounded text-[11px]">{v.var}</code>
                  <button type="button" onClick={() => copy(v.var)} className="ml-1 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer" title="복사">
                    <i className="ti ti-copy text-[11px]" />
                  </button>
                </td>
                <td className="px-3 py-2 text-gray-500">{v.desc}</td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <button onClick={() => onInsert(v.var)} className="px-2 py-1 bg-[#2ED573] text-white text-[10px] font-bold rounded border-none cursor-pointer hover:bg-[#25B866]" title="파라미터에 추가">
                    파라미터
                  </button>
                  <button onClick={() => onInsertHeader(v.var)} className="ml-1 px-2 py-1 bg-gray-600 text-white text-[10px] font-bold rounded border-none cursor-pointer hover:bg-gray-700" title="헤더에 추가">
                    헤더
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminWebhook() {
  const [scope, setScope] = useState<WebhookScope>('global')
  const [scopeId, setScopeId] = useState<number | null>(null)
  const [config, setConfig] = useState<WebhookConfig>({ ...defaultWebhookConfig })
  const [courses, setCourses] = useState<ProductRef[]>([])
  const [ebooks, setEbooks] = useState<ProductRef[]>([])
  const [configuredKeys, setConfiguredKeys] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [headerKey, setHeaderKey] = useState('')
  const [headerValue, setHeaderValue] = useState('')
  const [templateTab, setTemplateTab] = useState<'signup' | 'purchase'>('signup')
  const signupRef = useRef<HTMLTextAreaElement>(null)
  const purchaseRef = useRef<HTMLTextAreaElement>(null)
  const headerRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    (async () => {
      const [{ data: courseData }, { data: ebookData }, configs] = await Promise.all([
        supabase.from('courses').select('id, title').eq('is_published', true).order('id', { ascending: false }),
        supabase.from('ebooks').select('id, title').eq('is_published', true).order('id', { ascending: false }),
        webhookService.listConfigs(),
      ])
      setCourses((courseData as ProductRef[] | null) ?? [])
      setEbooks((ebookData as ProductRef[] | null) ?? [])
      const keys = new Set<string>()
      for (const c of configs) keys.add(`${c.scope}:${c.scope_id ?? ''}`)
      setConfiguredKeys(keys)
    })()
  }, [])

  useEffect(() => {
    setLoading(true)
    webhookService.getConfig(scope, scopeId).then((c) => {
      setConfig(c)
      setLoading(false)
    })
  }, [scope, scopeId])

  const handleSave = async () => {
    if (config.enabled && !config.url) {
      toast.error('수신 URL을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const saved = await webhookService.saveConfig(config)
      setConfig(saved)
      setConfiguredKeys((prev) => new Set(prev).add(`${saved.scope}:${saved.scope_id ?? ''}`))
      toast.success('웹훅 설정이 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!config.id) return
    if (!confirm('이 설정을 삭제하시겠습니까? 삭제하면 기본(global) 설정으로 폴백됩니다.')) return
    try {
      await webhookService.deleteConfig(config.id)
      setConfiguredKeys((prev) => {
        const next = new Set(prev)
        next.delete(`${config.scope}:${config.scope_id ?? ''}`)
        return next
      })
      setConfig({ ...defaultWebhookConfig, scope, scope_id: scopeId })
      toast.success('설정이 삭제되었습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const handleLoadDefault = async () => {
    if (!confirm('기본(global) 설정을 현재 편집창으로 불러옵니다. 저장하지 않은 변경 사항은 사라집니다.')) return
    const global = await webhookService.getConfig('global', null)
    setConfig((c) => ({
      ...c,
      enabled: global.enabled,
      url: global.url,
      method: global.method,
      use_json_header: global.use_json_header,
      header_data: global.header_data,
      headers: global.headers,
      events: global.events,
      use_template: global.use_template,
      signup_template: global.signup_template,
      purchase_template: global.purchase_template,
    }))
    toast.success('기본값을 불러왔습니다. "설정 저장"을 눌러 적용하세요.')
  }

  const handleTest = async (eventType: 'signup' | 'purchase') => {
    if (!config.url) { toast.error('수신 URL을 입력해주세요.'); return }
    if (!confirm(`"${eventType === 'signup' ? '회원가입' : '구매'}" 테스트 데이터를 현재 URL로 전송합니다. 진행할까요?`)) return
    const now = new Date()
    const fakePayload = {
      TITLE: config.label || '[테스트] 상품 또는 랜딩명',
      ITEM1: '테스트유저',
      ITEM2: '010-1234-5678',
      ITEM2_NOH: '01012345678',
      DATE: now.toLocaleDateString('ko-KR'),
      TIME: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      TIMES: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      MOBILE: 'W',
      REFERER: '(test)',
      U_SO: 'test', U_ME: 'test', U_CA: 'test', U_CO: 'test', U_TE: 'test',
      name: '테스트유저', email: 'test@example.com', phone: '010-1234-5678',
      gender: 'male', address: '12345|서울|테스트동', birth_date: '1990-01-01', provider: 'email',
      user_name: '테스트유저', user_email: 'test@example.com', user_phone: '010-1234-5678',
      title: config.label || '[테스트] 상품명', price: 10000, type: 'course',
    }

    try {
      const { data, error } = await supabase.functions.invoke('webhook-send', {
        body: {
          event: eventType,
          payload: fakePayload,
          test_mode: true,
          config_override: {
            id: 0,
            scope: 'global',
            scope_id: null,
            enabled: true,
            url: config.url,
            method: config.method,
            use_json_header: config.use_json_header,
            header_data: config.header_data,
            headers: config.headers,
            events: config.events,
            signup_template: config.signup_template,
            purchase_template: config.purchase_template,
          },
        },
      })
      if (error) {
        toast.error(`테스트 실패: ${error.message}`)
        return
      }
      const result = data as { status?: string; response_status?: number; response_body?: string; error_message?: string }
      if (result.status === 'success') {
        toast.success(`전송 성공 (HTTP ${result.response_status ?? '?'})`)
      } else {
        toast.error(`전송 실패 (HTTP ${result.response_status ?? '?'}): ${(result.response_body || result.error_message || '').slice(0, 120)}`, { duration: 6000 })
      }
    } catch (err) {
      toast.error(`Edge Function 호출 실패: ${err instanceof Error ? err.message : ''}`)
    }
  }

  const handleSaveAsDefault = async () => {
    if (!confirm('현재 입력값을 기본(global) 설정으로 저장합니다. 기존 기본값은 덮어씌워집니다.')) return
    setSaving(true)
    try {
      await webhookService.saveConfig({
        ...config,
        id: undefined,
        scope: 'global',
        scope_id: null,
      })
      setConfiguredKeys((prev) => new Set(prev).add('global:'))
      toast.success('기본값으로 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const insertIntoRef = (ref: React.RefObject<HTMLTextAreaElement | null>, field: 'signup_template' | 'purchase_template' | 'header_data', v: string) => {
    const el = ref.current
    if (el) {
      const start = el.selectionStart
      const end = el.selectionEnd
      const current = config[field]
      const newVal = current.slice(0, start) + v + current.slice(end)
      setConfig((c) => ({ ...c, [field]: newVal }))
      setTimeout(() => {
        el.focus()
        el.selectionStart = el.selectionEnd = start + v.length
      }, 0)
    } else {
      setConfig((c) => ({ ...c, [field]: c[field] + v }))
    }
  }

  const insertVar = (v: string) => {
    if (templateTab === 'signup') insertIntoRef(signupRef, 'signup_template', v)
    else insertIntoRef(purchaseRef, 'purchase_template', v)
  }

  const insertHeaderVar = (v: string) => insertIntoRef(headerRef, 'header_data', v)

  const addHeader = () => {
    if (!headerKey.trim()) return
    setConfig((c) => ({ ...c, headers: { ...c.headers, [headerKey.trim()]: headerValue } }))
    setHeaderKey('')
    setHeaderValue('')
  }

  const removeHeader = (key: string) => {
    setConfig((c) => {
      const h = { ...c.headers }
      delete h[key]
      return { ...c, headers: h }
    })
  }

  const scopeKey = `${scope}:${scopeId ?? ''}`
  const hasOverride = configuredKeys.has(scopeKey) && scope !== 'global'
  const extraVars = useMemo(() => {
    if (templateTab === 'signup') return [...EXTRA_COMMON_VARS, ...SIGNUP_EXTRA_VARS]
    return [...EXTRA_COMMON_VARS, ...PURCHASE_EXTRA_VARS]
  }, [templateTab])

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[#2ED573] rounded-full animate-spin" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">웹훅 (CRM 연동)</h1>
        <p className="text-sm text-gray-500 mt-1">회원가입·구매 시 외부 CRM으로 데이터를 자동 전송합니다. 상품별로 다른 설정을 사용할 수 있습니다.</p>
      </div>

      {/* Scope Selector */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-600 whitespace-nowrap">설정 대상</span>
          <button
            onClick={() => { setScope('global'); setScopeId(null) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${scope === 'global' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
          >
            기본 (global)
          </button>
          <button
            onClick={() => { setScope('course'); setScopeId(courses[0]?.id ?? null) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${scope === 'course' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
          >
            강의별
          </button>
          <button
            onClick={() => { setScope('ebook'); setScopeId(ebooks[0]?.id ?? null) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${scope === 'ebook' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
          >
            전자책별
          </button>
          {scope !== 'global' && (
            <select
              value={scopeId ?? ''}
              onChange={(e) => setScopeId(e.target.value ? Number(e.target.value) : null)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#2ED573] ml-2"
            >
              <option value="">— 선택 —</option>
              {(scope === 'course' ? courses : ebooks).map((p) => {
                const k = `${scope}:${p.id}`
                const marked = configuredKeys.has(k)
                return (
                  <option key={p.id} value={p.id}>{marked ? '● ' : '○ '}{p.title}</option>
                )
              })}
            </select>
          )}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {scope !== 'global' && (
              <>
                <button
                  type="button"
                  onClick={handleLoadDefault}
                  className="text-[11px] text-gray-700 bg-white border border-gray-200 hover:border-gray-400 rounded-md px-2.5 py-1 font-medium cursor-pointer"
                  title="기본(global) 설정을 현재 편집창으로 불러옵니다"
                >
                  <i className="ti ti-download mr-1" />기본값 불러오기
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsDefault}
                  disabled={saving}
                  className="text-[11px] text-white bg-gray-700 hover:bg-gray-800 rounded-md px-2.5 py-1 font-medium cursor-pointer border-none disabled:opacity-50"
                  title="현재 입력값을 기본(global) 설정으로도 저장합니다"
                >
                  <i className="ti ti-bookmark-plus mr-1" />기본값 등록하기
                </button>
              </>
            )}
            {hasOverride && (
              <span className="text-[11px] text-blue-600 bg-blue-50 rounded-full px-2.5 py-1">개별 설정 적용 중</span>
            )}
            {scope === 'global' && (
              <span className="text-[11px] text-gray-500 bg-gray-50 rounded-full px-2.5 py-1">기본 설정 (모든 상품 폴백)</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* 기본 설정 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-gray-900">기본 설정</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-500">{config.enabled ? '활성화' : '비활성화'}</span>
              <button
                type="button"
                onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
                className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer border-none ${config.enabled ? 'bg-[#2ED573]' : 'bg-gray-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${config.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">라벨 (관리용, 선택)</label>
              <input
                value={config.label}
                onChange={(e) => setConfig((c) => ({ ...c, label: e.target.value }))}
                placeholder="예: 캠페인 트리거 발송"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">수신 URL</label>
              <input
                value={config.url}
                onChange={(e) => setConfig((c) => ({ ...c, url: e.target.value }))}
                placeholder="https://..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] font-mono"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">전송 방식</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfig((c) => ({ ...c, method: 'POST' }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${config.method === 'POST' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                  POST
                </button>
                <button type="button" onClick={() => setConfig((c) => ({ ...c, method: 'GET' }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${config.method === 'GET' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                  GET
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">Content-Type</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfig((c) => ({ ...c, use_json_header: true }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${config.use_json_header ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                  application/json
                </button>
                <button type="button" onClick={() => setConfig((c) => ({ ...c, use_json_header: false }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${!config.use_json_header ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                  form-urlencoded
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">이벤트 트리거</label>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={config.events.signup}
                    onChange={(e) => setConfig((c) => ({ ...c, events: { ...c.events, signup: e.target.checked } }))}
                    className="accent-[#2ED573]" />
                  <span className="text-sm text-gray-700">회원가입</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={config.events.purchase}
                    onChange={(e) => setConfig((c) => ({ ...c, events: { ...c.events, purchase: e.target.checked } }))}
                    className="accent-[#2ED573]" />
                  <span className="text-sm text-gray-700">구매</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 특수 전송 헤더 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-1">특수 전송 헤더 (Header)</h2>
          <p className="text-xs text-gray-400 mb-3">외부 주소로 전달할 헤더. key=value&amp;key=value 형식. 예약어 사용 가능.</p>
          <textarea
            ref={headerRef}
            value={config.header_data}
            onChange={(e) => setConfig((c) => ({ ...c, header_data: e.target.value }))}
            placeholder="Authorization=Bearer ak_xxxxxxxxxxxxxxxxxxxxxxxx"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] font-mono resize-none mb-3"
          />

          <h3 className="text-xs font-bold text-gray-700 mb-2 mt-4">추가 헤더 (key-value)</h3>
          <div className="flex gap-2 mb-3">
            <input value={headerKey} onChange={(e) => setHeaderKey(e.target.value)}
              placeholder="Header Key" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
            <input value={headerValue} onChange={(e) => setHeaderValue(e.target.value)}
              placeholder="Header Value" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
            <button onClick={addHeader} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg border-none cursor-pointer hover:bg-gray-200">추가</button>
          </div>
          {Object.entries(config.headers).length > 0 && (
            <div className="space-y-1.5">
              {Object.entries(config.headers).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <code className="text-xs text-gray-600 flex-1">{k}: {v}</code>
                  <button onClick={() => removeHeader(k)} className="text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer">
                    <i className="ti ti-x text-xs" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 전달 파라미터 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-1">전달 파라미터</h2>
          <p className="text-xs text-gray-400 mb-4">외부 주소로 전달할 정보를 설정합니다. 예약어를 활용해 발송 내용을 만드세요. JSON 또는 <code>key=value&amp;key=value</code> 형식 지원.</p>

          <div className="flex gap-2 mb-3">
            <button onClick={() => setTemplateTab('signup')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${templateTab === 'signup' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
              회원가입
            </button>
            <button onClick={() => setTemplateTab('purchase')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${templateTab === 'purchase' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
              구매
            </button>
          </div>

          {/* 템플릿 에디터 (위) */}
          <textarea
            ref={templateTab === 'signup' ? signupRef : purchaseRef}
            value={templateTab === 'signup' ? config.signup_template : config.purchase_template}
            onChange={(e) => setConfig((c) => ({ ...c, [templateTab === 'signup' ? 'signup_template' : 'purchase_template']: e.target.value }))}
            placeholder={templateTab === 'signup'
              ? '예:\ncampaignId=CAMPAIGN_ID&phone={#ITEM2_NOH#}&고객명={#ITEM1#}&이메일={#email#}'
              : '예:\ncampaignId=CAMPAIGN_ID&phone={#ITEM2_NOH#}&고객명={#ITEM1#}&상품={#TITLE#}'}
            rows={10}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] font-mono resize-none"
          />
          <p className="text-[11px] text-gray-500 mt-2">* 전달 파라미터 항목은 <code>&amp;</code>(앤퍼센드)로 구분합니다. 예약어는 아래 테이블에서 추가하세요.</p>

          {/* 예약어 테이블 (아래, 좌우 2섹션) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
            <ReservedWordTable title="기본정보 예약어" rows={BASIC_VARS} onInsert={insertVar} onInsertHeader={insertHeaderVar} />
            <ReservedWordTable title={`추가정보 예약어 (${templateTab === 'signup' ? '회원가입' : '구매'})`} rows={extraVars} onInsert={insertVar} onInsertHeader={insertHeaderVar} />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] disabled:opacity-50">
            {saving ? '저장 중...' : '설정 저장'}
          </button>
          <button onClick={() => handleTest(templateTab)} disabled={!config.url}
            className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-gray-800 disabled:opacity-50">
            <i className="ti ti-send mr-1.5" />테스트 전송 ({templateTab === 'signup' ? '회원가입' : '구매'})
          </button>
          {config.id && scope !== 'global' && (
            <button onClick={handleDelete}
              className="bg-red-50 text-red-600 px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border border-red-200 hover:bg-red-100 ml-auto">
              이 설정 삭제
            </button>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
