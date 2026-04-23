import { supabase } from '../lib/supabase'

export type WebhookScope = 'global' | 'course' | 'ebook'
export type WebhookEvent = 'signup' | 'purchase' | 'refund' | 'cancel'

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
  return {
    event,
    ...extras,
    // 이름/연락처
    name: options.displayName || extras.name || '',
    phone: options.displayPhone || extras.phone || '',
    email: options.displayEmail || extras.email || '',
    title: options.displayTitle || extras.title || '',
    // 별칭 (디비카트 스타일)
    TITLE: options.displayTitle || extras.title || '',
    ITEM1: options.displayName || extras.name || '',
    ITEM2: options.displayPhone || extras.phone || '',
    ITEM2_NOH: String(options.displayPhone || extras.phone || '').replace(/-/g, ''),
    // 시간
    DATE: now.toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, ''),
    TIME: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    TIMES: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    date: now.toLocaleDateString('ko-KR'),
    time: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    timestamp: now.toISOString(),
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
    await fireInternal('purchase', {
      user_email: data.user_email || '',
      user_name: data.user_name || '',
      user_phone: data.user_phone || '',
      title: data.title || '',
      price: data.price ?? 0,
      type: data.type,
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
  }, context?: WebhookContext) {
    await fireInternal('refund', {
      user_email: data.user_email || '',
      user_name: data.user_name || '',
      user_phone: data.user_phone || '',
      title: data.title || '',
      price: data.price ?? 0,
      type: data.type,
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
    await updateLog(logId, { memo })
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
