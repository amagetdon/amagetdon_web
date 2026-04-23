import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import { supabase } from '../../lib/supabase'
import { webhookService } from '../../services/webhookService'

type EventType = 'signup' | 'purchase' | 'refund' | 'cancel'

interface WebhookLogRow {
  id: number
  event_type: EventType
  config_scope: string | null
  config_scope_id: number | null
  user_id: string | null
  related_type: string | null
  related_id: number | null
  display_name: string | null
  display_phone: string | null
  display_email: string | null
  display_title: string | null
  ip: string | null
  user_agent: string | null
  referrer: string | null
  device_type: string | null
  submission_duration_ms: number | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  request_url: string | null
  request_method: string | null
  request_body: string | null
  response_status: number | null
  response_body: string | null
  send_status: string | null
  error_message: string | null
  memo: string
  resend_count: number
  last_resent_at: string | null
  resend_history: Array<{ at: string; send_status: string; response_status: number | null; response_body: string }>
  payload: Record<string, unknown> | null
  sent_at: string
}

const EVENT_LABELS: Record<EventType, string> = {
  signup: '회원가입',
  purchase: '구매',
  refund: '환불',
  cancel: '취소',
}

const EVENT_COLORS: Record<EventType, string> = {
  signup: 'bg-blue-100 text-blue-700',
  purchase: 'bg-emerald-100 text-emerald-700',
  refund: 'bg-amber-100 text-amber-700',
  cancel: 'bg-gray-100 text-gray-600',
}

function formatDateTime(s: string | null): string {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '-'
  if (ms < 60_000) return `${Math.round(ms / 1000)}초`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}분 ${Math.round((ms % 60_000) / 1000)}초`
  return `${Math.floor(ms / 3_600_000)}시간 ${Math.floor((ms % 3_600_000) / 60_000)}분`
}

function parseUA(ua: string | null): { os: string; osIcon: string; browser: string; browserIcon: string } {
  if (!ua) return { os: '-', osIcon: 'ti-device-desktop-question', browser: '-', browserIcon: 'ti-help' }
  let os = 'Unknown'
  let osIcon = 'ti-device-desktop-question'
  if (/Windows NT/i.test(ua)) { os = 'Windows'; osIcon = 'ti-brand-windows' }
  else if (/Mac OS X|Macintosh/i.test(ua)) { os = 'macOS'; osIcon = 'ti-brand-apple' }
  else if (/Android/i.test(ua)) { os = 'Android'; osIcon = 'ti-brand-android' }
  else if (/iPhone|iPad|iPod/i.test(ua)) { os = 'iOS'; osIcon = 'ti-brand-apple' }
  else if (/Linux/i.test(ua)) { os = 'Linux'; osIcon = 'ti-brand-debian' }

  let browser = 'Unknown'
  let browserIcon = 'ti-world'
  if (/Instagram/i.test(ua)) { browser = '인스타그램앱'; browserIcon = 'ti-brand-instagram' }
  else if (/FB_IAB|FBAV|FB4A/i.test(ua)) { browser = '페이스북앱'; browserIcon = 'ti-brand-facebook' }
  else if (/KAKAOTALK/i.test(ua)) { browser = '카카오톡앱'; browserIcon = 'ti-brand-kakotalk' }
  else if (/NAVER/i.test(ua)) { browser = '네이버앱'; browserIcon = 'ti-brand-google' }
  else if (/Edg\//i.test(ua)) { browser = 'Edge'; browserIcon = 'ti-brand-edge' }
  else if (/OPR\/|Opera/i.test(ua)) { browser = 'Opera'; browserIcon = 'ti-brand-opera' }
  else if (/Chrome\//i.test(ua)) { browser = 'Chrome'; browserIcon = 'ti-brand-chrome' }
  else if (/Firefox/i.test(ua)) { browser = 'Firefox'; browserIcon = 'ti-brand-firefox' }
  else if (/Safari/i.test(ua)) { browser = 'Safari'; browserIcon = 'ti-brand-safari' }

  return { os, osIcon, browser, browserIcon }
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function presetRange(days: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days + 1)
  return { start: toDateInputValue(start), end: toDateInputValue(end) }
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

interface ColumnDef {
  key: string
  label: string
  pick: (r: WebhookLogRow) => unknown
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'id', label: '번호', pick: (r) => r.id },
  { key: 'event', label: '이벤트', pick: (r) => EVENT_LABELS[r.event_type] || r.event_type },
  { key: 'sent_at', label: '신청일', pick: (r) => formatDateTime(r.sent_at) },
  { key: 'name', label: '이름', pick: (r) => r.display_name ?? '' },
  { key: 'phone', label: '연락처', pick: (r) => r.display_phone ?? '' },
  { key: 'email', label: '이메일', pick: (r) => r.display_email ?? '' },
  { key: 'title', label: '상품명', pick: (r) => r.display_title ?? '' },
  { key: 'ip', label: 'IP', pick: (r) => r.ip ?? '' },
  { key: 'device', label: '기기', pick: (r) => r.device_type ?? '' },
  { key: 'referrer', label: '유입경로', pick: (r) => r.referrer ?? '' },
  { key: 'duration', label: '신청소요시간', pick: (r) => formatDuration(r.submission_duration_ms) },
  { key: 'utm_source', label: 'utm_source', pick: (r) => r.utm_source ?? '' },
  { key: 'utm_medium', label: 'utm_medium', pick: (r) => r.utm_medium ?? '' },
  { key: 'utm_campaign', label: 'utm_campaign', pick: (r) => r.utm_campaign ?? '' },
  { key: 'utm_content', label: 'utm_content', pick: (r) => r.utm_content ?? '' },
  { key: 'utm_term', label: 'utm_term', pick: (r) => r.utm_term ?? '' },
  { key: 'send_status', label: '전송상태', pick: (r) => r.send_status ?? '' },
  { key: 'response_status', label: '응답상태', pick: (r) => r.response_status ?? '' },
  { key: 'response_body', label: '응답요약', pick: (r) => (r.response_body ?? '').slice(0, 200) },
  { key: 'memo', label: '관리메모', pick: (r) => r.memo ?? '' },
  { key: 'user_agent', label: 'User-Agent', pick: (r) => r.user_agent ?? '' },
]

const DEFAULT_COLUMN_KEYS = ['id', 'event', 'sent_at', 'name', 'phone', 'email', 'title', 'ip', 'device', 'referrer', 'duration', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'send_status', 'response_status', 'response_body', 'memo']

function downloadCsv(filename: string, rows: WebhookLogRow[], columnKeys?: string[]) {
  const cols = columnKeys
    ? ALL_COLUMNS.filter((c) => columnKeys.includes(c.key))
    : ALL_COLUMNS.filter((c) => DEFAULT_COLUMN_KEYS.includes(c.key))
  const lines = [cols.map((c) => csvEscape(c.label)).join(',')]
  for (const r of rows) {
    lines.push(cols.map((c) => csvEscape(c.pick(r))).join(','))
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}


export default function AdminCrmLeads() {
  const [rows, setRows] = useState<WebhookLogRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [eventFilter, setEventFilter] = useState<EventType | ''>('')
  const [searchType, setSearchType] = useState<'name' | 'phone' | 'ip' | 'agent'>('name')
  const [searchString, setSearchString] = useState('')
  const [searchTick, setSearchTick] = useState(0)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [memoEdit, setMemoEdit] = useState<Record<number, string>>({})
  const [resending, setResending] = useState<number | null>(null)
  const [columnPickerOpen, setColumnPickerOpen] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(() => new Set(DEFAULT_COLUMN_KEYS))

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('webhook_logs').select('*', { count: 'exact' }).order('sent_at', { ascending: false })
      if (dateStart) query = query.gte('sent_at', `${dateStart}T00:00:00+09:00`)
      if (dateEnd) query = query.lte('sent_at', `${dateEnd}T23:59:59+09:00`)
      if (eventFilter) query = query.eq('event_type', eventFilter)
      if (searchString.trim()) {
        const v = searchString.trim()
        const col = searchType === 'name' ? 'display_name'
          : searchType === 'phone' ? 'display_phone'
          : searchType === 'ip' ? 'ip'
          : 'user_agent'
        query = query.ilike(col, `%${v}%`)
      }
      query = query.range((page - 1) * perPage, page * perPage - 1)
      const { data, count } = await query
      setRows((data as WebhookLogRow[] | null) ?? [])
      setTotalCount(count ?? 0)
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, dateStart, dateEnd, eventFilter, searchTick])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (prev.size === rows.length) return new Set()
      return new Set(rows.map((r) => r.id))
    })
  }

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까?`)) return
    try {
      await supabase.from('webhook_logs').delete().in('id', Array.from(selected))
      toast.success('삭제되었습니다.')
      setSelected(new Set())
      fetchLogs()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const handleResend = async (id: number) => {
    setResending(id)
    try {
      const ok = await webhookService.resendLog(id)
      if (ok) toast.success('재전송 성공')
      else toast.error('재전송 실패 (설정 확인)')
      fetchLogs()
    } finally {
      setResending(null)
    }
  }

  const handleSaveMemo = async (id: number) => {
    const v = memoEdit[id]
    if (v == null) return
    try {
      await webhookService.updateLogMemo(id, v)
      toast.success('메모 저장됨')
      fetchLogs()
    } catch {
      toast.error('저장 실패')
    }
  }

  const applySearch = () => { setPage(1); setSearchTick((t) => t + 1) }
  const resetFilters = () => {
    setDateStart(''); setDateEnd(''); setEventFilter(''); setSearchType('name'); setSearchString(''); setPage(1); setSearchTick((t) => t + 1)
  }
  const applyPreset = (days: number | 'today' | 'all') => {
    if (days === 'all') { setDateStart(''); setDateEnd('') }
    else if (days === 'today') {
      const t = toDateInputValue(new Date())
      setDateStart(t); setDateEnd(t)
    } else {
      const r = presetRange(days)
      setDateStart(r.start); setDateEnd(r.end)
    }
    setPage(1); setSearchTick((t) => t + 1)
  }

  const fetchAllForExport = async (): Promise<WebhookLogRow[]> => {
    let query = supabase.from('webhook_logs').select('*').order('sent_at', { ascending: false }).limit(5000)
    if (dateStart) query = query.gte('sent_at', `${dateStart}T00:00:00+09:00`)
    if (dateEnd) query = query.lte('sent_at', `${dateEnd}T23:59:59+09:00`)
    if (eventFilter) query = query.eq('event_type', eventFilter)
    if (searchString.trim()) {
      const col = searchType === 'name' ? 'display_name'
        : searchType === 'phone' ? 'display_phone'
        : searchType === 'ip' ? 'ip'
        : 'user_agent'
      query = query.ilike(col, `%${searchString.trim()}%`)
    }
    const { data } = await query
    return (data as WebhookLogRow[] | null) ?? []
  }

  const handleExportCsv = async () => {
    const rows = await fetchAllForExport()
    downloadCsv(`crm-leads-${toDateInputValue(new Date())}.csv`, rows)
  }

  const handleExportCustomCsv = async () => {
    if (selectedColumns.size === 0) { toast.error('최소 한 개 이상의 항목을 선택해주세요.'); return }
    const rows = await fetchAllForExport()
    downloadCsv(`crm-leads-${toDateInputValue(new Date())}.csv`, rows, Array.from(selectedColumns))
    setColumnPickerOpen(false)
    toast.success(`${rows.length.toLocaleString()}건 다운로드 완료`)
  }

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage))

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">디비 내역 (CRM)</h1>
        <p className="text-sm text-gray-500 mt-1">회원가입·구매 이벤트로 발송된 웹훅 로그를 조회하고 관리합니다.</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {(['all', 'today', 7, 30] as const).map((p) => (
            <button key={String(p)} onClick={() => applyPreset(p)} className="px-2.5 py-1.5 rounded text-[11px] font-medium border bg-white text-gray-500 border-gray-200 hover:border-gray-400 cursor-pointer">
              {p === 'all' ? '전체' : p === 'today' ? '오늘' : `지난${p}일`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">기간</span>
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-xs outline-none" />
          <span className="text-xs text-gray-400">~</span>
          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-xs outline-none" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">처리분류</span>
          <select value={eventFilter} onChange={(e) => { setEventFilter(e.target.value as EventType | ''); setPage(1); setSearchTick((t) => t + 1) }}
            className="border border-gray-200 rounded px-2 py-1 text-xs outline-none">
            <option value="">전체</option>
            <option value="signup">회원가입</option>
            <option value="purchase">구매</option>
            <option value="refund">환불</option>
            <option value="cancel">취소</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <select value={searchType} onChange={(e) => setSearchType(e.target.value as 'name' | 'phone' | 'ip' | 'agent')}
            className="border border-gray-200 rounded px-2 py-1 text-xs outline-none">
            <option value="name">이름</option>
            <option value="phone">연락처</option>
            <option value="ip">IP</option>
            <option value="agent">Agent</option>
          </select>
          <input value={searchString} onChange={(e) => setSearchString(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applySearch() }}
            placeholder="검색어"
            className="border border-gray-200 rounded px-2 py-1 text-xs outline-none w-40" />
          <button onClick={applySearch} className="px-3 py-1 bg-gray-900 text-white text-xs rounded border-none cursor-pointer">
            <i className="ti ti-search mr-1" />검색
          </button>
          <button onClick={resetFilters} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded border-none cursor-pointer" title="초기화">
            <i className="ti ti-arrow-back-up" />
          </button>
        </div>
        <div className="ml-auto text-xs text-gray-500">검색된 자료 수: <b className="text-gray-900">{totalCount.toLocaleString()}건</b></div>
      </div>

      {/* 액션 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={handleDeleteSelected} disabled={selected.size === 0}
          className="bg-red-50 text-red-600 px-3 py-1.5 rounded text-xs font-bold cursor-pointer border border-red-200 hover:bg-red-100 disabled:opacity-50">
          선택 삭제 ({selected.size})
        </button>
        <div className="ml-auto flex items-center gap-2">
          <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}
            className="border border-gray-200 rounded px-2 py-1.5 text-xs outline-none">
            {[10, 20, 30, 50, 100].map((n) => <option key={n} value={n}>{n}개씩 보기</option>)}
          </select>
          <button onClick={handleExportCsv} className="bg-gray-900 text-white px-3 py-1.5 rounded text-xs font-bold cursor-pointer border-none">
            <i className="ti ti-download mr-1" />CSV 다운로드
          </button>
          <button onClick={() => setColumnPickerOpen(true)} className="bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-bold cursor-pointer border-none hover:bg-gray-800">
            <i className="ti ti-columns mr-1" />항목별 다운로드
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 w-10">
                <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleSelectAll} />
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">신청일</th>
              <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">이벤트</th>
              <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">이름</th>
              <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">연락처</th>
              <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">상품명</th>
              <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">IP / 기기</th>
              <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">전송결과</th>
              <th className="px-3 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={9} className="py-12 text-center text-gray-400 text-sm">불러오는 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-gray-400 text-sm">검색 결과가 없습니다.</td></tr>
            ) : (
              rows.map((r) => (
                <FragmentRow key={r.id} row={r}
                  isOpen={expanded.has(r.id)}
                  toggleOpen={() => toggleExpanded(r.id)}
                  isChecked={selected.has(r.id)}
                  toggleChecked={() => toggleSelected(r.id)}
                  memoEdit={memoEdit[r.id] ?? r.memo}
                  setMemoEdit={(v) => setMemoEdit((prev) => ({ ...prev, [r.id]: v }))}
                  onSaveMemo={() => handleSaveMemo(r.id)}
                  onResend={() => handleResend(r.id)}
                  resending={resending === r.id}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
          <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 text-xs border rounded border-gray-200 bg-white cursor-pointer disabled:opacity-30"><i className="ti ti-chevrons-left" /></button>
          <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-2 py-1 text-xs border rounded border-gray-200 bg-white cursor-pointer disabled:opacity-30"><i className="ti ti-chevron-left" /></button>
          <span className="text-xs text-gray-600 mx-2">{page} / {totalPages}</span>
          <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-2 py-1 text-xs border rounded border-gray-200 bg-white cursor-pointer disabled:opacity-30"><i className="ti ti-chevron-right" /></button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-xs border rounded border-gray-200 bg-white cursor-pointer disabled:opacity-30"><i className="ti ti-chevrons-right" /></button>
        </div>
      )}

      {/* 항목별 다운로드 모달 */}
      {columnPickerOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setColumnPickerOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">항목별 CSV 다운로드</h2>
              <button onClick={() => setColumnPickerOpen(false)} className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer">
                <i className="ti ti-x text-xl" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">다운로드할 항목을 선택하세요. (선택: {selectedColumns.size}개)</p>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setSelectedColumns(new Set(ALL_COLUMNS.map((c) => c.key)))}
                className="text-xs px-2.5 py-1 rounded border border-gray-200 bg-white cursor-pointer hover:bg-gray-50">전체 선택</button>
              <button onClick={() => setSelectedColumns(new Set())}
                className="text-xs px-2.5 py-1 rounded border border-gray-200 bg-white cursor-pointer hover:bg-gray-50">전체 해제</button>
              <button onClick={() => setSelectedColumns(new Set(DEFAULT_COLUMN_KEYS))}
                className="text-xs px-2.5 py-1 rounded border border-gray-200 bg-white cursor-pointer hover:bg-gray-50">기본값으로</button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-[360px] overflow-y-auto border border-gray-100 rounded-lg p-3 mb-4">
              {ALL_COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer py-1">
                  <input type="checkbox" checked={selectedColumns.has(c.key)} onChange={() => toggleColumn(c.key)}
                    className="accent-[#2ED573]" />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setColumnPickerOpen(false)} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm cursor-pointer hover:bg-gray-50">취소</button>
              <button onClick={handleExportCustomCsv}
                className="px-4 py-2 rounded-lg bg-[#2ED573] text-white text-sm font-bold cursor-pointer border-none hover:bg-[#25B866]">
                <i className="ti ti-download mr-1" />다운로드
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

interface FragmentRowProps {
  row: WebhookLogRow
  isOpen: boolean
  toggleOpen: () => void
  isChecked: boolean
  toggleChecked: () => void
  memoEdit: string
  setMemoEdit: (v: string) => void
  onSaveMemo: () => void
  onResend: () => void
  resending: boolean
}

function FragmentRow({ row, isOpen, toggleOpen, isChecked, toggleChecked, memoEdit, setMemoEdit, onSaveMemo, onResend, resending }: FragmentRowProps) {
  const utmLine = [
    row.utm_source && `source: ${row.utm_source}`,
    row.utm_medium && `medium: ${row.utm_medium}`,
    row.utm_campaign && `campaign: ${row.utm_campaign}`,
    row.utm_content && `content: ${row.utm_content}`,
    row.utm_term && `term: ${row.utm_term}`,
  ].filter(Boolean).join(', ')

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-3 py-2.5"><input type="checkbox" checked={isChecked} onChange={toggleChecked} /></td>
        <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{formatDateTime(row.sent_at)}</td>
        <td className="px-3 py-2.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${EVENT_COLORS[row.event_type] || 'bg-gray-100 text-gray-600'}`}>
            {EVENT_LABELS[row.event_type] || row.event_type}
          </span>
        </td>
        <td className="px-3 py-2.5 text-sm text-gray-900">{row.display_name || '-'}</td>
        <td className="px-3 py-2.5 text-sm text-gray-600">{row.display_phone || '-'}</td>
        <td className="px-3 py-2.5 text-sm text-gray-600 truncate max-w-[220px]" title={row.display_title || ''}>{row.display_title || '-'}</td>
        <td className="px-3 py-2.5 text-xs text-gray-500">
          <div>{row.ip || '-'}</div>
          <div className="text-[10px] text-gray-400">{row.device_type === 'mobile' ? '모바일' : row.device_type === 'pc' ? 'PC' : ''}</div>
        </td>
        <td className="px-3 py-2.5">
          {row.send_status === 'success' && <span className="text-[10px] text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 font-medium">성공{row.response_status ? ` ${row.response_status}` : ''}</span>}
          {row.send_status === 'failed' && <span className="text-[10px] text-red-700 bg-red-50 rounded-full px-2 py-0.5 font-medium">실패</span>}
          {row.send_status === 'skipped' && <span className="text-[10px] text-gray-500 bg-gray-50 rounded-full px-2 py-0.5 font-medium">생략</span>}
          {!row.send_status && <span className="text-[10px] text-gray-400">-</span>}
          {row.resend_count > 0 && <span className="text-[10px] text-blue-600 ml-1">(재{row.resend_count})</span>}
        </td>
        <td className="px-3 py-2.5">
          <button onClick={toggleOpen} className="px-2 py-1 bg-gray-900 text-white text-[10px] rounded border-none cursor-pointer">
            {isOpen ? '접기' : '상세'}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-gray-50/50">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <DetailRow label="관리메모">
                  <div className="flex gap-2">
                    <input value={memoEdit} onChange={(e) => setMemoEdit(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onSaveMemo() }}
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#2ED573]" />
                    <button onClick={onSaveMemo} className="px-3 py-1 bg-gray-900 text-white text-[10px] rounded border-none cursor-pointer">저장</button>
                  </div>
                </DetailRow>
                <DetailRow label="유입경로">
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const ua = parseUA(row.user_agent)
                      return (
                        <>
                          <i className={`ti ${ua.osIcon} text-gray-500`} title={`OS: ${ua.os}`} />
                          <i className={`ti ${ua.browserIcon} text-gray-500`} title={`Browser: ${ua.browser}`} />
                          <span className="break-all text-xs text-gray-600">{row.referrer || '직접 입력'}</span>
                        </>
                      )
                    })()}
                  </div>
                </DetailRow>
                <DetailRow label="신청 소요시간"><span className="text-xs">{formatDuration(row.submission_duration_ms)}</span></DetailRow>
                <DetailRow label="UTM"><span className="text-xs text-gray-600 break-all">{utmLine || '-'}</span></DetailRow>
                <DetailRow label="이메일"><span className="text-xs">{row.display_email || '-'}</span></DetailRow>
                <DetailRow label="User-Agent">
                  <div>
                    {(() => {
                      const ua = parseUA(row.user_agent)
                      return <div className="text-[11px] text-gray-600 mb-1">{ua.os} · {ua.browser}</div>
                    })()}
                    <span className="break-all text-[11px] font-mono text-gray-500">{row.user_agent || '-'}</span>
                  </div>
                </DetailRow>
                <DetailRow label="데이터 고유번호"><span className="text-xs">{row.id.toLocaleString()}</span></DetailRow>
              </div>

              <div className="space-y-2">
                <DetailRow label="NOTI 전송주소"><span className="break-all text-[11px] font-mono">{row.request_url || '-'}</span></DetailRow>
                <DetailRow label="NOTI 전송데이터">
                  <div className="bg-white border border-gray-200 rounded p-2 text-[11px] font-mono break-all max-h-40 overflow-y-auto">
                    {row.request_method && <span className="text-blue-600 font-bold">[{row.request_method}] </span>}
                    {row.request_body || '-'}
                  </div>
                </DetailRow>
                <DetailRow label="NOTI 전송결과">
                  <div className="bg-white border border-gray-200 rounded p-2 text-[11px] font-mono break-all max-h-40 overflow-y-auto">
                    {row.send_status === 'failed' ? (
                      <span className="text-red-600">{row.error_message || 'Network error'}</span>
                    ) : (
                      row.response_body || '(비어있음 — no-cors 응답은 본문 확인 불가)'
                    )}
                  </div>
                </DetailRow>
                <DetailRow label="재전송">
                  <div className="flex items-center gap-2">
                    <button onClick={onResend} disabled={resending} className="px-3 py-1 bg-gray-700 text-white text-[11px] rounded border-none cursor-pointer hover:bg-gray-800 disabled:opacity-50">
                      {resending ? '전송 중...' : 'NOTI 재전송'}
                    </button>
                    {row.last_resent_at && (
                      <span className="text-[10px] text-gray-500">최근 재전송: {formatDateTime(row.last_resent_at)}</span>
                    )}
                  </div>
                </DetailRow>
                {row.resend_history && row.resend_history.length > 0 && (
                  <DetailRow label="재전송 이력">
                    <div className="text-[10px] text-gray-500 space-y-0.5">
                      {row.resend_history.map((h, i) => (
                        <div key={i}>
                          {formatDateTime(h.at)} — {h.send_status}{h.response_status ? ` (${h.response_status})` : ''}
                        </div>
                      ))}
                    </div>
                  </DetailRow>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-[100px] shrink-0 text-[11px] font-bold text-gray-500 pt-1">{label}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
