import { supabase } from '../lib/supabase'

export interface WebhookConfig {
  enabled: boolean
  url: string
  method: 'POST' | 'GET'
  events: {
    signup: boolean
    purchase: boolean
  }
  headers: Record<string, string>
  useTemplate: boolean
  signupTemplate: string
  purchaseTemplate: string
}

const defaultConfig: WebhookConfig = {
  enabled: false,
  url: '',
  method: 'POST',
  events: { signup: true, purchase: true },
  headers: {},
  useTemplate: false,
  signupTemplate: '',
  purchaseTemplate: '',
}

let cachedConfig: WebhookConfig | null = null

function resolveTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{#(\w+)#\}/g, (_, key) => {
    return String(data[key] ?? '')
  })
}

function templateToPayload(template: string, data: Record<string, unknown>): Record<string, string> | string {
  const resolved = resolveTemplate(template, data)
  // JSON 형태면 파싱 시도
  try {
    return JSON.parse(resolved)
  } catch {
    // key=value 형태 파싱 (& 구분)
    if (resolved.includes('=')) {
      const result: Record<string, string> = {}
      for (const part of resolved.split('&')) {
        const [k, ...v] = part.split('=')
        if (k.trim()) result[k.trim()] = v.join('=').trim()
      }
      return result
    }
    return resolved
  }
}

export const webhookService = {
  async getConfig(): Promise<WebhookConfig> {
    if (cachedConfig) return cachedConfig
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'webhook_config')
      .maybeSingle()
    cachedConfig = data ? { ...defaultConfig, ...(data as Record<string, unknown>).value as WebhookConfig } : defaultConfig
    return cachedConfig
  },

  async saveConfig(config: WebhookConfig) {
    await supabase.from('site_settings').upsert({
      key: 'webhook_config',
      value: config,
    } as never, { onConflict: 'key' })
    cachedConfig = config
  },

  async fire(event: 'signup' | 'purchase', payload: Record<string, unknown>) {
    try {
      const config = await this.getConfig()
      if (!config.enabled || !config.url || !config.events[event]) return

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...config.headers,
      }

      // 템플릿 모드
      let body: Record<string, unknown> | string = payload
      if (config.useTemplate) {
        const template = event === 'signup' ? config.signupTemplate : config.purchaseTemplate
        if (template) {
          body = templateToPayload(template, payload)
        }
      }

      if (config.method === 'POST') {
        fetch(config.url, {
          method: 'POST',
          headers,
          body: typeof body === 'string' ? body : JSON.stringify(body),
          mode: 'no-cors',
        }).catch(() => {})
      } else {
        const params = new URLSearchParams()
        const entries = typeof body === 'object' ? Object.entries(body as Record<string, unknown>) : []
        for (const [k, v] of entries) {
          params.set(k, String(v ?? ''))
        }
        fetch(`${config.url}?${params.toString()}`, {
          method: 'GET',
          mode: 'no-cors',
        }).catch(() => {})
      }
    } catch {
      // 웹훅 실패해도 메인 로직에 영향 없음
    }
  },

  async fireSignup(profile: {
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
  }) {
    await this.fire('signup', {
      event: 'signup',
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      gender: profile.gender || '',
      address: profile.address || '',
      birth_date: profile.birth_date || '',
      provider: profile.provider || 'email',
      utm_source: profile.utm_source || '',
      utm_medium: profile.utm_medium || '',
      utm_campaign: profile.utm_campaign || '',
      utm_content: profile.utm_content || '',
      utm_term: profile.utm_term || '',
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('ko-KR'),
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    })
  },

  async firePurchase(data: {
    user_email?: string
    user_name?: string
    user_phone?: string
    title: string
    price: number
    type: 'course' | 'ebook'
  }) {
    await this.fire('purchase', {
      event: 'purchase',
      ...data,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('ko-KR'),
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    })
  },
}
