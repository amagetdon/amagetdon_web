import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface WebhookConfigRow {
  id: number
  scope: string
  scope_id: number | null
  enabled: boolean
  url: string
  method: 'POST' | 'GET'
  use_json_header: boolean
  header_data: string
  headers: Record<string, string>
  events: { signup?: boolean; purchase?: boolean }
  signup_template: string
  purchase_template: string
}

type Payload = Record<string, unknown>

function resolveTemplate(template: string, data: Payload): string {
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

function detectDeviceType(ua?: string): 'pc' | 'mobile' {
  if (!ua) return 'pc'
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) ? 'mobile' : 'pc'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const {
      event,
      scope = 'global',
      scope_id = null,
      user_id = null,
      related_type = null,
      related_id = null,
      payload = {},
      utm = {},
      context = {},
      config_override = null,
      test_mode = false,
    } = body as {
      event: string
      scope?: string
      scope_id?: number | null
      user_id?: string | null
      related_type?: string | null
      related_id?: number | null
      payload?: Payload
      utm?: Record<string, string | null>
      context?: { ip?: string; user_agent?: string; referrer?: string; device_type?: string; submission_duration_ms?: number }
      config_override?: WebhookConfigRow | null
      test_mode?: boolean
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // 인증 확인 (test_mode인 경우 admin만 허용)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (test_mode) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if ((prof as { role?: string } | null)?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Admin only' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // IP는 서버 측에서 더 정확하게 추출
    const ip = context.ip
      || req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('cf-connecting-ip')
      || null
    const ua = context.user_agent || req.headers.get('user-agent') || null
    const deviceType = context.device_type || detectDeviceType(ua || undefined)

    // config 결정
    let config: WebhookConfigRow | null = config_override
    if (!config) {
      const loadConfig = async (s: string, sId: number | null) => {
        let q = supabase.from('webhook_configs').select('*').eq('scope', s)
        q = sId == null ? q.is('scope_id', null) : q.eq('scope_id', sId)
        const { data } = await q.maybeSingle()
        return data as WebhookConfigRow | null
      }
      if (scope !== 'global') {
        const scoped = await loadConfig(scope, scope_id)
        if (scoped && scoped.enabled) config = scoped
      }
      if (!config) config = await loadConfig('global', null)
    }

    // 로그 row 베이스
    const logRow: Record<string, unknown> = {
      event_type: event,
      config_id: config?.id ?? null,
      config_scope: config?.scope ?? null,
      config_scope_id: config?.scope_id ?? null,
      user_id,
      related_type,
      related_id,
      display_name: payload.name ?? payload.user_name ?? null,
      display_phone: payload.phone ?? payload.user_phone ?? null,
      display_email: payload.email ?? payload.user_email ?? null,
      display_title: payload.title ?? null,
      ip,
      user_agent: ua,
      referrer: context.referrer ?? null,
      device_type: deviceType,
      submission_duration_ms: context.submission_duration_ms ?? null,
      utm_source: utm.source ?? null,
      utm_medium: utm.medium ?? null,
      utm_campaign: utm.campaign ?? null,
      utm_content: utm.content ?? null,
      utm_term: utm.term ?? null,
      payload,
    }

    // config 비활성/누락 시 skipped 로그만 남김
    const eventEnabled = (event === 'signup' || event === 'purchase') ? !!config?.events?.[event] : true
    if (!config || !config.enabled || !config.url || !eventEnabled) {
      const reason = !config ? 'no config' : !config.enabled ? 'disabled' : !config.url ? 'no url' : 'event disabled'
      logRow.send_status = 'skipped'
      logRow.error_message = reason
      const { data: skipped } = test_mode
        ? { data: null }
        : await supabase.from('webhook_logs').insert(logRow as never).select('id').maybeSingle()
      return new Response(JSON.stringify({ status: 'skipped', reason, log_id: (skipped as { id?: number } | null)?.id ?? null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 로그 먼저 insert (DBNO 확보)
    let logId: number | null = null
    if (!test_mode) {
      const { data: inserted } = await supabase.from('webhook_logs').insert(logRow as never).select('id').maybeSingle()
      logId = (inserted as { id?: number } | null)?.id ?? null
      if (logId) {
        ;(payload as Payload).DBNO = logId
        await supabase.from('webhook_logs').update({ payload } as never).eq('id', logId)
      }
    } else {
      ;(payload as Payload).DBNO = 999999
    }

    // 템플릿 치환
    const template = event === 'signup' ? config.signup_template : config.purchase_template
    let outBody: Payload | string = payload
    if (template) {
      const resolved = resolveTemplate(template, payload)
      const trimmed = resolved.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try { outBody = JSON.parse(trimmed) } catch { outBody = resolved }
      } else if (config.use_json_header && resolved.includes('=')) {
        // application/json 모드 + key=value 형식 → 객체로 변환 후 JSON 직렬화 대상으로
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

    // 헤더 구성
    const reqHeaders: Record<string, string> = {
      ...(config.use_json_header ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/x-www-form-urlencoded' }),
      ...config.headers,
      ...parseHeaderData(config.header_data),
    }

    let url = config.url
    let bodyStr = ''
    if (config.method === 'POST') {
      if (typeof outBody === 'string') {
        bodyStr = outBody
      } else if (config.use_json_header) {
        bodyStr = JSON.stringify(outBody)
      } else {
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

    // 실제 발송 (서버 사이드 → CORS·Content-Type 제약 없음)
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

    // 로그 업데이트 (test_mode가 아닐 때만)
    if (!test_mode && logId) {
      await supabase.from('webhook_logs').update(result as never).eq('id', logId)
    }

    return new Response(JSON.stringify({
      status: result.send_status,
      log_id: logId,
      response_status: result.response_status,
      response_body: result.response_body,
      request_url: result.request_url,
      request_body: result.request_body,
      error_message: result.error_message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
