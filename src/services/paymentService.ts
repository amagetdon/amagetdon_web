import { supabase } from '../lib/supabase'

interface TossPaymentConfig {
  clientKey: string
  secretKey: string
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
    cachedConfig = { clientKey: val.clientKey, secretKey: val.secretKey || '' }
    return cachedConfig
  },

  async getClientKey(): Promise<string | null> {
    const config = await this.getConfig()
    return config?.clientKey || null
  },

  generateOrderId(): string {
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.random().toString(36).substring(2, 10)
    return `ORDER_${date}_${random}`
  },
}
