import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { analyticsService } from '../../services/analyticsService'

type Period = 'today' | '7d' | '30d' | '90d'

interface Stats {
  pageviews: number
  visitors: number
  visits: number
  totaltime: number
}

interface PageviewEntry {
  x: string
  y: number
}

interface MetricEntry {
  x: string
  y: number
}

function getRange(period: Period): { startAt: number; endAt: number } {
  const now = new Date()
  const endAt = now.getTime()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  switch (period) {
    case 'today':
      return { startAt: startOfToday, endAt }
    case '7d':
      return { startAt: startOfToday - 6 * 86400000, endAt }
    case '30d':
      return { startAt: startOfToday - 29 * 86400000, endAt }
    case '90d':
      return { startAt: startOfToday - 89 * 86400000, endAt }
  }
}

function formatDuration(totaltime: number, visits: number): string {
  if (!visits) return '0:00'
  const avgSeconds = Math.round(totaltime / visits)
  const min = Math.floor(avgSeconds / 60)
  const sec = avgSeconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today', label: '오늘' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: '90d', label: '90일' },
]

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<Period>('7d')
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(0)
  const [stats, setStats] = useState<Stats>({ pageviews: 0, visitors: 0, visits: 0, totaltime: 0 })
  const [pageviews, setPageviews] = useState<PageviewEntry[]>([])
  const [sessions, setSessions] = useState<PageviewEntry[]>([])
  const [topPages, setTopPages] = useState<MetricEntry[]>([])
  const [referrers, setReferrers] = useState<MetricEntry[]>([])
  const [devices, setDevices] = useState<MetricEntry[]>([])
  const [browsers, setBrowsers] = useState<MetricEntry[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { startAt, endAt } = getRange(period)
      const unit = period === 'today' ? 'hour' : 'day'

      const [statsData, pvData, activeData, pagesData, refData, devData, brData] =
        await Promise.all([
          analyticsService.getStats(startAt, endAt),
          analyticsService.getPageviews(startAt, endAt, unit),
          analyticsService.getActive(),
          analyticsService.getMetrics(startAt, endAt, 'url'),
          analyticsService.getMetrics(startAt, endAt, 'referrer'),
          analyticsService.getMetrics(startAt, endAt, 'device'),
          analyticsService.getMetrics(startAt, endAt, 'browser'),
        ])

      setStats({
        pageviews: statsData.pageviews.value,
        visitors: statsData.visitors.value,
        visits: statsData.visits.value,
        totaltime: statsData.totaltime.value,
      })
      setActive(activeData.x)
      setPageviews(pvData.pageviews)
      setSessions(pvData.sessions)
      setTopPages(pagesData.slice(0, 10))
      setReferrers(refData.slice(0, 5))
      setDevices(devData)
      setBrowsers(brData)
    } catch {
      // 에러 시 빈 상태 유지
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 실시간 접속자 30초 간격 갱신
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await analyticsService.getActive()
        setActive(data.x)
      } catch {
        // 무시
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const maxPv = Math.max(...pageviews.map((p) => p.y), ...sessions.map((s) => s.y), 1)
  const topPageMax = topPages.length > 0 ? topPages[0].y : 1
  const deviceTotal = devices.reduce((sum, d) => sum + d.y, 0) || 1
  const browserTotal = browsers.reduce((sum, b) => sum + b.y, 0) || 1

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        {/* 제목 */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">분석 대시보드</h1>
          <p className="text-sm text-gray-500 mt-1">사이트 트래픽 및 방문자 분석</p>
        </div>

        {/* 상단 카드 4열 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="실시간 접속자"
            value={active.toString()}
            icon="ti-antenna"
            accent
          />
          <StatCard
            label="페이지뷰"
            value={stats.pageviews.toLocaleString()}
            icon="ti-eye"
          />
          <StatCard
            label="방문자"
            value={stats.visitors.toLocaleString()}
            icon="ti-users"
          />
          <StatCard
            label="평균 방문 시간"
            value={formatDuration(stats.totaltime, stats.visits)}
            icon="ti-clock"
          />
        </div>

        {/* 기간 선택 */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl shadow-sm p-1.5 w-fit">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
                period === opt.value
                  ? 'bg-[#04F87F] text-white'
                  : 'bg-transparent text-gray-500 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-[#04F87F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 페이지뷰 차트 */}
            <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
              <h2 className="text-sm font-bold text-gray-900 mb-1">페이지뷰 추이</h2>
              <div className="flex items-center gap-4 mb-4">
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded-sm bg-[#04F87F] inline-block" /> 페이지뷰
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded-sm bg-[#6366f1] inline-block" /> 세션
                </span>
              </div>
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1 min-w-0" style={{ minHeight: 200 }}>
                  {pageviews.map((pv, i) => {
                    const session = sessions[i]
                    const pvHeight = maxPv > 0 ? (pv.y / maxPv) * 180 : 0
                    const sHeight = session && maxPv > 0 ? (session.y / maxPv) * 180 : 0
                    return (
                      <div key={pv.x} className="flex-1 min-w-[20px] flex flex-col items-center gap-0.5">
                        <div className="flex items-end gap-[2px] w-full justify-center" style={{ height: 180 }}>
                          <div
                            className="bg-[#04F87F] rounded-t-sm flex-1 max-w-[16px] transition-all relative group"
                            style={{ height: Math.max(pvHeight, 2) }}
                          >
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                              {pv.y}
                            </span>
                          </div>
                          <div
                            className="bg-[#6366f1] rounded-t-sm flex-1 max-w-[16px] transition-all relative group"
                            style={{ height: Math.max(sHeight, 2) }}
                          >
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                              {session?.y ?? 0}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">
                          {period === 'today' ? `${pv.x}시` : formatDate(pv.x)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 인기 페이지 TOP 10 */}
            <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
              <h2 className="text-sm font-bold text-gray-900 mb-4">인기 페이지 TOP 10</h2>
              <div className="space-y-2">
                {topPages.map((page, i) => (
                  <div key={page.x} className="relative">
                    <div
                      className="absolute inset-0 bg-[#04F87F]/8 rounded-lg"
                      style={{ width: `${(page.y / topPageMax) * 100}%` }}
                    />
                    <div className="relative flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-700 truncate">{page.x}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 shrink-0 ml-3">
                        {page.y.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
                {topPages.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">데이터 없음</p>
                )}
              </div>
            </div>

            {/* 유입 경로 TOP 5 */}
            <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
              <h2 className="text-sm font-bold text-gray-900 mb-4">유입 경로 TOP 5</h2>
              <div className="space-y-2">
                {referrers.map((ref, i) => (
                  <div key={ref.x || `direct-${i}`} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700 truncate">
                        {ref.x || '(직접 방문)'}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 shrink-0 ml-3">
                      {ref.y.toLocaleString()}
                    </span>
                  </div>
                ))}
                {referrers.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">데이터 없음</p>
                )}
              </div>
            </div>

            {/* 디바이스 / 브라우저 2열 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 디바이스 */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-bold text-gray-900 mb-4">디바이스</h2>
                <div className="space-y-3">
                  {devices.map((d) => {
                    const pct = Math.round((d.y / deviceTotal) * 100)
                    return (
                      <div key={d.x}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 capitalize">{d.x || 'Unknown'}</span>
                          <span className="text-sm font-semibold text-gray-900">{pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#04F87F] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {devices.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">데이터 없음</p>
                  )}
                </div>
              </div>

              {/* 브라우저 */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-bold text-gray-900 mb-4">브라우저</h2>
                <div className="space-y-3">
                  {browsers.map((b) => {
                    const pct = Math.round((b.y / browserTotal) * 100)
                    return (
                      <div key={b.x}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700">{b.x || 'Unknown'}</span>
                          <span className="text-sm font-semibold text-gray-900">{pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#6366f1] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {browsers.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">데이터 없음</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

/* 상단 통계 카드 컴포넌트 */
function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon: string
  accent?: boolean
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          accent ? 'bg-[#04F87F]/15' : 'bg-gray-100'
        }`}>
          <i className={`ti ${icon} text-base ${accent ? 'text-[#04F87F]' : 'text-gray-400'}`} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {accent && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#04F87F] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#04F87F]" />
          </span>
        )}
        <span className="text-2xl font-bold text-gray-900">{value}</span>
      </div>
    </div>
  )
}
