import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import { supabase } from '../../lib/supabase'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'

interface Metrics {
  fetched_at: string
  database: { name: string; version: string; size_bytes: number; max_connections: number }
  connections: {
    current: number
    max: number
    active_queries: number
    idle_in_transaction: number
    longest_active_seconds: number | null
  }
  traffic: {
    xact_commit: number
    xact_rollback: number
    blks_read: number
    blks_hit: number
    cache_hit_ratio: number | null
    deadlocks: number
    temp_files: number
    temp_bytes: number
  }
  tables: { name: string; live_rows: number; total_bytes: number; table_bytes: number }[]
  storage: { bucket: string; files: number; bytes: number }[]
  auth: { total_users: number; new_users_7d: number; active_users_7d: number }
}

const SUPABASE_PROJECT_REF = 'uxpihuccunqqtdbxszqa'
const PLAN_DB_LIMIT_BYTES = 8 * 1024 * 1024 * 1024 // Pro 플랜 기본 DB 8 GB
const PLAN_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024 * 1024 // Pro 플랜 기본 Storage 100 GB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR')
}

interface UsageBarProps {
  current: number
  max: number
  label: string
  warningRatio?: number
  dangerRatio?: number
  formatter?: (n: number) => string
}

function UsageBar({ current, max, label, warningRatio = 0.6, dangerRatio = 0.8, formatter = formatNumber }: UsageBarProps) {
  const ratio = max > 0 ? Math.min(1, current / max) : 0
  const pct = (ratio * 100).toFixed(1)
  const tone =
    ratio >= dangerRatio ? { bar: 'bg-red-500', text: 'text-red-600' }
    : ratio >= warningRatio ? { bar: 'bg-amber-500', text: 'text-amber-600' }
    : { bar: 'bg-[#2ED573]', text: 'text-emerald-600' }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-bold text-gray-500">{label}</span>
        <span className="text-xs">
          <strong className="text-gray-900">{formatter(current)}</strong>
          <span className="text-gray-400"> / {formatter(max)}</span>
          <span className={`ml-2 font-bold ${tone.text}`}>{pct}%</span>
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-500 ${tone.bar}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'warn' | 'danger' | 'good' }) {
  const toneClass =
    tone === 'danger' ? 'text-red-600'
    : tone === 'warn' ? 'text-amber-600'
    : tone === 'good' ? 'text-emerald-600'
    : 'text-gray-900'
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

interface DiskMount {
  mountpoint: string
  fstype?: string
  total_bytes: number
  used_bytes: number
  used_pct: number
}

interface InfraMetrics {
  status: 'ok' | 'unsupported'
  reason?: string
  fetched_at?: string
  cpu?: { used_pct: number | null; approximation?: boolean }
  memory?: { used_pct: number | null; used_bytes: number | null; total_bytes: number | null }
  disk?: {
    used_pct: number | null
    used_bytes: number | null
    total_bytes: number | null
    mountpoint?: string | null
    fstype?: string | null
    all_mounts?: DiskMount[]
  }
}

export default function AdminPerformance() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [infra, setInfra] = useState<InfraMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [rpcRes, infraRes] = await Promise.all([
        supabase.rpc('admin_performance_metrics'),
        supabase.functions.invoke('infra-metrics').catch((err) => ({ data: null, error: err })),
      ])
      if (rpcRes.error) throw rpcRes.error
      setMetrics(rpcRes.data as Metrics)
      if (infraRes.data) setInfra(infraRes.data as InfraMetrics)
      else if (infraRes.error) setInfra({ status: 'unsupported', reason: '인프라 메트릭 호출 실패' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '성능 지표를 불러오지 못했습니다.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])
  useVisibilityRefresh(fetchMetrics)

  // 30초 자동 갱신
  useEffect(() => {
    const id = setInterval(() => { fetchMetrics() }, 30000)
    return () => clearInterval(id)
  }, [fetchMetrics])

  const totalStorageBytes = metrics?.storage.reduce((acc, b) => acc + b.bytes, 0) ?? 0

  const connectionRatio = metrics ? metrics.connections.current / metrics.connections.max : 0
  const cacheHitPct = metrics?.traffic.cache_hit_ratio != null ? (metrics.traffic.cache_hit_ratio * 100).toFixed(2) : '—'
  const cacheTone = metrics?.traffic.cache_hit_ratio != null
    ? metrics.traffic.cache_hit_ratio >= 0.99 ? 'good' : metrics.traffic.cache_hit_ratio >= 0.95 ? 'default' : 'warn'
    : 'default'

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">성능 모니터</h1>
          <p className="text-sm text-gray-500 mt-1">DB / Storage 사용량과 한도. 30초마다 자동 갱신됩니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="bg-white text-gray-600 border border-gray-200 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <i className={`ti ti-refresh text-sm ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <a
            href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/observability/database`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#2ED573] text-white text-xs font-bold px-3 py-2 rounded-lg no-underline hover:bg-[#25B866] transition-colors flex items-center gap-1.5"
          >
            <i className="ti ti-external-link text-sm" />
            Supabase 콘솔 (CPU/RAM)
          </a>
        </div>
      </div>

      {error && !metrics && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
          <strong className="block mb-1">불러오기 실패</strong>
          <span>{error}</span>
        </div>
      )}

      {loading && !metrics ? (
        <div className="grid grid-cols-4 max-md:grid-cols-2 max-sm:grid-cols-1 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : metrics && (
        <div className="space-y-6">
          {/* 핵심 지표 카드 */}
          <div className="grid grid-cols-4 max-md:grid-cols-2 max-sm:grid-cols-1 gap-4">
            <StatCard
              label="현재 연결"
              value={`${metrics.connections.current} / ${metrics.connections.max}`}
              sub={`${(connectionRatio * 100).toFixed(0)}% 사용`}
              tone={connectionRatio >= 0.8 ? 'danger' : connectionRatio >= 0.6 ? 'warn' : 'default'}
            />
            <StatCard
              label="활성 쿼리"
              value={`${metrics.connections.active_queries}`}
              sub={metrics.connections.idle_in_transaction > 0 ? `idle in tx: ${metrics.connections.idle_in_transaction}` : '진행 중인 쿼리 수'}
              tone={metrics.connections.idle_in_transaction > 0 ? 'warn' : 'default'}
            />
            <StatCard
              label="DB 크기"
              value={formatBytes(metrics.database.size_bytes)}
              sub={`Postgres ${metrics.database.version.split(' ')[0]}`}
            />
            <StatCard
              label="캐시 히트"
              value={`${cacheHitPct}%`}
              sub="높을수록 좋음 (목표 99%+)"
              tone={cacheTone}
            />
          </div>

          {/* 인프라 메트릭 (CPU / RAM / Disk) */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-bold text-gray-900">인프라 사용률</h2>
              <span className="text-[11px] text-gray-400">
                {infra?.status === 'ok' && infra.fetched_at ? new Date(infra.fetched_at).toLocaleString('ko-KR') : 'Supabase Prometheus endpoint'}
              </span>
            </div>
            {infra?.status === 'ok' ? (
              <div className="space-y-3">
                {infra.cpu && infra.cpu.used_pct != null && (
                  <UsageBar
                    label={`CPU${infra.cpu.approximation ? ' (누적 평균 근사)' : ''}`}
                    current={infra.cpu.used_pct}
                    max={100}
                    formatter={(n) => `${n.toFixed(1)}%`}
                  />
                )}
                {infra.memory && infra.memory.used_pct != null && infra.memory.total_bytes && (
                  <UsageBar
                    label="RAM"
                    current={infra.memory.used_bytes ?? 0}
                    max={infra.memory.total_bytes}
                    formatter={formatBytes}
                  />
                )}
                {infra.disk && infra.disk.used_pct != null && infra.disk.total_bytes && (
                  <div>
                    <UsageBar
                      label={`Disk${infra.disk.mountpoint ? ` (${infra.disk.mountpoint})` : ''}`}
                      current={infra.disk.used_bytes ?? 0}
                      max={infra.disk.total_bytes}
                      formatter={formatBytes}
                    />
                    {infra.disk.all_mounts && infra.disk.all_mounts.length > 1 && (
                      <details className="mt-2">
                        <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-600">
                          모든 마운트 보기 ({infra.disk.all_mounts.length}개)
                        </summary>
                        <table className="w-full text-xs mt-2 border-t border-gray-100">
                          <thead>
                            <tr className="text-gray-400">
                              <th className="px-2 py-1.5 text-left font-medium">mount</th>
                              <th className="px-2 py-1.5 text-right font-medium">used</th>
                              <th className="px-2 py-1.5 text-right font-medium">total</th>
                              <th className="px-2 py-1.5 text-right font-medium">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {infra.disk.all_mounts.map((m) => (
                              <tr key={m.mountpoint} className={m.mountpoint === infra.disk?.mountpoint ? 'bg-emerald-50' : ''}>
                                <td className="px-2 py-1 font-mono text-gray-700">{m.mountpoint}</td>
                                <td className="px-2 py-1 text-right text-gray-600">{formatBytes(m.used_bytes)}</td>
                                <td className="px-2 py-1 text-right text-gray-600">{formatBytes(m.total_bytes)}</td>
                                <td className="px-2 py-1 text-right text-gray-900 font-bold">{m.used_pct.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    )}
                  </div>
                )}
                {infra.cpu?.used_pct == null && infra.memory?.used_pct == null && infra.disk?.used_pct == null && (
                  <p className="text-xs text-gray-400">메트릭이 비어있습니다. Supabase 에서 export 가 활성화되었는지 확인해주세요.</p>
                )}
              </div>
            ) : (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <i className="ti ti-alert-triangle mr-1.5" />
                인프라 메트릭(CPU/RAM/Disk) 을 가져오지 못했습니다. {infra?.reason || 'Pro 플랜에서만 활성화됩니다.'} 우상단 "Supabase 콘솔" 링크로 확인하세요.
              </div>
            )}
          </div>

          {/* 사용량 / 한도 */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">사용량 / 한도</h2>
              <span className="text-[11px] text-gray-400">{new Date(metrics.fetched_at).toLocaleString('ko-KR')}</span>
            </div>
            <UsageBar
              label="DB Connections"
              current={metrics.connections.current}
              max={metrics.connections.max}
            />
            <UsageBar
              label="DB 크기 (Pro 플랜 기본 8 GB 기준)"
              current={metrics.database.size_bytes}
              max={PLAN_DB_LIMIT_BYTES}
              formatter={formatBytes}
            />
            <UsageBar
              label="Storage 합계 (Pro 플랜 기본 100 GB 기준)"
              current={totalStorageBytes}
              max={PLAN_STORAGE_LIMIT_BYTES}
              formatter={formatBytes}
            />
            {metrics.connections.longest_active_seconds != null && metrics.connections.longest_active_seconds > 5 && (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <i className="ti ti-alert-triangle mr-1.5" />
                가장 오래 실행 중인 쿼리: {metrics.connections.longest_active_seconds.toFixed(1)}초 — 5초 넘으면 슬로우 쿼리 의심
              </div>
            )}
          </div>

          {/* 트래픽 */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-base font-bold text-gray-900 mb-3">DB 트래픽 (누적)</h2>
            <div className="grid grid-cols-4 max-md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-[11px] text-gray-500">커밋된 트랜잭션</p>
                <p className="font-bold text-gray-900">{formatNumber(metrics.traffic.xact_commit)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">롤백된 트랜잭션</p>
                <p className={`font-bold ${metrics.traffic.xact_rollback > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                  {formatNumber(metrics.traffic.xact_rollback)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">디스크 읽기</p>
                <p className="font-bold text-gray-900">{formatNumber(metrics.traffic.blks_read)} blocks</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">캐시 히트</p>
                <p className="font-bold text-gray-900">{formatNumber(metrics.traffic.blks_hit)} blocks</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">데드락</p>
                <p className={`font-bold ${metrics.traffic.deadlocks > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatNumber(metrics.traffic.deadlocks)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">임시 파일</p>
                <p className="font-bold text-gray-900">{formatNumber(metrics.traffic.temp_files)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">임시 데이터</p>
                <p className="font-bold text-gray-900">{formatBytes(metrics.traffic.temp_bytes)}</p>
              </div>
            </div>
          </div>

          {/* 사용자 통계 */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-base font-bold text-gray-900 mb-3">사용자</h2>
            <div className="grid grid-cols-3 max-sm:grid-cols-1 gap-4 text-sm">
              <div>
                <p className="text-[11px] text-gray-500">총 회원</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(metrics.auth.total_users)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">최근 7일 신규 가입</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(metrics.auth.new_users_7d)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">최근 7일 로그인</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(metrics.auth.active_users_7d)}</p>
              </div>
            </div>
          </div>

          {/* 큰 테이블 */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 pb-3">
              <h2 className="text-base font-bold text-gray-900">큰 테이블 Top 15</h2>
              <p className="text-xs text-gray-400 mt-1">total = 인덱스 포함</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">테이블</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500">행 수</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500">테이블</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500">total (+인덱스)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {metrics.tables.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-xs">데이터 없음</td></tr>
                  ) : metrics.tables.map((t) => (
                    <tr key={t.name}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-900">{t.name}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{formatNumber(t.live_rows)}</td>
                      <td className="px-4 py-2 text-right text-gray-500 text-xs">{formatBytes(t.table_bytes)}</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-bold text-xs">{formatBytes(t.total_bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Storage 버킷 */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 pb-3 flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-bold text-gray-900">Storage 버킷</h2>
              <span className="text-xs text-gray-500">합계 {formatBytes(totalStorageBytes)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">버킷</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500">파일 수</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500">크기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {metrics.storage.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-xs">데이터 없음</td></tr>
                  ) : metrics.storage.map((b) => (
                    <tr key={b.bucket}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-900">{b.bucket}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{formatNumber(b.files)}</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-bold text-xs">{formatBytes(b.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-xs text-gray-400 leading-relaxed">
            <p>* 한도 기준은 Pro 플랜 기본값 (DB 8GB / Storage 100GB) 입니다. 다른 플랜이면 실제 한도와 다를 수 있어요.</p>
            {infra?.status !== 'ok' && (
              <p>* CPU / RAM / 디스크 % 는 Supabase Prometheus endpoint 가 활성화돼야 표시됩니다 (Pro 플랜).</p>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
