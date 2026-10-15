import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'

// 관리자 '데이터 질문' 채팅 — 오른쪽 아래 버튼 → 패널(휴대폰은 전체 화면).
// 서버(/api/admin-chat)가 정해진 읽기 전용 집계 도구로만 답한다. 대화는 이 탭 안에서만 기억(새로고침하면 사라짐).

interface Turn { q: string; a: string; tools: string[]; costKrw?: number; error?: string; done: boolean }

const EXAMPLES = [
  '어제 메타로 들어온 신청자 연령대는?',
  '129 강의 신청자 중 오픈채팅 입장률을 매체별로',
  '이번 달 결제 수단별 매출',
  '최근 7일 날짜별 신청 수',
]
const TOOL_LABEL: Record<string, string> = {
  list_products: '상품 찾기', applicants: '신청·결제 집계', visits: '방문 집계', ad_spend: '광고비 집계',
  product_funnel: '통합 대시보드', board_post_funnel: '게시글 경유', umami_visits: 'Umami 방문', payments_received: '실제 입금',
}
const USD_KRW = 1400
const STORE_KEY = 'admin_data_chat'

// 아주 작은 마크다운: 표(| a | b |), **굵게**, 목록(- ), 줄바꿈. HTML 은 그리지 않는다(글자 그대로).
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>)
}
function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split('|').map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      i--
      out.push(
        <div key={`t${i}`} className="overflow-x-auto my-2">
          <table className="text-xs border-collapse whitespace-nowrap">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={ri === 0 ? 'bg-gray-50 font-bold' : ''}>
                  {r.map((c, ci) => <td key={ci} className="border border-gray-200 px-2 py-1 tabular-nums">{inline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    if (/^\s*[-*] /.test(line)) { out.push(<div key={i} className="pl-3">• {inline(line.replace(/^\s*[-*] /, ''))}</div>); continue }
    if (/^#{1,4} /.test(line)) { out.push(<div key={i} className="font-bold mt-2">{inline(line.replace(/^#{1,4} /, ''))}</div>); continue }
    out.push(line.trim() ? <div key={i}>{inline(line)}</div> : <div key={i} className="h-2" />)
  }
  return <>{out}</>
}

export default function AdminDataChat() {
  const [open, setOpen] = useState(false)
  // 관리자 화면은 페이지마다 레이아웃이 새로 그려지므로, 이 탭 안(sessionStorage)에만 대화를 남겨 둔다
  const [turns, setTurns] = useState<Turn[]>(() => {
    try { return (JSON.parse(sessionStorage.getItem(STORE_KEY) || '[]') as Turn[]).filter((t) => t.done) } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [turns, open])
  useEffect(() => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(turns.filter((t) => t.done).slice(-20))) } catch { /* 저장 못 해도 동작 */ }
  }, [turns])

  const update = (idx: number, patch: (t: Turn) => Turn) => setTurns((prev) => prev.map((t, i) => (i === idx ? patch(t) : t)))

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || busy) return
    const history = turns.filter((t) => t.done && !t.error).slice(-3).map((t) => ({ q: t.q, a: t.a }))
    const idx = turns.length
    setTurns((prev) => [...prev, { q, a: '', tools: [], done: false }])
    setInput('')
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ question: q, history }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `오류 (HTTP ${res.status})` }))
        update(idx, (t) => ({ ...t, error: (err as { error?: string }).error || '오류', done: true }))
        return
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl)
          buf = buf.slice(nl + 1)
          if (!line.trim()) continue
          const ev = JSON.parse(line) as { type: string; text?: string; name?: string; message?: string; cost_usd?: number }
          if (ev.type === 'text') update(idx, (t) => ({ ...t, a: t.a + (ev.text ?? '') }))
          else if (ev.type === 'tool') update(idx, (t) => ({ ...t, tools: [...t.tools, ev.name ?? ''] }))
          else if (ev.type === 'error') update(idx, (t) => ({ ...t, error: ev.message }))
          else if (ev.type === 'done') update(idx, (t) => ({ ...t, costKrw: Math.max(0, (ev.cost_usd ?? 0) * USD_KRW) }))
        }
      }
      update(idx, (t) => ({ ...t, done: true }))
    } catch (e) {
      update(idx, (t) => ({ ...t, error: (e as Error).message, done: true }))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 max-sm:bottom-4 max-sm:right-4 z-40 h-12 px-4 rounded-full bg-gray-900 text-white text-sm font-bold border-none cursor-pointer shadow-lg flex items-center gap-2 hover:bg-gray-800"
        aria-label="데이터 질문 열기"
      >
        <i className="ti ti-message-chatbot text-lg" /> 데이터 질문
      </button>
    )
  }

  return (
    <div className="fixed z-50 bottom-6 right-6 w-[420px] h-[640px] max-h-[calc(100vh-48px)] max-sm:inset-0 max-sm:w-auto max-sm:h-auto max-sm:max-h-none bg-white rounded-2xl max-sm:rounded-none shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-sm font-bold text-gray-900">데이터 질문</p>
          <p className="text-[11px] text-gray-400">집계 숫자로만 답해요 · 개인별 조회는 안 돼요</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="w-8 h-8 rounded-full border-none bg-transparent cursor-pointer text-gray-500 hover:bg-gray-100" aria-label="닫기">
          <i className="ti ti-x" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm text-gray-800">
        {turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">예시 질문</p>
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => ask(ex)}
                className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white cursor-pointer hover:bg-gray-50">
                {ex}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <div className="ml-auto w-fit max-w-[85%] bg-gray-900 text-white rounded-2xl rounded-br-sm px-3 py-2 whitespace-pre-wrap">{t.q}</div>
            <div className="max-w-full bg-gray-50 rounded-2xl rounded-bl-sm px-3 py-2 leading-relaxed min-w-0">
              {t.tools.length > 0 && (
                <p className="text-[11px] text-gray-400 mb-1">조회: {[...new Set(t.tools)].map((n) => TOOL_LABEL[n] ?? n).join(', ')}</p>
              )}
              {t.a ? <Markdown text={t.a} /> : !t.error && !t.done && <span className="text-gray-400">데이터 확인 중…</span>}
              {t.error && <p className="text-red-500 text-xs mt-1">{t.error}</p>}
              {t.done && t.costKrw != null && <p className="text-[10px] text-gray-300 mt-1 tabular-nums">약 {t.costKrw < 1 ? '1원 미만' : `${Math.round(t.costKrw)}원`}</p>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(input) }}
        className="border-t border-gray-100 p-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 지난주 매체별 신청 수"
          maxLength={1000}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]"
        />
        <button type="submit" disabled={busy || !input.trim()}
          className="px-4 py-2 rounded-lg bg-[#2ED573] text-white text-sm font-bold border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          {busy ? '…' : '보내기'}
        </button>
      </form>
    </div>
  )
}
