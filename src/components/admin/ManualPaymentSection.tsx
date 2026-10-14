import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import AdminFormModal from './AdminFormModal'
import { supabase } from '../../lib/supabase'
import type { CourseWithInstructor } from '../../types'

// 무통장(계좌이체·현금) 입금 수동 등록 — 토스 밖에서 받은 돈도 수강생 구매에 금액으로 남겨 매출에 잡히게 한다.
// 처리 규칙은 링크페이 수동 부여와 같다(RPC admin_record_manual_payment): 같은 회원·강의의 0원 수강권이 있으면 금액을 채우고,
// 유료 구매가 있으면 합산(카드 반 + 입금 반, 분할), 없으면 새 구매를 만든다.

interface MemberHit { id: string; name: string | null; phone: string | null; email: string | null }
interface ManualPaymentRow {
  id: number
  method: string
  amount: number
  paid_at: string
  payer_name: string | null
  memo: string | null
  mode: string | null
  course_id: number | null
  member: { name: string | null; phone: string | null } | null
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ManualPaymentSection({
  courses,
  courseExpiry,
}: {
  courses: CourseWithInstructor[]
  courseExpiry: (course: CourseWithInstructor | undefined) => string | null
}) {
  const [rows, setRows] = useState<ManualPaymentRow[]>([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberHits, setMemberHits] = useState<MemberHit[]>([])
  const [member, setMember] = useState<MemberHit | null>(null)
  const [courseSearch, setCourseSearch] = useState('')
  const [courseId, setCourseId] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [paidDate, setPaidDate] = useState(todayStr())
  const [method, setMethod] = useState<'bank' | 'cash'>('bank')
  const [payerName, setPayerName] = useState('')
  const [memo, setMemo] = useState('')

  const load = async () => {
    const { data } = await supabase
      .from('manual_payments')
      .select('id, method, amount, paid_at, payer_name, memo, mode, course_id, member:profiles(name, phone)')
      .order('paid_at', { ascending: false })
      .limit(100)
    setRows((data ?? []) as unknown as ManualPaymentRow[])
  }
  useEffect(() => { load() }, [])

  const reset = () => {
    setMemberQuery(''); setMemberHits([]); setMember(null); setCourseSearch(''); setCourseId('')
    setAmount(''); setPaidDate(todayStr()); setMethod('bank'); setPayerName(''); setMemo('')
  }

  const searchMembers = async (q: string) => {
    setMemberQuery(q)
    if (!q.trim()) { setMemberHits([]); return }
    const { data } = await supabase.from('profiles').select('id, name, phone, email')
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`).limit(20)
    setMemberHits((data ?? []) as MemberHit[])
  }

  const handleSave = async () => {
    const won = Number(amount.replace(/[^\d]/g, ''))
    if (!member) { toast.error('수강생을 선택해주세요.'); return }
    if (courseId === '') { toast.error('강의를 선택해주세요.'); return }
    if (!won) { toast.error('입금 금액을 입력해주세요.'); return }
    if (!paidDate) { toast.error('입금일을 입력해주세요.'); return }
    const course = courses.find((c) => c.id === courseId)
    try {
      setSaving(true)
      const { data, error } = await supabase.rpc('admin_record_manual_payment', {
        p_user_id: member.id,
        p_course_id: courseId,
        p_ebook_id: null,
        p_amount: won,
        p_paid_at: new Date(`${paidDate}T12:00:00`).toISOString(),
        p_method: method,
        p_payer_name: payerName,
        p_memo: memo,
        p_title: course?.title ?? '무통장 입금',
        p_expires_at: courseExpiry(course),
      } as never)
      if (error) throw error
      const mode = (data as { mode?: string } | null)?.mode
      toast.success(
        mode === 'attached' ? '기존 0원 수강권에 입금 금액을 채웠습니다. (기간 유지)'
          : mode === 'top_up' ? '이미 결제한 구매에 입금 금액을 더했습니다.'
            : '입금이 등록되고 수강권이 부여되었습니다.',
      )
      setOpen(false)
      reset()
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const filteredCourses = [...courses]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter((c) => !courseSearch || c.title.includes(courseSearch) || (c.instructor?.name || '').includes(courseSearch))
  const courseTitle = (id: number | null) => courses.find((c) => c.id === id)?.title ?? (id ? `#${id}` : '-')
  const modeLabel: Record<string, string> = { attached: '0원 수강권에 채움', top_up: '기존 결제에 합산', inserted: '새 수강권' }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-bold text-gray-900">무통장 입금 <span className="text-gray-400 font-normal">({rows.length})</span></h2>
          <p className="text-xs text-gray-400 mt-0.5">계좌이체·현금으로 받은 돈을 등록하면 수강권과 매출에 함께 반영됩니다. 카드 반 + 입금 반이면 각각 등록하세요(합산됩니다).</p>
        </div>
        <button
          onClick={() => { reset(); setOpen(true) }}
          className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors flex items-center gap-1.5"
        >
          <i className="ti ti-plus text-sm" /> 무통장 입금 등록
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-gray-400">등록된 무통장 입금이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600">입금일</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600">수강생 / 입금자</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600">강의</th>
                <th className="px-4 py-3 text-right font-bold text-gray-600">금액</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(r.paid_at).toLocaleDateString('ko-KR')} · {r.method === 'cash' ? '현금' : '계좌이체'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-gray-800">{r.member?.name || '-'}</span>
                    <span className="block text-xs text-gray-400">입금자 {r.payer_name || '-'}{r.memo ? ` · ${r.memo}` : ''}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{courseTitle(r.course_id)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{r.amount.toLocaleString()}원</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{modeLabel[r.mode ?? ''] ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminFormModal isOpen={open} onClose={() => setOpen(false)} title="무통장 입금 등록" onSubmit={handleSave} loading={saving} submitText="등록하기">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold block mb-1">수강생 계정 *</label>
            <input
              value={memberQuery}
              onChange={(e) => searchMembers(e.target.value)}
              placeholder="수업 듣는 사람의 이름·전화번호·이메일로 검색"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]"
            />
            {memberHits.length > 0 && (
              <div className="border border-gray-200 rounded-lg mt-1 max-h-[160px] overflow-y-auto">
                {memberHits.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMember(m)}
                    className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer flex items-center justify-between ${member?.id === m.id ? 'bg-[#2ED573]/10' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <span>{m.name || '(이름없음)'} <span className="text-xs text-gray-400">{m.phone || m.email || ''}</span></span>
                    {member?.id === m.id && <i className="ti ti-check text-[#2ED573]" />}
                  </button>
                ))}
              </div>
            )}
            {member
              ? <p className="text-[11px] text-emerald-600 mt-1">수강생 계정: <b>{member.name || '(이름없음)'} {member.phone || ''}</b></p>
              : <p className="text-[11px] text-gray-400 mt-1">회원이 아니면 회원 관리에서 회원을 먼저 만든 뒤 등록하세요.</p>}
          </div>
          <div>
            <label className="text-sm font-bold block mb-1">강의 *</label>
            <div className="border border-gray-300 rounded-xl overflow-hidden">
              <input
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="강의 검색..."
                className="w-full px-3 py-2 text-sm border-none outline-none"
                style={{ borderBottom: '1px solid #e5e7eb' }}
              />
              <div className="max-h-[160px] overflow-y-auto">
                {filteredCourses.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCourseId(courseId === c.id ? '' : c.id)}
                    className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer flex items-center justify-between ${courseId === c.id ? 'bg-[#2ED573]/10 text-gray-900' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span>{c.instructor?.name && <span className="text-xs text-gray-400 mr-1">[{c.instructor.name}]</span>}{c.title}</span>
                    {courseId === c.id && <i className="ti ti-check text-[#2ED573]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold block mb-1">입금 금액 (원) *</label>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, '') ? Number(e.target.value.replace(/[^\d]/g, '')).toLocaleString() : '')}
                placeholder="1,000,000"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]"
              />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">입금일 *</label>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]"
              />
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={method === 'bank'} onChange={() => setMethod('bank')} /> 계좌이체</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={method === 'cash'} onChange={() => setMethod('cash')} /> 현금</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold block mb-1">입금자명</label>
              <input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="통장에 찍힌 이름" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">메모</label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 2차 분할분" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">이미 0원 수강권을 준 회원이면 그 수강권에 금액이 채워지고, 이미 결제한 회원이면 금액이 더해집니다. 수강권은 하나로 유지됩니다.</p>
        </div>
      </AdminFormModal>
    </div>
  )
}
