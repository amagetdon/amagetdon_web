// 토스 링크페이 웹훅 — 결제 완료 시 수강권 자동 부여.
//
// 흐름: ORDER_PAYMENT_STATUS_CHANGED 수신
//   → 원본 보관 → 토스 API 로 결제 재확인(위조 방지)
//   → productKey 로 강의 식별(linkpay_links) → 전화번호로 회원 매칭
//   → 조건 충족 시 purchases 에 수강권 부여, 미매칭은 linkpay_payments 큐에 보관.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json200 = () =>
  new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

// 토스 API 로 결제를 재조회해 위조 여부 검증 (링크페이 웹훅은 서명이 없음)
async function verifyPayment(paymentKey: string, expectedAmount: number | null): Promise<boolean> {
  const secret = Deno.env.get('TOSS_LINKPAY_SECRET_KEY')
  if (!secret) {
    console.error('[linkpay-webhook] TOSS_LINKPAY_SECRET_KEY 미설정 — 검증 불가')
    return false
  }
  try {
    const res = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, {
      headers: { Authorization: `Basic ${btoa(`${secret}:`)}` },
    })
    if (!res.ok) return false
    const p = await res.json() as { status?: string; totalAmount?: number }
    if (p?.status !== 'DONE') return false
    if (expectedAmount != null && p?.totalAmount !== expectedAmount) return false
    return true
  } catch (e) {
    console.error('[linkpay-webhook] verify error:', e)
    return false
  }
}

// 뉴스레터 구독 만료일 계산 — 유효 구독이 남아 있으면 그 만료일부터 이어서 연장
async function computeBoardSubExpiry(
  supabase: SupabaseClient,
  instructorId: number,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from('instructors')
    .select('newsletter_days')
    .eq('id', instructorId)
    .maybeSingle()
  const days = (data as { newsletter_days: number | null } | null)?.newsletter_days || 30
  const { data: cur } = await supabase
    .from('purchases')
    .select('expires_at')
    .eq('user_id', userId).eq('board_instructor_id', instructorId)
    .not('expires_at', 'is', null)
    .order('expires_at', { ascending: false })
    .limit(1).maybeSingle()
  const curMs = (cur as { expires_at: string | null } | null)?.expires_at
    ? new Date((cur as { expires_at: string }).expires_at).getTime() : 0
  return new Date(Math.max(Date.now(), curMs) + days * 86400000).toISOString()
}

// 강의/전자책 수강권 만료일 계산 (AdminMembers 수동 부여와 동일 규칙)
async function computeExpiry(
  supabase: SupabaseClient,
  courseId: number | null,
  ebookId: number | null,
): Promise<string | null> {
  if (courseId) {
    const { data } = await supabase
      .from('courses')
      .select('enrollment_deadline, duration_days')
      .eq('id', courseId)
      .maybeSingle()
    const c = data as { enrollment_deadline: string | null; duration_days: number | null } | null
    if (c?.enrollment_deadline && c.duration_days && c.duration_days > 0) {
      return new Date(new Date(c.enrollment_deadline).getTime() + c.duration_days * 86400000).toISOString()
    }
    return null
  }
  if (ebookId) {
    const { data } = await supabase
      .from('ebooks')
      .select('duration_days')
      .eq('id', ebookId)
      .maybeSingle()
    const e = data as { duration_days: number | null } | null
    if (e?.duration_days && e.duration_days > 0) {
      return new Date(Date.now() + e.duration_days * 86400000).toISOString()
    }
    return null
  }
  return null
}

interface OrderData {
  orderKey?: string
  amount?: number
  customerName?: string | null
  customerPhoneNumber?: string | null
  orderItems?: { product?: { productKey?: string; name?: string } }[]
  payment?: {
    paymentKey?: string
    status?: string
    totalAmount?: number
    orderName?: string
    approvedAt?: string
  }
}

async function processOrder(supabase: SupabaseClient, data: OrderData): Promise<void> {
  const orderKey = data?.orderKey
  if (!orderKey) return

  const payment = data?.payment ?? {}
  const paymentKey = payment.paymentKey ?? null
  const status = payment.status ?? null
  const product = data?.orderItems?.[0]?.product
  const productKey = product?.productKey ?? null
  const orderName = product?.name ?? payment.orderName ?? null
  const customerName = data?.customerName ?? null
  const customerPhone = data?.customerPhoneNumber ?? null
  const amount = data?.amount ?? payment.totalAmount ?? null
  const approvedAt = payment.approvedAt ?? null

  // 이미 처리(부여)된 주문이면 멱등 스킵
  const { data: existing } = await supabase
    .from('linkpay_payments')
    .select('id, granted, purchase_id')
    .eq('order_key', orderKey)
    .maybeSingle()
  const prev = existing as { id: number; granted: boolean; purchase_id: number | null } | null

  // productKey → 강의/전자책/뉴스레터(글 단건·강사 구독)
  let courseId: number | null = null
  let ebookId: number | null = null
  let boardPostId: number | null = null
  let boardInstructorId: number | null = null
  if (productKey) {
    const { data: link } = await supabase
      .from('linkpay_links')
      .select('course_id, ebook_id, board_post_id, board_instructor_id')
      .eq('product_key', productKey)
      .maybeSingle()
    const l = link as { course_id: number | null; ebook_id: number | null; board_post_id: number | null; board_instructor_id: number | null } | null
    courseId = l?.course_id ?? null
    ebookId = l?.ebook_id ?? null
    boardPostId = l?.board_post_id ?? null
    boardInstructorId = l?.board_instructor_id ?? null
  }

  // 전화번호 → 회원
  let matchedUserId: string | null = null
  if (customerPhone) {
    const { data: uid } = await supabase.rpc('find_profile_id_by_phone', { p_phone: customerPhone })
    matchedUserId = (uid as string | null) ?? null
  }

  // 결제 취소 → 이전에 부여한 수강권 회수
  if (status === 'CANCELED') {
    if (prev?.purchase_id) {
      await supabase.from('purchases').delete().eq('id', prev.purchase_id)
    }
    await supabase.from('linkpay_payments').upsert({
      order_key: orderKey, payment_key: paymentKey, product_key: productKey, order_name: orderName,
      customer_name: customerName, customer_phone: customerPhone, amount, status,
      course_id: courseId, ebook_id: ebookId,
      board_post_id: boardPostId, board_instructor_id: boardInstructorId,
      matched_user_id: matchedUserId,
      granted: false, purchase_id: null, approved_at: approvedAt, raw: data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'order_key' })
    return
  }

  // 이미 부여 완료면 기록만 갱신
  if (prev?.granted) return

  // 결제 완료 + 검증 + 상품 식별 + 회원 매칭이 모두 되면 이용권 부여
  let granted = false
  let purchaseId: number | null = null
  if (status === 'DONE' && paymentKey && matchedUserId && (courseId || ebookId || boardPostId || boardInstructorId)) {
    const verified = await verifyPayment(paymentKey, amount)
    if (verified) {
      // 뉴스레터: 글 단건은 영구, 강사 구독은 기간제(잔여 구독 연장)
      const expiresAt = boardPostId
        ? null
        : boardInstructorId
          ? await computeBoardSubExpiry(supabase, boardInstructorId, matchedUserId)
          : await computeExpiry(supabase, courseId, ebookId)
      const { data: purchase, error } = await supabase
        .from('purchases')
        .insert({
          user_id: matchedUserId,
          course_id: courseId,
          ebook_id: ebookId,
          board_post_id: boardPostId,
          board_instructor_id: boardInstructorId,
          title: orderName ?? '링크페이 결제',
          price: amount ?? 0,
          payment_key: paymentKey,
          payment_method: 'linkpay',
          expires_at: expiresAt,
        })
        .select('id')
        .single()
      if (!error && purchase) {
        purchaseId = (purchase as { id: number }).id
        granted = true
      } else if (error) {
        console.error('[linkpay-webhook] purchase insert error:', error.message)
      }
    } else {
      console.error('[linkpay-webhook] 결제 검증 실패 — orderKey:', orderKey)
    }
  }

  await supabase.from('linkpay_payments').upsert({
    order_key: orderKey, payment_key: paymentKey, product_key: productKey, order_name: orderName,
    customer_name: customerName, customer_phone: customerPhone, amount, status,
    course_id: courseId, ebook_id: ebookId,
    board_post_id: boardPostId, board_instructor_id: boardInstructorId,
    matched_user_id: matchedUserId,
    granted, purchase_id: purchaseId, approved_at: approvedAt, raw: data,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'order_key' })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('linkpay-webhook ok', { status: 200 })
  }

  let raw = ''
  try {
    raw = await req.text()
  } catch (e) {
    console.error('[linkpay-webhook] read error:', e)
  }
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    parsed = { _unparsed: raw }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const eventType = parsed && typeof parsed.eventType === 'string' ? parsed.eventType : null

  // 원본 보관 (감사 로그)
  try {
    await supabase.from('linkpay_webhook_events').insert({ event_type: eventType, raw: parsed })
  } catch (e) {
    console.error('[linkpay-webhook] event store error:', e)
  }

  // 링크페이 주문 결제 이벤트만 처리
  if (eventType === 'ORDER_PAYMENT_STATUS_CHANGED' && parsed && typeof parsed.data === 'object') {
    try {
      await processOrder(supabase, parsed.data as OrderData)
    } catch (e) {
      console.error('[linkpay-webhook] process error:', e)
    }
  }

  // 토스에는 항상 200 (실패 시 재전송 폭주 방지 — 멱등 처리로 우리가 관리)
  return json200()
})
