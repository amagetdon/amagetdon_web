import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { courseExpiry } from '../../lib/linkpayMatch'
import type { CourseWithInstructor } from '../../types'

// 무통장 입금함 — 왼쪽 입금 목록(미처리/등록됨/제외), 오른쪽에서 고른 입금을 회원·강의에 연결해 등록.
// 등록은 서버 함수(admin_process_bank_deposit) → 기존 '무통장 입금 등록' 규칙(0원 수강권에 금액 / 분할이면 합산 / 없으면 새 수강권).
// 입금 내역은 매일 12시 예약 작업이 /api/bank-deposits-import 로 올리고, 빠진 날은 아래 '엑셀 올리기'로 채운다.

interface Deposit {
  id: number
  source: string
  external_id: string
  deposited_at: string
  amount: number
  depositor: string | null
  memo: string | null
  raw_text?: string | null
  hint: { label?: string; user_label?: string; course_id?: number; course?: string; reason?: string } | null
  status: 'pending' | 'processed' | 'excluded'
  exclude_reason: string | null
  processed_at: string | null
}
interface Member { id: string; name: string | null; phone: string | null; email?: string | null }
interface Candidate {
  purchase_id: number; user_id: string; course_id: number | null; ebook_id: number | null; item_title: string
  list_price: number | null; purchased_at: string; name: string | null; phone: string | null; email: string | null
  alias_hit: boolean; name_full: boolean; name_tail: boolean; price_match: boolean; score: number
}
type Filter = 'pending' | 'processed' | 'excluded' | 'all'

const EXCLUDE_REASONS = ['이자', '환불 입금', '개인·회사 간 이체', '카드 캐시백', '기타']
const won = (n: number | null | undefined) => `${(n ?? 0).toLocaleString()}원`
const when = (iso: string) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const maskPhone = (p: string | null) => (p ? p.replace(/(\d{3})-?(\d{3,4})-?(\d{4})/, '$1-****-$3') : '')

// 엑셀 첫 줄에서 열 이름 찾기 (클로브·은행 내보내기 파일마다 이름이 조금씩 달라서 후보로 찾는다)
const findCol = (headers: string[], keys: string[]) => headers.findIndex((h) => keys.some((k) => h.replace(/\s/g, '').includes(k)))

export default function BankDepositInbox({ courses }: { courses: CourseWithInstructor[] }) {
  const [rows, setRows] = useState<Deposit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pending')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [cands, setCands] = useState<Candidate[] | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberHits, setMemberHits] = useState<Member[]>([])
  const [courseId, setCourseId] = useState<number | ''>('')
  const [remember, setRemember] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonEtc, setReasonEtc] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('bank_deposits').select('*').order('deposited_at', { ascending: false }).limit(1000)
    if (error) toast.error('입금함을 불러오지 못했습니다.')
    setRows((data ?? []) as unknown as Deposit[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const selected = rows.find((r) => r.id === selectedId) ?? null
  const counts = useMemo(() => ({
    pending: rows.filter((r) => r.status === 'pending').length,
    pendingAmount: rows.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0),
    processed: rows.filter((r) => r.status === 'processed').length,
    excluded: rows.filter((r) => r.status === 'excluded').length,
    all: rows.length,
  }), [rows])
  const list = rows.filter((r) => (filter === 'all' || r.status === filter)
    && (!q.trim() || (r.depositor || '').includes(q.trim()) || String(r.amount).includes(q.replace(/,/g, '').trim())))

  // 입금을 고르면 추천 후보를 불러오고, 칸을 비운다
  useEffect(() => {
    setMember(null); setMemberQuery(''); setMemberHits([]); setCourseId(''); setReason(''); setReasonEtc(''); setCands(null); setRemember(false)
    if (!selected || selected.status !== 'pending') return
    let active = true
    supabase.rpc('admin_bank_deposit_candidates', { p_deposit_id: selected.id } as never).then(({ data }) => {
      if (active) setCands((data ?? []) as unknown as Candidate[])
    })
    return () => { active = false }
  }, [selected?.id, selected?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const pickCandidate = (c: Candidate) => {
    setMember({ id: c.user_id, name: c.name, phone: c.phone, email: c.email })
    setCourseId(c.course_id ?? '')
    // 입금자명이 회원 이름과 다르면(법인·상호명 등) 기억해 두기를 기본으로 켠다
    setRemember(!!selected?.depositor && !c.name_full)
  }

  const searchMembers = async (term: string) => {
    setMemberQuery(term)
    if (!term.trim()) { setMemberHits([]); return }
    const { data } = await supabase.from('profiles').select('id, name, phone, email')
      .or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`).limit(20)
    setMemberHits((data ?? []) as Member[])
  }

  const register = async () => {
    if (!selected || !member || courseId === '') return
    const course = courses.find((c) => c.id === courseId)
    setSaving(true)
    const { error } = await supabase.rpc('admin_process_bank_deposit', {
      p_deposit_id: selected.id, p_user_id: member.id, p_course_id: courseId, p_ebook_id: null,
      p_expires_at: courseExpiry(course), p_remember: remember,
    } as never)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('등록했어요. 수강권에 금액이 반영됐어요.')
    await load()
  }

  const exclude = async () => {
    if (!selected) return
    const r = reason === '기타' ? `기타: ${reasonEtc.trim()}` : reason
    if (!reason || (reason === '기타' && !reasonEtc.trim())) { toast.error('제외 사유를 고르세요.'); return }
    setSaving(true)
    const { error } = await supabase.rpc('admin_exclude_bank_deposit', { p_deposit_id: selected.id, p_reason: r } as never)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('제외했어요(매출 아님).')
    await load()
  }

  const reopen = async () => {
    if (!selected) return
    const { error } = await supabase.rpc('admin_reopen_bank_deposit', { p_deposit_id: selected.id } as never)
    if (error) { toast.error(error.message); return }
    toast.success('다시 미처리로 돌렸어요.')
    await load()
  }

  // 클로브(또는 은행) 엑셀 올리기 — 입금(들어온 돈)만, 같은 거래는 자동으로 건너뜀
  const uploadExcel = async (file: File) => {
    setUploading(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' })
      const headerRow = table.findIndex((r) => (r as unknown[]).some((c) => /입금|거래일|일시/.test(String(c))))
      if (headerRow < 0) { toast.error('열 이름(거래일시·입금액 등)을 찾지 못했어요.'); return }
      const headers = (table[headerRow] as unknown[]).map((h) => String(h))
      const cDate = findCol(headers, ['거래일시', '거래일자', '일시', '거래일', '날짜'])
      const cIn = findCol(headers, ['입금액', '입금금액', '입금', '맡기신금액'])
      const cName = findCol(headers, ['입금자', '보낸분', '적요', '내용', '거래처'])
      const cMemo = findCol(headers, ['메모', '비고', '적요'])
      const cBal = findCol(headers, ['잔액', '거래후잔액'])
      const cId = findCol(headers, ['거래ID', '거래번호', 'ID'])
      if (cDate < 0 || cIn < 0) { toast.error('거래일시·입금액 열이 있어야 해요.'); return }
      const out: Record<string, unknown>[] = []
      for (const r of table.slice(headerRow + 1) as unknown[][]) {
        const amount = Math.round(Number(String(r[cIn] ?? '').replace(/[^\d.-]/g, '')))
        if (!Number.isFinite(amount) || amount <= 0) continue
        const rawDate = r[cDate]
        const at = rawDate instanceof Date ? rawDate : new Date(String(rawDate).replace(/\./g, '-').trim().replace(' ', 'T') + (/[+Z]/.test(String(rawDate)) ? '' : '+09:00'))
        if (Number.isNaN(at.getTime())) continue
        const depositor = cName >= 0 ? String(r[cName] ?? '').trim() || null : null
        const balance = cBal >= 0 ? Number(String(r[cBal] ?? '').replace(/[^\d.-]/g, '')) || null : null
        const iso = at.toISOString()
        out.push({
          source: 'excel',
          external_id: cId >= 0 && String(r[cId] ?? '').trim() ? String(r[cId]).trim() : `${iso}|${amount}|${depositor ?? ''}|${balance ?? ''}`,
          deposited_at: iso, amount, depositor,
          memo: cMemo >= 0 && cMemo !== cName ? String(r[cMemo] ?? '').trim() || null : null,
          balance,
        })
      }
      if (!out.length) { toast.error('올릴 입금이 없어요(입금액 0 이상인 줄이 없음).'); return }
      const { data, error } = await supabase.from('bank_deposits')
        .upsert(out as never, { onConflict: 'external_id', ignoreDuplicates: true }).select('id')
      if (error) { toast.error(`올리기 실패: ${error.message}`); return }
      toast.success(`입금 ${out.length}건 중 새로 ${(data ?? []).length}건 추가(나머지는 이미 있음)`)
      await load()
    } finally {
      setUploading(false)
    }
  }

  const filterBtn = (key: Filter, label: string, n: number) => (
    <button key={key} type="button" onClick={() => setFilter(key)}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${filter === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>
      {label} {n}
    </button>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-bold text-gray-900 m-0">무통장 입금함</h2>
          <p className="text-xs text-gray-400 mt-1 mb-0">은행 입금을 매일 자동으로 받아 둡니다. 입금을 고르고 회원·강의를 지정해 등록하면 수강권 금액과 매출에 반영돼요.</p>
        </div>
        <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold cursor-pointer ${uploading ? 'opacity-50' : 'hover:bg-gray-50'}`}>
          <i className="ti ti-file-spreadsheet" /> {uploading ? '올리는 중…' : '엑셀 올리기(백업)'}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadExcel(f) }} />
        </label>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_380px] max-lg:grid-cols-1 gap-4">
        <div className="min-w-0">
          <div className="flex gap-2 flex-wrap mb-3">
            {filterBtn('pending', '미처리', counts.pending)}
            {filterBtn('processed', '등록됨', counts.processed)}
            {filterBtn('excluded', '제외', counts.excluded)}
            {filterBtn('all', '전체', counts.all)}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="입금자·금액 검색"
              className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#2ED573]" />
          </div>
          {counts.pending > 0 && <p className="text-xs text-amber-700 mb-2">미처리 {counts.pending}건 · {won(counts.pendingAmount)}</p>}
          <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-[560px] overflow-y-auto">
            {loading ? <p className="text-sm text-gray-400 p-4 m-0">불러오는 중…</p>
              : list.length === 0 ? <p className="text-sm text-gray-400 p-4 m-0">입금이 없어요.</p>
              : list.map((r) => (
                <button key={r.id} type="button" onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left px-4 py-3 border-none cursor-pointer flex items-center gap-3 ${selectedId === r.id ? 'bg-emerald-50' : 'bg-white hover:bg-gray-50'}`}>
                  <span className="text-xs text-gray-400 w-24 shrink-0 tabular-nums">{when(r.deposited_at)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-gray-900 truncate">{r.depositor || '(입금자 없음)'}</span>
                    {r.hint?.label && <span className="block text-[11px] text-gray-400 truncate">매칭표: {r.hint.label}{r.hint.user_label ? ` · ${r.hint.user_label}` : ''}{r.hint.course_id ? ` · 강의 ${r.hint.course_id}` : ''}</span>}
                  </span>
                  <span className="text-sm font-bold tabular-nums">{won(r.amount)}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${r.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : r.status === 'processed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {r.status === 'pending' ? '미처리' : r.status === 'processed' ? '등록됨' : '제외'}
                  </span>
                </button>
              ))}
          </div>
        </div>

        <div className="border border-gray-100 rounded-xl p-4 min-w-0">
          {!selected ? <p className="text-sm text-gray-400 m-0">왼쪽에서 입금을 고르세요.</p> : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 m-0">{when(selected.deposited_at)} · {selected.source === 'excel' ? '엑셀' : selected.source === 'seed' ? '첫 적재' : selected.source === 'sms' ? '입금 문자' : '클로브 자동'}</p>
                <p className="text-lg font-bold m-0 mt-0.5">{selected.depositor || '(입금자 없음)'} · {won(selected.amount)}</p>
                {selected.memo && <p className="text-xs text-gray-500 m-0 mt-0.5">{selected.memo}</p>}
                {selected.raw_text && (
                  <details className="mt-1.5">
                    <summary className="text-[11px] text-gray-400 cursor-pointer">문자 원문 보기</summary>
                    <pre className="text-[11px] text-gray-600 bg-gray-50 rounded-lg p-2 mt-1 whitespace-pre-wrap break-all m-0">{selected.raw_text}</pre>
                  </details>
                )}
                {selected.hint?.label && (
                  <p className="text-xs bg-gray-50 rounded-lg px-2 py-1.5 mt-2 mb-0 text-gray-600">
                    매칭표: <b>{selected.hint.label}</b>{selected.hint.user_label ? ` · ${selected.hint.user_label}` : ''}{selected.hint.course ? ` · ${selected.hint.course}` : selected.hint.course_id ? ` · 강의 ${selected.hint.course_id}` : ''}{selected.hint.reason ? ` · ${selected.hint.reason}` : ''}
                  </p>
                )}
              </div>

              {selected.status === 'processed' && <p className="text-sm text-emerald-700 m-0">등록됨 ({selected.processed_at ? when(selected.processed_at) : ''})</p>}
              {selected.status === 'excluded' && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 m-0">제외됨 — {selected.exclude_reason}</p>
                  <button type="button" onClick={reopen} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white cursor-pointer">미처리로 되돌리기</button>
                </div>
              )}

              {selected.status === 'pending' && (<>
                <div>
                  <p className="text-xs font-bold text-gray-600 mb-1.5 mt-0">추천 (입금일 ±3일 · 0원 수강권)</p>
                  {cands === null ? <p className="text-xs text-gray-400 m-0">찾는 중…</p>
                    : cands.length === 0 ? <p className="text-xs text-gray-400 m-0">추천 없음 — 아래에서 직접 찾아 주세요.</p>
                    : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {cands.map((c) => (
                          <button key={c.purchase_id} type="button" onClick={() => pickCandidate(c)}
                            className={`w-full text-left px-3 py-2 rounded-lg border cursor-pointer text-xs ${member?.id === c.user_id && courseId === c.course_id ? 'border-[#2ED573] bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                            <span className="font-bold">{c.name || '(이름 없음)'}</span> <span className="text-gray-400">{maskPhone(c.phone)}</span>
                            <span className="block text-gray-600 truncate">{c.item_title} · 판매가 {won(c.list_price)}</span>
                            <span className="flex gap-1 mt-1 flex-wrap">
                              {c.alias_hit && <span className="px-1.5 rounded bg-purple-50 text-purple-700">기억한 입금자</span>}
                              {c.name_full ? <span className="px-1.5 rounded bg-emerald-50 text-emerald-700">이름 일치</span> : c.name_tail ? <span className="px-1.5 rounded bg-emerald-50 text-emerald-700">끝 두 글자</span> : null}
                              {c.price_match && <span className="px-1.5 rounded bg-blue-50 text-blue-700">판매가 일치</span>}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-600 mb-1.5 mt-0">회원</p>
                  {member ? (
                    <div className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className="min-w-0 truncate"><b>{member.name}</b> <span className="text-xs text-gray-400">{maskPhone(member.phone)}</span></span>
                      <button type="button" onClick={() => setMember(null)} className="text-xs text-gray-500 bg-transparent border-none cursor-pointer">바꾸기</button>
                    </div>
                  ) : (
                    <>
                      <input value={memberQuery} onChange={(e) => searchMembers(e.target.value)} placeholder="이름·전화·이메일로 찾기"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
                      {memberHits.length > 0 && (
                        <div className="border border-gray-100 rounded-lg mt-1 max-h-40 overflow-y-auto">
                          {memberHits.map((m) => (
                            <button key={m.id} type="button" onClick={() => { setMember(m); setMemberHits([]); setRemember(!!selected.depositor && (m.name || '').replace(/\s/g, '') !== (selected.depositor || '').replace(/\s/g, '')) }}
                              className="w-full text-left px-3 py-1.5 text-xs bg-white hover:bg-gray-50 border-none cursor-pointer">
                              <b>{m.name}</b> <span className="text-gray-400">{maskPhone(m.phone)} {m.email}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-600 mb-1.5 mt-0">강의</p>
                  <select value={courseId} onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573] bg-white">
                    <option value="">강의 선택</option>
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.title}</option>)}
                  </select>
                </div>

                {selected.depositor && member && (
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    입금자명 "{selected.depositor}" → 이 회원으로 기억(다음 입금부터 1순위 추천)
                  </label>
                )}

                <button type="button" onClick={register} disabled={saving || !member || courseId === ''}
                  className="w-full py-2.5 rounded-lg bg-[#2ED573] text-white text-sm font-bold border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  {saving ? '처리 중…' : `등록 (${won(selected.amount)})`}
                </button>

                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-bold text-gray-600 mb-1.5 mt-0">매출이 아니면 제외</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {EXCLUDE_REASONS.map((r) => (
                      <button key={r} type="button" onClick={() => setReason(r)}
                        className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer ${reason === r ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>{r}</button>
                    ))}
                  </div>
                  {reason === '기타' && (
                    <input value={reasonEtc} onChange={(e) => setReasonEtc(e.target.value)} placeholder="사유 직접 입력"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mt-2 outline-none focus:border-[#2ED573]" />
                  )}
                  <button type="button" onClick={exclude} disabled={saving || !reason}
                    className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white cursor-pointer disabled:opacity-40">제외하기</button>
                </div>
              </>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
