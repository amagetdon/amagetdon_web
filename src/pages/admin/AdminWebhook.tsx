import { useState, useEffect, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import { webhookService, defaultWebhookConfig, type WebhookConfig } from '../../services/webhookService'
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

interface CustomEvent {
  id?: number
  code: string
  label: string
  description: string | null
  trigger_hint: string | null
  template: string
  enabled: boolean
  built_in: boolean
  sort_order: number
}

export default function AdminWebhook() {
  const [config, setConfig] = useState<WebhookConfig>({ ...defaultWebhookConfig })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [headerKey, setHeaderKey] = useState('')
  const [headerValue, setHeaderValue] = useState('')
  type TabId = 'signup' | 'purchase' | 'purchase_free' | 'purchase_premium' | 'coupon_issued' | 'coupon_expiring_d3' | 'coupon_expiring_d1' | 'coupon_expired' | 'point_charge'
  const TABS: Array<{ id: TabId; label: string; isCustom: boolean }> = [
    { id: 'signup', label: '회원가입', isCustom: false },
    { id: 'purchase', label: '구매 (공통)', isCustom: false },
    { id: 'purchase_free', label: '무료 구매', isCustom: true },
    { id: 'purchase_premium', label: '유료 구매', isCustom: true },
    { id: 'coupon_issued', label: '쿠폰 발급', isCustom: true },
    { id: 'coupon_expiring_d3', label: '쿠폰 D-3', isCustom: true },
    { id: 'coupon_expiring_d1', label: '쿠폰 D-1', isCustom: true },
    { id: 'coupon_expired', label: '쿠폰 만료', isCustom: true },
    { id: 'point_charge', label: '포인트 충전', isCustom: true },
  ]
  const [templateTab, setTemplateTab] = useState<TabId>('signup')
  const [testPhone, setTestPhone] = useState<string>(() => (typeof window !== 'undefined' ? window.localStorage.getItem('webhook_test_phone') || '' : ''))
  const [testResult, setTestResult] = useState<{ status?: string; response_status?: number; response_body?: string; request_url?: string; request_body?: string; error_message?: string } | null>(null)
  const signupRef = useRef<HTMLTextAreaElement>(null)
  const purchaseRef = useRef<HTMLTextAreaElement>(null)
  const headerRef = useRef<HTMLTextAreaElement>(null)

  // 커스텀 이벤트
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([])
  const [customEditing, setCustomEditing] = useState<Partial<CustomEvent> | null>(null)

  // cron 스케줄
  const [cronInfo, setCronInfo] = useState<{ schedule: string; active: boolean; last_run: string | null; last_status: string | null } | null>(null)
  const [cronExists, setCronExists] = useState(false)
  const [cronHour, setCronHour] = useState(9)
  const [cronMinute, setCronMinute] = useState(0)
  const [cronSaving, setCronSaving] = useState(false)

  const fetchCustomEvents = async () => {
    const list = await webhookService.listCustomEvents()
    setCustomEvents(list as CustomEvent[])
  }

  const fetchCronInfo = async () => {
    try {
      const info = await webhookService.getCronSchedule('coupon-expiry-scanner-daily')
      setCronInfo(info)
      setCronExists(!!info)
      if (info) {
        // cron expression: "min hour * * *" → KST = (UTC hour + 9) % 24
        const parts = info.schedule.split(/\s+/)
        if (parts.length >= 2) {
          const m = parseInt(parts[0], 10)
          const utcH = parseInt(parts[1], 10)
          if (!isNaN(m) && !isNaN(utcH)) {
            setCronMinute(m)
            setCronHour((utcH + 9) % 24)
          }
        }
      }
    } catch {
      setCronInfo(null)
      setCronExists(false)
    }
  }

  const handleSaveCron = async () => {
    setCronSaving(true)
    try {
      await webhookService.updateCronSchedule('coupon-expiry-scanner-daily', cronHour, cronMinute)
      toast.success(`발송 시각이 매일 ${String(cronHour).padStart(2, '0')}:${String(cronMinute).padStart(2, '0')} (KST)로 변경되었습니다.`)
      fetchCronInfo()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '변경 실패')
    } finally {
      setCronSaving(false)
    }
  }

  const handleToggleCron = async () => {
    if (!cronInfo) return
    try {
      await webhookService.setCronActive('coupon-expiry-scanner-daily', !cronInfo.active)
      toast.success(`스케줄이 ${cronInfo.active ? '비활성화' : '활성화'}되었습니다.`)
      fetchCronInfo()
    } catch {
      toast.error('변경 실패')
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      webhookService.getConfig('global', null).then(setConfig),
      fetchCustomEvents(),
      fetchCronInfo(),
    ]).finally(() => setLoading(false))
  }, [])

  const handleSaveCustom = async () => {
    if (!customEditing) return
    if (!customEditing.code?.trim()) { toast.error('이벤트 코드를 입력해주세요.'); return }
    if (!customEditing.label?.trim()) { toast.error('이름을 입력해주세요.'); return }
    if (!/^[a-z0-9_]+$/i.test(customEditing.code)) {
      toast.error('코드는 영문/숫자/언더스코어만 사용 가능합니다.')
      return
    }
    try {
      await webhookService.upsertCustomEvent({
        id: customEditing.id,
        code: customEditing.code,
        label: customEditing.label,
        description: customEditing.description ?? '',
        trigger_hint: customEditing.trigger_hint ?? '',
        template: customEditing.template ?? '',
        enabled: customEditing.enabled ?? true,
        sort_order: customEditing.sort_order ?? 0,
      })
      toast.success('저장되었습니다.')
      setCustomEditing(null)
      fetchCustomEvents()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '저장 실패'
      toast.error(msg.includes('duplicate') || msg.includes('unique') ? '이미 존재하는 코드입니다.' : '저장 실패')
    }
  }

  const handleDeleteCustom = async (id: number, code: string) => {
    if (!confirm(`커스텀 이벤트 "${code}"을 삭제하시겠습니까?`)) return
    try {
      await webhookService.deleteCustomEvent(id)
      toast.success('삭제됨')
      fetchCustomEvents()
    } catch {
      toast.error('삭제 실패')
    }
  }

  const handleTestCustom = async (ce: CustomEvent) => {
    if (!config.url) { toast.error('수신 URL이 설정되지 않았습니다.'); return }
    try {
      const fakePayload = {
        ITEM1: '테스트유저', ITEM2: '010-1234-5678', ITEM2_NOH: '01012345678',
        TITLE: ce.label,
        DATE: new Date().toLocaleDateString('ko-KR'),
        TIME: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
        name: '테스트유저', user_name: '테스트유저', phone: '010-1234-5678', user_phone: '010-1234-5678',
        email: 'test@example.com', user_email: 'test@example.com',
        coupon_name: '[테스트] 쿠폰 10,000원 할인', coupon_value: 10000, expires_at: '2026-12-31',
        point_amount: 10000, point_balance: 50000,
      }
      const { data } = await supabase.functions.invoke('webhook-send', {
        body: {
          event: 'custom',
          custom_event_code: ce.code,
          custom_template_override: ce.template,
          payload: fakePayload,
          test_mode: true,
        },
      })
      const result = data as { status?: string; response_status?: number; error_message?: string; response_body?: string }
      if (result.status === 'success') toast.success(`전송 성공 (HTTP ${result.response_status ?? '?'})`)
      else toast.error(`전송 실패: ${result.error_message || result.response_body || '알 수 없음'}`, { duration: 6000 })
    } catch (err) {
      toast.error(`Edge Function 호출 실패: ${err instanceof Error ? err.message : ''}`)
    }
  }

  const handleSave = async () => {
    if (config.enabled && !config.url) {
      toast.error('수신 URL을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const saved = await webhookService.saveConfig({ ...config, scope: 'global', scope_id: null })
      setConfig(saved)
      toast.success('웹훅 설정이 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (tab: TabId) => {
    if (!config.url) { toast.error('수신 URL을 입력해주세요.'); return }
    const phone = (testPhone || '').replace(/[^\d]/g, '')
    if (phone && (phone.length < 10 || phone.length > 11)) {
      toast.error('올바른 전화번호를 입력해주세요. (예: 01012345678)')
      return
    }
    const usePhone = phone || '01012345678'
    const usePhoneFmt = usePhone.length === 11 ? `${usePhone.slice(0, 3)}-${usePhone.slice(3, 7)}-${usePhone.slice(7)}` : `${usePhone.slice(0, 3)}-${usePhone.slice(3, 6)}-${usePhone.slice(6)}`
    if (!confirm(`테스트 데이터를 ${usePhoneFmt}로 발송합니다.\n(shoong이 실제 알림톡을 보낼 수 있는 번호여야 합니다)\n진행할까요?`)) return

    if (typeof window !== 'undefined') window.localStorage.setItem('webhook_test_phone', testPhone)

    const now = new Date()
    const labelByTab = TABS.find((t) => t.id === tab)?.label ?? tab
    const fakePayload = {
      TITLE: config.label || `[테스트] ${labelByTab}`,
      ITEM1: '테스트유저', ITEM2: usePhoneFmt, ITEM2_NOH: usePhone,
      DATE: now.toLocaleDateString('ko-KR'),
      TIME: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      TIMES: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      MOBILE: 'W', REFERER: '(test)',
      U_SO: 'test', U_ME: 'test', U_CA: 'test', U_CO: 'test', U_TE: 'test',
      name: '테스트유저', email: 'test@example.com', phone: usePhoneFmt,
      gender: 'male', address: '12345|서울|테스트동', birth_date: '1990-01-01', provider: 'email',
      user_name: '테스트유저', user_email: 'test@example.com', user_phone: usePhoneFmt,
      title: config.label || `[테스트] ${labelByTab}`, price: tab === 'purchase_free' ? 0 : 10000, type: 'course',
      coupon_name: '[테스트] 쿠폰', coupon_value: '10,000원', expires_at: '2026-12-31',
    }

    try {
      const isCustom = TABS.find((t) => t.id === tab)?.isCustom ?? false
      const customTpl = customEvents.find((c) => c.code === tab)?.template ?? ''
      const { data, error } = await supabase.functions.invoke('webhook-send', {
        body: isCustom ? {
          event: 'custom',
          custom_event_code: tab,
          custom_template_override: customTpl,
          payload: fakePayload,
          test_mode: true,
          config_override: { id: 0, scope: 'global', scope_id: null, enabled: true, url: config.url, method: config.method, use_json_header: config.use_json_header, header_data: config.header_data, headers: config.headers, events: config.events, signup_template: '', purchase_template: '' },
        } : {
          event: tab,
          payload: fakePayload,
          test_mode: true,
          config_override: {
            id: 0, scope: 'global', scope_id: null, enabled: true,
            url: config.url, method: config.method,
            use_json_header: config.use_json_header, header_data: config.header_data, headers: config.headers,
            events: config.events,
            signup_template: config.signup_template, purchase_template: config.purchase_template,
          },
        },
      })
      if (error) {
        toast.error(`테스트 실패: ${error.message}`)
        setTestResult({ error_message: error.message })
        return
      }
      const result = data as { status?: string; response_status?: number; response_body?: string; request_url?: string; request_body?: string; error_message?: string }
      setTestResult(result)
      if (result.status === 'success') {
        toast.success(`전송 성공 (HTTP ${result.response_status ?? '?'}). 아래에서 응답 본문 확인.`)
      } else {
        toast.error(`전송 실패 (HTTP ${result.response_status ?? '?'}): ${(result.response_body || result.error_message || '').slice(0, 120)}`, { duration: 6000 })
      }
    } catch (err) {
      toast.error(`Edge Function 호출 실패: ${err instanceof Error ? err.message : ''}`)
      setTestResult({ error_message: err instanceof Error ? err.message : String(err) })
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

  const extraVars = useMemo(() => {
    if (templateTab === 'signup') return [...EXTRA_COMMON_VARS, ...SIGNUP_EXTRA_VARS]
    return [...EXTRA_COMMON_VARS, ...PURCHASE_EXTRA_VARS]
  }, [templateTab])

  // 빌트인 커스텀 이벤트 탭은 webhook_custom_events 사용
  const isCustomTab = TABS.find((t) => t.id === templateTab)?.isCustom ?? false
  const customEventForTab = customEvents.find((ce) => ce.code === templateTab)
  const currentTemplate = isCustomTab
    ? (customEventForTab?.template ?? '')
    : (templateTab === 'signup' ? config.signup_template : config.purchase_template)
  const setCurrentTemplate = (val: string) => {
    if (isCustomTab) {
      setCustomEvents((list) => list.map((e) => e.code === templateTab ? { ...e, template: val } : e))
    } else if (templateTab === 'signup') {
      setConfig((c) => ({ ...c, signup_template: val }))
    } else {
      setConfig((c) => ({ ...c, purchase_template: val }))
    }
  }
  const handleSaveCurrentTemplate = async () => {
    if (config.enabled && !config.url) {
      toast.error('수신 URL을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      // 1) 글로벌 설정 저장 (URL · 인증 헤더 · signup/purchase 템플릿 등)
      //    어떤 탭에서 저장하든 헤더와 글로벌 설정은 항상 함께 저장
      const saved = await webhookService.saveConfig({ ...config, scope: 'global', scope_id: null })
      setConfig(saved)

      // 2) 커스텀 탭이면 해당 이벤트 템플릿도 함께 저장
      if (isCustomTab && customEventForTab) {
        await webhookService.upsertCustomEvent({
          id: customEventForTab.id,
          code: customEventForTab.code,
          label: customEventForTab.label,
          description: customEventForTab.description ?? '',
          trigger_hint: customEventForTab.trigger_hint ?? '',
          template: customEventForTab.template,
          enabled: customEventForTab.enabled,
          sort_order: customEventForTab.sort_order,
        })
        fetchCustomEvents()
      }
      toast.success('저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

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
        <h1 className="text-2xl font-bold text-gray-900">웹훅 (CRM 연동) — 기본 설정</h1>
        <p className="text-sm text-gray-500 mt-1">
          모든 강의·전자책에서 공통으로 사용할 연결 정보(URL · 인증 헤더)와 회원가입·구매 알림톡을 설정합니다.
        </p>
        <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
          <i className="ti ti-info-circle text-blue-600 text-sm mt-0.5" />
          <div className="text-xs text-blue-900">
            상품별 알림톡(구매 알림 override · D-3·정원 도달 등 예약 알림)은 해당 강의·전자책 상세 페이지의 <strong>"알림톡" 탭</strong>에서 관리합니다.
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
              <label className="text-sm font-bold text-gray-700 block mb-1.5">
                수신 URL
                <span className="ml-1.5 text-[10px] text-blue-600 bg-blue-50 rounded-full px-1.5 py-0.5">모든 알림톡 공통</span>
              </label>
              <input
                value={config.url}
                onChange={(e) => setConfig((c) => ({ ...c, url: e.target.value }))}
                placeholder="https://shoong-api.coredev.co.kr/send"
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
          <h2 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-1.5">
            특수 전송 헤더 (Header)
            <span className="text-[10px] text-blue-600 bg-blue-50 rounded-full px-1.5 py-0.5 font-medium">모든 알림톡 공통</span>
          </h2>
          <p className="text-xs text-gray-400 mb-3">회원가입·구매·쿠폰 등 모든 알림톡에 공통으로 적용됩니다. <code>key=value&amp;key=value</code> 형식. 예약어 사용 가능.</p>
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

          <div className="flex gap-2 mb-3 flex-wrap">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTemplateTab(t.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${templateTab === t.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {isCustomTab && customEventForTab && (
            <div className="mb-3 flex items-center gap-2 text-[11px]">
              <span className={`px-2 py-0.5 rounded-full font-medium ${customEventForTab.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {customEventForTab.enabled ? '활성' : '비활성'}
              </span>
              <button type="button"
                onClick={async () => {
                  try {
                    await webhookService.upsertCustomEvent({ ...customEventForTab, enabled: !customEventForTab.enabled })
                    fetchCustomEvents()
                    toast.success(customEventForTab.enabled ? '비활성화됨' : '활성화됨')
                  } catch { toast.error('변경 실패') }
                }}
                className="text-gray-600 hover:text-gray-900 bg-transparent border-none cursor-pointer underline">
                {customEventForTab.enabled ? '비활성화' : '활성화'}
              </button>
              {customEventForTab.trigger_hint && (
                <span className="text-gray-400">— {customEventForTab.trigger_hint}</span>
              )}
            </div>
          )}
          {isCustomTab && !customEventForTab && (
            <div className="mb-3 bg-amber-50 border border-amber-100 rounded p-2 text-[11px] text-amber-800">
              <i className="ti ti-alert-triangle mr-1" />
              빌트인 이벤트가 등록되지 않았습니다. <code>2026-04-23_webhook_custom_events.sql</code> 마이그레이션을 실행해주세요.
            </div>
          )}

          {/* 템플릿 에디터 */}
          <textarea
            ref={templateTab === 'signup' ? signupRef : templateTab === 'purchase' ? purchaseRef : null}
            value={currentTemplate}
            onChange={(e) => setCurrentTemplate(e.target.value)}
            placeholder={'예:\nsendType=at&phone={#ITEM2_NOH#}&channelConfig.senderkey=YOUR_KEY&channelConfig.templatecode=...&variables.이름={#ITEM1#}'}
            rows={10}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] font-mono resize-none"
          />
          <p className="text-[11px] text-gray-500 mt-2">* 전달 파라미터 항목은 <code>&amp;</code>(앤퍼센드)로 구분합니다. 예약어는 아래 테이블에서 추가하세요.</p>

          {/* 예약어 테이블 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
            <ReservedWordTable title="기본정보 예약어" rows={BASIC_VARS} onInsert={insertVar} onInsertHeader={insertHeaderVar} />
            <ReservedWordTable
              title={`추가정보 예약어 (${templateTab === 'signup' ? '회원가입' : '구매'})`}
              rows={extraVars} onInsert={insertVar} onInsertHeader={insertHeaderVar} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-gray-700">테스트 수신 전화번호</span>
          <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)}
            placeholder="01012345678 (실제 받을 번호)"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#2ED573] font-mono w-48" />
          <span className="text-[11px] text-gray-400">미입력 시 가짜 번호 010-1234-5678로 전송 (실제 발송 안 됨)</span>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button onClick={handleSaveCurrentTemplate} disabled={saving}
            className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] disabled:opacity-50">
            {saving ? '저장 중...' : isCustomTab ? '템플릿 저장' : '설정 저장'}
          </button>
          <button onClick={() => handleTest(templateTab)} disabled={!config.url}
            className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-gray-800 disabled:opacity-50">
            <i className="ti ti-send mr-1.5" />테스트 전송 ({templateTab === 'signup' ? '회원가입' : templateTab === 'purchase' ? '구매' : templateTab === 'purchase_free' ? '무료구매' : '유료구매'})
          </button>
        </div>

        {testResult && (
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-900">최근 테스트 결과</h3>
              <button onClick={() => setTestResult(null)} className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer text-xs">
                <i className="ti ti-x" /> 닫기
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-600 w-20">상태</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${testResult.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {testResult.status ?? 'error'} {testResult.response_status ? `(HTTP ${testResult.response_status})` : ''}
                </span>
              </div>
              {testResult.request_url && (
                <div className="flex items-start gap-2">
                  <span className="font-bold text-gray-600 w-20 shrink-0">요청 URL</span>
                  <code className="text-[11px] text-gray-700 break-all">{testResult.request_url}</code>
                </div>
              )}
              {testResult.request_body && (
                <div className="flex items-start gap-2">
                  <span className="font-bold text-gray-600 w-20 shrink-0">요청 본문</span>
                  <pre className="flex-1 text-[11px] font-mono text-gray-700 bg-gray-50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{testResult.request_body}</pre>
                </div>
              )}
              {testResult.response_body && (
                <div className="flex items-start gap-2">
                  <span className="font-bold text-gray-600 w-20 shrink-0">응답 본문</span>
                  <pre className="flex-1 text-[11px] font-mono text-gray-700 bg-gray-50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{testResult.response_body}</pre>
                </div>
              )}
              {testResult.error_message && (
                <div className="flex items-start gap-2">
                  <span className="font-bold text-gray-600 w-20 shrink-0">에러</span>
                  <code className="text-[11px] text-red-600">{testResult.error_message}</code>
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-2">※ HTTP 200/201 응답이라도 실제 카톡 발송 여부는 shoong dashboard에서 확인. shoong API는 트리거를 받으면 일단 성공으로 응답하고 발송은 비동기로 처리합니다.</p>
            </div>
          </div>
        )}

        {/* 스케줄 발송 시간 (cron) */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">스케줄 발송 시간</h2>
              <p className="text-xs text-gray-400 mt-0.5">쿠폰 만료 임박/만료 알림이 매일 자동 발송될 시각 (한국시간 기준)</p>
            </div>
            {cronExists && cronInfo && (
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">{cronInfo.active ? '활성' : '비활성'}</span>
                <button type="button" onClick={handleToggleCron}
                  className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer border-none ${cronInfo.active ? 'bg-[#2ED573]' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${cronInfo.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </label>
            )}
          </div>

          {!cronExists ? (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <p className="text-xs text-amber-900 mb-2">
                <i className="ti ti-alert-triangle mr-1" />
                <strong>cron 작업이 아직 등록되지 않았습니다.</strong>
              </p>
              <p className="text-[11px] text-amber-800 mb-3">
                Supabase Dashboard → SQL Editor에서 아래 SQL을 한 번 실행해주세요. (service_role key는 Project Settings → API에서 복사)
              </p>
              <pre className="text-[10px] bg-white border border-amber-200 rounded p-2 overflow-x-auto whitespace-pre-wrap">{`CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'coupon-expiry-scanner-daily',
  '0 0 * * *',
  $$ SELECT net.http_post(
    url := 'https://${(import.meta.env.VITE_SUPABASE_URL || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '')}/functions/v1/coupon-expiry-scanner',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
    body := '{}'::jsonb
  ); $$
);`}</pre>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-600">매일</span>
                <select value={cronHour} onChange={(e) => setCronHour(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#2ED573]">
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}시</option>
                  ))}
                </select>
                <select value={cronMinute} onChange={(e) => setCronMinute(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#2ED573]">
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">에 발송 (한국시간)</span>
                <button onClick={handleSaveCron} disabled={cronSaving}
                  className="ml-2 bg-[#2ED573] text-white px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none hover:bg-[#25B866] disabled:opacity-50">
                  {cronSaving ? '적용 중...' : '적용'}
                </button>
              </div>
              <div className="text-[11px] text-gray-500 space-y-0.5">
                <div>현재 등록된 cron: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{cronInfo?.schedule}</code> (UTC 기준)</div>
                {cronInfo?.last_run && (
                  <div>마지막 실행: {new Date(cronInfo.last_run).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} — <span className={cronInfo.last_status === 'succeeded' ? 'text-emerald-600' : 'text-red-600'}>{cronInfo.last_status}</span></div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 사용자 정의 커스텀 이벤트 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">사용자 정의 커스텀 이벤트</h2>
              <p className="text-xs text-gray-400 mt-0.5">위 정규 탭(회원가입·구매·쿠폰·포인트) 외에 자체 코드로 추가하는 알림톡 (예: 회원 등급 변경, 생일 축하 등)</p>
            </div>
            <button onClick={() => setCustomEditing({ code: '', label: '', description: '', trigger_hint: '', template: '', enabled: true, built_in: false, sort_order: 100 })}
              className="bg-[#2ED573] text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none hover:bg-[#25B866]">
              <i className="ti ti-plus mr-1" />이벤트 추가
            </button>
          </div>

          {customEvents.filter((c) => !c.built_in).length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">사용자 정의 이벤트가 없습니다. "이벤트 추가"로 만들고 코드 측에서 <code>fireCustomEvent('your_code', ...)</code> 호출.</p>
          ) : (
            <div className="space-y-2">
              {customEvents.filter((c) => !c.built_in).map((ce) => (
                <div key={ce.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ce.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {ce.enabled ? '활성' : '비활성'}
                    </span>
                    {ce.built_in && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">시스템</span>}
                    <span className="text-sm font-bold text-gray-900">{ce.label}</span>
                    <code className="text-[11px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{ce.code}</code>
                    {ce.trigger_hint && <span className="text-[11px] text-gray-400">{ce.trigger_hint}</span>}
                    <div className="ml-auto flex items-center gap-1">
                      <button onClick={() => handleTestCustom(ce)} disabled={!ce.template || !config.url}
                        className="text-[11px] text-white bg-gray-900 hover:bg-gray-800 rounded px-2 py-1 border-none cursor-pointer disabled:opacity-50">
                        <i className="ti ti-send" /> 테스트
                      </button>
                      <button onClick={() => setCustomEditing(ce)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded px-2 py-1 border-none cursor-pointer">
                        <i className="ti ti-pencil" /> 수정
                      </button>
                      {!ce.built_in && (
                        <button onClick={() => ce.id && handleDeleteCustom(ce.id, ce.code)}
                          className="text-[11px] text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded px-2 py-1 border-none cursor-pointer">
                          <i className="ti ti-trash" /> 삭제
                        </button>
                      )}
                    </div>
                  </div>
                  {ce.template && (
                    <pre className="mt-2 text-[11px] text-gray-600 bg-gray-50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{ce.template}</pre>
                  )}
                  {!ce.template && <p className="mt-2 text-[11px] text-amber-600">⚠ 템플릿이 비어있어 발송되지 않습니다. 수정 버튼으로 템플릿을 입력해주세요.</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 커스텀 이벤트 편집 모달 */}
      {customEditing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setCustomEditing(null) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{customEditing.id ? '커스텀 이벤트 수정' : '커스텀 이벤트 추가'}</h3>
              <button onClick={() => setCustomEditing(null)} className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer">
                <i className="ti ti-x text-xl" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">코드 (영문/숫자/_)</label>
                  <input value={customEditing.code ?? ''}
                    onChange={(e) => setCustomEditing({ ...customEditing, code: e.target.value })}
                    placeholder="예: coupon_issued"
                    disabled={customEditing.built_in}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573] font-mono disabled:bg-gray-50 disabled:text-gray-400" />
                  {customEditing.built_in && <p className="text-[10px] text-gray-400 mt-1">시스템 정의 코드는 변경 불가</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">표시명</label>
                  <input value={customEditing.label ?? ''}
                    onChange={(e) => setCustomEditing({ ...customEditing, label: e.target.value })}
                    placeholder="예: 쿠폰 발급 완료"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">발사 위치 안내 (선택)</label>
                <input value={customEditing.trigger_hint ?? ''}
                  onChange={(e) => setCustomEditing({ ...customEditing, trigger_hint: e.target.value })}
                  placeholder="예: 어드민 → 쿠폰 → 발급 시"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">전달 파라미터 (shoong)</label>
                <textarea value={customEditing.template ?? ''}
                  onChange={(e) => setCustomEditing({ ...customEditing, template: e.target.value })}
                  rows={6}
                  placeholder={`예 (쿠폰 발급):\nsendType=at&phone={#user_phone#}&channelConfig.senderkey=YOUR_KEY&channelConfig.templatecode=coupon_issued&variables.이름={#user_name#}&variables.쿠폰명={#coupon_name#}`}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573] font-mono resize-none" />
                <p className="text-[10px] text-gray-400 mt-1">사용 가능 변수: <code>{`{#user_name#}`}</code> <code>{`{#user_phone#}`}</code> <code>{`{#user_email#}`}</code> <code>{`{#TITLE#}`}</code> 외 fireCustomEvent에 전달된 모든 payload 변수</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ce_enabled" checked={customEditing.enabled ?? true}
                  onChange={(e) => setCustomEditing({ ...customEditing, enabled: e.target.checked })}
                  className="accent-[#2ED573]" />
                <label htmlFor="ce_enabled" className="text-sm text-gray-700 cursor-pointer">활성화</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setCustomEditing(null)} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm cursor-pointer hover:bg-gray-50">취소</button>
              <button onClick={handleSaveCustom} className="px-4 py-2 rounded-lg bg-[#2ED573] text-white text-sm font-bold cursor-pointer border-none hover:bg-[#25B866]">저장</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
