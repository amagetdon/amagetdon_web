import { supabase } from '../lib/supabase'

interface TossPaymentConfig {
  clientKey: string
  secretKey: string
  billingClientKey: string
  billingSecretKey: string
}

let cachedConfig: TossPaymentConfig | null = null

export const paymentService = {
  async getConfig(): Promise<TossPaymentConfig | null> {
    if (cachedConfig) return cachedConfig
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'toss_payments')
      .maybeSingle()
    if (!data) return null
    const val = (data as unknown as Record<string, unknown>).value as Record<string, string>
    if (!val?.clientKey) return null
    cachedConfig = {
      clientKey: val.clientKey,
      secretKey: val.secretKey || '',
      billingClientKey: val.billingClientKey || '',
      billingSecretKey: val.billingSecretKey || '',
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
