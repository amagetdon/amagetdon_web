import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyToken } from '../_shared/auth.ts'

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
        const verified = await verifyToken(token, supabaseUrl, anonKey, serviceKey)
        if (!verified) {
          return new Response(JSON.stringify({ error: 'Test mode requires admin login' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        user = { id: verified.user!.id }

        const adminClient = createClient(supabaseUrl, serviceKey)
        const { data: prof, error: profErr } = await adminClient.from('profiles').select('role').eq('id', user.id).maybeSingle()
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
      // custom event 의 경우 어떤 코드인지도 같이 저장해야 재전송 시 동일한 템플릿을 다시 적용할 수 있다.
      custom_event_code: event === 'custom' ? custom_event_code : null,
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

    // scope='course' 인 경우 강의별로 미리 정의된 변수(courses.webhook_variables)·강사 정보·강의일시를 payload 에 머지.
    // 호출자가 같은 키를 이미 채워 보냈으면 그쪽이 우선 — 자동 주입은 빈 슬롯만 채운다.
    if (scope === 'course' && scope_id != null) {
      const { data: courseRow } = await supabase
        .from('courses')
        .select('title, scheduled_at, enrollment_start, enrollment_deadline, webhook_variables, instructor:instructors(name, title, image_url, thumbnail_url)')
        .eq('id', scope_id)
        .maybeSingle()
      const cr = courseRow as {
        title?: string
        scheduled_at?: string | null
        enrollment_start?: string | null
        enrollment_deadline?: string | null
        webhook_variables?: Record<string, unknown>
        instructor?: { name?: string; title?: string; image_url?: string; thumbnail_url?: string } | null
      } | null
      const p = payload as Payload
      const setIfEmpty = (k: string, v: string | undefined | null) => {
        if (!v) return
        if (p[k] === undefined || p[k] === '' || p[k] === null) p[k] = v
      }
      // 1) 강사 정보 자동 주입
      const ins = cr?.instructor ?? null
      if (ins) {
        for (const k of ['강사명', 'instructor_name']) setIfEmpty(k, ins.name)
        for (const k of ['강사직책', 'instructor_title']) setIfEmpty(k, ins.title)
        for (const k of ['강사이미지', 'instructor_image']) setIfEmpty(k, ins.image_url || ins.thumbnail_url || '')
      }
      // 2) 강의 제목
      if (cr?.title) {
        for (const k of ['title', 'TITLE', '강의명', '강의제목', '상품명', '수업명', '모임명', '서비스명', '클래스명']) {
          setIfEmpty(k, cr.title)
        }
      }
      // 3) 강의일시 — payload 에 scheduled_at 가 없으면 강의 컬럼에서 가져와 한글/영문 시간 alias 채움.
      // scheduled_at 없으면 enrollment_start → enrollment_deadline 폴백.
      const fmtKst = (iso: string | null | undefined): { date: string; time: string; datetime: string } => {
        if (!iso) return { date: '', time: '', datetime: '' }
        const d = new Date(iso)
        if (Number.isNaN(d.getTime())) return { date: '', time: '', datetime: '' }
        const date = d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }).replace(/\. /g, '.').replace(/\.$/, '')
        const time = d.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
        return { date, time, datetime: `${date} ${time}` }
      }
      const schedIso = (p.scheduled_at as string | null | undefined) || cr?.scheduled_at || cr?.enrollment_start || cr?.enrollment_deadline || null
      if (schedIso) {
        if (!p.scheduled_at) p.scheduled_at = schedIso
        const f = fmtKst(schedIso)
        for (const k of ['강의날짜', '수업날짜', '예정일', 'SCHEDULED_DATE', 'scheduled_date']) setIfEmpty(k, f.date)
        for (const k of ['강의시간', '수업시간', '예정시간', 'SCHEDULED_TIME', 'scheduled_time']) setIfEmpty(k, f.time)
        for (const k of ['강의일시', '수업일시', '예정일시', '일시', 'SCHEDULED_DATETIME', 'scheduled_datetime']) setIfEmpty(k, f.datetime)
      }
      const enrStart = fmtKst(cr?.enrollment_start ?? null)
      if (enrStart.datetime) {
        setIfEmpty('오픈일시', enrStart.datetime); setIfEmpty('오픈날짜', enrStart.date); setIfEmpty('오픈시간', enrStart.time)
        setIfEmpty('ENROLLMENT_START', enrStart.datetime); setIfEmpty('ENROLLMENT_START_DATE', enrStart.date); setIfEmpty('ENROLLMENT_START_TIME', enrStart.time)
        setIfEmpty('enrollment_start_datetime', enrStart.datetime)
      }
      const enrDl = fmtKst(cr?.enrollment_deadline ?? null)
      if (enrDl.datetime) {
        setIfEmpty('마감일시', enrDl.datetime); setIfEmpty('마감일', enrDl.date); setIfEmpty('마감시간', enrDl.time)
        setIfEmpty('ENROLLMENT_DEADLINE', enrDl.datetime); setIfEmpty('ENROLLMENT_DEADLINE_DATE', enrDl.date); setIfEmpty('ENROLLMENT_DEADLINE_TIME', enrDl.time)
        setIfEmpty('enrollment_deadline_datetime', enrDl.datetime)
      }
      // 4) 강의별 사용자 정의 변수
      const courseVars = (cr?.webhook_variables ?? {}) as Record<string, unknown>
      for (const [k, v] of Object.entries(courseVars)) {
        if (p[k] === undefined || p[k] === '' || p[k] === null) p[k] = v as string
      }
    }

    // payload alias 정규화 — 어떤 클라이언트가 보냈든 영문/한글 표준 키들이 함께 채워지도록.
    // 예: { name: '홍길동' } 만 와도 user_name/customer_name/이름/고객명 등이 자동 채워짐.
    {
      const p = payload as Payload
      const pickStr = (...keys: string[]): string => {
        for (const k of keys) {
          const v = p[k]
          if (typeof v === 'string' && v.trim()) return v
        }
        return ''
      }
      const n = pickStr('name', 'user_name', 'customer_name', '이름', '고객명', '회원명', '성함')
      const ph = pickStr('phone', 'user_phone', '연락처', '전화번호', '핸드폰번호')
      const em = pickStr('email', 'user_email', '이메일')
      const tt = pickStr('title', 'TITLE', '강의명', '강의제목', '상품명', '수업명', '모임명', '모임', '서비스명', '클래스명')
      const setIfEmpty = (k: string, v: string) => {
        if (!v) return
        if (p[k] === undefined || p[k] === '' || p[k] === null) p[k] = v
      }
      for (const k of ['name', 'user_name', 'customer_name', '이름', '고객명', '회원명', '성함']) setIfEmpty(k, n)
      for (const k of ['phone', 'user_phone', '연락처', '전화번호', '핸드폰번호']) setIfEmpty(k, ph)
      // ITEM1/ITEM2 alias 도 함께 (shoong 등 외부 서비스가 쓰는 표준 키)
      setIfEmpty('ITEM1', n)
      setIfEmpty('ITEM2', ph)
      if (ph) setIfEmpty('ITEM2_NOH', ph.replace(/-/g, ''))
      for (const k of ['email', 'user_email', '이메일']) setIfEmpty(k, em)
      for (const k of ['title', 'TITLE', '강의명', '강의제목', '상품명', '수업명', '모임명', '모임', '서비스명', '클래스명']) setIfEmpty(k, tt)
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
