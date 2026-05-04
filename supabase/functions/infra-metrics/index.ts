// Supabase 인프라 메트릭 (CPU / RAM / Disk) — Prometheus exposition endpoint 를
// service_role 자격으로 가져와서 admin 클라이언트에 정제된 JSON 으로 반환.
//
// Pro 플랜 이상에서 활성. Free 플랜이거나 endpoint 가 막혀있으면 status='unsupported' 반환.
//
// POST 본문: 없음 (admin auth 만 필요)
//
// 응답:
//   { status: 'ok', cpu: { used_pct }, memory: { used_pct, used_bytes, total_bytes },
//     disk: { used_pct, used_bytes, total_bytes }, fetched_at }
//   { status: 'unsupported', reason }   ← Pro 미만 또는 endpoint 비활성
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Prometheus 라인 파서 — `metric_name{label="x"} 1.234` 형식
// 멀티라인 일치해야 하므로 라인 단위 처리
function parseMetric(text: string, name: string, labelFilter?: (labels: Record<string, string>) => boolean): number | null {
  const lines = text.split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (!line.startsWith(name)) continue
    // metric{labels} value  또는  metric value
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([\d.eE+-]+)/)
    if (!match) continue
    if (match[1] !== name) continue
    if (labelFilter) {
      const labelsRaw = match[2] || ''
      const labels: Record<string, string> = {}
      const re = /([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/g
      let m
      while ((m = re.exec(labelsRaw)) !== null) labels[m[1]] = m[2]
      if (!labelFilter(labels)) continue
    }
    const val = Number(match[3])
    if (Number.isFinite(val)) return val
  }
  return null
}

// 모든 매칭 라인의 값을 합산 (cpu seconds 처럼 코어/모드별 다중 라인일 때)
function sumMetric(text: string, name: string, labelFilter?: (labels: Record<string, string>) => boolean): number | null {
  const lines = text.split('\n')
  let total = 0
  let found = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([\d.eE+-]+)/)
    if (!match || match[1] !== name) continue
    if (labelFilter) {
      const labelsRaw = match[2] || ''
      const labels: Record<string, string> = {}
      const re = /([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/g
      let m
      while ((m = re.exec(labelsRaw)) !== null) labels[m[1]] = m[2]
      if (!labelFilter(labels)) continue
    }
    const val = Number(match[3])
    if (Number.isFinite(val)) { total += val; found = true }
  }
  return found ? total : null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authorization header missing' }, 401)
    const token = authHeader.replace('Bearer ', '')

    // service_role 또는 admin 사용자만
    let isServiceRole = token === serviceKey
    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
      const { data: userRes, error } = await userClient.auth.getUser(token)
      if (error || !userRes.user) return json({ error: 'invalid auth' }, 401)
      const { data: prof } = await userClient.from('profiles').select('role').eq('id', userRes.user.id).maybeSingle()
      if ((prof as { role?: string } | null)?.role !== 'admin') return json({ error: 'admin only' }, 403)
    }

    // Prometheus metrics endpoint
    // https://<ref>.supabase.co/customer/v1/privileged/metrics
    const metricsUrl = `${supabaseUrl}/customer/v1/privileged/metrics`
    const basicAuth = btoa(`service_role:${serviceKey}`)
    const res = await fetch(metricsUrl, {
      headers: { 'Authorization': `Basic ${basicAuth}` },
    })

    if (res.status === 401 || res.status === 403) {
      return json({
        status: 'unsupported',
        reason: 'Pro 플랜 이상에서만 메트릭 endpoint 가 활성화됩니다 (현재 인증 거부).',
        http_status: res.status,
      })
    }
    if (res.status === 404) {
      return json({
        status: 'unsupported',
        reason: '메트릭 endpoint 가 활성화되어 있지 않습니다.',
        http_status: 404,
      })
    }
    if (!res.ok) {
      return json({
        status: 'unsupported',
        reason: `메트릭 endpoint 응답 오류 (HTTP ${res.status}).`,
        http_status: res.status,
      })
    }

    const text = await res.text()

    // CPU — node_cpu_seconds_total{mode="idle"} / node_cpu_seconds_total (전체)
    // Prometheus 의 cumulative counter 라 단일 시점 값으로는 사용률 못 구한다.
    // 대신 supabase 가 제공할 가능성 있는 직접 게이지를 우선 시도.
    const cpuPct =
      parseMetric(text, 'supabase_cpu_usage_percent') ??
      parseMetric(text, 'node_load1') // fallback: 1분 load average (코어수와 비교 필요)

    // 메모리
    const memTotal = parseMetric(text, 'node_memory_MemTotal_bytes')
    const memAvailable = parseMetric(text, 'node_memory_MemAvailable_bytes')
    const memUsed = (memTotal != null && memAvailable != null) ? memTotal - memAvailable : null
    const memPct = (memUsed != null && memTotal && memTotal > 0) ? (memUsed / memTotal) * 100 : null

    // 디스크 — / 또는 /var/lib/postgresql 마운트 우선
    const diskFilter = (labels: Record<string, string>) => {
      const m = labels.mountpoint || ''
      return m === '/' || m.includes('postgres')
    }
    const diskTotal = parseMetric(text, 'node_filesystem_size_bytes', diskFilter)
    const diskAvail = parseMetric(text, 'node_filesystem_avail_bytes', diskFilter)
    const diskUsed = (diskTotal != null && diskAvail != null) ? diskTotal - diskAvail : null
    const diskPct = (diskUsed != null && diskTotal && diskTotal > 0) ? (diskUsed / diskTotal) * 100 : null

    // CPU 보강: idle 비율로 사용률 계산 (counter 라 한 번의 호출로는 부정확하지만 누적 비율의 근사치)
    const cpuIdleSum = sumMetric(text, 'node_cpu_seconds_total', (l) => l.mode === 'idle')
    const cpuTotalSum = sumMetric(text, 'node_cpu_seconds_total')
    const cpuPctFromCounters = (cpuIdleSum != null && cpuTotalSum != null && cpuTotalSum > 0)
      ? (1 - cpuIdleSum / cpuTotalSum) * 100
      : null

    return json({
      status: 'ok',
      fetched_at: new Date().toISOString(),
      cpu: {
        used_pct: cpuPct ?? cpuPctFromCounters,
        approximation: cpuPct == null && cpuPctFromCounters != null,
      },
      memory: {
        used_pct: memPct,
        used_bytes: memUsed,
        total_bytes: memTotal,
      },
      disk: {
        used_pct: diskPct,
        used_bytes: diskUsed,
        total_bytes: diskTotal,
      },
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
