import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { webhookScheduleService, type WebhookSchedule, type WebhookScheduleRun, type TriggerType } from '../../services/webhookScheduleService'
import { webhookService, type WebhookConfig } from '../../services/webhookService'

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
  const [overrideEnabled, setOverrideEnabled] = useState(false)
  const [savingPurchase, setSavingPurchase] = useState(false)

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
    if (s.id && s.purchase_template) {
      setPurchaseTemplate(s.purchase_template)
      setOverrideEnabled(true)
    } else {
      setPurchaseTemplate(g.purchase_template || '')
      setOverrideEnabled(false)
    }
  }, [scope, scopeId])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])
  useEffect(() => { fetchConfigs() }, [fetchConfigs])

  const handleSavePurchaseTemplate = async () => {
    if (!globalConfig) return
    setSavingPurchase(true)
    try {
      if (overrideEnabled) {
        // 강의별 override 저장 — global URL/auth 상속 + purchase_template만 교체
        await webhookService.saveConfig({
          ...globalConfig,
          ...(scopedConfig || {}),
          id: scopedConfig?.id,
          scope,
          scope_id: scopeId,
          enabled: true,
          purchase_template: purchaseTemplate,
          label: scopedConfig?.label || `${scope === 'course' ? '강의' : '전자책'}#${scopeId} 전용`,
        })
        toast.success('이 강의 전용 구매 알림톡 저장됨')
      } else if (scopedConfig?.id) {
        // override 해제 — 기존 scoped row 삭제하여 global로 폴백
        await webhookService.deleteConfig(scopedConfig.id)
        toast.success('전용 설정 해제 (기본 설정 사용)')
      }
      fetchConfigs()
    } catch {
      toast.error('저장 실패')
    } finally {
      setSavingPurchase(false)
    }
  }

  const handleSave = async () => {
    if (!editing) return
    if (!editing.label?.trim()) { toast.error('라벨을 입력해주세요.'); return }
    if (!editing.request_template?.trim()) { toast.error('전달 파라미터를 입력해주세요.'); return }
    try {
      await webhookScheduleService.upsert({
        ...editing,
        scope,
        scope_id: scopeId,
        trigger_type: (editing.trigger_type as TriggerType) || 'time_offset',
        offset_minutes: Number(editing.offset_minutes ?? 0),
        enabled: editing.enabled ?? true,
      })
      toast.success('저장되었습니다.')
      setEditing(null)
      fetchSchedules()
    } catch {
      toast.error('저장 실패')
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
            <span className="text-xs text-gray-500">{overrideEnabled ? '이 강의 전용' : '기본 설정 사용'}</span>
            <button type="button"
              onClick={() => setOverrideEnabled((v) => !v)}
              className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer border-none ${overrideEnabled ? 'bg-[#2ED573]' : 'bg-gray-300'}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${overrideEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>
        {overrideEnabled ? (
          <>
            <textarea value={purchaseTemplate} onChange={(e) => setPurchaseTemplate(e.target.value)}
              rows={5}
              placeholder={`예:\nsendType=at&phone={#user_phone#}&channelConfig.senderkey=YOUR_KEY&channelConfig.templatecode=m_3&variables.이름={#user_name#}&variables.강의명={#title#}`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573] font-mono resize-none" />
            <p className="text-[10px] text-gray-400 mt-1">사용 변수: <code>{`{#user_name#}`}</code> <code>{`{#user_phone#}`}</code> <code>{`{#user_email#}`}</code> <code>{`{#title#}`}</code> <code>{`{#price#}`}</code> <code>{`{#TITLE#}`}</code> <code>{`{#DBNO#}`}</code></p>
            <div className="flex justify-end mt-3">
              <button onClick={handleSavePurchaseTemplate} disabled={savingPurchase}
                className="bg-[#2ED573] text-white px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none hover:bg-[#25B866] disabled:opacity-50">
                {savingPurchase ? '저장 중...' : '저장'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-500 bg-gray-50 rounded p-3 space-y-1">
            <div>이 강의 구매 시 <strong>기본 구매 알림톡</strong>이 사용됩니다.</div>
            <pre className="text-[11px] font-mono text-gray-600 break-all whitespace-pre-wrap">{globalConfig?.purchase_template || '(기본 설정에 구매 템플릿 미입력)'}</pre>
            {scopedConfig?.id && (
              <button onClick={handleSavePurchaseTemplate} disabled={savingPurchase}
                className="mt-2 text-[11px] text-red-600 hover:text-red-800 bg-transparent border-none cursor-pointer underline">
                기존 전용 설정 삭제 (기본으로 복귀)
              </button>
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
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.enabled ? '활성' : '비활성'}
                  </span>
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
          onClick={(e) => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing.id ? '예약 알림톡 수정' : '예약 알림톡 추가'}</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer">
                <i className="ti ti-x text-xl" />
              </button>
            </div>

            <div className="space-y-4">
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
                  <label className="text-xs font-bold text-gray-700 block mb-1">발송 시점 (강의 시작 기준 분)</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {COMMON_PRESETS.map((p) => (
                      <button key={p.minutes} type="button" onClick={() => setEditing({ ...editing, offset_minutes: p.minutes })}
                        className={`px-2 py-1 text-[11px] rounded border cursor-pointer ${editing.offset_minutes === p.minutes ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" value={editing.offset_minutes ?? 0}
                      onChange={(e) => setEditing({ ...editing, offset_minutes: Number(e.target.value) })}
                      className="w-32 border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-[#2ED573]" />
                    <span className="text-xs text-gray-500">분 (음수: 강의 전 / 양수: 강의 후 / 0: 강의 시작 시)</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">현재: {offsetLabel(Number(editing.offset_minutes ?? 0))}</p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">전달 파라미터 (shoong API에 보낼 형식)</label>
                <textarea value={editing.request_template ?? ''}
                  onChange={(e) => setEditing({ ...editing, request_template: e.target.value })}
                  rows={6}
                  placeholder={`예:\nsendType=at&phone={#user_phone#}&channelConfig.senderkey=YOUR_SENDER_KEY&channelConfig.templatecode=start_3&variables.이름={#user_name#}&variables.강의명={#TITLE#}&variables.일시={#DATE#} {#TIME#}`}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573] font-mono resize-none" />
                <p className="text-[10px] text-gray-400 mt-1">사용 가능한 예약어: <code>{`{#TITLE#}`}</code>(강의명) <code>{`{#DATE#}`}</code>(강의 날짜) <code>{`{#TIME#}`}</code>(강의 시간) <code>{`{#user_name#}`}</code> <code>{`{#user_phone#}`}</code> <code>{`{#user_email#}`}</code> <code>{`{#DBNO#}`}</code></p>
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
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-[#2ED573] text-white text-sm font-bold cursor-pointer border-none hover:bg-[#25B866]">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
