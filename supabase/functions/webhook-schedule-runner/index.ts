// 도래한 webhook_schedule_runs 처리 — pg_cron이 매분 호출
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface RunRow {
  id: number
  webhook_schedule_id: number
  user_id: string | null
  user_name: string | null
  user_phone: string | null
  user_email: string | null
  course_title: string | null
  course_scheduled_at: string | null
  fire_at: string
  attempt_count: number
}

interface ScheduleRow {
  id: number
  scope: 'course' | 'ebook'
  scope_id: number
  label: string
  request_template: string
  enabled: boolean
}

interface ConfigRow {
  id: number
  scope: string
  scope_id: number | null
  enabled: boolean
  url: string
  method: 'POST' | 'GET'
  use_json_header: boolean
  header_data: string
  headers: Record<string, string>
}

function resolveTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{#(\w+)#\}/g, (_, k) => String(data[k] ?? ''))
}

function parseHeaderData(h: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!h) return out
  for (const part of h.split('&')) {
    const [k, ...v] = part.split('=')
    if (k.trim()) out[k.trim()] = v.join('=').trim()
  }
  return out
}

const MAX_PER_RUN = 50

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 보안: pg_cron이 service role key로 호출하거나, 어드민 사용자만 호출 가능
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    if (token !== serviceKey) {
      // 어드민 사용자라면 허용
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '')
      const { data: { user } } = await userClient.auth.getUser(token)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid auth' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const adminCheck = createClient(supabaseUrl, serviceKey)
      const { data: prof } = await adminCheck.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if ((prof as { role?: string } | null)?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Admin only' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // 1) 도래한 미발송 후보 ID 조회 (최대 50건/분)
    const { data: candidates } = await supabase
      .from('webhook_schedule_runs')
      .select('id')
      .eq('status', 'pending')
      .is('fired_at', null)
      .lte('fire_at', new Date().toISOString())
      .order('fire_at', { ascending: true })
      .limit(MAX_PER_RUN)
    const candidateIds = ((candidates as Array<{ id: number }> | null) ?? []).map((c) => c.id)
    if (candidateIds.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2) 원자적 claim — 다른 cron 호출과의 race 방지
    const { data: claimed } = await supabase
      .from('webhook_schedule_runs')
      .update({ status: 'processing' })
      .in('id', candidateIds)
      .eq('status', 'pending')
      .select('*')

    const runList = (claimed as RunRow[] | null) ?? []
    if (runList.length === 0) {
      return new Response(JSON.stringify({ processed: 0, note: 'all candidates were claimed by another invocation' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (runList.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 스케줄/config 캐시
    const scheduleCache = new Map<number, ScheduleRow>()
    const configCache = new Map<string, ConfigRow | null>()

    const getSchedule = async (id: number): Promise<ScheduleRow | null> => {
      if (scheduleCache.has(id)) return scheduleCache.get(id)!
      const { data } = await supabase.from('webhook_schedules').select('*').eq('id', id).maybeSingle()
      const row = (data as ScheduleRow | null)
      if (row) scheduleCache.set(id, row)
      return row
    }

    const loadConfig = async (scope: string, scopeId: number | null): Promise<ConfigRow | null> => {
      let q = supabase.from('webhook_configs').select('*').eq('scope', scope)
      q = scopeId == null ? q.is('scope_id', null) : q.eq('scope_id', scopeId)
      const { data } = await q.maybeSingle()
      return (data as ConfigRow | null)
    }
    const getConfig = async (scope: string, scopeId: number | null): Promise<ConfigRow | null> => {
      const key = `${scope}:${scopeId ?? ''}`
      if (configCache.has(key)) return configCache.get(key) ?? null
      let cfg: ConfigRow | null = null
      if (scope !== 'global') {
        const scoped = await loadConfig(scope, scopeId)
        if (scoped && scoped.enabled) cfg = scoped
      }
      if (!cfg) cfg = await loadConfig('global', null)
      configCache.set(key, cfg)
      return cfg
    }

    let processed = 0
    let succeeded = 0
    let failed = 0

    for (const run of runList) {
      processed++
      const sched = await getSchedule(run.webhook_schedule_id)
      if (!sched || !sched.enabled) {
        await supabase.from('webhook_schedule_runs').update({
          status: 'skipped',
          fired_at: new Date().toISOString(),
          error_message: !sched ? 'schedule deleted' : 'schedule disabled',
        } as never).eq('id', run.id)
        continue
      }

      const config = await getConfig(sched.scope, sched.scope_id)
      if (!config || !config.enabled || !config.url) {
        await supabase.from('webhook_schedule_runs').update({
          status: 'skipped',
          fired_at: new Date().toISOString(),
          error_message: !config ? 'no config' : !config.enabled ? 'config disabled' : 'no url',
        } as never).eq('id', run.id)
        continue
      }

      // payload 빌드 (스냅샷 + 강의 일정 정보)
      const scheduledAt = run.course_scheduled_at ? new Date(run.course_scheduled_at) : null
      const fmt = (d: Date | null, opts: Intl.DateTimeFormatOptions) =>
        d ? d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', ...opts }) : ''

      const phone = run.user_phone ?? ''
      const data: Record<string, unknown> = {
        TITLE: run.course_title ?? '',
        ITEM1: run.user_name ?? '',
        ITEM2: phone,
        ITEM2_NOH: phone.replace(/-/g, ''),
        DATE: fmt(scheduledAt, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, ''),
        TIME: fmt(scheduledAt, { hour: '2-digit', minute: '2-digit', hour12: false }),
        TIMES: fmt(scheduledAt, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        SCHEDULED_AT: run.course_scheduled_at ?? '',
        DBNO: run.id,
        // 사용자 정보 (양쪽 표기 지원)
        name: run.user_name ?? '',
        user_name: run.user_name ?? '',
        phone,
        user_phone: phone,
        email: run.user_email ?? '',
        user_email: run.user_email ?? '',
        title: run.course_title ?? '',
      }

      // 템플릿 치환 + body 빌드
      const template = sched.request_template || ''
      let outBody: Record<string, unknown> | string = data
      if (template) {
        const resolved = resolveTemplate(template, data)
        const trimmed = resolved.trim()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try { outBody = JSON.parse(trimmed) } catch { outBody = resolved }
        } else if (config.use_json_header && resolved.includes('=')) {
          const obj: Record<string, string> = {}
          for (const part of resolved.replace(/^&+/, '').split('&')) {
            const [k, ...v] = part.split('=')
            if (k.trim()) obj[k.trim()] = v.join('=').trim()
          }
          outBody = obj
        } else {
          outBody = resolved
        }
      }

      const reqHeaders: Record<string, string> = {
        ...(config.use_json_header ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/x-www-form-urlencoded' }),
        ...config.headers,
        ...parseHeaderData(config.header_data),
      }

      let url = config.url
      let bodyStr = ''
      if (config.method === 'POST') {
        if (typeof outBody === 'string') bodyStr = outBody
        else if (config.use_json_header) bodyStr = JSON.stringify(outBody)
        else {
          const params = new URLSearchParams()
          for (const [k, v] of Object.entries(outBody)) params.set(k, String(v ?? ''))
          bodyStr = params.toString()
        }
      } else {
        if (typeof outBody === 'string') {
          url = `${url}${url.includes('?') ? '&' : '?'}${outBody.replace(/^&+/, '')}`
        } else {
          const params = new URLSearchParams()
          for (const [k, v] of Object.entries(outBody)) params.set(k, String(v ?? ''))
          url = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`
        }
      }

      // 발송
      let result: Record<string, unknown>
      try {
        const res = await fetch(url, {
          method: config.method,
          headers: reqHeaders,
          body: config.method === 'POST' ? bodyStr : undefined,
        })
        const text = await res.text().catch(() => '')
        result = {
          request_url: url,
          request_method: config.method,
          request_headers: reqHeaders,
          request_body: bodyStr,
          response_status: res.status,
          response_body: text,
          send_status: res.ok ? 'success' : 'failed',
          error_message: res.ok ? null : `HTTP ${res.status}`,
        }
      } catch (err) {
        result = {
          request_url: url,
          request_method: config.method,
          request_headers: reqHeaders,
          request_body: bodyStr,
          response_status: null,
          response_body: '',
          send_status: 'failed',
          error_message: err instanceof Error ? err.message : String(err),
        }
      }

      // webhook_logs에도 기록 (디비내역에서 확인 가능하게)
      const logRow: Record<string, unknown> = {
        event_type: 'purchase',  // 구매 후속 알림이므로 purchase 카테고리
        config_id: config.id,
        config_scope: config.scope,
        config_scope_id: config.scope_id,
        user_id: run.user_id,
        related_type: 'webhook_schedule_run',
        related_id: run.id,
        display_name: run.user_name,
        display_phone: phone,
        display_email: run.user_email,
        display_title: `${run.course_title ?? ''} (${sched.label})`,
        payload: data,
        ...result,
      }
      const { data: logInserted } = await supabase.from('webhook_logs').insert(logRow as never).select('id').maybeSingle()
      const logId = (logInserted as { id?: number } | null)?.id ?? null

      // run 상태 업데이트
      const success = result.send_status === 'success'
      if (success) succeeded++; else failed++

      await supabase.from('webhook_schedule_runs').update({
        status: success ? 'success' : 'failed',
        fired_at: new Date().toISOString(),
        webhook_log_id: logId,
        error_message: result.error_message ?? null,
        attempt_count: (run.attempt_count ?? 0) + 1,
      } as never).eq('id', run.id)
    }

    return new Response(JSON.stringify({ processed, succeeded, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
