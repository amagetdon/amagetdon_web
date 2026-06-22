import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { toLocalDateStr } from '../../lib/dateUtils'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import { Dialog, DialogPanel, DialogTitle, Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from '@headlessui/react'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { webhookService } from '../../services/webhookService'
import { webhookScheduleService } from '../../services/webhookScheduleService'
import type { Profile, PointLog, Coupon } from '../../types'

interface MemberWithPurchases extends Profile {
  purchaseCount: number
  totalSpent: number
}

export default function AdminMembers() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [members, setMembers] = useState<MemberWithPurchases[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [memberTab, setMemberTab] = useState<'all' | 'email' | 'kakao' | 'google' | 'guest'>('all')
  const [page, setPage] = useState(0)
  const [viewing, setViewing] = useState<MemberWithPurchases | null>(null)
  const [purchases, setPurchases] = useState<{ id: number; title: string; original_price: number | null; price: number; purchased_at: string; expires_at: string | null; coupon_id: number | null; payment_method: string | null; payment_key: string | null; course_id: number | null; ebook_id: number | null }[]>([])
  const [roleTarget, setRoleTarget] = useState<{ id: string; name: string; newRole: 'user' | 'admin' } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; email: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [pointLogs, setPointLogs] = useState<PointLog[]>([])
  const [pointForm, setPointForm] = useState({ amount: '', memo: '', type: 'charge' as 'charge' | 'deduct' })
  const [pointSubmitting, setPointSubmitting] = useState(false)
  const [memberCoupons, setMemberCoupons] = useState<{ claim_id: number; coupon: Coupon; used_at: string | null; claimed_at: string }[]>([])
  const [grantOpen, setGrantOpen] = useState(false)
  const [grantType, setGrantType] = useState<'course' | 'ebook'>('course')
  const [grantItemId, setGrantItemId] = useState('')
  const [grantQuery, setGrantQuery] = useState('')
  const [grantDays, setGrantDays] = useState('365')
  // 수강 기간 산정 방식: deadline=강의 마감일 기준 / days=일(day) / date=만료 날짜 직접 지정
  const [grantMode, setGrantMode] = useState<'deadline' | 'days' | 'date'>('deadline')
  const [grantDate, setGrantDate] = useState('')
  const [grantSaving, setGrantSaving] = useState(false)
  // 일괄 부여(여러 회원 선택)
  const [bulkGrantOpen, setBulkGrantOpen] = useState(false)
  const [bulkMemberQuery, setBulkMemberQuery] = useState('')
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set())
  const [allCourses, setAllCourses] = useState<{ id: number; title: string; duration_days: number; enrollment_deadline: string | null }[]>([])
  const [allEbooks, setAllEbooks] = useState<{ id: number; title: string; duration_days: number }[]>([])
  const [refundTarget, setRefundTarget] = useState<{ id: number; title: string; price: number; coupon_id: number | null; payment_method: string | null; payment_key: string | null; course_id: number | null; ebook_id: number | null } | null>(null)
  const [refundRestoreCoupon, setRefundRestoreCoupon] = useState(true)
  const [refunding, setRefunding] = useState(false)
  const [pointLogPage, setPointLogPage] = useState(0)
  const [purchasePage, setPurchasePage] = useState(0)
  const [couponPage, setCouponPage] = useState(0)
  const [progressRecords, setProgressRecords] = useState<{ id: number; is_completed: boolean; completed_at: string | null; last_watched_at: string; course: { id: number; title: string } | null; curriculum_item: { id: number; label: string; week: number | null } | null }[]>([])
  const [memberReviews, setMemberReviews] = useState<{ id: number; title: string; content: string; rating: number; created_at: string; course: { id: number; title: string } | null }[]>([])
  const [progressPage, setProgressPage] = useState(0)
  const [reviewsPage, setReviewsPage] = useState(0)

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

  // URL 쿼리에 user=:id 있으면 해당 회원 모달 자동 오픈
  useEffect(() => {
    const userId = searchParams.get('user')
    if (!userId || members.length === 0 || viewing?.id === userId) return
    const target = members.find((m) => m.id === userId)
    if (target) handleViewMember(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, members])


  const handleViewMember = async (member: MemberWithPurchases) => {
    setViewing(member)
    setPointForm({ amount: '', memo: '', type: 'charge' })
    setPointLogPage(0)
    setPurchasePage(0)
    setCouponPage(0)
    setProgressPage(0)
    setReviewsPage(0)
    setMemberCoupons([])
    setProgressRecords([])
    setMemberReviews([])
    const [purchaseRes, pointLogRes, couponRes, progressRes, reviewRes] = await Promise.all([
      supabase
        .from('purchases')
        .select('id, title, original_price, price, purchased_at, expires_at, coupon_id, payment_method, payment_key, course_id, ebook_id')
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
      supabase
        .from('course_progress')
        .select('id, is_completed, completed_at, last_watched_at, course:courses(id, title), curriculum_item:curriculum_items(id, label, week)')
        .eq('user_id', member.id)
        .order('last_watched_at', { ascending: false })
        .limit(50),
      supabase
        .from('reviews')
        .select('id, title, content, rating, created_at, course:courses(id, title)')
        .eq('user_id', member.id)
        .order('created_at', { ascending: false }),
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
    setProgressRecords((progressRes.data as typeof progressRecords) || [])
    setMemberReviews((reviewRes.data as typeof memberReviews) || [])
  }

  // 강의/전자책 목록 로드 (최초 1회)
  const loadGrantItems = async () => {
    if (allCourses.length > 0) return
    const [c, e] = await Promise.all([
      supabase.from('courses').select('id, title, duration_days, enrollment_deadline').order('sort_order'),
      supabase.from('ebooks').select('id, title, duration_days').order('sort_order'),
    ])
    setAllCourses((c.data ?? []) as { id: number; title: string; duration_days: number; enrollment_deadline: string | null }[])
    setAllEbooks((e.data ?? []) as { id: number; title: string; duration_days: number }[])
  }

  // 강의/전자책·기간 선택 상태 초기화 (모달 공통)
  const resetGrantFields = () => {
    setGrantType('course')
    setGrantItemId('')
    setGrantQuery('')
    setGrantDays('365')
    setGrantMode('deadline')
    setGrantDate('')
  }

  // 수기 부여 모달(1인) 열기
  const openGrantModal = async () => {
    setGrantOpen(true)
    resetGrantFields()
    await loadGrantItems()
  }

  // 일괄 부여 모달(여러 회원) 열기
  const openBulkGrantModal = async () => {
    setBulkGrantOpen(true)
    setBulkSelectedIds(new Set())
    setBulkMemberQuery('')
    resetGrantFields()
    await loadGrantItems()
  }

  const toggleBulkMember = (id: string) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 선택된 모드에 따라 expires_at(ISO) 계산. null = 무제한.
  const computeGrantExpiry = (): string | null => {
    const itemId = Number(grantItemId)
    const items = grantType === 'course' ? allCourses : allEbooks
    const item = items.find((i) => i.id === itemId)
    if (grantMode === 'deadline') {
      const courseItem = item as { duration_days?: number; enrollment_deadline?: string | null } | undefined
      if (courseItem?.enrollment_deadline && courseItem?.duration_days && courseItem.duration_days > 0) {
        return new Date(new Date(courseItem.enrollment_deadline).getTime() + courseItem.duration_days * 86400000).toISOString()
      }
      return null
    }
    if (grantMode === 'days') {
      const days = Number(grantDays)
      return days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null
    }
    // date: 지정 날짜의 그날 끝(23:59:59)까지 유효
    return grantDate ? new Date(`${grantDate}T23:59:59`).toISOString() : null
  }

  const handleGrant = async () => {
    if (!viewing || !grantItemId) { toast.error('항목을 선택해주세요.'); return }
    if (grantMode === 'date' && !grantDate) { toast.error('만료 날짜를 선택해주세요.'); return }
    setGrantSaving(true)
    try {
      const itemId = Number(grantItemId)
      const items = grantType === 'course' ? allCourses : allEbooks
      const item = items.find((i) => i.id === itemId)
      const expiresAt = computeGrantExpiry()

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

  // 여러 회원에게 한 번에 부여 (이미 보유한 회원은 중복 부여하지 않고 건너뜀)
  const handleBulkGrant = async () => {
    if (bulkSelectedIds.size === 0) { toast.error('회원을 선택해주세요.'); return }
    if (!grantItemId) { toast.error('항목을 선택해주세요.'); return }
    if (grantMode === 'date' && !grantDate) { toast.error('만료 날짜를 선택해주세요.'); return }
    setGrantSaving(true)
    try {
      const itemId = Number(grantItemId)
      const items = grantType === 'course' ? allCourses : allEbooks
      const item = items.find((i) => i.id === itemId)
      const expiresAt = computeGrantExpiry()
      const idsArr = Array.from(bulkSelectedIds)

      // 이미 같은 강의/전자책을 보유한 회원 제외
      const { data: existing } = await supabase
        .from('purchases')
        .select('user_id')
        .eq(grantType === 'course' ? 'course_id' : 'ebook_id', itemId)
        .in('user_id', idsArr)
      const already = new Set(((existing ?? []) as { user_id: string }[]).map((r) => r.user_id))
      const targets = idsArr.filter((uid) => !already.has(uid))

      if (targets.length === 0) {
        toast('선택한 회원 모두 이미 보유 중입니다.')
        return
      }

      const rows = targets.map((uid) => ({
        user_id: uid,
        course_id: grantType === 'course' ? itemId : null,
        ebook_id: grantType === 'ebook' ? itemId : null,
        title: item?.title || '',
        price: 0,
        expires_at: expiresAt,
      }))
      const { error } = await supabase.from('purchases').insert(rows as never)
      if (error) throw error

      const skipped = idsArr.length - targets.length
      toast.success(`${targets.length}명에게 "${item?.title}" 수강권 부여 완료${skipped > 0 ? ` (${skipped}명 보유 중 제외)` : ''}`)
      setBulkGrantOpen(false)
      await fetchData()
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
      const isToss = refundTarget.payment_method === 'toss' && refundTarget.payment_key

      // 카드 결제인 경우 토스 결제 취소
      if (isToss) {
        const { data, error: cancelError } = await supabase.functions.invoke('cancel-payment', {
          body: { paymentKey: refundTarget.payment_key, cancelReason: `${refundTarget.title} 환불` },
        })
        if (cancelError || data?.error) {
          throw new Error(data?.error || cancelError?.message || '카드 결제 취소에 실패했습니다.')
        }
      }

      // 1. 구매 삭제
      const { error } = await supabase.from('purchases').delete().eq('id', refundTarget.id)
      if (error) throw error

      // 2. 포인트 환불 (포인트 결제인 경우만)
      if (!isToss && refundTarget.price > 0) {
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

      // 4. 수강/구매 적립 포인트 회수 (강의·전자책 공통)
      let rewardDeducted = 0
      if (refundTarget.course_id || refundTarget.ebook_id) {
        const table = refundTarget.course_id ? 'courses' : 'ebooks'
        const targetId = refundTarget.course_id ?? refundTarget.ebook_id!
        const { data: row } = await supabase
          .from(table).select('reward_points').eq('id', targetId).maybeSingle()
        const reward = (row as { reward_points?: number } | null)?.reward_points ?? 0
        if (reward > 0) {
          await supabase.rpc('add_points', { user_id_input: viewing.id, amount_input: -reward } as never)
          await supabase.rpc('insert_point_log', {
            p_user_id: viewing.id,
            p_amount: -reward,
            p_balance: viewing.points + (isToss ? 0 : refundTarget.price) - reward,
            p_type: 'deduct',
            p_memo: `${refundTarget.title} 수강 적립 회수`,
          } as never)
          rewardDeducted = reward
        }
      }

      const msgs = [`${refundTarget.title} 환불 완료`]
      if (isToss) {
        msgs.push('카드 결제 취소')
      } else if (refundTarget.price > 0) {
        msgs.push(`+${refundTarget.price.toLocaleString()}P`)
      }
      if (rewardDeducted > 0) msgs.push(`적립 회수 -${rewardDeducted.toLocaleString()}P`)
      if (refundRestoreCoupon && refundTarget.coupon_id) msgs.push('쿠폰 복구됨')
      toast.success(msgs.join(' · '))

      // 환불 웹훅
      webhookService.fireRefund({
        userId: viewing.id,
        user_email: viewing.email || '',
        user_name: viewing.name || '',
        user_phone: viewing.phone || '',
        title: refundTarget.title,
        price: refundTarget.price,
        type: refundTarget.course_id ? 'course' : 'ebook',
        productId: refundTarget.course_id ?? refundTarget.ebook_id ?? null,
        paymentId: refundTarget.id,
      }).catch(() => {})
      // 미발송 예약 알림톡 취소
      const productId = refundTarget.course_id ?? refundTarget.ebook_id
      if (productId) {
        webhookScheduleService.cancelForUserScope(viewing.id, refundTarget.course_id ? 'course' : 'ebook', productId).catch(() => {})
      }

      const pointsChange = (isToss ? 0 : refundTarget.price) - rewardDeducted
      setRefundTarget(null)
      setRefundRestoreCoupon(true)
      await handleViewMember({ ...viewing, points: viewing.points + pointsChange })
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '환불에 실패했습니다.')
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

  const generatePassword = () => {
    // 사람이 옮겨 적기 좋게 헷갈리는 문자(0/O, 1/l/I) 제외 12자.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let p = ''
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)]
    return p
  }

  const handleAddMember = async () => {
    if (addSaving) return
    const phoneDigits = addForm.phone.replace(/\D/g, '')
    const normalizedPhone = phoneDigits.length === 11
      ? `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 7)}-${phoneDigits.slice(7)}`
      : phoneDigits.length === 10
        ? `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`
        : addForm.phone.trim()
    try {
      setAddSaving(true)
      const { data, error } = await supabase.functions.invoke('admin-create-member', {
        body: {
          name: addForm.name.trim(),
          email: addForm.email.trim().toLowerCase(),
          phone: normalizedPhone || undefined,
          password: addForm.password,
        },
      })
      if (error) {
        let bodyMsg = ''
        const ctx = (error as { context?: unknown }).context
        if (ctx instanceof Response) {
          try {
            const parsed = await ctx.clone().json() as { error?: string }
            bodyMsg = parsed?.error || ''
          } catch { /* not JSON */ }
        }
        throw new Error(bodyMsg || error.message)
      }
      const payload = (data ?? {}) as { error?: string; email?: string }
      if (payload.error) throw new Error(payload.error)
      toast.success(`${addForm.name} 회원이 추가되었습니다.`)
      setAddOpen(false)
      setAddForm({ name: '', email: '', phone: '', password: '' })
      await fetchData()
    } catch (err) {
      toast.error(`회원 추가 실패: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAddSaving(false)
    }
  }

  const handleDeleteMember = async () => {
    if (!deleteTarget || deleting) return
    try {
      setDeleting(true)
      const { data, error } = await supabase.functions.invoke('delete-member', {
        body: { user_id: deleteTarget.id },
      })
      if (error) {
        // Edge Function 의 응답 본문에서 사유 추출 — supabase-js 가 가려두는 부분.
        let bodyMsg = ''
        const ctx = (error as { context?: unknown }).context
        if (ctx instanceof Response) {
          try {
            const parsed = await ctx.clone().json() as { error?: string }
            bodyMsg = parsed?.error || ''
          } catch { /* not JSON */ }
        }
        throw new Error(bodyMsg || error.message)
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
      toast.success(`${deleteTarget.name || '회원'}이(가) 탈퇴 처리되었습니다.`)
      setDeleteTarget(null)
      // 회원 상세 모달이 열려있던 상태라면 닫기
      setViewing((cur) => (cur?.id === deleteTarget.id ? null : cur))
      await fetchData()
    } catch (err) {
      toast.error(`탈퇴 처리 실패: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDeleting(false)
    }
  }

  const handleRoleChange = async () => {
    if (!roleTarget) return
    try {
      // update 가 RLS 로 막혀 0행을 반환해도 error 가 없으므로, select 로 결과를 직접 확인.
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: roleTarget.newRole } as never)
        .eq('id', roleTarget.id)
        .select('id, role')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('업데이트된 행이 없습니다. profiles RLS 정책이 admin update 를 허용하는지 확인해 주세요.')
      }
      toast.success(`${roleTarget.name || '회원'}의 권한이 ${roleTarget.newRole === 'admin' ? '관리자' : '일반회원'}으로 변경되었습니다.`)
      setRoleTarget(null)
      await fetchData()
    } catch (err) {
      toast.error(`권한 변경 실패: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const resolveProvider = (m: MemberWithPurchases): string => {
    const p = (m as unknown as Record<string, unknown>).provider as string | undefined
    if (p) return p
    if (m.email?.endsWith('@kakao.com')) return 'kakao'
    return 'email'
  }

  const filtered = members.filter((m) => {
    const matchesSearch = (m.name || '').includes(search)
      || (m.email || '').includes(search)
      || (m.phone || '').includes(search)
      || m.id.includes(search)
    if (!matchesSearch) return false
    if (memberTab === 'all') return true
    return resolveProvider(m) === memberTab
  })

  const tabCounts = {
    all: members.length,
    email: members.filter((m) => resolveProvider(m) === 'email').length,
    kakao: members.filter((m) => resolveProvider(m) === 'kakao').length,
    google: members.filter((m) => resolveProvider(m) === 'google').length,
    guest: members.filter((m) => resolveProvider(m) === 'guest').length,
  }

  // 검색어 또는 탭(가입방법) 필터가 적용된 상태인지
  const hasFilter = search.trim() !== '' || memberTab !== 'all'

  // 목록은 페이지 단위로만 표시 (엑셀 내보내기는 filtered 전체를 대상으로 함)
  const PER_PAGE = 20
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageClamped = Math.min(page, totalPages - 1)
  const paged = filtered.slice(pageClamped * PER_PAGE, (pageClamped + 1) * PER_PAGE)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0) }, [search, memberTab])

  const exportToExcel = (data: MemberWithPurchases[], filteredExport = false) => {
    const header = ['이름', '가입방법', '이메일', '전화번호', '성별', '생년월일', '주소', '권한', '포인트', '구매 수', '총 결제액', 'utm_source', 'utm_medium', 'utm_campaign', '가입일', '마지막 접속']
    const rows = data.map((m) => {
      const provider = (m as unknown as Record<string, unknown>).provider as string | undefined || (m.email?.endsWith('@kakao.com') ? 'kakao' : 'email')
      return [
        m.name || '',
        provider === 'kakao' ? '카카오' : provider === 'google' ? '구글' : provider === 'guest' ? '비회원' : '이메일',
        m.email || '',
        m.phone || '',
        m.gender === 'male' ? '남' : m.gender === 'female' ? '여' : '',
        m.birth_date || '',
        (m.address || '').replace(/\|/g, ' '),
        m.role === 'admin' ? '관리자' : '회원',
        m.points,
        m.purchaseCount,
        m.totalSpent,
        m.utm_source || '',
        m.utm_medium || '',
        m.utm_campaign || '',
        new Date(m.created_at).toLocaleDateString('ko-KR'),
        m.last_active_at ? new Date(m.last_active_at).toLocaleDateString('ko-KR') : '',
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
    a.download = `회원목록${filteredExport ? '_검색결과' : ''}_${toLocalDateStr(new Date())}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ko-KR')
  const formatGender = (g: string | null) => g === 'male' ? '남' : g === 'female' ? '여' : '-'
  // 이름이 6글자를 넘으면 …로 축약 (전체 이름은 title 툴팁으로 확인)
  const truncateName = (name: string | null) => {
    const n = name || '-'
    return n.length > 6 ? `${n.slice(0, 6)}…` : n
  }

  // 수강권 부여 모달: 검색어로 필터링한 강의/전자책 목록
  const grantItems = grantType === 'course' ? allCourses : allEbooks
  const grantFilteredItems = grantQuery.trim()
    ? grantItems.filter((i) => i.title.toLowerCase().includes(grantQuery.trim().toLowerCase()))
    : grantItems

  // 수강권 부여 모달: 현재 선택 기준으로 만료일 미리보기 문구
  const grantExpiry = (grantOpen || bulkGrantOpen) && grantItemId ? computeGrantExpiry() : null
  const grantExpiryPreview = !grantItemId
    ? ''
    : grantExpiry
      ? `만료일: ${formatDate(grantExpiry)}`
      : grantMode === 'deadline'
        ? '무제한 (강의에 마감일·수강 기간 미설정)'
        : grantMode === 'days'
          ? '무제한 (0일 또는 미입력)'
          : '날짜를 선택하세요'

  // 일괄 부여 모달: 검색어로 필터링한 회원 목록
  const bulkFilteredMembers = members.filter((m) => {
    const q = bulkMemberQuery.trim().toLowerCase()
    if (!q) return true
    return (m.name || '').toLowerCase().includes(q)
      || (m.email || '').toLowerCase().includes(q)
      || (m.phone || '').includes(bulkMemberQuery.trim())
  })

  // 강의/전자책 + 기간 선택 UI (1인·일괄 부여 모달 공통)
  const renderGrantFields = () => (
    <>
      <div className="flex gap-2">
        <button type="button" onClick={() => { setGrantType('course'); setGrantItemId(''); setGrantQuery(''); setGrantMode('deadline') }}
          className={`flex-1 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${grantType === 'course' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
          강의
        </button>
        <button type="button" onClick={() => { setGrantType('ebook'); setGrantItemId(''); setGrantQuery(''); setGrantMode('days') }}
          className={`flex-1 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${grantType === 'ebook' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
          전자책
        </button>
      </div>

      <Combobox
        value={grantItemId}
        onChange={(val: string | null) => {
          const next = val ?? ''
          setGrantItemId(next)
          const item = grantItems.find((i) => String(i.id) === next)
          if (item) setGrantDays(String(item.duration_days ?? 0))
        }}
        onClose={() => setGrantQuery('')}
      >
        <div className="relative">
          <ComboboxInput
            className="w-full border border-gray-200 rounded-lg pl-3 pr-9 py-2.5 text-sm outline-none focus:border-[#2ED573] bg-white"
            placeholder={grantType === 'course' ? '강의 검색 또는 선택' : '전자책 검색 또는 선택'}
            autoComplete="off"
            displayValue={(id: string) => grantItems.find((i) => String(i.id) === id)?.title ?? ''}
            onChange={(e) => setGrantQuery(e.target.value)}
          />
          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2.5 bg-transparent border-none cursor-pointer">
            <i className="ti ti-chevron-down text-gray-400 text-sm" />
          </ComboboxButton>
          <ComboboxOptions
            anchor="bottom start"
            className="z-[70] w-[var(--input-width)] max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg [--anchor-gap:4px]"
          >
            {grantFilteredItems.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">검색 결과가 없습니다.</div>
            ) : grantFilteredItems.map((item) => (
              <ComboboxOption
                key={item.id}
                value={String(item.id)}
                className="cursor-pointer px-3 py-2 text-sm text-gray-700 data-[focus]:bg-[#2ED573]/10 data-[selected]:font-bold data-[selected]:text-[#2ED573]"
              >
                {item.title}
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        </div>
      </Combobox>

      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1.5">
          {grantType === 'course' ? '수강 기간' : '열람 기간'}
        </label>
        <div className="flex gap-1 mb-2">
          {grantType === 'course' && (
            <button type="button" onClick={() => setGrantMode('deadline')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${grantMode === 'deadline' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
              강의 마감일 기준
            </button>
          )}
          <button type="button" onClick={() => setGrantMode('days')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${grantMode === 'days' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
            일(day)
          </button>
          <button type="button" onClick={() => setGrantMode('date')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${grantMode === 'date' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
            날짜 지정
          </button>
        </div>

        {grantMode === 'deadline' && (
          <input
            type="text"
            disabled
            value=""
            placeholder="강의 마감일 + 수강 기간으로 자동 설정"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-gray-100 text-gray-400"
          />
        )}
        {grantMode === 'days' && (
          <input
            type="number"
            min={0}
            value={grantDays}
            onChange={(e) => setGrantDays(e.target.value)}
            placeholder="0 = 무제한"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]"
          />
        )}
        {grantMode === 'date' && (
          <input
            type="date"
            value={grantDate}
            onChange={(e) => setGrantDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]"
          />
        )}

        {grantExpiryPreview && <p className="text-[11px] text-gray-400 mt-1.5">{grantExpiryPreview}</p>}
      </div>
    </>
  )

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
            onClick={() => exportToExcel(filtered, hasFilter)}
            disabled={filtered.length === 0}
            title={hasFilter
              ? `검색·필터 결과 ${filtered.length}명을 내보냅니다`
              : `전체 회원 ${filtered.length}명을 내보냅니다`}
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ti ti-file-spreadsheet text-sm" />
            엑셀 내보내기
            <span className="text-xs text-gray-400">
              {hasFilter ? `검색결과 ${filtered.length}` : `전체 ${filtered.length}`}
            </span>
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 전화번호 검색..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {(['all', 'email', 'kakao', 'google', 'guest'] as const).map((t) => {
              const label = { all: '전체', email: '이메일', kakao: '카카오', google: '구글', guest: '비회원' }[t]
              const active = memberTab === t
              return (
                <button
                  key={t}
                  onClick={() => setMemberTab(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border-none cursor-pointer transition-colors ${
                    active ? 'bg-[#2ED573] text-white' : 'bg-transparent text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label} <span className={`ml-1 text-[10px] ${active ? 'text-white/80' : 'text-gray-400'}`}>{tabCounts[t]}</span>
                </button>
              )
            })}
          </div>
          <button
            onClick={openBulkGrantModal}
            className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-gray-800 transition-colors flex items-center gap-1.5"
          >
            <i className="ti ti-ticket text-sm" /> 수강권 부여
          </button>
          <button
            onClick={() => {
              setAddForm({ name: '', email: '', phone: '', password: generatePassword() })
              setAddOpen(true)
            }}
            className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20 flex items-center gap-1.5"
          >
            <i className="ti ti-user-plus text-sm" /> 회원 추가
          </button>
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
                  <th className="px-4 py-3 text-center font-bold text-gray-600 whitespace-nowrap">이름</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden whitespace-nowrap">이메일</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden whitespace-nowrap">전화번호</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden whitespace-nowrap">성별</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden whitespace-nowrap">생년월일</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden whitespace-nowrap">주소</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 whitespace-nowrap">권한</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden whitespace-nowrap">포인트</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden whitespace-nowrap">구매</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden whitespace-nowrap">총 결제</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden whitespace-nowrap">UTM</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden whitespace-nowrap">가입일</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden whitespace-nowrap">마지막 접속</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={14} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}</td></tr>
                ) : paged.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewMember(m)}>
                    <td className="px-4 py-3 text-center font-medium whitespace-nowrap">
                      <span title={m.name || ''}>{truncateName(m.name)}</span>
                      {(() => {
                        const p = (m as unknown as Record<string, unknown>).provider as string | undefined
                        const provider = p || (m.email?.endsWith('@kakao.com') ? 'kakao' : 'email')
                        if (provider === 'kakao') return <span className="ml-1.5 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">카카오</span>
                        if (provider === 'google') return <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">구글</span>
                        if (provider === 'guest') return <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">비회원</span>
                        return <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">이메일</span>
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden text-xs">{m.email || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden whitespace-nowrap">{m.phone || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">{formatGender(m.gender)}</td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden text-xs whitespace-nowrap">{m.birth_date ? formatDate(m.birth_date) : '-'}</td>
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
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden text-xs">
                      {m.utm_campaign || m.utm_source ? (
                        <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded" title={[m.utm_source, m.utm_medium, m.utm_campaign].filter(Boolean).join(' / ')}>
                          {m.utm_campaign || m.utm_source}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden whitespace-nowrap">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden whitespace-nowrap">{m.last_active_at ? formatDate(m.last_active_at) : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setRoleTarget({
                              id: m.id,
                              name: m.name || '회원',
                              newRole: m.role === 'admin' ? 'user' : 'admin',
                            })
                          }}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border-none cursor-pointer transition-colors ${
                            m.role === 'admin'
                              ? 'text-purple-500 hover:text-purple-600 hover:bg-purple-50'
                              : 'text-gray-400 hover:text-purple-500 hover:bg-purple-50'
                          }`}
                          aria-label={m.role === 'admin' ? '관리자 권한 회수' : '관리자 권한 부여'}
                          title={m.role === 'admin' ? '관리자 (클릭 시 권한 회수)' : '관리자 권한 부여'}
                        >
                          {m.role === 'admin' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="w-4 h-4">
                              <path d="M11.46 1.137a2 2 0 0 1 1.08 0l8 2.317a2 2 0 0 1 1.46 1.926v6.323a9 9 0 0 1-4.99 8.057l-3.575 1.79a2 2 0 0 1-1.79 0l-3.578-1.79a9 9 0 0 1-4.987-8.057V5.38a2 2 0 0 1 1.46-1.926zm4.247 7.156a1 1 0 0 0-1.414 0l-3.293 3.293-1.293-1.293-.094-.083a1 1 0 0 0-1.32 1.497l2 2 .094.083a1 1 0 0 0 1.32-.083l4-4 .083-.094a1 1 0 0 0-.083-1.32z" />
                            </svg>
                          ) : (
                            <i className="ti ti-shield text-sm" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: m.id, name: m.name || '회원', email: m.email || '' })}
                          disabled={m.id === user?.id}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="회원 탈퇴"
                          title={m.id === user?.id ? '본인 계정은 여기서 탈퇴할 수 없습니다.' : '회원 탈퇴'}
                        >
                          <i className="ti ti-user-x text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 px-4 py-4 border-t border-gray-100">
              <button
                onClick={() => setPage(Math.max(0, pageClamped - 1))}
                disabled={pageClamped === 0}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-500 bg-white border border-gray-200 cursor-pointer hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, i) => i)
                .filter((i) => Math.abs(i - pageClamped) <= 2 || i === 0 || i === totalPages - 1)
                .map((i, idx, arr) => (
                  <span key={i} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== i - 1 && <span className="px-1 text-gray-300 text-sm">…</span>}
                    <button
                      onClick={() => setPage(i)}
                      className={`min-w-[32px] px-2 py-1.5 rounded-lg text-sm cursor-pointer border ${
                        i === pageClamped
                          ? 'bg-[#2ED573] text-white border-[#2ED573] font-bold'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  </span>
                ))}
              <button
                onClick={() => setPage(Math.min(totalPages - 1, pageClamped + 1))}
                disabled={pageClamped >= totalPages - 1}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-500 bg-white border border-gray-200 cursor-pointer hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}

      {/* 회원 상세 모달 */}
      <Dialog open={!!viewing} onClose={() => { setViewing(null); if (searchParams.get('user')) setSearchParams({}, { replace: true }) }} className="relative z-50">
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
                  <InfoItem label="마지막 접속" value={viewing.last_active_at ? formatDate(viewing.last_active_at) : '-'} />
                  <InfoItem label="총 구매" value={`${viewing.purchaseCount}건`} />
                  <InfoItem label="총 결제" value={`${viewing.totalSpent.toLocaleString()}원`} />
                </div>

                {/* UTM 유입 정보 & 가입 경로 */}
                {(viewing.utm_source || viewing.utm_medium || viewing.utm_campaign || viewing.utm_content || viewing.utm_term || viewing.signup_referrer) && (
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-gray-900 mb-2">유입 정보</h3>
                    <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {viewing.signup_referrer && <div><span className="text-gray-400 block">가입 경로</span><span className="text-gray-700 font-medium">{viewing.signup_referrer}</span></div>}
                      {viewing.utm_source && <div><span className="text-gray-400 block">source</span><span className="text-gray-700 font-medium">{viewing.utm_source}</span></div>}
                      {viewing.utm_medium && <div><span className="text-gray-400 block">medium</span><span className="text-gray-700 font-medium">{viewing.utm_medium}</span></div>}
                      {viewing.utm_campaign && <div><span className="text-gray-400 block">campaign</span><span className="text-gray-700 font-medium">{viewing.utm_campaign}</span></div>}
                      {viewing.utm_content && <div><span className="text-gray-400 block">content</span><span className="text-gray-700 font-medium">{viewing.utm_content}</span></div>}
                      {viewing.utm_term && <div><span className="text-gray-400 block">term</span><span className="text-gray-700 font-medium">{viewing.utm_term}</span></div>}
                    </div>
                  </div>
                )}

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

                  {pointLogs.length > 0 && (() => {
                    const perPage = 5
                    const totalPages = Math.ceil(pointLogs.length / perPage)
                    const paged = pointLogs.slice(pointLogPage * perPage, (pointLogPage + 1) * perPage)
                    return (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400 font-medium">포인트 내역 ({pointLogs.length}건)</p>
                        {totalPages > 1 && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setPointLogPage((p) => Math.max(0, p - 1))}
                              disabled={pointLogPage === 0}
                              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <i className="ti ti-chevron-left text-xs" />
                            </button>
                            <span className="text-[10px] text-gray-400">{pointLogPage + 1}/{totalPages}</span>
                            <button
                              onClick={() => setPointLogPage((p) => Math.min(totalPages - 1, p + 1))}
                              disabled={pointLogPage >= totalPages - 1}
                              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <i className="ti ti-chevron-right text-xs" />
                            </button>
                          </div>
                        )}
                      </div>
                      {paged.map((log) => (
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
                    )
                  })()}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-900">구매 내역 ({purchases.length}건)</h3>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const totalPages = Math.ceil(purchases.length / 5)
                        return totalPages > 1 ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setPurchasePage((p) => Math.max(0, p - 1))} disabled={purchasePage === 0} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><i className="ti ti-chevron-left text-xs" /></button>
                            <span className="text-[10px] text-gray-400">{purchasePage + 1}/{totalPages}</span>
                            <button onClick={() => setPurchasePage((p) => Math.min(totalPages - 1, p + 1))} disabled={purchasePage >= totalPages - 1} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><i className="ti ti-chevron-right text-xs" /></button>
                          </div>
                        ) : null
                      })()}
                      <button
                        onClick={openGrantModal}
                        className="px-3 py-1.5 bg-[#2ED573] text-white text-xs font-bold rounded-lg border-none cursor-pointer hover:bg-[#25B866] transition-colors flex items-center gap-1"
                      >
                        <i className="ti ti-plus text-xs" /> 수강권 부여
                      </button>
                    </div>
                  </div>
                  {purchases.length > 0 ? (
                    <div className="space-y-2">
                      {purchases.slice(purchasePage * 5, (purchasePage + 1) * 5).map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm text-gray-700 truncate">{p.title}</span>
                              {p.payment_method === 'toss' && (
                                <span className="text-[9px] px-1 py-0.5 bg-blue-50 text-blue-600 rounded shrink-0">카드</span>
                              )}
                              {p.payment_method === 'linkpay' && (
                                <span className="text-[9px] px-1 py-0.5 bg-emerald-50 text-emerald-600 rounded shrink-0">링크페이</span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400">
                              {(() => {
                                const unit = (p.payment_method === 'toss' || p.payment_method === 'linkpay') ? '원' : 'P'
                                if (p.original_price && p.original_price !== p.price) {
                                  return <><span className="line-through">{p.original_price.toLocaleString()}{unit}</span> → <span className="text-[#2ED573] font-bold">{p.price > 0 ? `${p.price.toLocaleString()}${unit}` : '무료'}</span> (쿠폰)</>
                                }
                                return p.price > 0 ? `${p.price.toLocaleString()}${unit}` : '무료'
                              })()}
                              {' · '}{formatDate(p.purchased_at)}
                              {p.expires_at && ` · ~${formatDate(p.expires_at)}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-3">
                            <button
                              onClick={() => setRefundTarget({ id: p.id, title: p.title, price: p.price, coupon_id: p.coupon_id, payment_method: p.payment_method, payment_key: p.payment_key, course_id: p.course_id, ebook_id: p.ebook_id })}
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
                {memberCoupons.length > 0 && (() => {
                  const perPage = 5
                  const totalPages = Math.ceil(memberCoupons.length / perPage)
                  const paged = memberCoupons.slice(couponPage * perPage, (couponPage + 1) * perPage)
                  return (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-gray-900">쿠폰 ({memberCoupons.length}건)</h3>
                      {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => setCouponPage((p) => Math.max(0, p - 1))} disabled={couponPage === 0} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><i className="ti ti-chevron-left text-xs" /></button>
                          <span className="text-[10px] text-gray-400">{couponPage + 1}/{totalPages}</span>
                          <button onClick={() => setCouponPage((p) => Math.min(totalPages - 1, p + 1))} disabled={couponPage >= totalPages - 1} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><i className="ti ti-chevron-right text-xs" /></button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {paged.map((c) => (
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
                  )
                })()}

                {/* 최근 수강 내역 */}
                {(() => {
                  const perPage = 5
                  const totalPages = Math.max(1, Math.ceil(progressRecords.length / perPage))
                  const paged = progressRecords.slice(progressPage * perPage, (progressPage + 1) * perPage)
                  return (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-gray-900">최근 수강 내역 ({progressRecords.length}건)</h3>
                        {totalPages > 1 && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setProgressPage((p) => Math.max(0, p - 1))} disabled={progressPage === 0} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><i className="ti ti-chevron-left text-xs" /></button>
                            <span className="text-[10px] text-gray-400">{progressPage + 1}/{totalPages}</span>
                            <button onClick={() => setProgressPage((p) => Math.min(totalPages - 1, p + 1))} disabled={progressPage >= totalPages - 1} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><i className="ti ti-chevron-right text-xs" /></button>
                          </div>
                        )}
                      </div>
                      {progressRecords.length > 0 ? (
                        <div className="space-y-2">
                          {paged.map((r) => (
                            <div key={r.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${r.is_completed ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                                  {r.is_completed ? '완료' : '진행중'}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-gray-700 truncate">{r.course?.title || '-'}</p>
                                  <p className="text-[10px] text-gray-400 truncate">
                                    {r.curriculum_item?.week ? `[${r.curriculum_item.week}주차] ` : ''}{r.curriculum_item?.label || '-'}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs text-gray-400 shrink-0 ml-3">{formatDate(r.last_watched_at)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-4">수강 내역이 없습니다.</p>
                      )}
                    </div>
                  )
                })()}

                {/* 작성한 후기 내역 */}
                {(() => {
                  const perPage = 3
                  const totalPages = Math.max(1, Math.ceil(memberReviews.length / perPage))
                  const paged = memberReviews.slice(reviewsPage * perPage, (reviewsPage + 1) * perPage)
                  return (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-gray-900">작성한 후기 ({memberReviews.length}건)</h3>
                        {totalPages > 1 && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setReviewsPage((p) => Math.max(0, p - 1))} disabled={reviewsPage === 0} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><i className="ti ti-chevron-left text-xs" /></button>
                            <span className="text-[10px] text-gray-400">{reviewsPage + 1}/{totalPages}</span>
                            <button onClick={() => setReviewsPage((p) => Math.min(totalPages - 1, p + 1))} disabled={reviewsPage >= totalPages - 1} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><i className="ti ti-chevron-right text-xs" /></button>
                          </div>
                        )}
                      </div>
                      {memberReviews.length > 0 ? (
                        <div className="space-y-2">
                          {paged.map((rv) => (
                            <div key={rv.id} className="py-2 px-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-yellow-400 text-xs shrink-0">{'★'.repeat(rv.rating)}{'☆'.repeat(5 - rv.rating)}</span>
                                  <span className="text-xs text-gray-500 truncate">{rv.course?.title || '-'}</span>
                                </div>
                                <span className="text-[10px] text-gray-400 shrink-0">{formatDate(rv.created_at)}</span>
                              </div>
                              <p className="text-sm font-medium text-gray-800 truncate">{rv.title}</p>
                              <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{rv.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-4">작성한 후기가 없습니다.</p>
                      )}
                    </div>
                  )
                })()}

                <button
                  onClick={() => { setViewing(null); if (searchParams.get('user')) setSearchParams({}, { replace: true }) }}
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
              {renderGrantFields()}

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

      {/* 수강권 일괄 부여 (여러 회원 선택) */}
      <Dialog open={bulkGrantOpen} onClose={() => setBulkGrantOpen(false)} className="relative z-[60]">
        <div className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <DialogTitle className="text-base font-bold text-gray-900 mb-1">수강권 일괄 부여</DialogTitle>
            <p className="text-xs text-gray-400 mb-4">선택한 회원들에게 강의/전자책 수강권을 한 번에 부여합니다.</p>

            <div className="space-y-3">
              {/* 회원 선택 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-600">회원 선택 ({bulkSelectedIds.size}명)</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkSelectedIds((prev) => {
                        const next = new Set(prev)
                        bulkFilteredMembers.forEach((m) => next.add(m.id))
                        return next
                      })}
                      className="text-[11px] text-[#2ED573] font-medium bg-transparent border-none cursor-pointer hover:underline"
                    >
                      검색결과 전체선택
                    </button>
                    {bulkSelectedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setBulkSelectedIds(new Set())}
                        className="text-[11px] text-gray-400 font-medium bg-transparent border-none cursor-pointer hover:underline"
                      >
                        선택 해제
                      </button>
                    )}
                  </div>
                </div>
                <input
                  value={bulkMemberQuery}
                  onChange={(e) => setBulkMemberQuery(e.target.value)}
                  placeholder="이름·이메일·전화번호 검색"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573] mb-2"
                />
                <div className="max-h-44 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {bulkFilteredMembers.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-gray-400 text-center">검색 결과가 없습니다.</div>
                  ) : bulkFilteredMembers.slice(0, 100).map((m) => {
                    const checked = bulkSelectedIds.has(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleBulkMember(m.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left border-none cursor-pointer transition-colors ${checked ? 'bg-[#2ED573]/5' : 'bg-transparent hover:bg-gray-50'}`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-[#2ED573] border-[#2ED573]' : 'border-gray-300'}`}>
                          {checked && <i className="ti ti-check text-white text-[10px]" />}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-sm text-gray-700">
                          {m.name || '이름없음'}
                          <span className="text-gray-400 text-xs ml-1.5">{m.email || m.phone || ''}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                {bulkFilteredMembers.length > 100 && (
                  <p className="text-[11px] text-gray-400 mt-1">상위 100명만 표시됩니다. 검색으로 좁혀주세요.</p>
                )}
              </div>

              {renderGrantFields()}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setBulkGrantOpen(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg border-none cursor-pointer hover:bg-gray-200">
                  취소
                </button>
                <button onClick={handleBulkGrant} disabled={grantSaving || !grantItemId || bulkSelectedIds.size === 0}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-[#2ED573] rounded-lg border-none cursor-pointer hover:bg-[#25B866] disabled:opacity-50">
                  {grantSaving ? '처리 중...' : `${bulkSelectedIds.size || ''}${bulkSelectedIds.size ? '명에게 ' : ''}부여하기`}
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
                  {refundTarget.payment_method === 'toss'
                    ? `${refundTarget.price.toLocaleString()}원 카드 결제가 취소됩니다.`
                    : refundTarget.price > 0 ? `${refundTarget.price.toLocaleString()}P가 환불됩니다.` : '무료 항목입니다.'}
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
        confirmText="변경"
        confirmColor="green"
        icon="ti-shield"
      />

      {/* 회원 추가 모달 */}
      <Dialog open={addOpen} onClose={() => { if (!addSaving) setAddOpen(false) }} className="relative z-50">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#2ED573]/10">
                <i className="ti ti-user-plus text-xl text-[#2ED573]" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">회원 추가</DialogTitle>
                <p className="text-xs text-gray-500 mt-0.5">이메일 인증 없이 즉시 가입 처리됩니다.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">이름 *</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]"
                  placeholder="홍길동"
                  disabled={addSaving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">이메일 *</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]"
                  placeholder="user@example.com"
                  autoComplete="off"
                  disabled={addSaving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]"
                  placeholder="010-0000-0000"
                  disabled={addSaving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">비밀번호 * <span className="text-gray-400 font-normal">(6자 이상)</span></label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573] font-mono"
                    autoComplete="off"
                    disabled={addSaving}
                  />
                  <button
                    type="button"
                    onClick={() => setAddForm({ ...addForm, password: generatePassword() })}
                    disabled={addSaving}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium border-none cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    title="새 비밀번호 자동 생성"
                  >
                    <i className="ti ti-refresh text-sm" /> 재생성
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(addForm.password).then(
                        () => toast.success('비밀번호가 복사되었습니다.'),
                        () => toast.error('복사에 실패했습니다.'),
                      )
                    }}
                    disabled={addSaving || !addForm.password}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium border-none cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    title="클립보드에 복사"
                  >
                    <i className="ti ti-copy text-sm" /> 복사
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                disabled={addSaving}
                className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl cursor-pointer border-none hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddMember}
                disabled={addSaving || !addForm.name.trim() || !addForm.email.trim() || addForm.password.length < 6}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#2ED573] hover:bg-[#25B866] rounded-xl cursor-pointer border-none disabled:opacity-50 transition-colors"
              >
                {addSaving ? '추가 중...' : '회원 추가'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* 회원 탈퇴 확인 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        onConfirm={handleDeleteMember}
        title="회원 탈퇴"
        message={deleteTarget
          ? `${deleteTarget.name}${deleteTarget.email ? ` (${deleteTarget.email})` : ''} 회원을 탈퇴 처리하시겠습니까? 계정과 함께 프로필·구매 내역·포인트·후기 등 연관 데이터가 영구 삭제되며 되돌릴 수 없습니다.`
          : ''}
        confirmText="탈퇴 처리"
        confirmColor="red"
        icon="ti-user-x"
        loading={deleting}
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
