import { supabase } from '../lib/supabase'

export type WebhookScope = 'global' | 'course' | 'ebook'
export type WebhookEvent = 'signup' | 'purchase' | 'refund' | 'cancel' | 'custom'

export interface WebhookConfig {
  id?: number
  scope: WebhookScope
  scope_id: number | null
  enabled: boolean
  url: string
  method: 'POST' | 'GET'
  use_json_header: boolean
  header_data: string
  headers: Record<string, string>
  events: {
    signup: boolean
    purchase: boolean
  }
  use_template: boolean
  signup_template: string
  purchase_template: string
  label: string
}

export const defaultWebhookConfig: WebhookConfig = {
  scope: 'global',
  scope_id: null,
  enabled: true,
  url: '',
  method: 'POST',
  use_json_header: true,
  header_data: '',
  headers: {},
  events: { signup: true, purchase: true },
  use_template: true,
  signup_template: '',
  purchase_template: '',
  label: '',
}

export interface WebhookContext {
  ip?: string
  user_agent?: string
  referrer?: string
  device_type?: string
  submission_duration_ms?: number
}

export interface FireOptions {
  scope?: WebhookScope
  scopeId?: number | null
  userId?: string | null
  relatedType?: string
  relatedId?: number | null
  displayName?: string
  displayPhone?: string
  displayEmail?: string
  displayTitle?: string
  utm?: {
    source?: string | null
    medium?: string | null
    campaign?: string | null
    content?: string | null
    term?: string | null
  }
  context?: WebhookContext
}

async function loadConfig(scope: WebhookScope, scopeId: number | null): Promise<WebhookConfig | null> {
  let query = supabase.from('webhook_configs').select('*').eq('scope', scope)
  query = scopeId == null ? query.is('scope_id', null) : query.eq('scope_id', scopeId)
  const { data } = await query.maybeSingle()
  return data as WebhookConfig | null
}

function buildDataDict(event: WebhookEvent, options: FireOptions, extras: Record<string, unknown>): Record<string, unknown> {
  const now = new Date()
  const ctx = options.context || {}
  const utm = options.utm || {}
  const name = options.displayName || (extras.name as string) || ''
  const phone = options.displayPhone || (extras.phone as string) || ''
  const email = options.displayEmail || (extras.email as string) || ''
  const title = options.displayTitle || (extras.title as string) || ''

  // 일시 포매팅 유틸 — ISO 문자열을 ko-KR date/time/datetime 3종으로 변환
  const fmtDt = (raw: string | null | undefined): { date: string; time: string; datetime: string } => {
    if (!raw) return { date: '', time: '', datetime: '' }
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return { date: '', time: '', datetime: '' }
    const date = d.toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '')
    const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    return { date, time, datetime: `${date} ${time}` }
  }

  // 강의 일시(scheduled_at) 다형 포맷 — schedules 또는 그 폴백 값
  const { date: schedDate, time: schedTime, datetime: schedDatetime } = fmtDt(extras.scheduled_at as string | null | undefined)
  // 강의 오픈일시/마감일시 (courses.enrollment_start / enrollment_deadline)
  const enrStart = fmtDt(extras.enrollment_start as string | null | undefined)
  const enrDeadline = fmtDt(extras.enrollment_deadline as string | null | undefined)

  return {
    event,
    ...extras,
    // 이름/연락처
    name,
    phone,
    email,
    title,
    // 별칭 (디비카트 스타일)
    TITLE: title,
    ITEM1: name,
    ITEM2: phone,
    ITEM2_NOH: String(phone).replace(/-/g, ''),
    // 시간
    DATE: now.toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, ''),
    TIME: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    TIMES: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    date: now.toLocaleDateString('ko-KR'),
    time: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    timestamp: now.toISOString(),
    // 수업 진행 일시 (schedules.scheduled_at 기준; 없으면 오픈일시 폴백)
    SCHEDULED_DATE: schedDate,
    SCHEDULED_TIME: schedTime,
    SCHEDULED_DATETIME: schedDatetime,
    scheduled_date: schedDate,
    scheduled_time: schedTime,
    scheduled_datetime: schedDatetime,
    // 강의 오픈일시 (courses.enrollment_start)
    ENROLLMENT_START: enrStart.datetime,
    ENROLLMENT_START_DATE: enrStart.date,
    ENROLLMENT_START_TIME: enrStart.time,
    enrollment_start_datetime: enrStart.datetime,
    오픈일시: enrStart.datetime,
    오픈날짜: enrStart.date,
    오픈시간: enrStart.time,
    // 강의 마감일시 (courses.enrollment_deadline)
    ENROLLMENT_DEADLINE: enrDeadline.datetime,
    ENROLLMENT_DEADLINE_DATE: enrDeadline.date,
    ENROLLMENT_DEADLINE_TIME: enrDeadline.time,
    enrollment_deadline_datetime: enrDeadline.datetime,
    마감일시: enrDeadline.datetime,
    마감일: enrDeadline.date,
    마감시간: enrDeadline.time,
    // 수업 진행 한글 alias
    강의날짜: schedDate,
    강의시간: schedTime,
    강의일시: schedDatetime,
    수업날짜: schedDate,
    수업시간: schedTime,
    수업일시: schedDatetime,
    예정일: schedDate,
    예정시간: schedTime,
    예정일시: schedDatetime,
    일시: schedDatetime,
    // 한글 변수명 별칭 (shoong 알림톡 템플릿에서 자주 쓰이는 이름들)
    이름: name,
    고객명: name,
    회원명: name,
    성함: name,
    연락처: phone,
    전화번호: phone,
    핸드폰번호: phone,
    이메일: email,
    강의명: title,
    강의제목: title,
    모임명: title,
    모임: title,
    수업명: title,
    상품명: title,
    서비스명: title,
    클래스명: title,
    // 컨텍스트
    IP: ctx.ip || '',
    AGENT: ctx.user_agent || '',
    MOBILE: ctx.device_type === 'mobile' ? 'M' : 'W',
    REFERER: ctx.referrer || '',
    // UTM
    U_SO: utm.source || '',
    U_ME: utm.medium || '',
    U_CA: utm.campaign || '',
    U_CO: utm.content || '',
    U_TE: utm.term || '',
    utm_source: utm.source || '',
    utm_medium: utm.medium || '',
    utm_campaign: utm.campaign || '',
    utm_content: utm.content || '',
    utm_term: utm.term || '',
  }
}

function detectDeviceType(ua?: string): 'pc' | 'mobile' {
  if (!ua) return 'pc'
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) ? 'mobile' : 'pc'
}


async function fireInternal(
  event: WebhookEvent,
  extras: Record<string, unknown>,
  options: FireOptions,
) {
  const scope = options.scope || 'global'
  const scopeId = options.scopeId ?? null
  const ctx = options.context || {}
  if (!ctx.device_type && ctx.user_agent) {
    ctx.device_type = detectDeviceType(ctx.user_agent)
  }

  const data = buildDataDict(event, { ...options, context: ctx }, extras)

  // 서버사이드 Edge Function으로 위임 (CORS·Content-Type·Auth 헤더 제약 없음)
  try {
    await supabase.functions.invoke('webhook-send', {
      body: {
        event,
        scope,
        scope_id: scopeId,
        user_id: options.userId ?? null,
        related_type: options.relatedType ?? null,
        related_id: options.relatedId ?? null,
        payload: { ...data, ...extras, name: options.displayName, phone: options.displayPhone, email: options.displayEmail, title: options.displayTitle },
        utm: options.utm || {},
        context: ctx,
      },
    })
  } catch {
    // 실패해도 메인 플로우에 영향 없음
  }
}

export const webhookService = {
  async fireSignup(profile: {
    userId?: string | null
    name?: string | null
    email?: string | null
    phone?: string | null
    gender?: string | null
    address?: string | null
    birth_date?: string | null
    provider?: string | null
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    utm_content?: string | null
    utm_term?: string | null
  }, context?: WebhookContext) {
    await fireInternal('signup', {
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      gender: profile.gender || '',
      address: profile.address || '',
      birth_date: profile.birth_date || '',
      provider: profile.provider || 'email',
    }, {
      scope: 'global',
      userId: profile.userId ?? null,
      displayName: profile.name || '',
      displayPhone: profile.phone || '',
      displayEmail: profile.email || '',
      utm: {
        source: profile.utm_source,
        medium: profile.utm_medium,
        campaign: profile.utm_campaign,
        content: profile.utm_content,
        term: profile.utm_term,
      },
      context,
    })
  },

  async firePurchase(data: {
    userId?: string | null
    user_email?: string
    user_name?: string
    user_phone?: string
    title: string
    price: number
    type: 'course' | 'ebook'
    productId?: number | null
    paymentId?: number | null
  }, context?: WebhookContext) {
    // course 인 경우 일시 자동 조회
    let scheduledAt: string | null = null
    let enrollmentStart: string | null = null
    let enrollmentDeadline: string | null = null
    if (data.type === 'course' && data.productId) {
      const [schedFuture, courseRow] = await Promise.all([
        supabase
          .from('schedules')
          .select('scheduled_at')
          .eq('course_id', data.productId)
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(1),
        supabase
          .from('courses')
          .select('enrollment_start, enrollment_deadline')
          .eq('id', data.productId)
          .maybeSingle(),
      ])
      const c = courseRow.data as { enrollment_start?: string | null; enrollment_deadline?: string | null } | null
      enrollmentStart = c?.enrollment_start ?? null
      enrollmentDeadline = c?.enrollment_deadline ?? null
      scheduledAt = (schedFuture.data as Array<{ scheduled_at: string }> | null)?.[0]?.scheduled_at ?? null
      if (!scheduledAt) {
        const { data: past } = await supabase
          .from('schedules')
          .select('scheduled_at')
          .eq('course_id', data.productId)
          .order('scheduled_at', { ascending: false })
          .limit(1)
        scheduledAt = (past as Array<{ scheduled_at: string }> | null)?.[0]?.scheduled_at ?? null
      }
      // schedules 레코드가 없으면 SCHEDULED_* 도 오픈일시/마감일시로 폴백
      if (!scheduledAt) scheduledAt = enrollmentStart ?? enrollmentDeadline ?? null
    }

    await fireInternal('purchase', {
      user_email: data.user_email || '',
      user_name: data.user_name || '',
      user_phone: data.user_phone || '',
      title: data.title || '',
      price: data.price ?? 0,
      type: data.type,
      scheduled_at: scheduledAt,
      enrollment_start: enrollmentStart,
      enrollment_deadline: enrollmentDeadline,
    }, {
      scope: data.type,
      scopeId: data.productId ?? null,
      userId: data.userId ?? null,
      relatedType: 'payment',
      relatedId: data.paymentId ?? null,
      displayName: data.user_name || '',
      displayPhone: data.user_phone || '',
      displayEmail: data.user_email || '',
      displayTitle: data.title || '',
      context,
    })
  },

  async fireRefund(data: {
    userId?: string | null
    user_email?: string
    user_name?: string
    user_phone?: string
    title: string
    price: number
    type: 'course' | 'ebook'
    productId?: number | null
    paymentId?: number | null
  }, _context?: WebhookContext) {
    // refund 는 built-in event 도 webhook_configs.refund_template 도 따로 없어서
    // 어드민이 'refund' 라는 custom event 로 템플릿 관리하도록 위임.
    await this.fireCustomEvent('refund', {
      user_email: data.user_email || '',
      user_name: data.user_name || '',
      user_phone: data.user_phone || '',
      title: data.title || '',
      price: data.price ?? 0,
      type: data.type,
    }, {
      userId: data.userId ?? null,
      userName: data.user_name,
      userPhone: data.user_phone,
      userEmail: data.user_email,
      title: data.title,
      scope: data.type,
      scopeId: data.productId ?? null,
    })
  },

  // 커스텀 이벤트 발사 (쿠폰 발급, 포인트 충전 등 임의 이벤트)
  async fireCustomEvent(code: string, payload: Record<string, unknown>, options?: {
    userId?: string | null
    userName?: string
    userPhone?: string
    userEmail?: string
    title?: string
    scope?: 'coupon' | 'course' | 'ebook'
    scopeId?: number | null
  }): Promise<void> {
    try {
      // course 인 경우 일시 자동 조회 (schedules → courses.enrollment_start → enrollment_deadline)
      let scheduledAt: string | null = null
      if (options?.scope === 'course' && options.scopeId) {
        const [schedFuture, courseRow] = await Promise.all([
          supabase
            .from('schedules')
            .select('scheduled_at')
            .eq('course_id', options.scopeId)
            .gte('scheduled_at', new Date().toISOString())
            .order('scheduled_at', { ascending: true })
            .limit(1),
          supabase
            .from('courses')
            .select('enrollment_start, enrollment_deadline')
            .eq('id', options.scopeId)
            .maybeSingle(),
        ])
        scheduledAt = (schedFuture.data as Array<{ scheduled_at: string }> | null)?.[0]?.scheduled_at ?? null
        if (!scheduledAt) {
          const { data: past } = await supabase
            .from('schedules')
            .select('scheduled_at')
            .eq('course_id', options.scopeId)
            .order('scheduled_at', { ascending: false })
            .limit(1)
          scheduledAt = (past as Array<{ scheduled_at: string }> | null)?.[0]?.scheduled_at ?? null
        }
        if (!scheduledAt) {
          const c = courseRow.data as { enrollment_start?: string | null; enrollment_deadline?: string | null } | null
          scheduledAt = c?.enrollment_start ?? c?.enrollment_deadline ?? null
        }
      }

      // firePurchase 등과 동일하게 buildDataDict 를 거쳐 한글 alias / 시간 포맷 / UTM 등 전부 주입
      const enriched = buildDataDict('custom', {
        scope: (options?.scope === 'coupon' ? 'global' : options?.scope) ?? 'global',
        scopeId: options?.scopeId ?? null,
        userId: options?.userId ?? null,
        displayName: options?.userName ?? (payload.user_name as string | undefined) ?? (payload.name as string | undefined) ?? '',
        displayPhone: options?.userPhone ?? (payload.user_phone as string | undefined) ?? (payload.phone as string | undefined) ?? '',
        displayEmail: options?.userEmail ?? (payload.user_email as string | undefined) ?? (payload.email as string | undefined) ?? '',
        displayTitle: options?.title ?? (payload.title as string | undefined) ?? '',
      }, { ...payload, scheduled_at: scheduledAt })

      await supabase.functions.invoke('webhook-send', {
        body: {
          event: 'custom',
          custom_event_code: code,
          scope: options?.scope ?? 'global',
          scope_id: options?.scopeId ?? null,
          user_id: options?.userId ?? null,
          payload: enriched,
        },
      })
    } catch {
      // fire-and-forget
    }
  },

  // pg_cron 스케줄 관리
  async getCronSchedule(jobName: string): Promise<{ schedule: string; active: boolean; last_run: string | null; last_status: string | null } | null> {
    const { data, error } = await supabase.rpc('get_cron_schedule', { p_job_name: jobName } as never)
    if (error) throw error
    const list = data as Array<{ schedule: string; active: boolean; last_run: string | null; last_status: string | null }> | null
    return list?.[0] ?? null
  },

  async updateCronSchedule(jobName: string, kstHour: number, kstMinute: number): Promise<string> {
    const { data, error } = await supabase.rpc('update_cron_schedule', {
      p_job_name: jobName,
      p_hour_kst: kstHour,
      p_minute: kstMinute,
    } as never)
    if (error) throw error
    return data as string
  },

  async setCronActive(jobName: string, active: boolean): Promise<void> {
    const { error } = await supabase.rpc('set_cron_active', { p_job_name: jobName, p_active: active } as never)
    if (error) throw error
  },

  // 커스텀 이벤트 정의 CRUD
  async listCustomEvents(): Promise<Array<{ id: number; code: string; label: string; description: string | null; trigger_hint: string | null; template: string; enabled: boolean; built_in: boolean; sort_order: number }>> {
    const { data } = await supabase.from('webhook_custom_events').select('*').order('sort_order').order('id')
    return (data as Array<{ id: number; code: string; label: string; description: string | null; trigger_hint: string | null; template: string; enabled: boolean; built_in: boolean; sort_order: number }> | null) ?? []
  },

  async upsertCustomEvent(row: { id?: number; code: string; label: string; description?: string | null; trigger_hint?: string | null; template: string; enabled?: boolean; sort_order?: number; variable_aliases?: Record<string, string> }): Promise<void> {
    const payload = { ...row, variable_aliases: row.variable_aliases ?? {} }
    if (row.id) {
      await supabase.from('webhook_custom_events').update(payload as never).eq('id', row.id)
    } else {
      await supabase.from('webhook_custom_events').insert(payload as never)
    }
  },

  async deleteCustomEvent(id: number): Promise<void> {
    await supabase.from('webhook_custom_events').delete().eq('id', id)
  },

  // 커스텀 이벤트 scope별 override CRUD (쿠폰별 개별 템플릿 등)
  async listCustomEventOverrides(scope: 'coupon' | 'course' | 'ebook', scopeId: number): Promise<Array<{ id: number; event_code: string; scope: string; scope_id: number; template: string; enabled: boolean }>> {
    const { data } = await supabase
      .from('webhook_custom_event_overrides')
      .select('*')
      .eq('scope', scope)
      .eq('scope_id', scopeId)
    return (data as Array<{ id: number; event_code: string; scope: string; scope_id: number; template: string; enabled: boolean }> | null) ?? []
  },

  async upsertCustomEventOverride(row: { id?: number; event_code: string; scope: 'coupon' | 'course' | 'ebook'; scope_id: number; template: string; enabled?: boolean; variable_aliases?: Record<string, string> }): Promise<void> {
    const payload = {
      event_code: row.event_code,
      scope: row.scope,
      scope_id: row.scope_id,
      template: row.template,
      enabled: row.enabled ?? true,
      variable_aliases: row.variable_aliases ?? {},
    }
    if (row.id) {
      const { error } = await supabase.from('webhook_custom_event_overrides').update(payload as never).eq('id', row.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('webhook_custom_event_overrides')
        .upsert(payload as never, { onConflict: 'event_code,scope,scope_id' })
      if (error) throw error
    }
  },

  async deleteCustomEventOverride(id: number): Promise<void> {
    const { error } = await supabase.from('webhook_custom_event_overrides').delete().eq('id', id)
    if (error) throw error
  },

  // 사용자 정의 canonical 변수 CRUD
  async listCustomCanonicalVars(): Promise<Array<{ id: number; key: string; value: string; description: string; sort_order: number }>> {
    const { data } = await supabase.from('custom_canonical_vars').select('*').order('sort_order').order('key')
    return (data as Array<{ id: number; key: string; value: string; description: string; sort_order: number }> | null) ?? []
  },

  async upsertCustomCanonicalVar(row: { id?: number; key: string; value: string; description?: string; sort_order?: number }): Promise<void> {
    const payload = {
      key: row.key,
      value: row.value,
      description: row.description ?? '',
      sort_order: row.sort_order ?? 0,
    }
    if (row.id) {
      const { error } = await supabase.from('custom_canonical_vars').update(payload as never).eq('id', row.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('custom_canonical_vars')
        .upsert(payload as never, { onConflict: 'key' })
      if (error) throw error
    }
  },

  async deleteCustomCanonicalVar(id: number): Promise<void> {
    const { error } = await supabase.from('custom_canonical_vars').delete().eq('id', id)
    if (error) throw error
  },

  // OpenAI API 키 풀 CRUD
  async listOpenaiKeys(): Promise<Array<{ id: number; label: string; api_key: string; enabled: boolean; last_used_at: string | null; last_error_at: string | null; last_error_message: string | null; error_count: number; use_count: number; sort_order: number }>> {
    const { data } = await supabase.from('openai_api_keys').select('*').order('sort_order').order('id')
    return (data as Array<{ id: number; label: string; api_key: string; enabled: boolean; last_used_at: string | null; last_error_at: string | null; last_error_message: string | null; error_count: number; use_count: number; sort_order: number }> | null) ?? []
  },

  async upsertOpenaiKey(row: { id?: number; label: string; api_key: string; enabled?: boolean; sort_order?: number }): Promise<void> {
    const payload = {
      label: row.label,
      api_key: row.api_key,
      enabled: row.enabled ?? true,
      sort_order: row.sort_order ?? 0,
    }
    if (row.id) {
      const { error } = await supabase.from('openai_api_keys').update(payload as never).eq('id', row.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('openai_api_keys').insert(payload as never)
      if (error) throw error
    }
  },

  async deleteOpenaiKey(id: number): Promise<void> {
    const { error } = await supabase.from('openai_api_keys').delete().eq('id', id)
    if (error) throw error
  },

  async bulkInsertOpenaiKeys(keys: string[], labelPrefix = 'Key'): Promise<number> {
    if (keys.length === 0) return 0
    const rows = keys.map((k, i) => ({
      label: `${labelPrefix} #${i + 1}`,
      api_key: k.trim(),
      enabled: true,
      sort_order: i,
    }))
    const { error } = await supabase.from('openai_api_keys').insert(rows as never)
    if (error) throw error
    return rows.length
  },

  // 템플릿 변수명 분석 — 미확인 변수 매핑 + 빈 슬롯 채움 제안 (GPT-5.4-mini)
  async analyzeTemplateVariables(template: string): Promise<{
    unknown_vars: string[]
    suggested_aliases: Record<string, { canonical: string; reason: string }>
    empty_slots: string[]
    suggested_slot_fills: Record<string, { canonical: string; reason: string }>
    warning?: string
  }> {
    const { data, error } = await supabase.functions.invoke('webhook-template-analyze', { body: { template } })
    if (error) throw error
    return data as {
      unknown_vars: string[]
      suggested_aliases: Record<string, { canonical: string; reason: string }>
      empty_slots: string[]
      suggested_slot_fills: Record<string, { canonical: string; reason: string }>
      warning?: string
    }
  },

  async getConfig(scope: WebhookScope = 'global', scopeId: number | null = null): Promise<WebhookConfig> {
    const data = await loadConfig(scope, scopeId)
    if (data) return data
    return { ...defaultWebhookConfig, scope, scope_id: scopeId }
  },

  async listConfigs(): Promise<WebhookConfig[]> {
    const { data } = await supabase.from('webhook_configs').select('*').order('scope').order('scope_id')
    return (data as WebhookConfig[] | null) ?? []
  },

  async saveConfig(config: WebhookConfig): Promise<WebhookConfig> {
    const cfgExt = config as WebhookConfig & { signup_variable_aliases?: Record<string, string>; purchase_variable_aliases?: Record<string, string> }
    const payload = {
      scope: config.scope,
      scope_id: config.scope_id,
      enabled: config.enabled,
      url: config.url,
      method: config.method,
      use_json_header: config.use_json_header,
      header_data: config.header_data,
      headers: config.headers,
      events: config.events,
      use_template: config.use_template,
      signup_template: config.signup_template,
      purchase_template: config.purchase_template,
      label: config.label,
      signup_variable_aliases: cfgExt.signup_variable_aliases ?? {},
      purchase_variable_aliases: cfgExt.purchase_variable_aliases ?? {},
    }
    if (config.id) {
      const { data, error } = await supabase.from('webhook_configs').update(payload as never).eq('id', config.id).select().single()
      if (error) throw error
      return data as WebhookConfig
    }
    const onConflict = config.scope === 'global' ? 'scope' : undefined
    const q = supabase.from('webhook_configs').upsert(payload as never, onConflict ? { onConflict } : undefined).select().single()
    const { data, error } = await q
    if (error) throw error
    return data as WebhookConfig
  },

  async deleteConfig(id: number): Promise<void> {
    await supabase.from('webhook_configs').delete().eq('id', id)
  },

  async resendLog(logId: number): Promise<boolean> {
    const { data } = await supabase.from('webhook_logs').select('*').eq('id', logId).maybeSingle()
    if (!data) return false
    const log = data as Record<string, unknown>
    const payload = (log.payload as Record<string, unknown>) || {}

    const { data: result, error } = await supabase.functions.invoke('webhook-send', {
      body: {
        event: log.event_type,
        scope: (log.config_scope as string) || 'global',
        scope_id: (log.config_scope_id as number | null) ?? null,
        user_id: log.user_id,
        related_type: log.related_type,
        related_id: log.related_id,
        payload,
        utm: {
          source: log.utm_source,
          medium: log.utm_medium,
          campaign: log.utm_campaign,
          content: log.utm_content,
          term: log.utm_term,
        },
        context: {
          ip: log.ip,
          user_agent: log.user_agent,
          referrer: log.referrer,
          device_type: log.device_type,
        },
      },
    })

    const success = !error && (result as { status?: string } | null)?.status === 'success'
    const responseStatus = (result as { response_status?: number } | null)?.response_status
    const history = Array.isArray(log.resend_history) ? log.resend_history : []
    await supabase.from('webhook_logs').update({
      last_resent_at: new Date().toISOString(),
      resend_count: (typeof log.resend_count === 'number' ? log.resend_count : 0) + 1,
      resend_history: [...history, { at: new Date().toISOString(), success, response_status: responseStatus }],
    } as never).eq('id', logId)
    return success
  },

  async updateLogMemo(logId: number, memo: string): Promise<void> {
    const { error } = await supabase.from('webhook_logs').update({ memo } as never).eq('id', logId)
    if (error) throw error
  },

  captureContext(): WebhookContext {
    if (typeof window === 'undefined') return {}
    const ua = navigator.userAgent
    const entry = window.sessionStorage.getItem('landing_entry_time')
    const duration = entry ? Date.now() - Number(entry) : undefined
    const cachedIp = window.sessionStorage.getItem('client_ip') || undefined
    return {
      ip: cachedIp,
      user_agent: ua,
      referrer: document.referrer || '',
      device_type: detectDeviceType(ua),
      submission_duration_ms: duration,
    }
  },

  markLandingEntry() {
    if (typeof window === 'undefined') return
    if (!window.sessionStorage.getItem('landing_entry_time')) {
      window.sessionStorage.setItem('landing_entry_time', String(Date.now()))
    }
    // IP 캐시 (한 세션당 1회)
    if (!window.sessionStorage.getItem('client_ip')) {
      fetch('https://api.ipify.org?format=json')
        .then((r) => r.json())
        .then((d: { ip?: string }) => {
          if (d?.ip) window.sessionStorage.setItem('client_ip', d.ip)
        })
        .catch(() => {})
    }
  },
}
