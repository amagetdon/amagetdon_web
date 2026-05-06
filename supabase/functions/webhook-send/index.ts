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
  // 한글 변수명(예: {#이름#}, {#강의명#})도 지원하도록 \w 대신 [^#\s] 사용
  return template.replace(/\{#([^#\s]+)#\}/g, (_, k) => String(data[k] ?? ''))
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
      custom_event_code = null,
      scope = 'global',
      scope_id = null,
      user_id = null,
      related_type = null,
      related_id = null,
      payload = {},
      utm = {},
      context = {},
      config_override = null,
      custom_template_override = null,
      test_mode = false,
    } = body as {
      event: string
      custom_event_code?: string | null
      scope?: string
      scope_id?: number | null
      user_id?: string | null
      related_type?: string | null
      related_id?: number | null
      payload?: Payload
      utm?: Record<string, string | null>
      context?: { ip?: string; user_agent?: string; referrer?: string; device_type?: string; submission_duration_ms?: number }
      config_override?: WebhookConfigRow | null
      custom_template_override?: string | null
      test_mode?: boolean
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // 인증 — 일반 호출은 인증 없이 통과 (이벤트 발생 시점이 세션 유무와 무관할 수 있음).
    // test_mode 만 admin / service_role 만 호출 가능하도록 제한.
    const authHeader = req.headers.get('Authorization')
    const token = authHeader ? authHeader.replace('Bearer ', '') : ''

    let isServiceRole = !!token && token === serviceKey
    let user: { id: string } | null = null

    if (test_mode) {
      if (!isServiceRole) {
        // legacy service_role JWT 대응 — auth/v1/admin/users 호출로 service_role 여부 판정
        try {
          const probeRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
            headers: { 'Authorization': `Bearer ${token}`, 'apikey': token },
          })
          if (probeRes.ok) isServiceRole = true
        } catch { /* ignore */ }
      }
      if (!isServiceRole) {
        // 사용자 JWT 검증 후 admin 인지 확인
        try {
          const userClient = createClient(supabaseUrl, anonKey)
          const { data, error } = await userClient.auth.getUser(token)
          if (error || !data.user) {
            return new Response(JSON.stringify({ error: 'Test mode requires admin login' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          user = data.user
        } catch (authErr) {
          return new Response(JSON.stringify({ error: 'Auth error: ' + (authErr instanceof Error ? authErr.message : String(authErr)) }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const userClient2 = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        })
        const { data: prof, error: profErr } = await userClient2.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if (profErr) {
          return new Response(JSON.stringify({ error: `Profile check failed: ${profErr.message}` }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        if ((prof as { role?: string } | null)?.role !== 'admin') {
          return new Response(JSON.stringify({ error: `Admin only (current role: ${(prof as { role?: string } | null)?.role ?? 'none'})` }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // 본체에서 사용할 DB 클라이언트: service_role 인증된 경우 해당 토큰, 아니면 env serviceKey
    const supabase = createClient(supabaseUrl, isServiceRole ? token : serviceKey)

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

    // 템플릿 유무로 자동 판단
    // - signup/purchase: 기본 템플릿 필수
    // - refund/cancel: 기본 템플릿 슬롯이 없음 → custom event 로만 지원. 여기서는 skip
    // - custom: 아래 webhook_custom_events 조회 + enabled 체크로 별도 처리
    const builtInEvent = event === 'signup' || event === 'purchase'
    const templateForCheck = event === 'signup' ? config?.signup_template
      : event === 'purchase' ? config?.purchase_template
      : null
    const templateEmpty = builtInEvent
      ? !templateForCheck?.trim()
      : event !== 'custom' // refund/cancel 등 built-in도 custom도 아닌 이벤트는 기본 발송 차단

    if (!config || !config.enabled || !config.url || templateEmpty) {
      const reason = !config ? 'no config' : !config.enabled ? 'disabled' : !config.url ? 'no url'
        : builtInEvent ? 'template empty'
        : `event "${event}" has no built-in template — use a custom event instead`
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

    // 템플릿 + alias 결정
    let template = ''
    let aliases: Record<string, string> = {}
    if (event === 'custom' && custom_event_code) {
      // 커스텀 이벤트: override(scope별) → 전역 기본값(webhook_custom_events) 순으로 조회
      template = custom_template_override ?? ''

      // 1) scope + scope_id override 먼저 조회
      if (!template && scope !== 'global' && scope_id != null) {
        const { data: ov } = await supabase
          .from('webhook_custom_event_overrides')
          .select('template, enabled, variable_aliases')
          .eq('event_code', custom_event_code)
          .eq('scope', scope)
          .eq('scope_id', scope_id)
          .maybeSingle()
        const ovRow = ov as { template?: string; enabled?: boolean; variable_aliases?: Record<string, string> } | null
        if (ovRow?.enabled && ovRow.template?.trim()) {
          template = ovRow.template
          aliases = ovRow.variable_aliases ?? {}
        }
      }

      // 2) override 없으면 전역 기본값
      if (!template) {
        const { data: ce } = await supabase
          .from('webhook_custom_events')
          .select('template, enabled, variable_aliases')
          .eq('code', custom_event_code)
          .maybeSingle()
        const ceRow = ce as { template?: string; enabled?: boolean; variable_aliases?: Record<string, string> } | null
        if (!ceRow || !ceRow.enabled || !ceRow.template?.trim()) {
          const reason = !ceRow ? `custom event "${custom_event_code}" not defined`
            : !ceRow.enabled ? `custom event "${custom_event_code}" disabled`
            : `custom event "${custom_event_code}" template empty`
          if (!test_mode && logId) {
            await supabase.from('webhook_logs').update({
              send_status: 'skipped',
              error_message: reason,
            } as never).eq('id', logId)
          }
          return new Response(JSON.stringify({ status: 'skipped', reason }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        template = ceRow.template ?? ''
        aliases = ceRow.variable_aliases ?? {}
      }
    } else {
      template = event === 'signup' ? config.signup_template
        : event === 'purchase' ? config.purchase_template
        : ''
      // signup/purchase alias는 webhook_configs row에서 읽기
      const cfgFull = config as unknown as { signup_variable_aliases?: Record<string, string>; purchase_variable_aliases?: Record<string, string> }
      aliases = (event === 'signup' ? cfgFull.signup_variable_aliases
        : event === 'purchase' ? cfgFull.purchase_variable_aliases
        : {}) ?? {}
    }

    // 사용자 정의 canonical 변수 주입 (open_chat_url 등)
    try {
      const { data: customVars, error: cvErr } = await supabase.from('custom_canonical_vars').select('key, value')
      console.log('[webhook-send] custom_canonical_vars result', { count: customVars?.length ?? null, error: cvErr?.message ?? null })
      for (const cv of ((customVars as Array<{ key: string; value: string }> | null) ?? [])) {
        if ((payload as Payload)[cv.key] === undefined || (payload as Payload)[cv.key] === '') {
          ;(payload as Payload)[cv.key] = cv.value
        }
      }
      console.log('[webhook-send] payload after canonical inject', {
        open_chat_url: (payload as Payload).open_chat_url,
        user_name: (payload as Payload).user_name,
        강의날짜: (payload as Payload).강의날짜,
      })
    } catch (e) {
      console.error('[webhook-send] custom_canonical_vars exception', e)
    }

    // variable_aliases 오버레이 — 사전 매핑된 임의 변수명을 canonical 값으로 주입
    for (const [alias, canonical] of Object.entries(aliases)) {
      if ((payload as Payload)[canonical] !== undefined && (payload as Payload)[alias] === undefined) {
        ;(payload as Payload)[alias] = (payload as Payload)[canonical]
      }
    }

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
