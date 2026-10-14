import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { linkpayService, type LinkpayPayment } from '../../services/linkpayService'
import { courseExpiry, guessCourseId } from '../../lib/linkpayMatch'
import type { CourseWithInstructor } from '../../types'

// 링크페이 결제 처리함 — 왼쪽 결제 목록(처리 필요/전체/부여됨/취소), 오른쪽에서 고른 결제를 수강생 계정·강의에 연결.
// 연결 규칙은 서버 함수(admin_attach_linkpay_payment): 0원 수강권이 있으면 금액을 채우고, 유료 구매가 있으면 합산, 없으면 새 수강권.

type Filter = 'todo' | 'all' | 'done' | 'canceled'
interface Member { id: string; name: string | null; phone: string | null; email?: string | null }

const statusOf = (p: LinkpayPayment): 'todo' | 'done' | 'canceled' | 'other' =>
  p.status === 'CANCELED' ? 'canceled' : p.granted ? 'done' : p.status === 'DONE' ? 'todo' : 'other'

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  todo: { label: '처리 필요', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  done: { label: '부여됨', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  canceled: { label: '취소', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  other: { label: '대기', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

// 상품명 앞의 "고객이름_" 은 목록에서 이미 보이므로 떼고 보여준다
const productLabel = (p: LinkpayPayment) => {
  const name = p.order_name || '-'
  return p.customer_name && name.startsWith(`${p.customer_name}_`) ? name.slice(p.customer_name.length + 1) : name
}
const won = (n: number | null | undefined) => `${(n ?? 0).toLocaleString()}원`
const when = (p: LinkpayPayment) =>
  new Date(p.approved_at ?? p.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function LinkpayInbox({
  payments,
  courses,
  onChanged,
}: {
  payments: LinkpayPayment[]
  courses: CourseWithInstructor[]
  onChanged: () => Promise<void>
}) {
  const [filter, setFilter] = useState<Filter>('todo')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberHits, setMemberHits] = useState<Member[]>([])
  const [courseId, setCourseId] = useState<number | ''>('')
  const [courseSearch, setCourseSearch] = useState('')
  const [preview, setPreview] = useState<'attached' | 'top_up' | 'inserted' | null>(null)
  const [saving, setSaving] = useState(false)
  // 부여된 결제 옮기기 — 현재 연결된 계정과 옮길 계정을 따로 둔다
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveTarget, setMoveTarget] = useState<Member | null>(null)
  const [revokeOld, setRevokeOld] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  const counts = useMemo(() => {
    const c = { todo: 0, all: payments.length, done: 0, canceled: 0, todoAmount: 0 }
    for (const p of payments) {
      const s = statusOf(p)
      if (s === 'todo') { c.todo++; c.todoAmount += p.amount ?? 0 }
      if (s === 'done') c.done++
      if (s === 'canceled') c.canceled++
    }
    return c
  }, [payments])

  const list = useMemo(() => {
    const term = q.trim()
    return payments
      .filter((p) => filter === 'all' || statusOf(p) === filter)
      .filter((p) => !term || [p.customer_name, p.customer_phone, p.order_name].some((v) => v?.includes(term)))
  }, [payments, filter, q])

  const selected = payments.find((p) => p.id === selectedId) ?? null
  const courseTitle = (id: number | null | '') => courses.find((c) => c.id === id)?.title ?? (id ? `#${id}` : '')

  const select = async (p: LinkpayPayment) => {
    setSelectedId(p.id)
    setMoveOpen(false)
    setMoveTarget(null)
    setRevokeOld(true)
    setMember(null)
    setMemberQuery('')
    setMemberHits([])
    setCourseSearch('')
    setCourseId(p.course_id ?? guessCourseId(p.order_name, courses) ?? '')
    if (window.innerWidth < 1024) setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    if (p.matched_user_id) {
      const { data } = await supabase.from('profiles').select('id, name, phone, email').eq('id', p.matched_user_id).maybeSingle()
      if (data) setMember(data as Member)
    }
  }

  const searchMembers = async (term: string) => {
    setMemberQuery(term)
    if (!term.trim()) { setMemberHits([]); return }
    const { data } = await supabase.from('profiles').select('id, name, phone, email')
      .or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`).limit(20)
    setMemberHits((data ?? []) as Member[])
  }

  // 지금 고른 수강생·강의로 부여하면 어떻게 처리되는지 미리 보여준다 (서버 함수와 같은 순서)
  useEffect(() => {
    setPreview(null)
    if (!selected || statusOf(selected) !== 'todo' || !member || courseId === '') return
    let active = true
    supabase.from('purchases').select('price, payment_key').eq('user_id', member.id).eq('course_id', courseId)
      .then(({ data }) => {
        if (!active) return
        const rows = (data ?? []) as { price: number; payment_key: string | null }[]
        setPreview(rows.some((r) => r.price === 0 && !r.payment_key) ? 'attached' : rows.some((r) => r.price > 0) ? 'top_up' : 'inserted')
      })
    return () => { active = false }
  }, [selected, member, courseId])

  const grant = async () => {
    if (!selected || saving) return
    if (!member) { toast.error('수강생 계정을 골라주세요.'); return }
    if (courseId === '') { toast.error('강의를 골라주세요.'); return }
    const course = courses.find((c) => c.id === courseId)
    try {
      setSaving(true)
      const { mode } = await linkpayService.manualGrant(selected, {
        userId: member.id,
        courseId: courseId as number,
        ebookId: null,
        title: course?.title || selected.order_name || '링크페이 결제',
        expiresAt: courseExpiry(course),
      })
      toast.success(
        mode === 'attached' ? `${member.name ?? '회원'}님 0원 수강권에 ${won(selected.amount)}을 채웠습니다.`
          : mode === 'top_up' ? `${member.name ?? '회원'}님 기존 결제에 ${won(selected.amount)}을 더했습니다.`
            : `${member.name ?? '회원'}님에게 수강권을 부여했습니다.`,
      )
      // 다음 처리할 결제로 자동 이동
      const next = list.find((p) => p.id !== selected.id && statusOf(p) === 'todo')
      await onChanged()
      if (next) await select(next)
      else setSelectedId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '부여에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const move = async () => {
    if (!selected || saving) return
    if (!moveTarget) { toast.error('옮길 수강생 계정을 골라주세요.'); return }
    if (courseId === '') { toast.error('강의를 골라주세요.'); return }
    const course = courses.find((c) => c.id === courseId)
    try {
      setSaving(true)
      const { oldAction } = await linkpayService.movePayment(selected, {
        userId: moveTarget.id,
        courseId: courseId as number,
        ebookId: null,
        title: course?.title || selected.order_name || '링크페이 결제',
        expiresAt: courseExpiry(course),
        revokeOld,
      })
      const oldMsg = oldAction === 'subtracted' ? '원래 구매에서는 금액만 뺐습니다'
        : oldAction === 'revoked' ? '원래 계정의 수강권은 회수했습니다'
          : oldAction === 'zeroed' ? '원래 계정은 0원 수강권으로 남겼습니다' : ''
      toast.success(`${moveTarget.name ?? '회원'}님 계정으로 옮겼습니다.${oldMsg ? ` ${oldMsg}.` : ''}`)
      await onChanged()
      await select({ ...selected, matched_user_id: moveTarget.id, course_id: courseId as number })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '옮기기에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const filteredCourses = [...courses]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter((c) => !courseSearch || c.title.includes(courseSearch) || (c.instructor?.name || '').includes(courseSearch))

  const FILTERS: { key: Filter; label: string; n: number }[] = [
    { key: 'todo', label: '처리 필요', n: counts.todo },
    { key: 'all', label: '전체', n: counts.all },
    { key: 'done', label: '부여됨', n: counts.done },
    { key: 'canceled', label: '취소', n: counts.canceled },
  ]

  return (
    <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 items-start mb-8">
      {/* 왼쪽: 결제 목록 */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden min-w-0">
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 space-y-3">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h2 className="font-bold text-gray-900">링크페이 결제</h2>
            {counts.todo > 0 && (
              <span className="text-xs font-bold text-amber-700">처리 필요 {counts.todo}건 · {won(counts.todoAmount)} 매출 미반영</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors ${
                  filter === f.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {f.label} <span className={filter === f.key ? 'text-white/70' : 'text-gray-400'}>{f.n}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              id="linkpay-inbox-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="구매자 이름·전화번호·상품명 검색"
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573] focus:bg-white"
            />
          </div>
        </div>
        <div className="max-h-[620px] overflow-y-auto divide-y divide-gray-50">
          {list.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-gray-400">
              {filter === 'todo' ? '처리할 결제가 없습니다. 모두 반영됐어요.' : '해당하는 결제가 없습니다.'}
            </p>
          ) : list.map((p) => {
            const st = STATUS_PILL[statusOf(p)]
            const active = p.id === selectedId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => select(p)}
                className={`w-full text-left px-5 py-3.5 border-none cursor-pointer transition-colors block ${active ? 'bg-emerald-50/70' : 'bg-white hover:bg-gray-50'}`}
                style={active ? { boxShadow: 'inset 3px 0 0 #2ED573' } : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${st.cls}`}>{st.label}</span>
                  <span className="font-bold text-gray-900 text-sm truncate">{p.customer_name || '이름 없음'}</span>
                  <span className="ml-auto font-bold text-gray-900 text-sm tabular-nums shrink-0">{won(p.amount)}</span>
                </div>
                <p className="text-[13px] text-gray-600 truncate mt-1">{productLabel(p)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                  {when(p)} · {p.customer_phone || '번호 없음'}
                  {statusOf(p) === 'done' && p.course_id ? ` · ${courseTitle(p.course_id)}` : ''}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* 오른쪽: 처리 패널 */}
      <div ref={panelRef} className="bg-white rounded-2xl border border-gray-100 min-w-0 lg:sticky lg:top-4">
        {!selected ? (
          <div className="p-6 space-y-4">
            <div>
              <h3 className="font-bold text-gray-900">왼쪽에서 결제를 고르세요</h3>
              <p className="text-xs text-gray-400 mt-1">고른 결제를 수업 듣는 사람 계정과 강의에 연결하면 수강권과 매출이 함께 기록됩니다.</p>
            </div>
            <ol className="space-y-2.5 text-sm text-gray-700 list-none p-0 m-0">
              {['처리 필요 결제를 고릅니다', '수강생 계정을 확인합니다 (결제자와 다르면 검색해서 변경)', '강의를 확인하고 부여하기를 누릅니다'].map((t, i) => (
                <li key={t} className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full bg-[#2ED573]/15 text-[#16a34a] text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
            <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 leading-relaxed space-y-1">
              <p>수강생이 회원이 아니면 <Link to="/admin/members" className="font-bold text-gray-700">회원 관리</Link>에서 먼저 만들어 주세요. 결제는 여기 그대로 남아 있습니다.</p>
              <p>회원 관리에서 0원 수강권을 따로 주지 마세요. 이미 줬다면 여기서 부여할 때 그 수강권에 금액이 채워집니다.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* 결제 정보 */}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-gray-400 tracking-wide">결제한 사람</p>
                  <p className="font-bold text-gray-900 mt-0.5">{selected.customer_name || '이름 없음'} <span className="text-sm font-normal text-gray-500">{selected.customer_phone || ''}</span></p>
                  <p className="text-xs text-gray-500 mt-1 break-words">{selected.order_name || '-'}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{when(selected)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{won(selected.amount)}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_PILL[statusOf(selected)].cls}`}>{STATUS_PILL[statusOf(selected)].label}</span>
                </div>
              </div>
            </div>

            {statusOf(selected) !== 'todo' ? (
              <div className="p-5 text-sm text-gray-600 space-y-2">
                {statusOf(selected) === 'done' ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 tracking-wide">지금 연결된 곳</p>
                      <p className="mt-1 text-gray-800">
                        <i className="ti ti-user text-gray-400" /> {member ? <><b>{member.name || '(이름없음)'}</b> <span className="text-xs text-gray-500">{member.phone || member.email || ''}</span></> : '연결된 회원 없음'}
                      </p>
                      <p className="text-gray-800"><i className="ti ti-book text-gray-400" /> {selected.course_id ? courseTitle(selected.course_id) : '강의 없음'}</p>
                      {!selected.purchase_id && <p className="text-xs text-amber-700 mt-1">구매 기록과 연결이 끊긴 결제입니다. 수강 중인 계정으로 옮기면 매출에 다시 잡힙니다.</p>}
                    </div>

                    {!moveOpen ? (
                      <button
                        type="button"
                        onClick={() => { setMoveOpen(true); setMoveTarget(null); setMemberQuery(''); setMemberHits([]) }}
                        className="w-full py-2.5 rounded-xl bg-white border border-gray-300 text-gray-700 font-bold text-sm cursor-pointer hover:border-gray-400"
                      >
                        <i className="ti ti-arrows-exchange" /> 다른 계정·강의로 옮기기
                      </button>
                    ) : (
                      <div className="space-y-3 border-t border-gray-100 pt-3">
                        <p className="text-sm font-bold text-gray-900">① 옮길 수강생 계정 <span className="text-xs font-normal text-gray-400">수업 듣는 사람</span></p>
                        {moveTarget && (
                          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                            <i className="ti ti-user-check text-emerald-600" />
                            <span className="text-sm text-gray-900 font-medium truncate">{moveTarget.name || '(이름없음)'}</span>
                            <span className="text-xs text-gray-500 truncate">{moveTarget.phone || moveTarget.email || ''}</span>
                          </div>
                        )}
                        <input
                          id="linkpay-inbox-move-member"
                          value={memberQuery}
                          onChange={(e) => searchMembers(e.target.value)}
                          placeholder="이름·전화·이메일로 검색"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]"
                        />
                        {memberHits.length > 0 && (
                          <div className="border border-gray-200 rounded-lg max-h-[160px] overflow-y-auto">
                            {memberHits.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => { setMoveTarget(m); setMemberHits([]); setMemberQuery('') }}
                                className="w-full text-left px-3 py-2 text-sm border-none cursor-pointer bg-white hover:bg-gray-50"
                              >
                                {m.name || '(이름없음)'} <span className="text-xs text-gray-400">{m.phone || m.email || ''}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <p className="text-sm font-bold text-gray-900">② 강의</p>
                        <select
                          id="linkpay-inbox-move-course"
                          value={courseId}
                          onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : '')}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573] bg-white"
                        >
                          <option value="">강의 선택</option>
                          {[...courses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((c) => (
                            <option key={c.id} value={c.id}>{c.instructor?.name ? `[${c.instructor.name}] ` : ''}{c.title}</option>
                          ))}
                        </select>
                        {selected.purchase_id && (
                          <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={revokeOld} onChange={(e) => setRevokeOld(e.target.checked)} className="mt-0.5" />
                            <span>원래 계정의 수강권 회수 <span className="text-gray-400">(끄면 원래 계정은 0원 수강권으로 남습니다. 분할 결제로 합쳐진 구매면 이 결제 금액만 빠집니다)</span></span>
                          </label>
                        )}
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setMoveOpen(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm border-none cursor-pointer">취소</button>
                          <button
                            type="button"
                            onClick={move}
                            disabled={saving || !moveTarget || courseId === ''}
                            className="flex-[2] py-2.5 rounded-xl bg-gray-900 text-white font-bold text-sm border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {saving ? '옮기는 중...' : '이 계정으로 옮기기'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : statusOf(selected) === 'canceled' ? (
                  <p>취소된 결제라 수강권을 줄 수 없습니다.</p>
                ) : (
                  <p>결제가 아직 완료되지 않았습니다.</p>
                )}
              </div>
            ) : (
              <>
                {/* ① 수강생 */}
                <div className="p-5 space-y-2">
                  <p className="text-sm font-bold text-gray-900">① 수강생 계정 <span className="text-xs font-normal text-gray-400">수업 듣는 사람</span></p>
                  {member ? (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      <i className="ti ti-user-check text-emerald-600" />
                      <span className="text-sm text-gray-900 font-medium truncate">{member.name || '(이름없음)'}</span>
                      <span className="text-xs text-gray-500 truncate">{member.phone || member.email || ''}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">결제 번호로 회원을 찾지 못했습니다. 아래에서 검색해 고르세요. 회원이 아니면 <Link to="/admin/members" className="font-bold">회원 관리</Link>에서 먼저 만들어 주세요.</p>
                  )}
                  <input
                    id="linkpay-inbox-member"
                    value={memberQuery}
                    onChange={(e) => searchMembers(e.target.value)}
                    placeholder={member ? '다른 계정으로 바꾸기 — 이름·전화·이메일 검색' : '이름·전화·이메일로 검색'}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]"
                  />
                  {memberHits.length > 0 && (
                    <div className="border border-gray-200 rounded-lg max-h-[160px] overflow-y-auto">
                      {memberHits.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { setMember(m); setMemberHits([]); setMemberQuery('') }}
                          className="w-full text-left px-3 py-2 text-sm border-none cursor-pointer bg-white hover:bg-gray-50 flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{m.name || '(이름없음)'} <span className="text-xs text-gray-400">{m.phone || m.email || ''}</span></span>
                          {member?.id === m.id && <i className="ti ti-check text-[#2ED573]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ② 강의 */}
                <div className="p-5 space-y-2">
                  <p className="text-sm font-bold text-gray-900">② 강의</p>
                  {courseId !== '' && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      <i className="ti ti-book text-emerald-600" />
                      <span className="text-sm text-gray-900 font-medium">{courseTitle(courseId)}</span>
                    </div>
                  )}
                  <input
                    id="linkpay-inbox-course"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder={courseId !== '' ? '다른 강의로 바꾸기 — 검색' : '강의 검색'}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]"
                  />
                  {(courseSearch || courseId === '') && (
                    <div className="border border-gray-200 rounded-lg max-h-[180px] overflow-y-auto">
                      {filteredCourses.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setCourseId(c.id); setCourseSearch('') }}
                          className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer flex items-center justify-between gap-2 ${courseId === c.id ? 'bg-[#2ED573]/10' : 'bg-white hover:bg-gray-50'}`}
                        >
                          <span className="truncate">{c.instructor?.name && <span className="text-xs text-gray-400 mr-1">[{c.instructor.name}]</span>}{c.title}</span>
                          {courseId === c.id && <i className="ti ti-check text-[#2ED573]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ③ 부여 */}
                <div className="p-5 space-y-3">
                  {preview && (
                    <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                      {preview === 'attached' && <>이 회원이 가진 <b>0원 수강권에 {won(selected.amount)}이 채워집니다</b>. 수강 기간은 그대로입니다.</>}
                      {preview === 'top_up' && <>이미 결제한 구매에 <b>{won(selected.amount)}이 더해집니다</b>(분할·차액). 수강권은 하나로 유지됩니다.</>}
                      {preview === 'inserted' && <>이 회원에게 <b>새 수강권</b>이 생기고 {won(selected.amount)}이 매출에 기록됩니다.</>}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={grant}
                    disabled={saving || !member || courseId === ''}
                    className="w-full py-3 rounded-xl bg-[#2ED573] hover:bg-[#25B866] text-white font-bold text-sm border-none cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? '처리 중...' : `부여하기 · ${won(selected.amount)}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
