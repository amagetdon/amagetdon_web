import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { withTimeout } from '../../lib/fetchWithTimeout'
import AdminLayout from '../../components/admin/AdminLayout'

const UMAMI_SHARE_URL = 'https://umami-ama.vercel.app/share/LuxmmqXDx2i6kFBo'
const UMAMI_DASHBOARD_URL = 'https://umami-ama.vercel.app/websites'

const COLORS = ['#2ED573', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']

interface DashboardData {
  // 핵심 지표
  totalUsers: number
  newUsersToday: number
  newUsersWeek: number
  newUsersMonth: number
  // 매출
  totalRevenue: number
  todayRevenue: number
  weekRevenue: number
  monthRevenue: number
  totalPurchases: number
  // 콘텐츠
  totalCourses: number
  freeCourses: number
  premiumCourses: number
  totalEbooks: number
  totalInstructors: number
  totalReviews: number
  totalResults: number
  totalFaqs: number
  totalSchedules: number
  // 차트 데이터
  signupTrend: { date: string; count: number }[]
  revenueTrend: { date: string; revenue: number }[]
  purchaseByType: { name: string; value: number }[]
  // 최근 활동
  recentMembers: { name: string | null; created_at: string; phone: string | null }[]
  recentPurchases: { title: string; price: number; purchased_at: string }[]
  recentReviews: { author_name: string; title: string; rating: number; created_at: string }[]
  // 인기 콘텐츠
  topCourses: { title: string; count: number }[]
  topEbooks: { title: string; count: number }[]
  // 평점
  avgRating: number
  ratingDist: { stars: number; count: number }[]
  // 회원 통계
  genderDist: { name: string; value: number }[]
  ageDist: { name: string; value: number }[]
  regionDist: { name: string; value: number }[]
  providerDist: { name: string; value: number }[]
  signupMonthly: { month: string; count: number }[]
}

const defaultData: DashboardData = {
  totalUsers: 0, newUsersToday: 0, newUsersWeek: 0, newUsersMonth: 0,
  totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, totalPurchases: 0,
  totalCourses: 0, freeCourses: 0, premiumCourses: 0,
  totalEbooks: 0, totalInstructors: 0, totalReviews: 0, totalResults: 0, totalFaqs: 0, totalSchedules: 0,
  signupTrend: [], revenueTrend: [], purchaseByType: [],
  recentMembers: [], recentPurchases: [], recentReviews: [],
  topCourses: [], topEbooks: [],
  avgRating: 0, ratingDist: [],
  genderDist: [], ageDist: [], regionDist: [], providerDist: [], signupMonthly: [],
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData>(defaultData)
  const [loading, setLoading] = useState(true)
  const [umamiOpen, setUmamiOpen] = useState(() => localStorage.getItem('admin_umami_open') === '1')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    try {
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const days30Ago = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).toISOString()

      const [
        { count: totalUsers },
        { count: newUsersToday },
        { count: newUsersWeek },
        { count: newUsersMonth },
        { count: totalCourses },
        { count: freeCourses },
        { count: premiumCourses },
        { count: totalEbooks },
        { count: totalInstructors },
        { count: totalReviews },
        { count: totalResults },
        { count: totalFaqs },
        { count: totalSchedules },
        { count: totalPurchases },
        { data: allPurchases },
        { data: todayPurchases },
        { data: weekPurchases },
        { data: monthPurchases },
        { data: recentMembers },
        { data: recentPurchases },
        { data: recentReviews },
        { data: signupRaw },
        { data: revenueRaw },
        { data: purchaseItems },
        { data: reviewRatings },
        { data: allProfiles },
      ] = await withTimeout(Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfWeek),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }).eq('course_type', 'free'),
        supabase.from('courses').select('*', { count: 'exact', head: true }).eq('course_type', 'premium'),
        supabase.from('ebooks').select('*', { count: 'exact', head: true }),
        supabase.from('instructors').select('*', { count: 'exact', head: true }),
        supabase.from('reviews').select('*', { count: 'exact', head: true }),
        supabase.from('results').select('*', { count: 'exact', head: true }),
        supabase.from('faqs').select('*', { count: 'exact', head: true }),
        supabase.from('schedules').select('*', { count: 'exact', head: true }),
        supabase.from('purchases').select('*', { count: 'exact', head: true }),
        supabase.from('purchases').select('price'),
        supabase.from('purchases').select('price').gte('purchased_at', startOfToday),
        supabase.from('purchases').select('price').gte('purchased_at', startOfWeek),
        supabase.from('purchases').select('price').gte('purchased_at', startOfMonth),
        supabase.from('profiles').select('name, created_at, phone').order('created_at', { ascending: false }).limit(8),
        supabase.from('purchases').select('title, price, purchased_at').order('purchased_at', { ascending: false }).limit(8),
        supabase.from('reviews').select('author_name, title, rating, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('profiles').select('created_at').gte('created_at', days30Ago),
        supabase.from('purchases').select('purchased_at, price').gte('purchased_at', days30Ago),
        supabase.from('purchases').select('title, course_id, ebook_id'),
        supabase.from('reviews').select('rating'),
        supabase.from('profiles').select('gender, birth_date, address, provider, created_at'),
      ]), 15000)

      const sum = (arr: { price: number }[] | null) => arr?.reduce((s, p) => s + p.price, 0) || 0

      // 가입 트렌드 (30일)
      const signupMap = new Map<string, number>()
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
        signupMap.set(d.toISOString().slice(0, 10), 0)
      }
      for (const r of (signupRaw as { created_at: string }[] || [])) {
        const key = r.created_at.slice(0, 10)
        signupMap.set(key, (signupMap.get(key) || 0) + 1)
      }
      const signupTrend = Array.from(signupMap.entries()).map(([date, count]) => ({
        date: `${new Date(date).getMonth() + 1}/${new Date(date).getDate()}`,
        count,
      }))

      // 매출 트렌드 (30일)
      const revenueMap = new Map<string, number>()
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
        revenueMap.set(d.toISOString().slice(0, 10), 0)
      }
      for (const r of (revenueRaw as { purchased_at: string; price: number }[] || [])) {
        const key = r.purchased_at.slice(0, 10)
        revenueMap.set(key, (revenueMap.get(key) || 0) + r.price)
      }
      const revenueTrend = Array.from(revenueMap.entries()).map(([date, revenue]) => ({
        date: `${new Date(date).getMonth() + 1}/${new Date(date).getDate()}`,
        revenue,
      }))

      // 구매 유형 비율
      const items = (purchaseItems as { title: string; course_id: number | null; ebook_id: number | null }[] || [])
      const courseCount = items.filter((p) => p.course_id).length
      const ebookCount = items.filter((p) => p.ebook_id).length
      const purchaseByType = [
        { name: '강의', value: courseCount },
        { name: '전자책', value: ebookCount },
      ].filter((v) => v.value > 0)

      // 인기 콘텐츠
      const courseMap = new Map<string, number>()
      const ebookMap = new Map<string, number>()
      for (const p of items) {
        if (p.course_id) courseMap.set(p.title, (courseMap.get(p.title) || 0) + 1)
        if (p.ebook_id) ebookMap.set(p.title, (ebookMap.get(p.title) || 0) + 1)
      }
      const topCourses = Array.from(courseMap.entries())
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([title, count]) => ({ title, count }))
      const topEbooks = Array.from(ebookMap.entries())
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([title, count]) => ({ title, count }))

      // 평점 분포
      const ratings = (reviewRatings as { rating: number }[] || [])
      const avgRating = ratings.length > 0
        ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
        : 0
      const ratingDist = [5, 4, 3, 2, 1].map((stars) => ({
        stars,
        count: ratings.filter((r) => r.rating === stars).length,
      }))

      // 회원 통계
      const profiles = (allProfiles as { gender: string | null; birth_date: string | null; address: string | null; provider: string | null; created_at: string }[] || [])

      // 성별
      const genderCount = { '남성': 0, '여성': 0, '미입력': 0 }
      for (const p of profiles) {
        if (p.gender === 'male') genderCount['남성']++
        else if (p.gender === 'female') genderCount['여성']++
        else genderCount['미입력']++
      }
      const genderDist = Object.entries(genderCount).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))

      // 연령대
      const ageCount: Record<string, number> = {}
      const thisYear = new Date().getFullYear()
      for (const p of profiles) {
        if (!p.birth_date) { ageCount['미입력'] = (ageCount['미입력'] || 0) + 1; continue }
        const age = thisYear - new Date(p.birth_date).getFullYear()
        const group = age < 20 ? '10대' : age < 30 ? '20대' : age < 40 ? '30대' : age < 50 ? '40대' : age < 60 ? '50대' : '60대+'
        ageCount[group] = (ageCount[group] || 0) + 1
      }
      const ageOrder = ['10대', '20대', '30대', '40대', '50대', '60대+', '미입력']
      const ageDist = ageOrder.filter((k) => ageCount[k]).map((name) => ({ name, value: ageCount[name] }))

      // 지역
      const regionCount: Record<string, number> = {}
      for (const p of profiles) {
        if (!p.address) { regionCount['미입력'] = (regionCount['미입력'] || 0) + 1; continue }
        const addr = p.address.split('|')[1] || ''
        const region = addr.split(' ')[0] || '기타'
        regionCount[region] = (regionCount[region] || 0) + 1
      }
      const regionDist = Object.entries(regionCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }))

      // 가입방법
      const provCount: Record<string, number> = {}
      for (const p of profiles) {
        const prov = p.provider === 'kakao' ? '카카오' : p.provider === 'google' ? '구글' : '이메일'
        provCount[prov] = (provCount[prov] || 0) + 1
      }
      const providerDist = Object.entries(provCount).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))

      // 월별 가입자
      const monthMap = new Map<string, number>()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(thisYear, new Date().getMonth() - i, 1)
        monthMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0)
      }
      for (const p of profiles) {
        const key = p.created_at.slice(0, 7)
        if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + 1)
      }
      const signupMonthly = Array.from(monthMap.entries()).map(([m, count]) => ({
        month: `${Number(m.split('-')[1])}월`,
        count,
      }))

      setData({
        totalUsers: totalUsers || 0,
        newUsersToday: newUsersToday || 0,
        newUsersWeek: newUsersWeek || 0,
        newUsersMonth: newUsersMonth || 0,
        totalRevenue: sum(allPurchases as { price: number }[]),
        todayRevenue: sum(todayPurchases as { price: number }[]),
        weekRevenue: sum(weekPurchases as { price: number }[]),
        monthRevenue: sum(monthPurchases as { price: number }[]),
        totalPurchases: totalPurchases || 0,
        totalCourses: totalCourses || 0,
        freeCourses: freeCourses || 0,
        premiumCourses: premiumCourses || 0,
        totalEbooks: totalEbooks || 0,
        totalInstructors: totalInstructors || 0,
        totalReviews: totalReviews || 0,
        totalResults: totalResults || 0,
        totalFaqs: totalFaqs || 0,
        totalSchedules: totalSchedules || 0,
        signupTrend, revenueTrend, purchaseByType,
        recentMembers: (recentMembers as DashboardData['recentMembers']) || [],
        recentPurchases: (recentPurchases as DashboardData['recentPurchases']) || [],
        recentReviews: (recentReviews as DashboardData['recentReviews']) || [],
        topCourses, topEbooks, avgRating, ratingDist,
        genderDist, ageDist, regionDist, providerDist, signupMonthly,
      })
    } catch {
      // 타임아웃 또는 에러 시 기본값 유지
    } finally {
      setLoading(false)
    }
  }

  const formatRelative = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    if (diff < 60000) return '방금 전'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`
    return new Date(d).toLocaleDateString('ko-KR')
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-gray-200 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm font-bold text-gray-900 mb-1">대시보드를 준비하고 있습니다</p>
          <p className="text-xs text-gray-400">운영 현황 데이터를 불러오는 중입니다...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">아마겟돈 클래스 운영 현황</p>
      </div>

      {/* ── 핵심 지표 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <BigCard icon="ti-users" label="전체 회원" value={data.totalUsers} sub={`오늘 +${data.newUsersToday}`} color="#2ED573" />
        <BigCard icon="ti-currency-won" label="총 매출" value={data.totalRevenue} isCurrency sub={`이번 달 ${data.monthRevenue.toLocaleString()}원`} color="#6366f1" />
        <BigCard icon="ti-shopping-cart" label="총 구매" value={data.totalPurchases} sub={`오늘 매출 ${data.todayRevenue.toLocaleString()}원`} color="#f59e0b" />
        <BigCard icon="ti-star" label="평균 평점" value={Number(data.avgRating.toFixed(1))} sub={`후기 ${data.totalReviews}개`} color="#ef4444" isStar />
      </div>

      {/* ── 매출 & 가입 상세 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniCard label="오늘 가입" value={data.newUsersToday} icon="ti-user-plus" />
        <MiniCard label="이번 주 가입" value={data.newUsersWeek} icon="ti-user-plus" />
        <MiniCard label="이번 주 매출" value={data.weekRevenue} icon="ti-trending-up" isCurrency />
        <MiniCard label="이번 달 매출" value={data.monthRevenue} icon="ti-report-money" isCurrency />
      </div>

      {/* ── 차트 섹션 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* 가입자 추이 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">가입자 추이 (30일)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.signupTrend}>
              <defs>
                <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2ED573" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2ED573" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#2ED573" strokeWidth={2} fill="url(#signupGrad)" name="가입자" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 매출 추이 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">매출 추이 (30일)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 10000 ? `${v / 10000}만` : v.toLocaleString()} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }} formatter={(v) => [`${Number(v).toLocaleString()}원`, '매출']} />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="매출" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 콘텐츠 현황 + 구매 유형 + 평점 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* 콘텐츠 현황 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">콘텐츠 현황</h3>
          <div className="space-y-3">
            <ContentRow icon="ti-users" label="강사" value={data.totalInstructors} color="text-blue-500" bg="bg-blue-50" />
            <ContentRow icon="ti-book-2" label="강의" value={data.totalCourses} color="text-emerald-500" bg="bg-emerald-50" sub={`무료 ${data.freeCourses} / 프리미엄 ${data.premiumCourses}`} />
            <ContentRow icon="ti-notebook" label="전자책" value={data.totalEbooks} color="text-purple-500" bg="bg-purple-50" />
            <ContentRow icon="ti-message-star" label="후기" value={data.totalReviews} color="text-amber-500" bg="bg-amber-50" />
            <ContentRow icon="ti-trophy" label="성과" value={data.totalResults} color="text-rose-500" bg="bg-rose-50" />
            <ContentRow icon="ti-calendar-event" label="일정" value={data.totalSchedules} color="text-cyan-500" bg="bg-cyan-50" />
            <ContentRow icon="ti-help-circle" label="FAQ" value={data.totalFaqs} color="text-gray-500" bg="bg-gray-100" />
          </div>
        </div>

        {/* 구매 유형 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">구매 유형</h3>
          {data.purchaseByType.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data.purchaseByType} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                    {data.purchaseByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2">
                {data.purchaseByType.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-xs text-gray-600">{item.name} ({item.value})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">구매 데이터 없음</div>
          )}
        </div>

        {/* 평점 분포 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">평점 분포</h3>
          <p className="text-3xl font-bold text-gray-900 mb-4">
            {data.avgRating.toFixed(1)} <span className="text-yellow-400 text-xl">★</span>
          </p>
          <div className="space-y-2">
            {data.ratingDist.map((r) => {
              const maxCount = Math.max(...data.ratingDist.map((d) => d.count), 1)
              return (
                <div key={r.stars} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-4 text-right">{r.stars}</span>
                  <span className="text-yellow-400 text-xs">★</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-all"
                      style={{ width: `${(r.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-6 text-right">{r.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── 인기 콘텐츠 ── */}
      {(data.topCourses.length > 0 || data.topEbooks.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {data.topCourses.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <i className="ti ti-flame text-sm text-orange-500" /> 인기 강의 TOP 5
              </h3>
              <div className="space-y-2">
                {data.topCourses.map((c, i) => (
                  <RankRow key={c.title} rank={i + 1} label={c.title} value={`${c.count}회`} maxValue={data.topCourses[0].count} currentValue={c.count} />
                ))}
              </div>
            </div>
          )}
          {data.topEbooks.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <i className="ti ti-flame text-sm text-orange-500" /> 인기 전자책 TOP 5
              </h3>
              <div className="space-y-2">
                {data.topEbooks.map((e, i) => (
                  <RankRow key={e.title} rank={i + 1} label={e.title} value={`${e.count}회`} maxValue={data.topEbooks[0].count} currentValue={e.count} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 최근 활동 3열 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* 최근 가입 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-50 flex items-center justify-center"><i className="ti ti-user-plus text-xs text-blue-500" /></div>
            최근 가입
          </h3>
          {data.recentMembers.length > 0 ? (
            <div className="space-y-2.5">
              {data.recentMembers.map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2ED573] to-emerald-400 flex items-center justify-center shrink-0">
                      <span className="text-[10px] text-white font-bold">{(m.name || '?')[0]}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 font-medium truncate">{m.name || '(이름 없음)'}</p>
                      <p className="text-[10px] text-gray-400">{m.phone || ''}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">{formatRelative(m.created_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">데이터 없음</p>
          )}
        </div>

        {/* 최근 구매 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber-50 flex items-center justify-center"><i className="ti ti-shopping-cart text-xs text-amber-500" /></div>
            최근 구매
          </h3>
          {data.recentPurchases.length > 0 ? (
            <div className="space-y-2.5">
              {data.recentPurchases.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate flex-1">{p.title}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs font-bold text-gray-900">{p.price.toLocaleString()}원</span>
                    <span className="text-[10px] text-gray-400">{formatRelative(p.purchased_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">데이터 없음</p>
          )}
        </div>

        {/* 최근 후기 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-rose-50 flex items-center justify-center"><i className="ti ti-message-star text-xs text-rose-500" /></div>
            최근 후기
          </h3>
          {data.recentReviews.length > 0 ? (
            <div className="space-y-2.5">
              {data.recentReviews.map((r, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm text-gray-900 font-medium truncate">{r.author_name}</span>
                    <span className="text-yellow-400 text-xs shrink-0">{'★'.repeat(r.rating)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 truncate flex-1">{r.title}</p>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">{formatRelative(r.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">데이터 없음</p>
          )}
        </div>
      </div>

      {/* ── 회원 분석 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 성별 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">성별</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={data.genderDist} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}>
                {data.genderDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: unknown) => `${String(v)}명`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-2">
            {data.genderDist.map((d, i) => (
              <span key={d.name} className="text-xs text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {d.name} {d.value}
              </span>
            ))}
          </div>
        </div>

        {/* 연령대 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">연령대</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.ageDist} barSize={20}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis hide />
              <Tooltip formatter={(v: unknown) => `${String(v)}명`} />
              <Bar dataKey="value" fill="#2ED573" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 가입방법 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">가입 방법</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={data.providerDist} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}>
                {data.providerDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: unknown) => `${String(v)}명`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-2">
            {data.providerDist.map((d, i) => (
              <span key={d.name} className="text-xs text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {d.name} {d.value}
              </span>
            ))}
          </div>
        </div>

        {/* 지역 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">지역 TOP 8</h3>
          <div className="space-y-1.5">
            {data.regionDist.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center px-2"
                    style={{ width: `${Math.max(20, (d.value / (data.regionDist[0]?.value || 1)) * 100)}%`, background: COLORS[i % COLORS.length] }}
                  >
                    <span className="text-[10px] text-white font-bold truncate">{d.name}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 월별 가입자 추이 */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h3 className="text-sm font-bold text-gray-900 mb-3">월별 가입자 추이 (최근 6개월)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.signupMonthly} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: unknown) => `${String(v)}명`} />
            <Bar dataKey="count" fill="#2ED573" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Umami 트래픽 분석 ── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => {
            const next = !umamiOpen
            setUmamiOpen(next)
            localStorage.setItem('admin_umami_open', next ? '1' : '0')
          }}
          className="w-full flex items-center justify-between px-5 py-4 bg-transparent border-none cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <i className="ti ti-chart-dots text-lg text-[#2ED573]" />
            <div className="text-left">
              <h2 className="text-sm font-bold text-gray-900">트래픽 분석</h2>
              <p className="text-[11px] text-gray-400">Umami Analytics 제공</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 max-sm:hidden">계정: admin / didwkwndcjq159</span>
            <a
              href={UMAMI_DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-[#2ED573] no-underline hover:underline flex items-center gap-1"
            >
              <i className="ti ti-external-link text-xs" /> 열기
            </a>
            <i className={`ti ${umamiOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-400 text-sm`} />
          </div>
        </button>
        <div style={{ height: umamiOpen ? 3500 : 750 }} className="transition-all duration-300">
          <iframe src={UMAMI_SHARE_URL} title="Umami Analytics" className="w-full h-full border-none" loading="lazy" />
        </div>
        {!umamiOpen && (
          <button
            onClick={() => { setUmamiOpen(true); localStorage.setItem('admin_umami_open', '1') }}
            className="w-full py-3 bg-gray-50 border-none cursor-pointer text-sm text-gray-500 hover:text-[#2ED573] hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5"
          >
            <i className="ti ti-chevron-down text-sm" /> 전체 보기
          </button>
        )}
      </div>
    </AdminLayout>
  )
}

/* ── 컴포넌트 ── */

function BigCard({ icon, label, value, sub, color, isCurrency, isStar }: {
  icon: string; label: string; value: number; sub: string; color: string; isCurrency?: boolean; isStar?: boolean
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10" style={{ backgroundColor: color }} />
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <i className={`ti ${icon} text-base`} style={{ color }} />
        </div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {isCurrency ? `${value.toLocaleString()}원` : isStar ? `${value} ★` : value.toLocaleString()}
      </p>
      <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

function MiniCard({ label, value, icon, isCurrency }: { label: string; value: number; icon: string; isCurrency?: boolean }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3.5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <i className={`ti ${icon} text-base text-gray-400`} />
      </div>
      <div>
        <p className="text-[11px] text-gray-400">{label}</p>
        <p className="text-base font-bold text-gray-900">{isCurrency ? `${value.toLocaleString()}원` : value.toLocaleString()}</p>
      </div>
    </div>
  )
}

function ContentRow({ icon, label, value, color, bg, sub }: {
  icon: string; label: string; value: number; color: string; bg: string; sub?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
          <i className={`ti ${icon} text-sm ${color}`} />
        </div>
        <div>
          <span className="text-sm text-gray-700">{label}</span>
          {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
        </div>
      </div>
      <span className="text-base font-bold text-gray-900">{value}</span>
    </div>
  )
}

function RankRow({ rank, label, value, maxValue, currentValue }: {
  rank: number; label: string; value: string; maxValue: number; currentValue: number
}) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-[#2ED573]/5 rounded-lg" style={{ width: `${(currentValue / maxValue) * 100}%` }} />
      <div className="relative flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`text-xs font-bold w-5 text-center shrink-0 ${rank <= 3 ? 'text-[#2ED573]' : 'text-gray-400'}`}>{rank}</span>
          <span className="text-sm text-gray-700 truncate">{label}</span>
        </div>
        <span className="text-xs font-semibold text-gray-900 shrink-0 ml-2">{value}</span>
      </div>
    </div>
  )
}
