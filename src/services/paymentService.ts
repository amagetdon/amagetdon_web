import { supabase } from '../lib/supabase'

// 브라우저에는 공개 키(clientKey)만 둔다. 비밀키(secretKey·billingSecretKey)는 서버 함수(service role)만
// site_settings 'toss_payments' 줄에서 읽는다 — 10/20 그 줄이 누구나 읽히는 정책이라 공개 줄을 따로 뗌.
interface TossPaymentConfig {
  clientKey: string
  billingClientKey: string
}

let cachedConfig: TossPaymentConfig | null = null

export const paymentService = {
  async getConfig(): Promise<TossPaymentConfig | null> {
    if (cachedConfig) return cachedConfig
    const read = async (key: string) => {
      const { data } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle()
      return ((data as unknown as { value?: Record<string, string> } | null)?.value) ?? null
    }
    // 공개 줄 우선. 공개 줄 SQL 적용 전에는 예전 줄에서 공개 키만 골라 쓴다(적용 뒤엔 예전 줄이 브라우저에 안 보임)
    const val = (await read('toss_payments_public')) ?? (await read('toss_payments'))
    if (!val?.clientKey) return null
    cachedConfig = {
      clientKey: val.clientKey,
      billingClientKey: val.billingClientKey || '',
    }
    return cachedConfig
  },

  async getClientKey(): Promise<string | null> {
    const config = await this.getConfig()
    return config?.clientKey || null
  },

  // 자동결제(빌링) 인증창용 클라이언트 키 — 빌링 전용 키가 없으면 일반 키로 폴백
  async getBillingClientKey(): Promise<string | null> {
    const config = await this.getConfig()
    return config?.billingClientKey || config?.clientKey || null
  },

  generateOrderId(): string {
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.random().toString(36).substring(2, 10)
    return `ORDER_${date}_${random}`
  },
}
