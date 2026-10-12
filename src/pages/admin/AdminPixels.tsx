import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import { supabase } from '../../lib/supabase'
import { MEDIA, STD_EVENTS, getMedia, isProductionHost, type AdPixelRow, type MediaId, type StdEvent } from '../../lib/pixels/media'

interface LogRow {
  id: number
  pixel_id: number | null
  media: string | null
  action: 'insert' | 'update' | 'delete'
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  changed_by: string | null
  changed_at: string
}

const FIELD_LABEL: Record<string, string> = {
  enabled: '사용', scope: '적용 범위', pixel_id: 'ID', events: '이벤트', extra: '라벨/이름', memo: '메모', sort_order: '순서', media: '매체',
}

/** 변경 이력 요약 — 바뀐 항목만 "필드: 이전 → 이후" */
function summarizeChange(log: LogRow): string {
  if (log.action === 'insert') return '추가'
  if (log.action === 'delete') return `삭제 (ID ${String(log.before?.pixel_id ?? '')})`
  const b = log.before ?? {}, a = log.after ?? {}
  const parts: string[] = []
  for (const k of Object.keys(FIELD_LABEL)) {
    const bv = JSON.stringify(b[k] ?? null), av = JSON.stringify(a[k] ?? null)
    if (bv === av) continue
    if (k === 'enabled') parts.push(`사용 ${b[k] ? 'ON' : 'OFF'} → ${a[k] ? 'ON' : 'OFF'}`)
    else if (k === 'events') {
      const be = (b[k] ?? {}) as Record<string, boolean>, ae = (a[k] ?? {}) as Record<string, boolean>
      const on = STD_EVENTS.filter((e) => ae[e.key] && !be[e.key]).map((e) => e.label)
      const off = STD_EVENTS.filter((e) => !ae[e.key] && be[e.key]).map((e) => e.label)
      if (on.length) parts.push(`이벤트 켬: ${on.join(', ')}`)
      if (off.length) parts.push(`이벤트 끔: ${off.join(', ')}`)
    } else if (k === 'extra') parts.push('라벨/이름 변경')
    else parts.push(`${FIELD_LABEL[k]}: ${String(b[k] ?? '-')} → ${String(a[k] ?? '-')}`)
  }
  return parts.join(' / ') || '변경 없음'
}

export default function AdminPixels() {
  const [rows, setRows] = useState<AdPixelRow[]>([])
  const [drafts, setDrafts] = useState<Record<number, AdPixelRow>>({})
  const [logs, setLogs] = useState<LogRow[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [isSuper, setIsSuper] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [addMedia, setAddMedia] = useState<MediaId | ''>('')

  const load = useCallback(() => {
    Promise.all([
      supabase.from('ad_pixels' as never).select('*').order('sort_order').order('id'),
      supabase.from('ad_pixel_logs' as never).select('*').order('changed_at', { ascending: false }).limit(50),
      supabase.rpc('is_super_admin' as never),
    ]).then(async ([px, lg, sup]) => {
      const list = (px.data ?? []) as unknown as AdPixelRow[]
      setRows(list)
      setDrafts(Object.fromEntries(list.map((r) => [r.id, structuredClone(r)])))
      const logList = (lg.data ?? []) as unknown as LogRow[]
      setLogs(logList)
      setIsSuper(sup.data === true)
      const ids = [...new Set(logList.map((l) => l.changed_by).filter(Boolean))] as string[]
      if (ids.length) {
        const { data } = await supabase.from('profiles').select('id, name, email').in('id', ids)
        setNames(Object.fromEntries(((data ?? []) as { id: string; name: string | null; email: string | null }[]).map((p) => [p.id, p.name || p.email || '알 수 없음'])))
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

  const patch = (id: number, fn: (d: AdPixelRow) => void) =>
    setDrafts((prev) => {
      const next = structuredClone(prev[id])
      fn(next)
      return { ...prev, [id]: next }
    })

  const dirty = useMemo(() => {
    const out = new Set<number>()
    for (const r of rows) if (JSON.stringify(r) !== JSON.stringify(drafts[r.id])) out.add(r.id)
    return out
  }, [rows, drafts])

  const save = async (id: number) => {
    const d = drafts[id]
    const def = getMedia(d.media)
    const pid = d.pixel_id.trim()
    if (d.enabled && !pid) { toast.error(`${def?.idLabel ?? 'ID'}를 입력해주세요.`); return }
    if (pid && def?.pattern && !def.pattern.test(pid)) { toast.error(`${def.idLabel} 형식이 맞지 않습니다 (${def.patternHint}).`); return }
    setSavingId(id)
    const { error } = await supabase.from('ad_pixels' as never).update({
      enabled: d.enabled, scope: d.scope, pixel_id: pid, events: d.events, extra: d.extra, memo: d.memo?.trim() || null,
    } as never).eq('id', id)
    setSavingId(null)
    if (error) { toast.error('저장에 실패했습니다.'); return }
    toast.success('저장했습니다. 사이트에는 새로 여는 페이지부터 바로 적용됩니다.')
    load()
  }

  const remove = async (id: number) => {
    const { error } = await supabase.from('ad_pixels' as never).delete().eq('id', id)
    if (error) { toast.error('삭제에 실패했습니다.'); return }
    toast.success('삭제했습니다.')
    load()
  }

  const add = async () => {
    if (!addMedia) return
    const def = getMedia(addMedia)!
    const events = Object.fromEntries(def.supported.map((e) => [e, true]))
    const { error } = await supabase.from('ad_pixels' as never).insert({
      media: addMedia, enabled: false, scope: 'preview', pixel_id: '', events, extra: {},
      sort_order: (MEDIA.findIndex((m) => m.id === addMedia) + 1) * 10 + 5,
    } as never)
    if (error) { toast.error('추가에 실패했습니다.'); return }
    setAddMedia('')
    toast.success('추가했습니다. ID 를 입력하고 저장하세요.')
    load()
  }

  const canAdd = (m: (typeof MEDIA)[number]) => m.multiple || !rows.some((r) => r.media === m.id)
  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573] bg-white disabled:bg-gray-50 disabled:text-gray-400'

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">픽셀 관리</h1>
        <p className="text-sm text-gray-500 mt-1">광고 매체별 픽셀·태그를 켜고, 매체마다 보낼 전환 이벤트를 고릅니다. 이벤트 발생 지점은 사이트에 이미 구현된 그대로 쓰입니다.</p>
      </div>

      {!isSuper && !loading && (
        <div className="mb-4 rounded-xl bg-amber-50 text-amber-700 text-sm px-4 py-3">
          <i className="ti ti-lock mr-1" />픽셀 설정은 최고관리자만 수정할 수 있습니다. 지금은 보기만 가능합니다.
        </div>
      )}
      <div className="mb-4 rounded-xl bg-white shadow-sm text-xs text-gray-500 px-4 py-3 leading-relaxed">
        <b className="text-gray-700">적용 범위</b> — <b>미리보기만</b>: Vercel 미리보기 주소·로컬에서만 동작(운영 amag-class.com 에는 로드 안 됨). 새 매체는 미리보기에서 확인한 뒤 <b>운영+미리보기</b>로 바꾸세요.
        지금 이 화면은 <b>{isProductionHost() ? '운영' : '미리보기'}</b> 주소입니다. · 매체를 끄면 스크립트 자체를 불러오지 않습니다. · 개인정보(이메일·전화)는 어떤 매체로도 보내지 않습니다.
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-40 bg-white rounded-xl" />)}</div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const d = drafts[r.id] ?? r
            const def = getMedia(d.media)
            if (!def) return null
            const ro = !isSuper
            const pid = d.pixel_id.trim()
            const invalid = !!pid && !!def.pattern && !def.pattern.test(pid)
            return (
              <div key={r.id} className={`bg-white rounded-xl shadow-sm p-5 ${d.enabled ? '' : 'opacity-90'}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-sm font-bold text-gray-900">{def.name}</h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${d.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{d.enabled ? '사용함' : '사용안함'}</span>
                    {d.enabled && d.scope === 'preview' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">미리보기만</span>}
                    {dirty.has(r.id) && <span className="text-[10px] text-amber-600">저장 안 됨</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" className="accent-[#2ED573]" checked={d.enabled} disabled={ro}
                        onChange={(e) => patch(r.id, (x) => { x.enabled = e.target.checked })} />
                      사용
                    </label>
                    <select value={d.scope} disabled={ro} onChange={(e) => patch(r.id, (x) => { x.scope = e.target.value as 'all' | 'preview' })}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white" aria-label="적용 범위">
                      <option value="all">운영+미리보기</option>
                      <option value="preview">미리보기만</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label htmlFor={`px-id-${r.id}`} className="text-xs font-bold text-gray-700 block mb-1">{def.idLabel}</label>
                    <input id={`px-id-${r.id}`} value={d.pixel_id} disabled={ro} placeholder={def.placeholder}
                      onChange={(e) => patch(r.id, (x) => { x.pixel_id = e.target.value })}
                      className={`${inputCls} font-mono ${invalid ? 'border-red-300' : ''}`} />
                    {invalid && <p className="text-[11px] text-red-500 mt-1">형식: {def.patternHint}</p>}
                  </div>
                  <div>
                    <label htmlFor={`px-memo-${r.id}`} className="text-xs font-bold text-gray-700 block mb-1">메모</label>
                    <input id={`px-memo-${r.id}`} value={d.memo ?? ''} disabled={ro} placeholder="예) 2호 픽셀(리타게팅용)"
                      onChange={(e) => patch(r.id, (x) => { x.memo = e.target.value })} className={inputCls} />
                  </div>
                </div>

                {def.supported.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-bold text-gray-700 mb-1.5">보낼 이벤트</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {STD_EVENTS.map((e) => {
                        const ok = def.supported.includes(e.key)
                        return (
                          <label key={e.key} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-gray-700 cursor-pointer' : 'text-gray-300'}`}
                            title={ok ? `${def.name}: ${def.eventNames?.[e.key] ?? e.key}` : '이 매체로는 보내지 않는 이벤트'}>
                            <input type="checkbox" className="accent-[#2ED573]" disabled={ro || !ok}
                              checked={ok && !!d.events[e.key]}
                              onChange={(ev) => patch(r.id, (x) => { x.events = { ...x.events, [e.key]: ev.target.checked } })} />
                            {e.label}{!ok && ' –'}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {d.media === 'google_ads' && (
                  <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(['Lead', 'CompleteRegistration', 'Purchase', 'OpenChatJoin'] as StdEvent[]).map((e) => (
                      <div key={e}>
                        <label htmlFor={`px-label-${r.id}-${e}`} className="text-[11px] text-gray-500 block mb-0.5">{STD_EVENTS.find((x) => x.key === e)?.label} 전환 라벨</label>
                        <input id={`px-label-${r.id}-${e}`} value={d.extra.labels?.[e] ?? ''} disabled={ro} placeholder="비워 두면 전송 안 함"
                          onChange={(ev) => patch(r.id, (x) => { x.extra = { ...x.extra, labels: { ...x.extra.labels, [e]: ev.target.value } } })}
                          className={`${inputCls} font-mono text-xs`} />
                      </div>
                    ))}
                  </div>
                )}

                {d.media === 'taboola' && (
                  <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {def.supported.map((e) => (
                      <div key={e}>
                        <label htmlFor={`px-name-${r.id}-${e}`} className="text-[11px] text-gray-500 block mb-0.5">{STD_EVENTS.find((x) => x.key === e)?.label} 이벤트 이름</label>
                        <input id={`px-name-${r.id}-${e}`} value={d.extra.names?.[e] ?? ''} disabled={ro} placeholder={def.eventNames?.[e]}
                          onChange={(ev) => patch(r.id, (x) => { x.extra = { ...x.extra, names: { ...x.extra.names, [e]: ev.target.value } } })}
                          className={`${inputCls} font-mono text-xs`} />
                      </div>
                    ))}
                  </div>
                )}

                {def.note && <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">{def.note}</p>}

                {!ro && (
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => remove(r.id)}
                      className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-white text-gray-500 cursor-pointer hover:text-red-500">삭제</button>
                    <button type="button" onClick={() => save(r.id)} disabled={!dirty.has(r.id) || savingId === r.id}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#2ED573] text-white border-none cursor-pointer hover:bg-[#25B866] disabled:opacity-40 disabled:cursor-not-allowed">
                      {savingId === r.id ? '저장 중...' : '저장'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {isSuper && (
            <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900 mr-1">매체 추가</span>
              <select value={addMedia} onChange={(e) => setAddMedia(e.target.value as MediaId | '')}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" aria-label="추가할 매체">
                <option value="">매체 선택</option>
                {MEDIA.map((m) => <option key={m.id} value={m.id} disabled={!canAdd(m)}>{m.name}{!canAdd(m) ? ' (1개만 가능)' : ''}</option>)}
              </select>
              <button type="button" onClick={add} disabled={!addMedia}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-900 text-white border-none cursor-pointer disabled:opacity-40">추가</button>
              <span className="text-xs text-gray-400">새 매체는 '미리보기만', 사용안함 상태로 추가됩니다.</span>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">변경 이력 (최근 50건)</h2>
            {logs.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">변경 이력이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-gray-600 whitespace-nowrap">시각</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600 whitespace-nowrap">변경자</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600 whitespace-nowrap">매체</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600">내용</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap tabular-nums">{new Date(l.changed_at).toLocaleString('ko-KR')}</td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{l.changed_by ? names[l.changed_by] ?? '…' : 'SQL/시스템'}</td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{getMedia(l.media ?? '')?.name ?? l.media}</td>
                        <td className="px-3 py-2 text-gray-600">{summarizeChange(l)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
