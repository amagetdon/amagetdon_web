import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Profile, PointLog, Coupon } from '../../types'

interface MemberWithPurchases extends Profile {
  purchaseCount: number
  totalSpent: number
}

export default function AdminMembers() {
  const { user } = useAuth()
  const [members, setMembers] = useState<MemberWithPurchases[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<MemberWithPurchases | null>(null)
  const [purchases, setPurchases] = useState<{ id: number; title: string; original_price: number | null; price: number; purchased_at: string; expires_at: string | null; coupon_id: number | null }[]>([])
  const [roleTarget, setRoleTarget] = useState<{ id: string; name: string; newRole: 'user' | 'admin' } | null>(null)
  const [pointLogs, setPointLogs] = useState<PointLog[]>([])
  const [pointForm, setPointForm] = useState({ amount: '', memo: '', type: 'charge' as 'charge' | 'deduct' })
  const [pointSubmitting, setPointSubmitting] = useState(false)
  const [memberCoupons, setMemberCoupons] = useState<{ claim_id: number; coupon: Coupon; used_at: string | null; claimed_at: string }[]>([])
  const [grantOpen, setGrantOpen] = useState(false)
  const [grantType, setGrantType] = useState<'course' | 'ebook'>('course')
  const [grantItemId, setGrantItemId] = useState('')
  const [grantDays, setGrantDays] = useState('365')
  const [grantSaving, setGrantSaving] = useState(false)
  const [allCourses, setAllCourses] = useState<{ id: number; title: string; duration_days: number }[]>([])
  const [allEbooks, setAllEbooks] = useState<{ id: number; title: string; duration_days: number }[]>([])
  const [refundTarget, setRefundTarget] = useState<{ id: number; title: string; price: number; coupon_id: number | null } | null>(null)
  const [refundRestoreCoupon, setRefundRestoreCoupon] = useState(true)
  const [refunding, setRefunding] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data: profiles, error: profileError } = await withTimeout(Promise.resolve(supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })))
      if (profileError) throw profileError

      const { data: purchaseData } = await withTimeout(Promise.resolve(supabase
        .from('purchases')
        .select('user_id, price')))

      const purchaseMap = new Map<string, { count: number; total: number }>()
      if (purchaseData) {
        for (const p of purchaseData as { user_id: string; price: number }[]) {
          const prev = purchaseMap.get(p.user_id) || { count: 0, total: 0 }
          purchaseMap.set(p.user_id, { count: prev.count + 1, total: prev.total + p.price })
        }
      }

      const membersWithPurchases = (profiles as Profile[]).map((profile) => {
        const pData = purchaseMap.get(profile.id) || { count: 0, total: 0 }
        return { ...profile, purchaseCount: pData.count, totalSpent: pData.total }
      })

      setMembers(membersWithPurchases)
    } catch {
      toast.error('회원 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])
  useVisibilityRefresh(fetchData)


  const handleViewMember = async (member: MemberWithPurchases) => {
    setViewing(member)
    setPointForm({ amount: '', memo: '', type: 'charge' })
    setMemberCoupons([])
    const [purchaseRes, pointLogRes, couponRes] = await Promise.all([
      supabase
        .from('purchases')
        .select('id, title, original_price, price, purchased_at, expires_at, coupon_id')
        .eq('user_id', member.id)
        .order('purchased_at', { ascending: false }),
      supabase
        .from('point_logs')
        .select('*')
        .eq('user_id', member.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('coupon_claims')
        .select('id, coupon_id, used_at, claimed_at, coupons(*)')
        .eq('user_id', member.id)
        .order('claimed_at', { ascending: false }),
    ])
    setPurchases((purchaseRes.data as typeof purchases) || [])
    setPointLogs((pointLogRes.data as PointLog[]) || [])
    setMemberCoupons(
      (couponRes.data ?? []).map((d: { id: number; coupon_id: number; used_at: string | null; claimed_at: string; coupons: Coupon }) => ({
        claim_id: d.id,
        coupon: d.coupons,
        used_at: d.used_at,
        claimed_at: d.claimed_at,
      }))
    )
  }

  // 수기 부여 모달 열 때 강의/전자책 목록 로드
  const openGrantModal = async () => {
    setGrantOpen(true)
    setGrantItemId('')
    setGrantDays('365')
    if (allCourses.length === 0) {
      const [c, e] = await Promise.all([
        supabase.from('courses').select('id, title, duration_days').order('sort_order'),
        supabase.from('ebooks').select('id, title, duration_days').order('sort_order'),
      ])
      setAllCourses((c.data ?? []) as { id: number; title: string; duration_days: number }[])
      setAllEbooks((e.data ?? []) as { id: number; title: string; duration_days: number }[])
    }
  }

  const handleGrant = async () => {
    if (!viewing || !grantItemId) { toast.error('항목을 선택해주세요.'); return }
    setGrantSaving(true)
    try {
      const itemId = Number(grantItemId)
      const items = grantType === 'course' ? allCourses : allEbooks
      const item = items.find((i) => i.id === itemId)
      const days = Number(grantDays) || item?.duration_days || 365
      const expiresAt = new Date(Date.now() + days * 86400000).toISOString()

      const { error } = await supabase.from('purchases').insert({
        user_id: viewing.id,
        course_id: grantType === 'course' ? itemId : null,
        ebook_id: grantType === 'ebook' ? itemId : null,
        title: item?.title || '',
        price: 0,
        expires_at: expiresAt,
      } as never)
      if (error) throw error

      toast.success(`${item?.title} 수강권이 부여되었습니다.`)
      setGrantOpen(false)
      await handleViewMember(viewing)
    } catch {
      toast.error('부여에 실패했습니다.')
    } finally {
      setGrantSaving(false)
    }
  }

  const handleRefund = async () => {
    if (!viewing || !refundTarget || !user || refunding) return
    setRefunding(true)
    try {
      // 1. 구매 삭제
      const { error } = await supabase.from('purchases').delete().eq('id', refundTarget.id)
      if (error) throw error

      // 2. 포인트 환불 (가격이 0보다 큰 경우)
      if (refundTarget.price > 0) {
        await supabase.rpc('add_points', { user_id_input: viewing.id, amount_input: refundTarget.price } as never)
        await supabase.rpc('insert_point_log', {
          p_user_id: viewing.id,
          p_amount: refundTarget.price,
          p_balance: viewing.points + refundTarget.price,
          p_type: 'refund',
          p_memo: `${refundTarget.title} 환불`,
        } as never)
      }

      // 3. 쿠폰 복구 (해당 구매에 사용된 쿠폰)
      if (refundRestoreCoupon && refundTarget.coupon_id) {
        await supabase
          .from('coupon_claims')
          .update({ used_at: null } as never)
          .eq('user_id', viewing.id)
          .eq('coupon_id', refundTarget.coupon_id)
      }

      const msgs = [`${refundTarget.title} 환불 완료`]
      if (refundTarget.price > 0) msgs.push(`+${refundTarget.price.toLocaleString()}P`)
      if (refundRestoreCoupon) msgs.push('쿠폰 복구됨')
      toast.success(msgs.join(' · '))

      setRefundTarget(null)
      setRefundRestoreCoupon(true)
      await handleViewMember({ ...viewing, points: viewing.points + refundTarget.price })
      await fetchData()
    } catch {
      toast.error('환불에 실패했습니다.')
    } finally {
      setRefunding(false)
    }
  }

  const [deleteTargetPurchase, setDeleteTargetPurchase] = useState<number | null>(null)

  const handleDeletePurchase = async () => {
    if (!viewing || !deleteTargetPurchase) return
    try {
      const { error } = await supabase.from('purchases').delete().eq('id', deleteTargetPurchase)
      if (error) throw error
      setPurchases((prev) => prev.filter((p) => p.id !== deleteTargetPurchase))
      setDeleteTargetPurchase(null)
      toast.success('구매 내역이 삭제되었습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const handleDeleteCouponClaim = async (claimId: number) => {
    try {
      const { error } = await supabase.from('coupon_claims').delete().eq('id', claimId)
      if (error) throw error
      setMemberCoupons((prev) => prev.filter((c) => c.claim_id !== claimId))
      toast.success('쿠폰이 회수되었습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const handlePointSubmit = async () => {
    if (!viewing || !user) return
    const amount = parseInt(pointForm.amount)
    if (!amount || amount <= 0) {
      toast.error('금액을 올바르게 입력해주세요.')
      return
    }

    const actualAmount = pointForm.type === 'deduct' ? -amount : amount
    const newBalance = viewing.points + actualAmount

    if (newBalance < 0) {
      toast.error('차감 후 잔액이 0 미만이 됩니다.')
      return
    }

    setPointSubmitting(true)
    try {
      // 1. 포인트 먼저 변경 (SECURITY DEFINER 함수로 RLS 우회)
      const { error: pointError } = await supabase.rpc('add_points', {
        user_id_input: viewing.id,
        amount_input: actualAmount,
      } as never)
      if (pointError) throw pointError

      // 2. 로그 기록 (SECURITY DEFINER 함수)
      await supabase.rpc('insert_point_log', {
        p_user_id: viewing.id,
        p_amount: actualAmount,
        p_balance: newBalance,
        p_type: pointForm.type,
        p_memo: pointForm.memo || null,
      } as never)

      toast.success(`${amount.toLocaleString()}P ${pointForm.type === 'charge' ? '충전' : '차감'} 완료`)
      // DB에서 최신 포인트 다시 읽기
      const { data: freshProfile } = await supabase.from('profiles').select('points').eq('id', viewing.id).single()
      setViewing({ ...viewing, points: (freshProfile as unknown as Record<string, unknown>)?.points as number ?? newBalance })
      setPointForm({ amount: '', memo: '', type: 'charge' })

      const { data: newLogs } = await supabase
        .from('point_logs')
        .select('*')
        .eq('user_id', viewing.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setPointLogs((newLogs as PointLog[]) || [])
      await fetchData()
    } catch {
      toast.error('포인트 처리에 실패했습니다.')
    } finally {
      setPointSubmitting(false)
    }
  }

  const handleRoleChange = async () => {
    if (!roleTarget) return
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: roleTarget.newRole } as never)
        .eq('id', roleTarget.id)
      if (error) throw error
      toast.success(`${roleTarget.name || '회원'}의 권한이 ${roleTarget.newRole === 'admin' ? '관리자' : '일반회원'}으로 변경되었습니다.`)
      setRoleTarget(null)
      await fetchData()
    } catch {
      toast.error('권한 변경에 실패했습니다.')
    }
  }

  const filtered = members.filter((m) =>
    (m.name || '').includes(search) ||
    (m.email || '').includes(search) ||
    (m.phone || '').includes(search) ||
    m.id.includes(search)
  )

  const exportToExcel = (data: MemberWithPurchases[]) => {
    const header = ['이름', '가입방법', '이메일', '전화번호', '성별', '생년월일', '주소', '권한', '포인트', '구매 수', '총 결제액', '가입일']
    const rows = data.map((m) => {
      const provider = (m as Record<string, unknown>).provider as string | undefined || (m.email?.endsWith('@kakao.com') ? 'kakao' : 'email')
      return [
        m.name || '',
        provider === 'kakao' ? '카카오' : provider === 'google' ? '구글' : '이메일',
        m.email || '',
        m.phone || '',
        m.gender === 'male' ? '남' : m.gender === 'female' ? '여' : '',
        m.birth_date || '',
        (m.address || '').replace(/\|/g, ' '),
        m.role === 'admin' ? '관리자' : '회원',
        m.points,
        m.purchaseCount,
        m.totalSpent,
        new Date(m.created_at).toLocaleDateString('ko-KR'),
      ]
    })

    const BOM = '\uFEFF'
    const csv = BOM + [header, ...rows].map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `회원목록_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ko-KR')
  const formatGender = (g: string | null) => g === 'male' ? '남' : g === 'female' ? '여' : '-'

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
          <p className="text-sm text-gray-500 mt-1">전체 {members.length}명</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchData() ; toast.success('새로고침 완료') }}
            className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 text-gray-500 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
            aria-label="새로고침"
          >
            <i className="ti ti-refresh text-sm" />
          </button>
          <button
            onClick={() => exportToExcel(filtered)}
            disabled={filtered.length === 0}
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ti ti-file-spreadsheet text-sm" />
            엑셀 내보내기
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 전화번호 검색..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">이름</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">이메일</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">전화번호</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">성별</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">생년월일</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">주소</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">권한</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">포인트</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">구매</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">총 결제</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">가입일</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}</td></tr>
                ) : filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewMember(m)}>
                    <td className="px-4 py-3 text-center font-medium">
                      <span>{m.name || '-'}</span>
                      {(() => {
                        const p = (m as Record<string, unknown>).provider as string | undefined
                        const provider = p || (m.email?.endsWith('@kakao.com') ? 'kakao' : 'email')
                        if (provider === 'kakao') return <span className="ml-1.5 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">카카오</span>
                        if (provider === 'google') return <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">구글</span>
                        return <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">이메일</span>
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden text-xs">{m.email || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">{m.phone || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">{formatGender(m.gender)}</td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden text-xs">{m.birth_date ? formatDate(m.birth_date) : '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden text-xs max-w-[150px] truncate">{m.address ? m.address.split('|').slice(1).join(' ') : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        m.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {m.role === 'admin' ? '관리자' : '회원'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center max-sm:hidden">
                      <span className={`text-sm font-medium ${m.points > 0 ? 'text-[#2ED573]' : 'text-gray-400'}`}>
                        {m.points > 0 ? `${m.points.toLocaleString()}P` : '0P'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">{m.purchaseCount}</td>
                    <td className="px-4 py-3 text-center text-gray-700 max-sm:hidden">{m.totalSpent > 0 ? `${m.totalSpent.toLocaleString()}원` : '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setRoleTarget({
                            id: m.id,
                            name: m.name || '회원',
                            newRole: m.role === 'admin' ? 'user' : 'admin',
                          })
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-purple-500 hover:bg-purple-50 bg-transparent border-none cursor-pointer transition-colors mx-auto"
                        aria-label="권한 변경"
                      >
                        <i className="ti ti-shield text-sm" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 회원 상세 모달 */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[80vh] overflow-y-auto">
            {viewing && (
              <>
                <DialogTitle className="text-lg font-bold text-gray-900 mb-4">회원 정보</DialogTitle>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <InfoItem label="이름" value={viewing.name || '-'} />
                  <InfoItem label="이메일" value={viewing.email || '-'} />
                  <InfoItem label="전화번호" value={viewing.phone || '-'} />
                  <InfoItem label="성별" value={formatGender(viewing.gender)} />
                  <InfoItem label="생년월일" value={viewing.birth_date ? formatDate(viewing.birth_date) : '-'} />
                  <InfoItem label="주소" value={viewing.address || '-'} full />
                  <InfoItem label="포인트" value={`${viewing.points.toLocaleString()}P`} />
                  <InfoItem label="권한" value={viewing.role === 'admin' ? '관리자' : '일반회원'} />
                  <InfoItem label="가입일" value={formatDate(viewing.created_at)} />
                  <InfoItem label="총 구매" value={`${viewing.purchaseCount}건`} />
                  <InfoItem label="총 결제" value={`${viewing.totalSpent.toLocaleString()}원`} />
                </div>

                {/* 포인트 관리 */}
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">포인트 관리</h3>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-500">현재 잔액</span>
                      <span className="text-lg font-bold text-[#2ED573]">{viewing.points.toLocaleString()}P</span>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setPointForm(prev => ({ ...prev, type: 'charge' }))}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-none transition-colors ${
                          pointForm.type === 'charge'
                            ? 'bg-[#2ED573] text-gray-900'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }`}
                      >
                        충전
                      </button>
                      <button
                        type="button"
                        onClick={() => setPointForm(prev => ({ ...prev, type: 'deduct' }))}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-none transition-colors ${
                          pointForm.type === 'deduct'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }`}
                      >
                        차감
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={pointForm.amount}
                        onChange={(e) => setPointForm(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="금액"
                        min="1"
                        className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]"
                      />
                      <input
                        type="text"
                        value={pointForm.memo}
                        onChange={(e) => setPointForm(prev => ({ ...prev, memo: e.target.value }))}
                        placeholder="사유 (예: 무통장입금)"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]"
                      />
                      <button
                        onClick={handlePointSubmit}
                        disabled={pointSubmitting || !pointForm.amount}
                        className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
                          pointForm.type === 'charge'
                            ? 'bg-[#2ED573] text-gray-900 hover:bg-[#25B866]'
                            : 'bg-red-500 text-white hover:bg-red-600'
                        }`}
                      >
                        {pointSubmitting ? '처리중...' : '확인'}
                      </button>
                    </div>
                  </div>

                  {pointLogs.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs text-gray-400 font-medium">최근 포인트 내역</p>
                      {pointLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                              log.type === 'charge' ? 'bg-green-100 text-green-700'
                              : log.type === 'deduct' ? 'bg-red-100 text-red-700'
                              : log.type === 'use' ? 'bg-blue-100 text-blue-700'
                              : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {log.type === 'charge' ? '충전' : log.type === 'deduct' ? '차감' : log.type === 'use' ? '사용' : '환불'}
                            </span>
                            <span className="text-sm text-gray-600 truncate">{log.memo || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className={`text-sm font-semibold ${log.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString()}P
                            </span>
                            <span className="text-xs text-gray-400">{formatDate(log.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-900">구매 내역 ({purchases.length}건)</h3>
                    <button
                      onClick={openGrantModal}
                      className="px-3 py-1.5 bg-[#2ED573] text-white text-xs font-bold rounded-lg border-none cursor-pointer hover:bg-[#25B866] transition-colors flex items-center gap-1"
                    >
                      <i className="ti ti-plus text-xs" /> 수강권 부여
                    </button>
                  </div>
                  {purchases.length > 0 ? (
                    <div className="space-y-2">
                      {purchases.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700 truncate block">{p.title}</span>
                            <span className="text-[10px] text-gray-400">
                              {p.original_price && p.original_price !== p.price ? (
                                <><span className="line-through">{p.original_price.toLocaleString()}P</span> → <span className="text-[#2ED573] font-bold">{p.price > 0 ? `${p.price.toLocaleString()}P` : '무료'}</span> (쿠폰)</>
                              ) : (
                                p.price > 0 ? `${p.price.toLocaleString()}P` : '무료'
                              )}
                              {' · '}{formatDate(p.purchased_at)}
                              {p.expires_at && ` · ~${formatDate(p.expires_at)}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-3">
                            <button
                              onClick={() => setRefundTarget({ id: p.id, title: p.title, price: p.price, coupon_id: p.coupon_id })}
                              className="px-2 py-1 text-[10px] font-medium text-yellow-600 bg-yellow-50 rounded border-none cursor-pointer hover:bg-yellow-100 transition-colors whitespace-nowrap"
                            >
                              환불
                            </button>
                            <button
                              onClick={() => setDeleteTargetPurchase(p.id)}
                              className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors"
                              aria-label="삭제"
                            >
                              <i className="ti ti-x text-xs" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-4">구매 내역이 없습니다.</p>
                  )}
                </div>

                {/* 쿠폰 발급 내역 */}
                {memberCoupons.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-bold text-gray-900 mb-2">쿠폰 ({memberCoupons.length}건)</h3>
                    <div className="space-y-2">
                      {memberCoupons.map((c) => (
                        <div key={c.claim_id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                              c.used_at ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-700'
                            }`}>
                              {c.used_at ? '사용됨' : '미사용'}
                            </span>
                            <span className="text-sm text-gray-700 truncate">
                              {c.coupon.title?.split('\n')[0]}
                            </span>
                            <span className="text-xs text-gray-400 shrink-0">
                              {c.coupon.discount_type === 'percent' ? `${c.coupon.discount_value}%` : `${c.coupon.discount_value.toLocaleString()}원`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="text-xs text-gray-400">{formatDate(c.claimed_at)}</span>
                            <button
                              onClick={() => handleDeleteCouponClaim(c.claim_id)}
                              className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors"
                              aria-label="회수"
                            >
                              <i className="ti ti-x text-xs" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setViewing(null)}
                  className="mt-6 w-full py-2 bg-gray-100 text-gray-600 rounded-lg cursor-pointer border-none text-sm hover:bg-gray-200"
                >
                  닫기
                </button>
              </>
            )}
          </DialogPanel>
        </div>
      </Dialog>

      {/* 수강권 수기 부여 */}
      <Dialog open={grantOpen} onClose={() => setGrantOpen(false)} className="relative z-[60]">
        <div className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <DialogTitle className="text-base font-bold text-gray-900 mb-4">수강권 수기 부여</DialogTitle>
            <p className="text-xs text-gray-400 mb-4">{viewing?.name || '회원'}에게 강의/전자책 수강권을 부여합니다.</p>

            <div className="space-y-3">
              <div className="flex gap-2">
                <button type="button" onClick={() => { setGrantType('course'); setGrantItemId('') }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${grantType === 'course' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                  강의
                </button>
                <button type="button" onClick={() => { setGrantType('ebook'); setGrantItemId('') }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${grantType === 'ebook' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                  전자책
                </button>
              </div>

              <select
                value={grantItemId}
                onChange={(e) => {
                  setGrantItemId(e.target.value)
                  const items = grantType === 'course' ? allCourses : allEbooks
                  const item = items.find((i) => i.id === Number(e.target.value))
                  if (item) setGrantDays(String(item.duration_days || 365))
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] bg-white cursor-pointer"
              >
                <option value="">{grantType === 'course' ? '강의를 선택하세요' : '전자책을 선택하세요'}</option>
                {(grantType === 'course' ? allCourses : allEbooks).map((item) => (
                  <option key={item.id} value={item.id}>{item.title}</option>
                ))}
              </select>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">수강 기간 (일)</label>
                <input
                  type="number"
                  value={grantDays}
                  onChange={(e) => setGrantDays(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setGrantOpen(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg border-none cursor-pointer hover:bg-gray-200">
                  취소
                </button>
                <button onClick={handleGrant} disabled={grantSaving || !grantItemId}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-[#2ED573] rounded-lg border-none cursor-pointer hover:bg-[#25B866] disabled:opacity-50">
                  {grantSaving ? '처리 중...' : '부여하기'}
                </button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* 환불 확인 */}
      <Dialog open={!!refundTarget} onClose={() => { setRefundTarget(null); setRefundRestoreCoupon(true) }} className="relative z-[60]">
        <div className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="ti ti-receipt-refund text-yellow-500 text-xl" />
            </div>
            <p className="text-sm font-bold text-gray-900 text-center mb-1">구매 환불</p>
            {refundTarget && (
              <>
                <p className="text-xs text-gray-400 text-center mb-4">
                  "{refundTarget.title}" 수강권이 회수되고<br />
                  {refundTarget.price > 0 ? `${refundTarget.price.toLocaleString()}P가 환불됩니다.` : '무료 항목입니다.'}
                </p>
                {refundTarget.coupon_id ? (
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 rounded-lg px-3 py-2.5 mb-4">
                    <input
                      type="checkbox"
                      checked={refundRestoreCoupon}
                      onChange={(e) => setRefundRestoreCoupon(e.target.checked)}
                      className="accent-[#2ED573]"
                    />
                    <div>
                      <span className="text-sm text-gray-700">사용한 쿠폰 복구</span>
                      <p className="text-[10px] text-gray-400">이 구매에 사용된 쿠폰을 미사용 상태로 되돌립니다</p>
                    </div>
                  </label>
                ) : (
                  <div className="bg-gray-50 rounded-lg px-3 py-2.5 mb-4">
                    <p className="text-xs text-gray-400">쿠폰 없이 결제된 구매입니다</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setRefundTarget(null); setRefundRestoreCoupon(true) }}
                    className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg border-none cursor-pointer hover:bg-gray-200 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleRefund}
                    disabled={refunding}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg border-none cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {refunding ? '처리 중...' : '환불하기'}
                  </button>
                </div>
              </>
            )}
          </DialogPanel>
        </div>
      </Dialog>

      {/* 구매 삭제 확인 */}
      <ConfirmDialog
        isOpen={!!deleteTargetPurchase}
        onClose={() => setDeleteTargetPurchase(null)}
        onConfirm={handleDeletePurchase}
        title="구매 내역 삭제"
        message="이 구매 내역을 삭제하시겠습니까? 수강권이 회수되며 포인트는 환불되지 않습니다."
        confirmColor="red"
      />

      {/* 권한 변경 확인 */}
      <ConfirmDialog
        isOpen={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        onConfirm={handleRoleChange}
        title="권한 변경"
        message={roleTarget ? `${roleTarget.name}의 권한을 ${roleTarget.newRole === 'admin' ? '관리자' : '일반회원'}으로 변경하시겠습니까?` : ''}
      />
    </AdminLayout>
  )
}

function InfoItem({ label, value, full }: { label: string; value: string; full?: boolean }) {
  const formatted = value.includes('|') ? value.split('|').map((v) => v.trim()).join('\n') : value
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900 whitespace-pre-line">{formatted}</p>
    </div>
  )
}
