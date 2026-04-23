import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { webhookService } from '../../services/webhookService'
import { normalizeAlimtalkKeys } from '../../utils/webhookTemplate'
import TemplateAliasConfirmModal from './TemplateAliasConfirmModal'

interface CustomEventDef {
  id: number
  code: string
  label: string
  description: string | null
  template: string
  enabled: boolean
}

interface Override {
  id: number
  event_code: string
  scope: string
  scope_id: number
  template: string
  enabled: boolean
  variable_aliases?: Record<string, string>
}

interface Props {
  scope: 'coupon' | 'course' | 'ebook'
  scopeId: number
  eventCodes: string[]
  /** 자동 주입 변수 안내 (미리보기용) */
  autoVars?: Array<{ name: string; code: string; sample: string }>
  /** 상단 배너에 표시할 현재 대상 정보 */
  contextBanner?: React.ReactNode
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{#([^#\s]+)#\}/g, (_, k) => vars[k] ?? `{#${k}#}`)
}

function fillEmptySlots(template: string, slotFills: Record<string, string>): string {
  let out = template
  for (const [slot, value] of Object.entries(slotFills)) {
    if (!value) continue
    const esc = slot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`"variables\\.${esc}"\\s*:\\s*""`, 'g')
    const isLiteral = /^https?:\/\//i.test(value) || (/[\s/:?=&]/.test(value) && !/^[A-Za-z0-9_가-힣]+$/.test(value))
    const escapedValue = isLiteral ? JSON.stringify(value).slice(1, -1) : `{#${value}#}`
    out = out.replace(re, `"variables.${slot}":"${escapedValue}"`)
  }
  return out
}

export default function CustomEventOverrideEditor({ scope, scopeId, eventCodes, autoVars, contextBanner }: Props) {
  const [events, setEvents] = useState<CustomEventDef[]>([])
  const [overrides, setOverrides] = useState<Override[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, { enabled: boolean; template: string }>>({})
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [previewCode, setPreviewCode] = useState<string | null>(null)
  const [aliasConfirm, setAliasConfirm] = useState<{
    code: string
    unknownVars: string[]
    suggestedAliases: Record<string, { canonical: string; reason: string }>
    emptySlots: string[]
    suggestedSlotFills: Record<string, { canonical: string; reason: string }>
    warning?: string
  } | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [allEvents, ovs] = await Promise.all([
        webhookService.listCustomEvents(),
        webhookService.listCustomEventOverrides(scope, scopeId),
      ])
      const filtered = (allEvents as CustomEventDef[]).filter((e) => eventCodes.includes(e.code))
      setEvents(filtered)
      setOverrides(ovs as Override[])

      // draft 초기화
      const map: Record<string, { enabled: boolean; template: string }> = {}
      for (const e of filtered) {
        const ov = (ovs as Override[]).find((o) => o.event_code === e.code)
        map[e.code] = ov
          ? { enabled: ov.enabled, template: ov.template }
          : { enabled: false, template: '' }
      }
      setDrafts(map)
    } finally {
      setLoading(false)
    }
  }, [scope, scopeId, eventCodes])

  useEffect(() => { fetchAll() }, [fetchAll])

  const getDefaultTemplate = (code: string) => events.find((e) => e.code === code)?.template ?? ''
  const getOverride = (code: string) => overrides.find((o) => o.event_code === code)

  const performSaveOverride = async (code: string, aliases: Record<string, string>, slotFills: Record<string, string>) => {
    const draft = drafts[code]
    if (!draft) return
    const existing = getOverride(code)
    setSavingCode(code)
    try {
      const filledTemplate = Object.keys(slotFills).length > 0
        ? fillEmptySlots(draft.template, slotFills)
        : draft.template
      await webhookService.upsertCustomEventOverride({
        id: existing?.id,
        event_code: code,
        scope,
        scope_id: scopeId,
        template: filledTemplate,
        enabled: true,
        variable_aliases: { ...(existing?.variable_aliases ?? {}), ...aliases },
      })
      toast.success('전용 템플릿 저장됨')
      setAliasConfirm(null)
      await fetchAll()
    } catch {
      toast.error('저장 실패')
    } finally {
      setSavingCode(null)
    }
  }

  const handleSave = async (code: string) => {
    const draft = drafts[code]
    if (!draft) return
    const existing = getOverride(code)
    if (!draft.enabled) {
      if (existing) {
        setSavingCode(code)
        try {
          await webhookService.deleteCustomEventOverride(existing.id)
          toast.success('전용 설정 해제 (기본값 사용)')
          await fetchAll()
        } catch {
          toast.error('저장 실패')
        } finally {
          setSavingCode(null)
        }
      }
      return
    }
    if (!draft.template.trim()) {
      toast.error('템플릿을 입력해주세요.')
      return
    }
    // 미확인 변수 분석 → 매핑 제안
    setSavingCode(code)
    try {
      const analysis = await webhookService.analyzeTemplateVariables(draft.template)
      const unknownVars = analysis.unknown_vars ?? []
      const emptySlots = analysis.empty_slots ?? []
      const suggestedAliases = analysis.suggested_aliases ?? {}
      const suggestedSlotFills = analysis.suggested_slot_fills ?? {}
      if (unknownVars.length > 0 || emptySlots.length > 0) {
        setAliasConfirm({ code, unknownVars, suggestedAliases, emptySlots, suggestedSlotFills, warning: analysis.warning })
        setSavingCode(null)
        return
      }
      if (analysis.warning) toast(analysis.warning, { icon: 'ℹ️', duration: 5000 })
      await performSaveOverride(code, {}, {})
    } catch (err) {
      toast.error('변수 분석 중 오류, alias 없이 저장합니다.')
      console.error(err)
      await performSaveOverride(code, {}, {})
    }
  }

  const handleTextareaChange = (code: string, val: string) => {
    // shoong cURL 자동 추출
    const t = val.trim()
    let next = val
    if (t.startsWith('curl ') || /\s-d\s+['"]/.test(t)) {
      const dIdx = t.lastIndexOf("-d '")
      if (dIdx !== -1) {
        const start = dIdx + 4
        const end = t.lastIndexOf("'")
        if (end > start) {
          const body = t.slice(start, end).trim()
          if (body.startsWith('{')) {
            // shoong cURL이 버튼 링크 키를 `variables.{링크명5` 처럼 `}` 없이 내려주는 버그 보정
            next = normalizeAlimtalkKeys(
              body.replace(/"phone"\s*:\s*"01012345678"/g, '"phone":"{#ITEM2_NOH#}"'),
            )
            toast.success('cURL에서 JSON 본문 자동 추출됨')
          }
        }
      }
    }
    setDrafts({ ...drafts, [code]: { ...drafts[code], template: next } })
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>
  }

  const sampleVars: Record<string, string> = Object.fromEntries(
    (autoVars ?? []).map((v) => [v.code, v.sample])
  )

  return (
    <div className="space-y-4">
      {contextBanner && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-900">
          {contextBanner}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-[11px] text-gray-600 flex items-start gap-2">
        <i className="ti ti-info-circle text-gray-400 mt-0.5" />
        <div>
          기본 템플릿은 <Link to="/admin/webhook" className="font-bold underline">기본 웹훅 설정</Link>에서 관리됩니다.
          여기서는 이 {scope === 'coupon' ? '쿠폰' : scope === 'course' ? '강의' : '전자책'} 전용 템플릿을 덮어씌울 수 있습니다.
          비활성 상태면 기본 템플릿이 그대로 사용됩니다.
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">사용 가능한 이벤트 정의가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const draft = drafts[e.code] ?? { enabled: false, template: '' }
            const defaultTpl = getDefaultTemplate(e.code)
            const hasOverride = !!getOverride(e.code)
            const showPreview = previewCode === e.code
            return (
              <div key={e.code} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      {e.label}
                      {hasOverride && draft.enabled && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">전용 템플릿</span>
                      )}
                      {!hasOverride && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">기본값 사용 중</span>
                      )}
                    </h4>
                    {e.description && <p className="text-[11px] text-gray-500 mt-0.5">{e.description}</p>}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] text-gray-500">{draft.enabled ? '전용 사용' : '기본값 사용'}</span>
                    <button type="button"
                      onClick={() => setDrafts({ ...drafts, [e.code]: { ...draft, enabled: !draft.enabled, template: !draft.enabled && !draft.template ? defaultTpl : draft.template } })}
                      className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer border-none ${draft.enabled ? 'bg-[#2ED573]' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${draft.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                </div>

                {draft.enabled ? (
                  <>
                    <textarea
                      value={draft.template}
                      onChange={(ev) => handleTextareaChange(e.code, ev.target.value)}
                      rows={8}
                      placeholder={defaultTpl || 'shoong JSON 또는 cURL 통째 붙여넣기'}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#2ED573] font-mono resize-none"
                    />
                    <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <button type="button"
                          onClick={() => setDrafts({ ...drafts, [e.code]: { ...draft, template: defaultTpl } })}
                          className="text-[11px] text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded px-2 py-1 border-none cursor-pointer">
                          기본값 불러오기
                        </button>
                        <button type="button"
                          onClick={() => setPreviewCode(showPreview ? null : e.code)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded px-2 py-1 border-none cursor-pointer">
                          {showPreview ? '미리보기 닫기' : '치환 미리보기'}
                        </button>
                      </div>
                      <button
                        onClick={() => handleSave(e.code)}
                        disabled={savingCode === e.code}
                        className="bg-[#2ED573] text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none hover:bg-[#25B866] disabled:opacity-50">
                        {savingCode === e.code ? '저장 중...' : '저장'}
                      </button>
                    </div>
                    {showPreview && (
                      <pre className="mt-2 text-[11px] text-gray-600 bg-gray-50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                        {applyTemplate(draft.template, sampleVars)}
                      </pre>
                    )}
                  </>
                ) : (
                  <div className="bg-gray-50 rounded p-2 text-[11px] text-gray-500 space-y-1">
                    <p className="font-bold text-gray-600">현재 사용 중: 기본 템플릿</p>
                    <pre className="font-mono text-[10px] break-all whitespace-pre-wrap">{defaultTpl || '(기본 템플릿 미설정)'}</pre>
                    {hasOverride && (
                      <button
                        onClick={() => handleSave(e.code)}
                        disabled={savingCode === e.code}
                        className="text-[11px] text-red-600 hover:text-red-800 bg-transparent border-none cursor-pointer underline disabled:opacity-50">
                        기존 전용 설정 삭제
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {autoVars && autoVars.length > 0 && (
        <details className="bg-white border border-gray-200 rounded-xl p-3">
          <summary className="text-[11px] text-gray-600 cursor-pointer hover:text-gray-900 font-bold">
            📚 이 {scope === 'coupon' ? '쿠폰' : scope === 'course' ? '강의' : '전자책'}에서 자동 채워지는 변수 ({autoVars.length}개)
          </summary>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[10px]">
            {autoVars.map((v) => (
              <div key={v.code} className="flex items-start gap-1.5">
                <code className="text-[#2ED573] bg-green-50 px-1 py-0.5 rounded text-[10px] shrink-0">{`{#${v.code}#}`}</code>
                <span className="text-gray-600">
                  <strong>{v.name}</strong> — {v.sample}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {aliasConfirm && (
        <TemplateAliasConfirmModal
          isOpen
          unknownVars={aliasConfirm.unknownVars}
          suggestedAliases={aliasConfirm.suggestedAliases}
          emptySlots={aliasConfirm.emptySlots}
          suggestedSlotFills={aliasConfirm.suggestedSlotFills}
          warning={aliasConfirm.warning}
          onCancel={() => setAliasConfirm(null)}
          onConfirm={(aliases, slotFills) => performSaveOverride(aliasConfirm.code, aliases, slotFills)}
        />
      )}
    </div>
  )
}
