import { useEffect, useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { toLocalDateStr, toLocalMonthStr } from '../../lib/dateUtils'
import AdminLayout from '../../components/admin/AdminLayout'

const COLORS = ['#2ED573', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']

type Period = '7d' | '30d' | '90d' | 'all' | 'custom'

interface PurchaseRow {
  id: number
  user_id: string | null
  course_id: number | null
  ebook_id: number | null
  title: string
  price: number
  purchased_at: string
}

interface CourseRow {
  id: number
  title: string
  instructor_id: number | null
  course_type: 'free' | 'premium'
}

interface ProfileRow {
  id: string
  name: string | null
  email: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
}

interface EbookRow {
  id: number
  title: string
  instructor_id: number | null
}

interface InstructorRow {
  id: number
  name: string
}

interface PointLogRow {
  amount: number
  type: 'charge' | 'deduct' | 'use' | 'refund'
  created_at: string
}

const formatKRW = (v: number) => `${v.toLocaleString()}원`

export default function AdminRevenueAnalytics() {
  const [period, setPeriod] = useState<Period>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showCumulative, setShowCumulative] = useState(true)
  const [loading, setLoading] = useState(true)
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [ebooks, setEbooks] = useState<EbookRow[]>([])
  const [instructors, setInstructors] = useState<InstructorRow[]>([])
  const [pointLogs, setPointLogs] = useState<PointLogRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [purchaseRes, courseRes, ebookRes, instructorRes, pointRes, profileRes] = await withTimeout(Promise.all([
          supabase.from('purchases').select('id, user_id, course_id, ebook_id, title, price, purchased_at'),
          supabase.from('courses').select('id, title, instructor_id, course_type'),
          supabase.from('ebooks').select('id, title, instructor_id'),
          supabase.from('instructors').select('id, name'),
          supabase.from('point_logs').select('amount, type, created_at'),
          supabase.from('profiles').select('id, name, email, utm_source, utm_medium, utm_campaign'),
        ]), 15000)
        setPurchases((purchaseRes.data ?? []) as PurchaseRow[])
        setCourses((courseRes.data ?? []) as CourseRow[])
        setEbooks((ebookRes.data ?? []) as EbookRow[])
        setInstructors((instructorRes.data ?? []) as InstructorRow[])
        setPointLogs((pointRes.data ?? []) as PointLogRow[])
        setProfiles((profileRes.data ?? []) as ProfileRow[])
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const now = useMemo(() => new Date(), [])
  const periodStart = useMemo(() => {
    if (period === 'custom' && customFrom) return new Date(customFrom)
    if (period === '7d') return new Date(now.getTime() - 7 * 86400000)
    if (period === '30d') return new Date(now.getTime() - 30 * 86400000)
    if (period === '90d') return new Date(now.getTime() - 90 * 86400000)
    return new Date(0)
  }, [period, customFrom, now])
  const periodEnd = useMemo(
    () => (period === 'custom' && customTo ? new Date(customTo + 'T23:59:59') : now),
    [period, customTo, now],
  )

  const filteredPurchases = useMemo(
    () => purchases.filter((p) => {
      const d = new Date(p.purchased_at)
      return d >= periodStart && d <= periodEnd
    }),
    [purchases, periodStart, periodEnd],
  )

  // 직전 동일 기간 (전기 대비)
  const prevStart = useMemo(() => {
    const diff = periodEnd.getTime() - periodStart.getTime()
    return new Date(periodStart.getTime() - diff)
  }, [periodEnd, periodStart])
  const prevPurchases = useMemo(
    () => purchases.filter((p) => {
      const d = new Date(p.purchased_at)
      return d >= prevStart && d < periodStart
    }),
    [purchases, prevStart, periodStart],
  )

  // 핵심 지표
  const totalRevenue = filteredPurchases.reduce((s, p) => s + p.price, 0)
  const prevRevenue = prevPurchases.reduce((s, p) => s + p.price, 0)
  const growthPct = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : null
  const transactionCount = filteredPurchases.length
  const payingUsers = new Set(filteredPurchases.map((p) => p.user_id).filter(Boolean)).size
  const arppu = payingUsers > 0 ? Math.round(totalRevenue / payingUsers) : 0
  const avgOrderValue = transactionCount > 0 ? Math.round(totalRevenue / transactionCount) : 0

  // 포인트: 환불/사용 (point_logs에서 기간 내)
  const filteredPointLogs = pointLogs.filter((p) => {
    const d = new Date(p.created_at)
    return d >= periodStart && d <= periodEnd
  })
  const refundTotal = filteredPointLogs
    .filter((p) => p.type === 'refund')
    .reduce((s, p) => s + Math.abs(p.amount), 0)
  const pointUsedTotal = filteredPointLogs
    .filter((p) => p.type === 'use')
    .reduce((s, p) => s + Math.abs(p.amount), 0)

  // 일별 매출 추이
  const days = useMemo(() => {
    if (period === 'custom' && customFrom) {
      return Math.min(180, Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000)))
    }
    if (period === '7d') return 7
    if (period === '90d') return 90
    if (period === 'all') return 30
    return 30
  }, [period, customFrom, periodStart, periodEnd])

  const revenueByDay = useMemo(() => {
    const result: { date: string; revenue: number; count: number; cumulative: number }[] = []
    const bucketMap = new Map<string, { revenue: number; count: number }>()
    for (const p of purchases) {
      const key = toLocalDateStr(new Date(p.purchased_at))
      const entry = bucketMap.get(key) ?? { revenue: 0, count: 0 }
      entry.revenue += p.price
      entry.count += 1
      bucketMap.set(key, entry)
    }
    let cumulative = 0
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const dateStr = toLocalDateStr(d)
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      const entry = bucketMap.get(dateStr) ?? { revenue: 0, count: 0 }
      cumulative += entry.revenue
      result.push({ date: label, revenue: entry.revenue, count: entry.count, cumulative })
    }
    return result
  }, [days, purchases, now])

  // 월별 매출 추이 (최근 12개월)
  const revenueByMonth = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      map.set(toLocalMonthStr(d), { revenue: 0, count: 0 })
    }
    for (const p of purchases) {
      const key = toLocalMonthStr(new Date(p.purchased_at))
      const existing = map.get(key)
      if (existing) {
        existing.revenue += p.price
        existing.count += 1
      }
    }
    return Array.from(map.entries()).map(([key, val]) => ({
      month: key.slice(5),
      revenue: val.revenue,
      count: val.count,
    }))
  }, [purchases, now])

  // 상품 유형 분포 (강의 vs 전자책)
  const typeDist = useMemo(() => {
    let course = 0
    let ebook = 0
    for (const p of filteredPurchases) {
      if (p.course_id) course += p.price
      else if (p.ebook_id) ebook += p.price
    }
    return [
      { name: '강의', value: course },
      { name: '전자책', value: ebook },
    ].filter((d) => d.value > 0)
  }, [filteredPurchases])

  // 강의별 매출 TOP 10
  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])
  const courseRevenueTop = useMemo(() => {
    const map = new Map<number, { title: string; revenue: number; count: number }>()
    for (const p of filteredPurchases) {
      if (!p.course_id) continue
      const course = courseMap.get(p.course_id)
      const title = course?.title ?? p.title
      const existing = map.get(p.course_id) ?? { title, revenue: 0, count: 0 }
      existing.revenue += p.price
      existing.count += 1
      map.set(p.course_id, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [filteredPurchases, courseMap])

  // 전자책별 매출 TOP 10
  const ebookMap = useMemo(() => new Map(ebooks.map((e) => [e.id, e])), [ebooks])
  const ebookRevenueTop = useMemo(() => {
    const map = new Map<number, { title: string; revenue: number; count: number }>()
    for (const p of filteredPurchases) {
      if (!p.ebook_id) continue
      const ebook = ebookMap.get(p.ebook_id)
      const title = ebook?.title ?? p.title
      const existing = map.get(p.ebook_id) ?? { title, revenue: 0, count: 0 }
      existing.revenue += p.price
      existing.count += 1
      map.set(p.ebook_id, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [filteredPurchases, ebookMap])

  // 강사별 매출 TOP 10
  const instructorMap = useMemo(() => new Map(instructors.map((i) => [i.id, i])), [instructors])
  const instructorRevenueTop = useMemo(() => {
    const map = new Map<number, { name: string; revenue: number; count: number }>()
    for (const p of filteredPurchases) {
      let instructorId: number | null = null
      if (p.course_id) instructorId = courseMap.get(p.course_id)?.instructor_id ?? null
      else if (p.ebook_id) instructorId = ebookMap.get(p.ebook_id)?.instructor_id ?? null
      if (instructorId == null) continue
      const name = instructorMap.get(instructorId)?.name ?? `강사 #${instructorId}`
      const existing = map.get(instructorId) ?? { name, revenue: 0, count: 0 }
      existing.revenue += p.price
      existing.count += 1
      map.set(instructorId, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [filteredPurchases, courseMap, ebookMap, instructorMap])

  // 시간대별 매출
  const hourDist = useMemo(() => {
    const arr = new Array(24).fill(0).map((_, h) => ({ hour: `${h}시`, revenue: 0 }))
    for (const p of filteredPurchases) {
      const h = new Date(p.purchased_at).getHours()
      arr[h].revenue += p.price
    }
    return arr
  }, [filteredPurchases])

  // 요일별 매출
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const weekdayDist = useMemo(() => {
    const arr = new Array(7).fill(0)
    for (const p of filteredPurchases) {
      arr[new Date(p.purchased_at).getDay()] += p.price
    }
    return dayNames.map((name, i) => ({ name, revenue: arr[i] }))
  }, [filteredPurchases])

  // 가격대 분포
  const priceRanges = [
    { name: '0원', min: 0, max: 0 },
    { name: '1~1만', min: 1, max: 10000 },
    { name: '1~5만', min: 10001, max: 50000 },
    { name: '5~10만', min: 50001, max: 100000 },
    { name: '10~50만', min: 100001, max: 500000 },
    { name: '50~100만', min: 500001, max: 1000000 },
    { name: '100만+', min: 1000001, max: Infinity },
  ]
  const priceDist = priceRanges
    .map((r) => ({
      name: r.name,
      value: filteredPurchases.filter((p) => p.price >= r.min && p.price <= r.max).length,
    }))
    .filter((d) => d.value > 0)

  // 신규 vs 재구매 매출 비중 (유저별 결제 순서 판별)
  const { newVsRepeat, newBuyers, repeatBuyersInPeriod } = useMemo(() => {
    const firstPurchaseByUser = new Map<string, string>()
    for (const p of purchases) {
      if (!p.user_id) continue
      const prev = firstPurchaseByUser.get(p.user_id)
      if (!prev || p.purchased_at < prev) firstPurchaseByUser.set(p.user_id, p.purchased_at)
    }
    let newRev = 0
    let repeatRev = 0
    const newUsers = new Set<string>()
    const repeatUsers = new Set<string>()
    for (const p of filteredPurchases) {
      if (!p.user_id) continue
      const first = firstPurchaseByUser.get(p.user_id)
      if (first && first === p.purchased_at) {
        newRev += p.price
        newUsers.add(p.user_id)
      } else {
        repeatRev += p.price
        repeatUsers.add(p.user_id)
      }
    }
    return {
      newVsRepeat: [
        { name: '신규 구매', value: newRev },
        { name: '재구매', value: repeatRev },
      ].filter((d) => d.value > 0),
      newBuyers: newUsers.size,
      repeatBuyersInPeriod: repeatUsers.size,
    }
  }, [purchases, filteredPurchases])

  // VIP 고객 TOP 10 (기간 내 누적 결제액)
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])
  const vipTop = useMemo(() => {
    const map = new Map<string, { name: string; email: string; revenue: number; count: number }>()
    for (const p of filteredPurchases) {
      if (!p.user_id) continue
      const profile = profileMap.get(p.user_id)
      const name = profile?.name ?? '이름 없음'
      const email = profile?.email ?? ''
      const existing = map.get(p.user_id) ?? { name, email, revenue: 0, count: 0 }
      existing.revenue += p.price
      existing.count += 1
      map.set(p.user_id, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [filteredPurchases, profileMap])

  // UTM 소스/캠페인별 매출
  const { utmSourceRev, utmCampaignRev } = useMemo(() => {
    const sourceMap = new Map<string, { revenue: number; count: number }>()
    const campaignMap = new Map<string, { revenue: number; count: number }>()
    for (const p of filteredPurchases) {
      if (!p.user_id) continue
      const profile = profileMap.get(p.user_id)
      if (!profile) continue
      const source = profile.utm_source?.trim() || '직접 유입'
      const srcEntry = sourceMap.get(source) ?? { revenue: 0, count: 0 }
      srcEntry.revenue += p.price
      srcEntry.count += 1
      sourceMap.set(source, srcEntry)
      if (profile.utm_campaign) {
        const campEntry = campaignMap.get(profile.utm_campaign) ?? { revenue: 0, count: 0 }
        campEntry.revenue += p.price
        campEntry.count += 1
        campaignMap.set(profile.utm_campaign, campEntry)
      }
    }
    return {
      utmSourceRev: Array.from(sourceMap.entries())
        .map(([name, val]) => ({ name, revenue: val.revenue, count: val.count }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8),
      utmCampaignRev: Array.from(campaignMap.entries())
        .map(([name, val]) => ({ name, revenue: val.revenue, count: val.count }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8),
    }
  }, [filteredPurchases, profileMap])

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-gray-200 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm font-bold text-gray-900 mb-1">매출 데이터를 분석하고 있습니다</p>
          <p className="text-xs text-gray-400">결제 및 상품별 통계를 계산하는 중입니다...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">매출 통계</h1>
          <p className="text-sm text-gray-500 mt-1">기간·상품·강사별 매출 분석</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-white rounded-lg shadow-sm p-1">
            {([['7d', '7일'], ['30d', '30일'], ['90d', '90일'], ['all', '전체']] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setPeriod(v)}
                className={`px-3 py-1.5 rounded text-xs font-medium border-none cursor-pointer transition-colors ${
                  period === v ? 'bg-gray-900 text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 bg-white rounded-lg shadow-sm p-1">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value); if (e.target.value) setPeriod('custom') }}
              className="px-2 py-1 text-xs border-none outline-none bg-transparent"
            />
            <span className="text-xs text-gray-400">~</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); if (e.target.value) setPeriod('custom') }}
              className="px-2 py-1 text-xs border-none outline-none bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <RevenueStatCard
          label="기간 내 총 매출"
          value={formatKRW(totalRevenue)}
          sub={growthPct == null ? '전기 데이터 부족' : `전기 대비 ${growthPct > 0 ? '+' : ''}${growthPct}%`}
          subColor={growthPct == null ? '#9ca3af' : growthPct >= 0 ? '#2ED573' : '#ef4444'}
          color="#2ED573"
        />
        <RevenueStatCard
          label="결제 건수"
          value={`${transactionCount.toLocaleString()}건`}
          sub={`결제자 ${payingUsers.toLocaleString()}명`}
          color="#6366f1"
        />
        <RevenueStatCard
          label="결제 유저당 매출 (ARPPU)"
          value={formatKRW(arppu)}
          sub={`건당 평균 ${formatKRW(avgOrderValue)}`}
          color="#3b82f6"
        />
        <RevenueStatCard
          label="포인트 사용 / 환불"
          value={`${formatKRW(pointUsedTotal)}`}
          sub={`환불 ${formatKRW(refundTotal)}`}
          color="#f59e0b"
        />
      </div>

      {/* 일별 + 월별 매출 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-900">일별 매출 추이</h3>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCumulative}
                  onChange={(e) => setShowCumulative(e.target.checked)}
                  className="accent-[#ef4444] cursor-pointer"
                />
                누적 매출 표시
              </label>
              <span className="text-[11px] text-gray-400">최근 {days}일</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            {showCumulative ? (
              <ComposedChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={period === '90d' ? 6 : period === '7d' ? 0 : 2} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round((v as number) / 10000)}만`} />
                <Tooltip formatter={(v: unknown) => formatKRW(Number(v))} />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="일 매출" stroke="#2ED573" fill="#2ED573" fillOpacity={0.18} strokeWidth={2} />
                <Line type="monotone" dataKey="cumulative" name="누적 매출" stroke="#ef4444" strokeWidth={2} dot={false} />
              </ComposedChart>
            ) : (
              <AreaChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={period === '90d' ? 6 : period === '7d' ? 0 : 2} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round((v as number) / 10000)}만`} />
                <Tooltip formatter={(v: unknown) => formatKRW(Number(v))} />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="일 매출" stroke="#2ED573" fill="#2ED573" fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">월별 매출 (최근 12개월)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenueByMonth} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round((v as number) / 10000)}만`} />
              <Tooltip formatter={(v: unknown) => formatKRW(Number(v))} />
              <Bar dataKey="revenue" name="매출" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 신규vs재구매 + 상품 유형 + 가격대 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">신규 vs 재구매 매출</h3>
            <span className="text-[11px] text-gray-400">신규 {newBuyers} · 재구매 {repeatBuyersInPeriod}</span>
          </div>
          {newVsRepeat.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={newVsRepeat} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {newVsRepeat.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => formatKRW(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-3 mt-1 flex-wrap">
                {newVsRepeat.map((d, i) => (
                  <span key={d.name} className="text-[11px] text-gray-500 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                    {d.name} {formatKRW(d.value)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">데이터 없음</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">상품 유형별 매출 비중</h3>
          {typeDist.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={typeDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {typeDist.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => formatKRW(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-3 mt-1 flex-wrap">
                {typeDist.map((d, i) => (
                  <span key={d.name} className="text-[11px] text-gray-500 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: COLORS[(i + 2) % COLORS.length] }} />
                    {d.name} {formatKRW(d.value)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">데이터 없음</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">가격대별 결제 건수</h3>
          {priceDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={priceDist} barSize={20}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: unknown) => `${String(v)}건`} />
                <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">데이터 없음</p>
          )}
        </div>
      </div>

      {/* VIP 고객 + UTM 소스/캠페인별 매출 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">VIP 고객 TOP 10</h3>
          {vipTop.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">해당 기간 결제자 없음</p>
          ) : (
            <RankList
              items={vipTop.map((v) => ({
                label: v.name + (v.email ? ` · ${v.email}` : ''),
                value: v.revenue,
                sub: `${v.count}건`,
              }))}
            />
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">UTM 소스별 매출 TOP 8</h3>
          {utmSourceRev.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">UTM 데이터 없음</p>
          ) : (
            <RankList
              items={utmSourceRev.map((u) => ({ label: u.name, value: u.revenue, sub: `${u.count}건` }))}
            />
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">UTM 캠페인별 매출 TOP 8</h3>
          {utmCampaignRev.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">UTM 캠페인 데이터 없음</p>
          ) : (
            <RankList
              items={utmCampaignRev.map((u) => ({ label: u.name, value: u.revenue, sub: `${u.count}건` }))}
            />
          )}
        </div>
      </div>

      {/* 강의 / 전자책 / 강사 매출 TOP 10 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">강의 매출 TOP 10</h3>
          {courseRevenueTop.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">해당 기간 강의 매출 없음</p>
          ) : (
            <RankList items={courseRevenueTop.map((c) => ({ label: c.title, value: c.revenue, sub: `${c.count}건` }))} />
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">전자책 매출 TOP 10</h3>
          {ebookRevenueTop.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">해당 기간 전자책 매출 없음</p>
          ) : (
            <RankList items={ebookRevenueTop.map((e) => ({ label: e.title, value: e.revenue, sub: `${e.count}건` }))} />
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">강사 매출 TOP 10</h3>
          {instructorRevenueTop.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">해당 기간 강사 매출 없음</p>
          ) : (
            <RankList items={instructorRevenueTop.map((i) => ({ label: i.name, value: i.revenue, sub: `${i.count}건` }))} />
          )}
        </div>
      </div>

      {/* 시간대 + 요일 */}
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">시간대별 매출</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourDist} barSize={10}>
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={1} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round((v as number) / 10000)}만`} />
              <Tooltip formatter={(v: unknown) => formatKRW(Number(v))} />
              <Bar dataKey="revenue" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">요일별 매출</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekdayDist} barSize={30}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round((v as number) / 10000)}만`} />
              <Tooltip formatter={(v: unknown) => formatKRW(Number(v))} />
              <Bar dataKey="revenue" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AdminLayout>
  )
}

function RevenueStatCard({ label, value, sub, color, subColor }: { label: string; value: string; sub: string; color: string; subColor?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[11px] mt-1" style={{ color: subColor ?? '#9ca3af' }}>{sub}</p>
    </div>
  )
}

function RankList({ items }: { items: { label: string; value: number; sub?: string }[] }) {
  const max = items[0]?.value || 1
  return (
    <div className="space-y-2">
      {items.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-400 w-6 text-right">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs font-medium text-gray-900 truncate">{d.label}</span>
              <span className="text-xs text-gray-500 shrink-0">
                {formatKRW(d.value)}{d.sub ? ` · ${d.sub}` : ''}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(4, (d.value / max) * 100)}%`,
                  background: COLORS[i % COLORS.length],
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
