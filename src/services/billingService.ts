import { supabase } from '../lib/supabase'

// 뉴스레터 정기구독(자동결제) 조회/해지.
// billing_key 는 컬럼 권한으로 클라이언트에서 조회 자체가 불가 — 명시 컬럼만 select 한다.
export interface NewsletterSubscription {
  id: number
  instructor_id: number
  card_company: string | null
  card_number: string | null
  status: 'active' | 'canceled' | 'failed'
  price: number
  period_days: number
  current_expires_at: string | null
  next_charge_at: string | null
  fail_count: number
  canceled_at: string | null
  created_at: string
  instructor: { name: string } | null
}

const SELECT_COLUMNS =
  'id, instructor_id, card_company, card_number, status, price, period_days, ' +
  'current_expires_at, next_charge_at, fail_count, canceled_at, created_at, ' +
  'instructor:instructors(name)'

export const billingService = {
  async getMySubscriptions(userId: string): Promise<NewsletterSubscription[]> {
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select(SELECT_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    // to-one 관계라 객체로 오지만, 일부 환경에서 배열로 직렬화되는 경우까지 방어 (confirm-payment 와 동일)
    return (data ?? []).map((row) => {
      const r = row as unknown as Omit<NewsletterSubscription, 'instructor'> & {
        instructor: { name: string } | { name: string }[] | null
      }
      return { ...r, instructor: Array.isArray(r.instructor) ? r.instructor[0] ?? null : r.instructor }
    })
  },

  // 자동갱신 해지 — 이미 결제된 기간은 만료일까지 이용 가능
  async cancelSubscription(instructorId: number): Promise<void> {
    const response = await supabase.functions.invoke('billing-cancel', {
      body: { instructorId },
    })
    const data = response.data as { error?: string } | null
    if (response.error) {
      throw new Error(data?.error || response.error.message || '해지에 실패했습니다.')
    }
    if (data?.error) throw new Error(data.error)
  },
}
