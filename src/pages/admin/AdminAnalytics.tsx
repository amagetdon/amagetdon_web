import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { withTimeout } from '../../lib/fetchWithTimeout'
import AdminLayout from '../../components/admin/AdminLayout'

const COLORS = ['#2ED573', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']

type Period = '7d' | '30d' | '90d' | 'all'

interface ProfileRow {
  gender: string | null
  birth_date: string | null
  address: string | null
  provider: string | null
  phone: string | null
  name: string | null
  created_at: string
  last_active_at: string | null
  points: number
}

interface PurchaseRow {
  user_id: string
  price: number
  purchased_at: string
  course_id: number | null
  ebook_id: number | null
}

interface CouponClaimRow {
  coupon_id: number
  used_at: string | null
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<Period>('30d')
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [couponClaims, setCouponClaims] = useState<CouponClaimRow[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [profileRes, purchaseRes, couponRes] = await withTimeout(Promise.all([
          supabase.from('profiles').select('gender, birth_date, address, provider, phone, name, created_at, last_active_at, points'),
          supabase.from('purchases').select('user_id, price, purchased_at, course_id, ebook_id'),
          supabase.from('coupon_claims').select('coupon_id, used_at'),
        ]), 15000)
        setProfiles((profileRes.data ?? []) as ProfileRow[])
        setPurchases((purchaseRes.data ?? []) as PurchaseRow[])
        setCouponClaims((couponRes.data ?? []) as CouponClaimRow[])
      } catch { /* */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const now = new Date()
  const periodMs = period === '7d' ? 7 * 86400000 : period === '30d' ? 30 * 86400000 : period === '90d' ? 90 * 86400000 : Infinity
  const periodStart = periodMs === Infinity ? new Date(0) : new Date(now.getTime() - periodMs)

  const filteredProfiles = period === 'all' ? profiles : profiles.filter((p) => new Date(p.created_at) >= periodStart)
  const filteredPurchases = period === 'all' ? purchases : purchases.filter((p) => new Date(p.purchased_at) >= periodStart)

  // ── DAU / WAU / MAU ──
  const dau = profiles.filter((p) => p.last_active_at && new Date(p.last_active_at) >= new Date(now.getTime() - 86400000)).length
  const wau = profiles.filter((p) => p.last_active_at && new Date(p.last_active_at) >= new Date(now.getTime() - 7 * 86400000)).length
  const mau = profiles.filter((p) => p.last_active_at && new Date(p.last_active_at) >= new Date(now.getTime() - 30 * 86400000)).length
  const totalUsers = profiles.length

  // ── 휴면 유저 ──
  const dormant30 = profiles.filter((p) => !p.last_active_at || new Date(p.last_active_at) < new Date(now.getTime() - 30 * 86400000)).length
  const dormant60 = profiles.filter((p) => !p.last_active_at || new Date(p.last_active_at) < new Date(now.getTime() - 60 * 86400000)).length
  const dormant90 = profiles.filter((p) => !p.last_active_at || new Date(p.last_active_at) < new Date(now.getTime() - 90 * 86400000)).length

  // ── 전환 퍼널 ──
  const profileComplete = profiles.filter((p) => p.phone && p.name).length
  const purchasedUsers = new Set(purchases.map((p) => p.user_id)).size
  const funnelData = [
    { name: '가입', value: totalUsers },
    { name: '프로필 완성', value: profileComplete },
    { name: '첫 구매', value: purchasedUsers },
  ]

  // ── 유저당 평균 결제액 ──
  const totalRevenue = filteredPurchases.reduce((s, p) => s + p.price, 0)
  const avgRevenuePerUser = purchasedUsers > 0 ? Math.round(totalRevenue / purchasedUsers) : 0
  const avgPurchaseCount = purchasedUsers > 0 ? (filteredPurchases.length / purchasedUsers).toFixed(1) : '0'

  // ── 활성 유저 추이 (일별) ──
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const activeByDay: { date: string; active: number; signup: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    const active = profiles.filter((p) => p.last_active_at && p.last_active_at.slice(0, 10) === dateStr).length
    const signup = profiles.filter((p) => p.created_at.slice(0, 10) === dateStr).length
    activeByDay.push({ date: label, active, signup })
  }

  // ── 성별 ──
  const genderCount = { '남성': 0, '여성': 0, '미입력': 0 }
  for (const p of filteredProfiles) {
    if (p.gender === 'male') genderCount['남성']++
    else if (p.gender === 'female') genderCount['여성']++
    else genderCount['미입력']++
  }
  const genderDist = Object.entries(genderCount).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))

  // ── 연령대 ──
  const thisYear = now.getFullYear()
  const ageCount: Record<string, number> = {}
  for (const p of filteredProfiles) {
    if (!p.birth_date) { ageCount['미입력'] = (ageCount['미입력'] || 0) + 1; continue }
    const age = thisYear - new Date(p.birth_date).getFullYear()
    const group = age < 20 ? '10대' : age < 30 ? '20대' : age < 40 ? '30대' : age < 50 ? '40대' : age < 60 ? '50대' : '60대+'
    ageCount[group] = (ageCount[group] || 0) + 1
  }
  const ageOrder = ['10대', '20대', '30대', '40대', '50대', '60대+', '미입력']
  const ageDist = ageOrder.filter((k) => ageCount[k]).map((name) => ({ name, value: ageCount[name] }))

  // ── 지역 ──
  const regionCount: Record<string, number> = {}
  for (const p of filteredProfiles) {
    if (!p.address) { regionCount['미입력'] = (regionCount['미입력'] || 0) + 1; continue }
    const region = (p.address.split('|')[1] || '').split(' ')[0] || '기타'
    regionCount[region] = (regionCount[region] || 0) + 1
  }
  const regionDist = Object.entries(regionCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))

  // ── 가입방법 ──
  const provCount: Record<string, number> = {}
  for (const p of filteredProfiles) {
    const prov = p.provider === 'kakao' ? '카카오' : p.provider === 'google' ? '구글' : '이메일'
    provCount[prov] = (provCount[prov] || 0) + 1
  }
  const providerDist = Object.entries(provCount).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))

  // ── 쿠폰 사용률 ──
  const totalClaims = couponClaims.length
  const usedClaims = couponClaims.filter((c) => c.used_at).length
  const couponUseRate = totalClaims > 0 ? Math.round((usedClaims / totalClaims) * 100) : 0

  // ── 시간대별 가입 ──
  const hourCount = new Array(24).fill(0)
  for (const p of profiles) {
    const h = new Date(p.created_at).getHours()
    hourCount[h]++
  }
  const hourDist = hourCount.map((count, h) => ({ hour: `${h}시`, count }))

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded w-40 animate-pulse" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-white rounded-xl p-5 animate-pulse h-24" />)}
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">회원 분석</h1>
          <p className="text-sm text-gray-500 mt-1">상세 회원 통계 및 활성도 분석</p>
        </div>
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
      </div>

      {/* ── 활성 유저 지표 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="일간 활성 (DAU)" value={dau} sub={`전체의 ${totalUsers ? Math.round((dau / totalUsers) * 100) : 0}%`} color="#2ED573" />
        <StatCard label="주간 활성 (WAU)" value={wau} sub={`전체의 ${totalUsers ? Math.round((wau / totalUsers) * 100) : 0}%`} color="#6366f1" />
        <StatCard label="월간 활성 (MAU)" value={mau} sub={`전체의 ${totalUsers ? Math.round((mau / totalUsers) * 100) : 0}%`} color="#3b82f6" />
        <StatCard label="전체 회원" value={totalUsers} sub={`기간 내 신규 ${filteredProfiles.length}명`} color="#f59e0b" />
      </div>

      {/* ── 활성/가입 추이 ── */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h3 className="text-sm font-bold text-gray-900 mb-3">일별 활성 유저 / 신규 가입</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={activeByDay}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={period === '90d' ? 6 : period === '7d' ? 0 : 2} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="active" name="활성 유저" stroke="#2ED573" fill="#2ED573" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="signup" name="신규 가입" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* ── 휴면 유저 ── */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">휴면 유저</h3>
          <div className="space-y-3">
            <DormantRow label="30일 미접속" count={dormant30} total={totalUsers} color="#f59e0b" />
            <DormantRow label="60일 미접속" count={dormant60} total={totalUsers} color="#ef4444" />
            <DormantRow label="90일 미접속" count={dormant90} total={totalUsers} color="#7f1d1d" />
          </div>
        </div>

        {/* ── 전환 퍼널 ── */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">전환 퍼널</h3>
          <div className="space-y-2">
            {funnelData.map((d, i) => (
              <div key={d.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{d.name}</span>
                  <span className="font-bold text-gray-900">{d.value}명 ({totalUsers ? Math.round((d.value / totalUsers) * 100) : 0}%)</span>
                </div>
                <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${totalUsers ? (d.value / totalUsers) * 100 : 0}%`, background: COLORS[i] }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 결제 통계 ── */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">결제 통계</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400">기간 내 총 매출</p>
              <p className="text-lg font-bold text-gray-900">{totalRevenue.toLocaleString()}P</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">유저당 평균 결제</p>
              <p className="text-lg font-bold text-gray-900">{avgRevenuePerUser.toLocaleString()}P</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">유저당 평균 구매 수</p>
              <p className="text-lg font-bold text-gray-900">{avgPurchaseCount}건</p>
            </div>
          </div>
        </div>

        {/* ── 쿠폰 ── */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">쿠폰 현황</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400">총 발급</p>
              <p className="text-lg font-bold text-gray-900">{totalClaims}건</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">사용 완료</p>
              <p className="text-lg font-bold text-gray-900">{usedClaims}건</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">사용률</p>
              <p className="text-lg font-bold" style={{ color: couponUseRate > 50 ? '#2ED573' : '#f59e0b' }}>{couponUseRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 인구 통계 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">성별</h3>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={genderDist} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={3}>
                {genderDist.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${v}명`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-1">
            {genderDist.map((d, i) => (
              <span key={d.name} className="text-[10px] text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />{d.name} {d.value}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">연령대</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={ageDist} barSize={18}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => `${v}명`} />
              <Bar dataKey="value" fill="#2ED573" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">가입 방법</h3>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={providerDist} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={3}>
                {providerDist.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${v}명`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-1">
            {providerDist.map((d, i) => (
              <span key={d.name} className="text-[10px] text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />{d.name} {d.value}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">가입 시간대</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={hourDist} barSize={8}>
              <XAxis dataKey="hour" tick={{ fontSize: 8 }} interval={2} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => `${v}명`} />
              <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 지역 분포 ── */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h3 className="text-sm font-bold text-gray-900 mb-3">지역 분포 TOP 10</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={regionDist} layout="vertical" barSize={20}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
            <Tooltip formatter={(v: number) => `${v}명`} />
            <Bar dataKey="value" fill="#2ED573" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AdminLayout>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value.toLocaleString()}</p>
      <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

function DormantRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-bold" style={{ color }}>{count}명 ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
