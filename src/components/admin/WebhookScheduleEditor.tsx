import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { webhookScheduleService, type WebhookSchedule, type WebhookScheduleRun, type TriggerType } from '../../services/webhookScheduleService'
import { webhookService, type WebhookConfig } from '../../services/webhookService'
import { supabase } from '../../lib/supabase'
import TemplateAliasConfirmModal from './TemplateAliasConfirmModal'

interface ScopeInfo {
  title: string
  instructorName: string
  price: number
  url: string
  upcomingScheduledAt: string | null
}

function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{#([^#\s]+)#\}/g, (_, k) => vars[k] ?? `{#${k}#}`)
}

/** 빈 "variables.X":"" 슬롯에 picker가 emit한 값을 그대로 채워 넣음
 *  picker는 canonical 선택 시 `{#KEY#}` 형태로, 고정값/URL은 raw 값으로 emit하므로
 *  여기서는 추측 없이 JSON 이스케이프만 해서 삽입한다. */
function fillEmptySlots(template: string, slotFills: Record<string, string>): string {
  let out = template
  for (const [slot, value] of Object.entries(slotFills)) {
    if (!value) continue
    const esc = slot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`"variables\\.${esc}"\\s*:\\s*""`, 'g')
    const escapedValue = JSON.stringify(value).slice(1, -1)
    out = out.replace(re, `"variables.${slot}":"${escapedValue}"`)
  }
  return out
}

function fmt(d: Date | null, opts: Intl.DateTimeFormatOptions): string {
  return d ? d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', ...opts }) : ''
}

function buildScopeVars(info: ScopeInfo | null): Record<string, string> {
  if (!info) return {}
  const at = info.upcomingScheduledAt ? new Date(info.upcomingScheduledAt) : null
  const date = fmt(at, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')
  const time = fmt(at, { hour: '2-digit', minute: '2-digit', hour12: false })
  const longDt = at ? `${fmt(at, { year: 'numeric', month: 'long', day: 'numeric' })} ${time}` : ''
  const sampleName = '홍길동'
  const samplePhone = '010-1234-5678'
  const sampleEmail = 'test@example.com'
  return {
    TITLE: info.title,
    title: info.title,
    instructor_name: info.instructorName,
    instructor: info.instructorName,
    course_url: info.url,
    course_link: info.url,
    URL: info.url,
    price: String(info.price),
    DATE: date,
    TIME: time,
    SCHEDULED_DATE: date,
    SCHEDULED_TIME: time,
    SCHEDULED_AT: info.upcomingScheduledAt ?? '',
    // 한글 변수명 별칭
    이름: sampleName,
    고객명: sampleName,
    회원명: sampleName,
    성함: sampleName,
    연락처: samplePhone,
    전화번호: samplePhone,
    핸드폰번호: samplePhone,
    이메일: sampleEmail,
    강사명: info.instructorName,
    강사: info.instructorName,
    선생님: info.instructorName,
    강의명: info.title,
    모임명: info.title,
    모임: info.title,
    수업명: info.title,
    상품명: info.title,
    서비스명: info.title,
    클래스명: info.title,
    일시: longDt,
    모임일시: longDt,
    강의일시: longDt,
    날짜: date,
    시간: time,
    링크: info.url,
    URL주소: info.url,
    가격: info.price ? `${info.price.toLocaleString()}원` : '',
    금액: info.price ? `${info.price.toLocaleString()}원` : '',
    // 샘플 사용자 (영문)
    ITEM1: sampleName,
    ITEM2: samplePhone,
    ITEM2_NOH: '01012345678',
    user_name: sampleName,
    user_phone: samplePhone,
    user_email: sampleEmail,
    name: sampleName,
    phone: samplePhone,
    email: sampleEmail,
    DBNO: '999999',
  }
}

const TRIGGER_LABEL: Record<TriggerType, string> = {
  time_offset: '강의 일정 기준',
  enrollment_full: '정원 도달 시',
  manual: '수동 발송',
}

interface Props {
  scope: 'course' | 'ebook'
  scopeId: number
}

const COMMON_PRESETS: Array<{ label: string; minutes: number }> = [
  { label: '강의 7일 전', minutes: -10080 },
  { label: '강의 3일 전', minutes: -4320 },
  { label: '강의 1일 전', minutes: -1440 },
  { label: '강의 1시간 전', minutes: -60 },
  { label: '강의 30분 전', minutes: -30 },
  { label: '강의 시작 시', minutes: 0 },
  { label: '강의 1시간 후', minutes: 60 },
]


function offsetLabel(min: number): string {
  if (min === 0) return '강의 시작 시'
  const abs = Math.abs(min)
  const days = Math.floor(abs / 1440)
  const hours = Math.floor((abs % 1440) / 60)
  const mins = abs % 60
  const parts = []
  if (days) parts.push(`${days}일`)
  if (hours) parts.push(`${hours}시간`)
  if (mins) parts.push(`${mins}분`)
  return `강의 ${min < 0 ? parts.join(' ') + ' 전' : parts.join(' ') + ' 후'}`
}

export default function WebhookScheduleEditor({ scope, scopeId }: Props) {
  const [schedules, setSchedules] = useState<WebhookSchedule[]>([])
  const [editing, setEditing] = useState<Partial<WebhookSchedule> | null>(null)
  const [runs, setRuns] = useState<WebhookScheduleRun[]>([])
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [openRunsFor, setOpenRunsFor] = useState<number | null>(null)

  // 구매 알림톡 (per-scope override)
  const [globalConfig, setGlobalConfig] = useState<WebhookConfig | null>(null)
  const [scopedConfig, setScopedConfig] = useState<WebhookConfig | null>(null)
  const [purchaseTemplate, setPurchaseTemplate] = useState('')
  const [overrideEnabled, setOverrideEnabled] = useState(true)
  const [savingPurchase, setSavingPurchase] = useState(false)

  // scope(강의/전자책) 정보 — 자동 채움 배너 + 미리보기용
  const [scopeInfo, setScopeInfo] = useState<ScopeInfo | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // 변수 분석 확인 모달
  const [aliasConfirm, setAliasConfirm] = useState<{
    unknownVars: string[]
    suggestedAliases: Record<string, { canonical: string; reason: string }>
    emptySlots: string[]
    suggestedSlotFills: Record<string, { canonical: string; reason: string }>
    warning?: string
  } | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  const fetchSchedules = useCallback(async () => {
    if (!scopeId) return
    const data = await webhookScheduleService.listByScope(scope, scopeId)
    setSchedules(data)
  }, [scope, scopeId])

  const fetchConfigs = useCallback(async () => {
    if (!scopeId) return
    const [g, s] = await Promise.all([
      webhookService.getConfig('global', null),
      webhookService.getConfig(scope, scopeId),
    ])
    setGlobalConfig(g)
    setScopedConfig(s.id ? s : null)
    // 토글 상태 = scoped 가 존재하고 enabled === true. 그 외 (없거나 disabled) 는 OFF (기본 웹훅 사용).
    setPurchaseTemplate(s.purchase_template || '')
    setOverrideEnabled(s.id ? s.enabled !== false : false)
  }, [scope, scopeId])

  const fetchScopeInfo = useCallback(async () => {
    if (!scopeId) return
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''
    try {
      if (scope === 'course') {
        const { data: course } = await supabase
          .from('courses')
          .select('id, title, sale_price, original_price, instructor:instructors(name)')
          .eq('id', scopeId)
          .maybeSingle()
        const c = course as { id: number; title: string; sale_price?: number; original_price?: number; instructor?: { name?: string } | null } | null
        // 가장 가까운 미래 schedule
        const { data: sc } = await supabase
          .from('schedules')
          .select('scheduled_at')
          .eq('course_id', scopeId)
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at')
          .limit(1)
          .maybeSingle()
        const nearest = (sc as { scheduled_at?: string } | null)?.scheduled_at ?? null
        setScopeInfo({
          title: c?.title ?? '',
          instructorName: c?.instructor?.name ?? '',
          price: c?.sale_price ?? c?.original_price ?? 0,
          url: `${siteUrl}/course/${scopeId}`,
          upcomingScheduledAt: nearest,
        })
      } else {
        const { data: ebook } = await supabase
          .from('ebooks')
          .select('id, title, sale_price, original_price')
          .eq('id', scopeId)
          .maybeSingle()
        const e = ebook as { id: number; title: string; sale_price?: number; original_price?: number } | null
        setScopeInfo({
          title: e?.title ?? '',
          instructorName: '',
          price: e?.sale_price ?? e?.original_price ?? 0,
          url: `${siteUrl}/ebook/${scopeId}`,
          upcomingScheduledAt: null,
        })
      }
    } catch {
      setScopeInfo(null)
    }
  }, [scope, scopeId])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])
  useEffect(() => { fetchConfigs() }, [fetchConfigs])
  useEffect(() => { fetchScopeInfo() }, [fetchScopeInfo])

  // 강의/전자책이 처음 webhook 페이지를 열었을 때 global default 템플릿(course_d7/d3/d1/d0)을
  // 이 scope 의 webhook_schedules 로 자동 시드. 한 번만 실행되도록 default_webhooks_seeded 플래그로 가드.
  useEffect(() => {
    if (!scopeId) return
    let cancelled = false
    const seedDefaults = async () => {
      try {
        const table = scope === 'course' ? 'courses' : 'ebooks'
        const { data: row } = await supabase.from(table).select('default_webhooks_seeded').eq('id', scopeId).maybeSingle()
        if (cancelled) return
        if ((row as { default_webhooks_seeded?: boolean } | null)?.default_webhooks_seeded) return

        // 강의에만 적용 (전자책은 아직 일정 기준 알림톡이 없음)
        if (scope !== 'course') {
          await supabase.from(table).update({ default_webhooks_seeded: true } as never).eq('id', scopeId)
          return
        }

        const DEFAULT_CODES: Array<{ code: string; offset: number; label: string }> = [
          { code: 'course_d7', offset: -10080, label: '강의 7일 전' },
          { code: 'course_d3', offset: -4320, label: '강의 3일 전' },
          { code: 'course_d1', offset: -1440, label: '강의 1일 전' },
          { code: 'course_d0', offset: 0, label: '강의 당일' },
        ]
        const { data: events } = await supabase.from('webhook_custom_events')
          .select('code, label, template, variable_aliases, enabled')
          .in('code', DEFAULT_CODES.map((d) => d.code))
        const map = new Map<string, { template: string; aliases: Record<string, string>; enabled: boolean; label: string }>()
        for (const e of (events ?? []) as Array<{ code: string; label: string; template: string; variable_aliases: Record<string, string> | null; enabled: boolean }>) {
          map.set(e.code, { template: e.template, aliases: e.variable_aliases ?? {}, enabled: e.enabled, label: e.label })
        }

        const rows: Array<Record<string, unknown>> = []
        for (const d of DEFAULT_CODES) {
          const evt = map.get(d.code)
          if (!evt || !evt.template?.trim()) continue
          rows.push({
            scope,
            scope_id: scopeId,
            label: evt.label || d.label,
            trigger_type: 'time_offset',
            offset_minutes: d.offset,
            request_template: evt.template,
            enabled: evt.enabled !== false,
            sort_order: 0,
            variable_aliases: evt.aliases,
          })
        }
        if (rows.length > 0) {
          await supabase.from('webhook_schedules').insert(rows as never)
        }
        await supabase.from(table).update({ default_webhooks_seeded: true } as never).eq('id', scopeId)
        if (!cancelled && rows.length > 0) {
          await fetchSchedules()
          toast.success(`기본 템플릿 ${rows.length}개를 이 강의에 적용했습니다.`)
        }
      } catch (err) {
        console.warn('[WebhookScheduleEditor] default seed 실패:', err)
      }
    }
    seedDefaults()
    return () => { cancelled = true }
  }, [scope, scopeId, fetchSchedules])

  // purchase alias 저장 상태 (모달 확인 후 실제 저장에 쓰임)
  const [purchaseAliasConfirm, setPurchaseAliasConfirm] = useState<{
    unknownVars: string[]
    suggestedAliases: Record<string, { canonical: string; reason: string }>
    emptySlots: string[]
    suggestedSlotFills: Record<string, { canonical: string; reason: string }>
    warning?: string
  } | null>(null)

  const performSavePurchase = async (templateToSave: string, aliases: Record<string, string>) => {
    if (!globalConfig) return
    setSavingPurchase(true)
    try {
      const extConfig = (scopedConfig || {}) as WebhookConfig & { purchase_variable_aliases?: Record<string, string> }
      await webhookService.saveConfig({
        ...globalConfig,
        ...(scopedConfig || {}),
        id: scopedConfig?.id,
        scope,
        scope_id: scopeId,
        enabled: true,
        purchase_template: templateToSave,
        label: scopedConfig?.label || `${scope === 'course' ? '강의' : '전자책'}#${scopeId} 전용`,
        purchase_variable_aliases: { ...(extConfig.purchase_variable_aliases ?? {}), ...aliases },
      } as WebhookConfig)
      toast.success(`이 ${scope === 'course' ? '강의' : '전자책'} 전용 구매 알림톡 저장됨`)
      setPurchaseAliasConfirm(null)
      fetchConfigs()
    } catch {
      toast.error('저장 실패')
    } finally {
      setSavingPurchase(false)
    }
  }

  // 토글 클릭 시 즉시 DB 반영. ON ↔ OFF 가 UI 상에서만 바뀌고 DB 는 그대로라 헷갈리던 문제 해결.
  // OFF 로 가도 데이터는 보존(enabled=false) — 다시 ON 할 때 작성한 템플릿 그대로 살아남음.
  const handleToggleOverride = async () => {
    const next = !overrideEnabled
    setOverrideEnabled(next)
    if (!scopedConfig?.id) return // 아직 저장된 전용 설정이 없으면 DB 작업 불필요
    setSavingPurchase(true)
    try {
      await webhookService.saveConfig({ ...scopedConfig, enabled: next } as WebhookConfig)
      toast.success(next ? '전용 설정 활성화' : '기본 웹훅 설정으로 전환됨 (전용 템플릿은 보존)')
      fetchConfigs()
    } catch {
      // 실패 시 토글 롤백
      setOverrideEnabled(!next)
      toast.error('전환 실패')
    } finally {
      setSavingPurchase(false)
    }
  }

  const handleSavePurchaseTemplate = async () => {
    if (!globalConfig) return
    if (!purchaseTemplate.trim()) { toast.error('템플릿을 입력해주세요.'); return }

    // 저장 직전에도 cURL 추출 한 번 더 (사용자가 버튼 안 눌렀어도 커버)
    const { body: extractedTpl, extracted } = extractCurlBody(purchaseTemplate)
    if (extracted) {
      setPurchaseTemplate(extractedTpl)
      toast.success('cURL에서 JSON 본문 자동 추출됨')
    }
    const templateForAnalysis = extractedTpl

    // 템플릿 분석: 미확인 {#변수#} + 빈 variables.X:"" 슬롯
    setSavingPurchase(true)
    try {
      const analysis = await webhookService.analyzeTemplateVariables(templateForAnalysis)
      const unknownVars = analysis.unknown_vars ?? []
      const emptySlots = analysis.empty_slots ?? []
      const suggestedAliases = analysis.suggested_aliases ?? {}
      const suggestedSlotFills = analysis.suggested_slot_fills ?? {}
      if (unknownVars.length > 0 || emptySlots.length > 0) {
        setPurchaseAliasConfirm({ unknownVars, suggestedAliases, emptySlots, suggestedSlotFills, warning: analysis.warning })
        setSavingPurchase(false)
        return
      }
      if (analysis.warning) toast(analysis.warning, { icon: 'ℹ️', duration: 5000 })
      await performSavePurchase(templateForAnalysis, {})
    } catch (err) {
      console.error(err)
      toast.error('변수 분석 중 오류, alias 없이 저장합니다.')
      await performSavePurchase(templateForAnalysis, {})
    }
  }

  // cURL → JSON 본문 추출 (별도 함수로 분리해서 onChange/버튼/save에서 재사용)
  const extractCurlBody = (val: string): { body: string; extracted: boolean } => {
    const t = val.trim()
    if (!(t.startsWith('curl ') || t.startsWith('curl\n') || /\s-d\s+['"]/.test(t))) {
      return { body: val, extracted: false }
    }
    const dIdxSingle = t.lastIndexOf("-d '")
    const dIdxDouble = t.lastIndexOf('-d "')
    const isSingle = dIdxSingle > dIdxDouble
    const dIdx = isSingle ? dIdxSingle : dIdxDouble
    const quote = isSingle ? "'" : '"'
    if (dIdx === -1) return { body: val, extracted: false }
    const start = dIdx + 4
    const end = t.lastIndexOf(quote)
    if (end <= start) return { body: val, extracted: false }
    const body = t.slice(start, end).trim()
    if (!body.startsWith('{')) return { body: val, extracted: false }
    const replaced = body.replace(/"phone"\s*:\s*"01012345678"/g, '"phone":"{#ITEM2_NOH#}"')
    return { body: replaced, extracted: true }
  }

  const handlePurchaseTextareaChange = (val: string) => {
    const { body, extracted } = extractCurlBody(val)
    if (extracted) toast.success('cURL에서 JSON 본문 자동 추출됨')
    setPurchaseTemplate(body)
  }

  const handleExtractCurl = () => {
    const { body, extracted } = extractCurlBody(purchaseTemplate)
    if (extracted) {
      setPurchaseTemplate(body)
      toast.success('cURL에서 JSON 본문 추출됨')
    } else {
      toast('cURL 형태가 아니거나 이미 추출된 상태입니다', { icon: 'ℹ️' })
    }
  }

  const handleToggleEnabled = async (s: WebhookSchedule) => {
    try {
      await webhookScheduleService.upsert({ id: s.id, enabled: !s.enabled } as Partial<WebhookSchedule>)
      fetchSchedules()
    } catch {
      toast.error('상태 변경 실패')
    }
  }

  const performSave = async (aliases: Record<string, string>, slotFills: Record<string, string>) => {
    if (!editing) return
    try {
      const filledTemplate = Object.keys(slotFills).length > 0 && editing.request_template
        ? fillEmptySlots(editing.request_template, slotFills)
        : editing.request_template
      await webhookScheduleService.upsert({
        ...editing,
        request_template: filledTemplate,
        scope,
        scope_id: scopeId,
        trigger_type: (editing.trigger_type as TriggerType) || 'time_offset',
        offset_minutes: Number(editing.offset_minutes ?? 0),
        enabled: editing.enabled ?? true,
        variable_aliases: { ...(editing.variable_aliases ?? {}), ...aliases },
      } as Partial<WebhookSchedule>)
      toast.success('저장되었습니다.')
      setEditing(null)
      setAliasConfirm(null)
      fetchSchedules()
    } catch {
      toast.error('저장 실패')
    }
  }

  const handleSave = async () => {
    if (!editing) return
    if (!editing.label?.trim()) { toast.error('라벨을 입력해주세요.'); return }
    if (!editing.request_template?.trim()) { toast.error('전달 파라미터를 입력해주세요.'); return }

    // 템플릿 분석: 미확인 {#변수#} 매핑 + 빈 variables.X 슬롯 자동 채움 제안
    setAnalyzing(true)
    try {
      const analysis = await webhookService.analyzeTemplateVariables(editing.request_template)
      const unknownVars = analysis.unknown_vars ?? []
      const emptySlots = analysis.empty_slots ?? []
      const suggestedAliases = analysis.suggested_aliases ?? {}
      const suggestedSlotFills = analysis.suggested_slot_fills ?? {}
      if (unknownVars.length > 0 || emptySlots.length > 0) {
        setAliasConfirm({ unknownVars, suggestedAliases, emptySlots, suggestedSlotFills, warning: analysis.warning })
      } else {
        if (analysis.warning) toast(analysis.warning, { icon: 'ℹ️', duration: 5000 })
        await performSave({}, {})
      }
    } catch (err) {
      toast.error('변수 분석 중 오류, alias 없이 저장합니다.')
      console.error(err)
      await performSave({}, {})
    } finally {
      setAnalyzing(false)
    }
  }

  const handleManualFire = async (s: WebhookSchedule) => {
    if (!confirm(`"${s.label}" 알림톡을 현재 모든 구매자에게 즉시 발송합니다. 진행할까요?`)) return
    try {
      const result = await webhookScheduleService.fanOutToAllPurchasers(s.id)
      if (result.recipients === 0) {
        toast('구매자가 없습니다.')
      } else {
        toast.success(`${result.inserted}건 큐잉됨 (대상자 ${result.recipients}명)`)
      }
      fetchSchedules()
    } catch {
      toast.error('발송 실패')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까? 이미 큐잉된 발송 건은 강의 일정과 함께 자동 정리됩니다.')) return
    await webhookScheduleService.delete(id)
    toast.success('삭제되었습니다.')
    fetchSchedules()
  }

  const handleViewRuns = async (scheduleId: number) => {
    if (openRunsFor === scheduleId) {
      setOpenRunsFor(null)
      setRuns([])
      return
    }
    setLoadingRuns(true)
    try {
      const data = await webhookScheduleService.listRuns({ scheduleId, limit: 50 })
      setRuns(data)
      setOpenRunsFor(scheduleId)
    } finally {
      setLoadingRuns(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 연결 설정 안내 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
        <i className="ti ti-info-circle text-blue-600 text-sm mt-0.5" />
        <div className="text-xs text-blue-900 flex-1">
          연결 정보(URL · 인증 헤더 · Content-Type)는 <Link to="/admin/webhook" className="font-bold underline">기본 웹훅 설정</Link>에서 관리합니다.
          {globalConfig && (
            <span className="block mt-0.5 text-blue-700">현재 기본 URL: <code className="bg-white/60 px-1 rounded">{globalConfig.url || '(미설정)'}</code></span>
          )}
        </div>
      </div>

      {/* 구매 즉시 알림톡 (per-scope override) */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900">구매 즉시 알림톡</h3>
            <p className="text-xs text-gray-500 mt-0.5">사용자가 이 {scope === 'course' ? '강의' : '전자책'}을 구매하는 즉시 발송됩니다.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-gray-500">{overrideEnabled ? `이 ${scope === 'course' ? '강의' : '전자책'} 전용` : '기본 웹훅 설정 사용 (기본값)'}</span>
            <button type="button"
              onClick={handleToggleOverride}
              disabled={savingPurchase}
              className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer border-none ${overrideEnabled ? 'bg-[#2ED573]' : 'bg-gray-300'} disabled:opacity-50`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${overrideEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>
        {overrideEnabled ? (
          <>
            <textarea value={purchaseTemplate} onChange={(e) => handlePurchaseTextareaChange(e.target.value)}
              rows={8}
              placeholder={`shoong "코드 예제" cURL 통째 붙여넣기 OK (자동 추출)\n\n또는 JSON 직접:\n{\n  "sendType":"at",\n  "phone":"{#ITEM2_NOH#}",\n  "channelConfig.senderkey":"...",\n  "channelConfig.templatecode":"...",\n  "variables.강의명":"{#TITLE#}",\n  "variables.이름":"{#user_name#}"\n}`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573] font-mono resize-none" />
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <button type="button" onClick={handleExtractCurl}
                className="text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded px-2 py-1 border-none cursor-pointer">
                <i className="ti ti-file-code mr-1" />cURL에서 JSON 추출
              </button>
              <span className="text-[10px] text-gray-400">저장 시 GPT-5.4-mini가 빈 변수 슬롯을 자동 채움 제안합니다.</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">사용 변수: <code>{`{#user_name#}`}</code> <code>{`{#user_phone#}`}</code> <code>{`{#title#}`}</code> <code>{`{#TITLE#}`}</code> <code>{`{#price#}`}</code> <code>{`{#DBNO#}`}</code></p>
            <div className="flex justify-end mt-3">
              <button onClick={handleSavePurchaseTemplate} disabled={savingPurchase}
                className="bg-[#2ED573] text-white px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none hover:bg-[#25B866] disabled:opacity-50">
                {savingPurchase ? '저장 중...' : '저장'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded p-3 space-y-1">
            <div>
              <i className="ti ti-info-circle text-blue-600 mr-1" />
              <strong>기본 웹훅 설정</strong>의 구매 알림톡 템플릿이 사용됩니다.
              {globalConfig?.purchase_template?.trim()
                ? <span className="ml-1 text-blue-700">(기본 템플릿 등록됨)</span>
                : <span className="ml-1 text-amber-700">— 단, 현재 기본 템플릿이 비어 있어 발송되지 않습니다.</span>}
            </div>
            <div className="text-[11px] text-gray-500">
              이 {scope === 'course' ? '강의' : '전자책'}만 다르게 발송하려면 토글을 켜고 전용 템플릿을 작성하세요.
              {' '}<Link to="/admin/webhook" className="underline text-blue-700 font-bold">기본 웹훅 설정 →</Link>
            </div>
            {scopedConfig?.id && (
              <div className="text-[11px] text-gray-400 mt-1">
                이전에 작성한 전용 템플릿은 보존되어 있어요. 다시 토글 ON 하면 살아납니다.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 예약 알림톡 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">예약 알림톡 (D-3, 정원 도달 등)</h3>
            <p className="text-xs text-gray-500 mt-0.5">{scope === 'course' ? '강의' : '전자책'} 일정·정원·수동 트리거에 따라 자동 발송됩니다.</p>
          </div>
          <button onClick={() => setEditing({ label: '', offset_minutes: -4320, request_template: '', enabled: true })}
            className="bg-[#2ED573] text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none hover:bg-[#25B866]">
            <i className="ti ti-plus mr-1" />추가
          </button>
        </div>

        {schedules.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">등록된 예약 알림톡이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div key={s.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleToggleEnabled(s)}
                    title={s.enabled ? '활성 (클릭으로 OFF)' : '비활성 (클릭으로 ON)'}
                    className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer border-none ${s.enabled ? 'bg-[#2ED573]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${s.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-sm font-bold text-gray-900">{s.label}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    s.trigger_type === 'time_offset' ? 'bg-blue-100 text-blue-700'
                      : s.trigger_type === 'enrollment_full' ? 'bg-amber-100 text-amber-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {TRIGGER_LABEL[s.trigger_type]}
                  </span>
                  {s.trigger_type === 'time_offset' && (
                    <span className="text-xs text-gray-500">{offsetLabel(s.offset_minutes)}</span>
                  )}
                  {s.trigger_type === 'enrollment_full' && s.enrollment_full_fired_at && (
                    <span className="text-[10px] text-gray-400">자동 발사됨: {new Date(s.enrollment_full_fired_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    {(s.trigger_type === 'manual' || s.trigger_type === 'enrollment_full') && (
                      <button onClick={() => handleManualFire(s)} className="text-xs text-white bg-[#2ED573] hover:bg-[#25B866] rounded px-2 py-1 border-none cursor-pointer">
                        <i className="ti ti-send" /> 지금 발송
                      </button>
                    )}
                    <button onClick={() => handleViewRuns(s.id)} className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded px-2 py-1 border-none cursor-pointer">
                      <i className="ti ti-list" /> 큐 ({openRunsFor === s.id ? '닫기' : '보기'})
                    </button>
                    <button onClick={() => setEditing(s)} className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded px-2 py-1 border-none cursor-pointer">
                      <i className="ti ti-pencil" /> 수정
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded px-2 py-1 border-none cursor-pointer">
                      <i className="ti ti-trash" /> 삭제
                    </button>
                  </div>
                </div>
                <pre className="mt-2 text-[11px] text-gray-600 bg-gray-50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{s.request_template}</pre>
                {openRunsFor === s.id && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="text-xs font-bold text-gray-700 mb-2">최근 발송 큐 ({runs.length}건)</p>
                    {loadingRuns ? (
                      <p className="text-xs text-gray-400">불러오는 중...</p>
                    ) : runs.length === 0 ? (
                      <p className="text-xs text-gray-400">큐에 적재된 건이 없습니다. 사용자가 구매하면 자동 생성됩니다.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1 text-left">발송 예정</th>
                              <th className="px-2 py-1 text-left">사용자</th>
                              <th className="px-2 py-1 text-left">상태</th>
                              <th className="px-2 py-1 text-left">실제 발송</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {runs.map((r) => (
                              <tr key={r.id}>
                                <td className="px-2 py-1 text-gray-600">{new Date(r.fire_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
                                <td className="px-2 py-1">{r.user_name} / {r.user_phone}</td>
                                <td className="px-2 py-1">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                    r.status === 'success' ? 'bg-emerald-100 text-emerald-700'
                                      : r.status === 'failed' ? 'bg-red-100 text-red-700'
                                      : r.status === 'cancelled' ? 'bg-gray-100 text-gray-500'
                                      : r.status === 'skipped' ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>{r.status}</span>
                                </td>
                                <td className="px-2 py-1 text-gray-500">{r.fired_at ? new Date(r.fired_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 편집 모달 */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing.id ? '예약 알림톡 수정' : '예약 알림톡 추가'}</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer">
                <i className="ti ti-x text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              {scopeInfo && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs">
                  <div className="font-bold text-blue-900">{scopeInfo.title || '(제목 없음)'}</div>
                  <div className="text-blue-700 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {scopeInfo.instructorName && <span>강사: {scopeInfo.instructorName}</span>}
                    <span>가격: {scopeInfo.price.toLocaleString()}원</span>
                    {scopeInfo.upcomingScheduledAt && (
                      <span>가까운 일정: {new Date(scopeInfo.upcomingScheduledAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                    <span className="truncate">URL: <code className="text-[10px] bg-white/60 px-1 rounded">{scopeInfo.url}</code></span>
                  </div>
                  <p className="text-[10px] text-blue-600 mt-1">위 정보는 <code>{`{#TITLE#}`}</code>, <code>{`{#instructor_name#}`}</code>, <code>{`{#course_url#}`}</code> 등으로 자동 치환됩니다.</p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">라벨 (관리용)</label>
                <input value={editing.label ?? ''} onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="예: 강의 D-3 안내, 시작 30분 전 리마인더, 모임신청마감"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">발송 트리거</label>
                <div className="flex gap-2">
                  {(['time_offset', 'enrollment_full', 'manual'] as TriggerType[]).map((t) => (
                    <button key={t} type="button"
                      onClick={() => setEditing({ ...editing, trigger_type: t })}
                      className={`flex-1 py-2 px-3 rounded text-xs font-medium border cursor-pointer ${
                        (editing.trigger_type ?? 'time_offset') === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}>
                      {TRIGGER_LABEL[t]}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {(editing.trigger_type ?? 'time_offset') === 'time_offset' && '구매 시점에 강의 일정 기준으로 큐잉. 매분 cron이 처리.'}
                  {editing.trigger_type === 'enrollment_full' && '정원(max_enrollments)이 다 차는 순간 모든 구매자에게 자동 일괄 발송. 1회만 발사.'}
                  {editing.trigger_type === 'manual' && '관리자가 "지금 발송" 버튼을 클릭할 때만 발송. 자동 발사 없음.'}
                </p>
              </div>

              {(editing.trigger_type ?? 'time_offset') === 'time_offset' && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">발송 시점</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {COMMON_PRESETS.map((p) => (
                      <button key={p.minutes} type="button" onClick={() => setEditing({ ...editing, offset_minutes: p.minutes })}
                        className={`px-2 py-1 text-[11px] rounded border cursor-pointer ${editing.offset_minutes === p.minutes ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const cur = Number(editing.offset_minutes ?? 0)
                    const direction: 'before' | 'start' | 'after' = cur < 0 ? 'before' : cur > 0 ? 'after' : 'start'
                    const absMin = Math.abs(cur)
                    const unit: 'minute' | 'hour' | 'day' = absMin > 0 && absMin % 1440 === 0 ? 'day' : absMin % 60 === 0 && absMin > 0 ? 'hour' : 'minute'
                    const amount = unit === 'day' ? absMin / 1440 : unit === 'hour' ? absMin / 60 : absMin
                    const apply = (amt: number, u: 'minute' | 'hour' | 'day', dir: 'before' | 'start' | 'after') => {
                      if (dir === 'start') return setEditing({ ...editing, offset_minutes: 0 })
                      const mins = u === 'day' ? amt * 1440 : u === 'hour' ? amt * 60 : amt
                      setEditing({ ...editing, offset_minutes: dir === 'before' ? -Math.abs(mins) : Math.abs(mins) })
                    }
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={direction}
                          onChange={(e) => apply(amount || 0, unit, e.target.value as 'before' | 'start' | 'after')}
                          className="border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-[#2ED573] bg-white"
                        >
                          <option value="before">강의 전</option>
                          <option value="start">강의 시작 시</option>
                          <option value="after">강의 후</option>
                        </select>
                        {direction !== 'start' && (
                          <>
                            <input
                              type="number"
                              min={0}
                              value={amount || ''}
                              placeholder="0"
                              onChange={(e) => apply(Number(e.target.value || 0), unit, direction)}
                              className="w-20 border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-[#2ED573] text-right"
                            />
                            <select
                              value={unit}
                              onChange={(e) => apply(amount || 0, e.target.value as 'minute' | 'hour' | 'day', direction)}
                              className="border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-[#2ED573] bg-white"
                            >
                              <option value="minute">분</option>
                              <option value="hour">시간</option>
                              <option value="day">일</option>
                            </select>
                          </>
                        )}
                      </div>
                    )
                  })()}
                  <p className="text-[10px] text-gray-400 mt-1">현재: <strong>{offsetLabel(Number(editing.offset_minutes ?? 0))}</strong> ({Number(editing.offset_minutes ?? 0)}분)</p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">전달 파라미터 (shoong API에 보낼 형식)</label>
                <textarea value={editing.request_template ?? ''}
                  onChange={(e) => {
                    let val = e.target.value
                    // shoong cURL 자동 추출
                    const t = val.trim()
                    if (t.startsWith('curl ') || /\s-d\s+['"]/.test(t)) {
                      const dIdx = t.lastIndexOf("-d '")
                      if (dIdx !== -1) {
                        const start = dIdx + 4
                        const end = t.lastIndexOf("'")
                        if (end > start) {
                          const body = t.slice(start, end).trim()
                          if (body.startsWith('{')) {
                            val = body.replace(/"phone"\s*:\s*"01012345678"/g, '"phone":"{#ITEM2_NOH#}"')
                            toast.success('cURL에서 JSON 본문 자동 추출됨')
                          }
                        }
                      }
                    }
                    setEditing({ ...editing, request_template: val })
                  }}
                  rows={8}
                  placeholder={`shoong "코드 예제" cURL 통째 붙여넣기 OK (자동 추출)\n\n또는 JSON 직접:\n{\n  "sendType":"at",\n  "phone":"{#ITEM2_NOH#}",\n  "channelConfig.senderkey":"...",\n  "channelConfig.templatecode":"...",\n  "variables.강의명":"{#TITLE#}",\n  "variables.강사명":"{#instructor_name#}",\n  "variables.일시":"{#강의일시#}",\n  "variables.링크":"{#course_url#}"\n}`}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573] font-mono resize-none" />
                <div className="mt-2 flex items-center gap-2">
                  <button type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded px-2 py-1 border-none cursor-pointer">
                    <i className="ti ti-eye mr-0.5" />{showPreview ? '미리보기 닫기' : '치환 미리보기'}
                  </button>
                  <span className="text-[10px] text-gray-400">이 {scope === 'course' ? '강의' : '전자책'} 정보 + 샘플 사용자로 치환된 결과</span>
                </div>
                {showPreview && editing.request_template && (
                  <pre className="mt-2 text-[11px] text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                    {resolveTemplate(editing.request_template, buildScopeVars(scopeInfo))}
                  </pre>
                )}

                <details className="mt-2">
                  <summary className="text-[11px] text-gray-600 cursor-pointer hover:text-gray-900">📚 사용 가능한 예약어 (자동 채움)</summary>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] bg-gray-50 rounded p-2">
                    <div>
                      <p className="font-bold text-gray-700 mb-1">강의/상품 정보 (자동)</p>
                      <ul className="space-y-0.5 text-gray-600">
                        <li><code>{`{#TITLE#}`}</code> <code>{`{#강의명#}`}</code> <code>{`{#모임명#}`}</code> <code>{`{#수업명#}`}</code> <code>{`{#상품명#}`}</code> <code>{`{#클래스명#}`}</code> — 제목</li>
                        <li><code>{`{#instructor_name#}`}</code> <code>{`{#강사명#}`}</code> <code>{`{#강사#}`}</code> <code>{`{#선생님#}`}</code> — 강사 이름</li>
                        <li><code>{`{#course_url#}`}</code> <code>{`{#URL#}`}</code> <code>{`{#링크#}`}</code> — 페이지 URL</li>
                        <li><code>{`{#price#}`}</code> <code>{`{#가격#}`}</code> <code>{`{#금액#}`}</code> — 가격</li>
                        <li><code>{`{#DATE#}`}</code> <code>{`{#날짜#}`}</code> <code>{`{#SCHEDULED_DATE#}`}</code> — 날짜</li>
                        <li><code>{`{#TIME#}`}</code> <code>{`{#시간#}`}</code> — 시간</li>
                        <li><code>{`{#일시#}`}</code> <code>{`{#강의일시#}`}</code> <code>{`{#모임일시#}`}</code> — "2026년 4월 24일 19:30"</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-bold text-gray-700 mb-1">사용자 정보 (자동)</p>
                      <ul className="space-y-0.5 text-gray-600">
                        <li><code>{`{#user_name#}`}</code> <code>{`{#이름#}`}</code> <code>{`{#고객명#}`}</code> <code>{`{#성함#}`}</code> <code>{`{#ITEM1#}`}</code> — 이름</li>
                        <li><code>{`{#user_phone#}`}</code> <code>{`{#연락처#}`}</code> <code>{`{#전화번호#}`}</code> <code>{`{#ITEM2#}`}</code> — 010-xxxx-xxxx</li>
                        <li><code>{`{#ITEM2_NOH#}`}</code> — 01012345678 (shoong용)</li>
                        <li><code>{`{#user_email#}`}</code> <code>{`{#이메일#}`}</code> — 이메일</li>
                        <li><code>{`{#DBNO#}`}</code> — 데이터 고유번호</li>
                      </ul>
                    </div>
                  </div>
                </details>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="enabled" checked={editing.enabled ?? true}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                  className="accent-[#2ED573]" />
                <label htmlFor="enabled" className="text-sm text-gray-700 cursor-pointer">활성화</label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm cursor-pointer hover:bg-gray-50">취소</button>
              <button onClick={handleSave} disabled={analyzing}
                className="px-4 py-2 rounded-lg bg-[#2ED573] text-white text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] disabled:opacity-50">
                {analyzing ? '분석 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LLM 기반 변수 매핑 확인 모달 — 예약 알림톡용 */}
      {aliasConfirm && (
        <TemplateAliasConfirmModal
          isOpen
          unknownVars={aliasConfirm.unknownVars}
          suggestedAliases={aliasConfirm.suggestedAliases}
          emptySlots={aliasConfirm.emptySlots}
          suggestedSlotFills={aliasConfirm.suggestedSlotFills}
          warning={aliasConfirm.warning}
          onCancel={() => setAliasConfirm(null)}
          onConfirm={(aliases, slotFills) => performSave(aliases, slotFills)}
        />
      )}

      {/* LLM 기반 변수 매핑 확인 모달 — 구매 즉시 알림톡용 */}
      {purchaseAliasConfirm && (
        <TemplateAliasConfirmModal
          isOpen
          unknownVars={purchaseAliasConfirm.unknownVars}
          suggestedAliases={purchaseAliasConfirm.suggestedAliases}
          emptySlots={purchaseAliasConfirm.emptySlots}
          suggestedSlotFills={purchaseAliasConfirm.suggestedSlotFills}
          warning={purchaseAliasConfirm.warning}
          onCancel={() => setPurchaseAliasConfirm(null)}
          onConfirm={(aliases, slotFills) => {
            const filledTemplate = Object.keys(slotFills).length > 0
              ? fillEmptySlots(purchaseTemplate, slotFills)
              : purchaseTemplate
            setPurchaseTemplate(filledTemplate)
            performSavePurchase(filledTemplate, aliases)
          }}
        />
      )}
    </div>
  )
}
