// 전환 이벤트 추적 (GTM dataLayer 기반)
//
// 설계: 모든 전환 이벤트는 window.dataLayer.push() 로 발화하고, GTM 이 이를 받아
// GA4 / Meta Pixel (+ 향후 Meta CAPI) 로 라우팅한다. (참고: 전환이벤트설계서.md)
//
// - 모든 이벤트에 event_id 를 포함해 추후 CAPI 중복 제거에 대비한다.
// - user_email / user_phone 은 가능한 경우 함께 전달해 Meta CAPI 매칭률을 높인다.
// - value 는 숫자형, currency 는 'KRW' 고정.
// - 발화 실패는 절대 앱 동작을 막지 않는다 (try-catch 로 무음 처리).

type DataLayerObject = Record<string, unknown>

const CURRENCY = 'KRW'

/** content_id 네임스페이스 — 강의/전자책 ID 충돌을 막기 위해 prefix 를 붙인다. */
export type ContentKind = 'course' | 'ebook'

export const buildContentId = (kind: ContentKind, id: number | string): string => `${kind}_${id}`

/** content_category(상품 유형) 라벨 — 무료→유료 전환 분석용. 강의 course_type 기준. */
export function courseCategoryLabel(courseType: string | null | undefined): string {
  switch (courseType) {
    case 'free': return '무료강의'
    case 'pre_alert': return '사전알림'
    case 'premium': return '유료강의'
    default: return '강의'
  }
}

/** content_category(상품 유형) 라벨 — 전자책 is_free 기준. */
export function ebookCategoryLabel(isFree: boolean | null | undefined): string {
  return isFree ? '무료전자책' : '유료전자책'
}

/** null/undefined/'' 값을 제거한 뒤 dataLayer 에 push. */
function pushToDataLayer(payload: DataLayerObject): void {
  try {
    if (typeof window === 'undefined') return
    window.dataLayer = window.dataLayer || []
    const clean: DataLayerObject = {}
    for (const [key, val] of Object.entries(payload)) {
      if (val === undefined || val === null || val === '') continue
      // NaN/Infinity 가 value 등 숫자 필드로 새는 것을 차단 (GA4/Meta 매출 오염 방지).
      if (typeof val === 'number' && !Number.isFinite(val)) continue
      clean[key] = val
    }
    window.dataLayer.push(clean)
  } catch {
    // 트래킹 실패는 무시 — 앱 흐름에 영향 없음
  }
}

/**
 * Meta 픽셀 직접 발화 (fbq). GTM 안에 Meta 이벤트 태그를 따로 만들지 않아도 픽셀로 바로 전송된다.
 * - 직접 주입된 window.fbq 가 있을 때만 동작(없으면 무음).
 * - eventId 를 eventID 옵션으로 넘겨 향후 Meta CAPI(서버 이벤트)와 중복 제거되게 한다.
 * - custom=true 면 표준 이벤트가 아닌 trackCustom 으로 전송(OpenChatJoin 등).
 */
function fireMeta(
  eventName: string,
  params: Record<string, unknown>,
  opts?: { eventId?: string; custom?: boolean },
): void {
  try {
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
    const clean: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue
      if (typeof v === 'number' && !Number.isFinite(v)) continue
      clean[k] = v
    }
    const method = opts?.custom ? 'trackCustom' : 'track'
    if (opts?.eventId) window.fbq(method, eventName, clean, { eventID: opts.eventId })
    else window.fbq(method, eventName, clean)
  } catch {
    // 트래킹 실패는 무시
  }
}

/** 세션 단위 1회 발화 보장 (새로고침 / 리렌더 중복 방지). 이미 발화됐으면 true. */
function alreadyFired(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return true
    sessionStorage.setItem(key, '1')
    return false
  } catch {
    return false
  }
}

interface UserContact {
  email?: string | null
  phone?: string | null
}

/** 광고 캠페인 식별자 — 명시값이 없으면 UTM campaign(sessionStorage)을 fallback 으로 사용. */
function resolveCampaignId(explicit?: string | null): string | undefined {
  if (explicit) return explicit
  try {
    return sessionStorage.getItem('utm_campaign') ?? undefined
  } catch {
    return undefined
  }
}

// ─────────────────────────────────────────────────────────────
// 2. ViewContent — 강의 / 전자책 상세 페이지 조회
// ─────────────────────────────────────────────────────────────
export function trackViewItem(params: {
  contentId: string
  contentName: string
  contentCategory?: string | null
  contentSubcategory?: string | null
  instructorName?: string | null
  value: number
  user?: UserContact
}): void {
  pushToDataLayer({
    event: 'view_item',
    content_id: params.contentId,
    content_name: params.contentName,
    content_category: params.contentCategory,
    content_subcategory: params.contentSubcategory,
    content_type: 'product',
    instructor_name: params.instructorName,
    value: params.value,
    currency: CURRENCY,
    user_email: params.user?.email,
    user_phone: params.user?.phone,
  })
  // Meta 픽셀 직접 발화 (ViewContent)
  fireMeta('ViewContent', {
    content_ids: [params.contentId],
    content_name: params.contentName,
    content_type: 'product',
    content_category: params.contentCategory,
    value: params.value,
    currency: CURRENCY,
  })
}

// ─────────────────────────────────────────────────────────────
// 3. Lead — 무료 신청 완료 (0원)
// ─────────────────────────────────────────────────────────────
export function trackFreeEnroll(params: {
  orderId: string
  contentId: string
  contentName: string
  contentCategory?: string | null
  contentSubcategory?: string | null
  instructorName?: string | null
  user?: UserContact
}): void {
  // orderId 가 결정적(free_course_{id}_{userId}) 이라 더블클릭/재트리거 시 1회만 발화.
  if (alreadyFired(`tracked_free_${params.orderId}`)) return
  pushToDataLayer({
    event: 'free_enroll_complete',
    content_id: params.contentId,
    content_name: params.contentName,
    content_category: params.contentCategory,
    content_subcategory: params.contentSubcategory,
    instructor_name: params.instructorName,
    value: 0,
    currency: CURRENCY,
    order_id: params.orderId,
    event_id: params.orderId,
    user_email: params.user?.email,
    user_phone: params.user?.phone,
  })
  // Meta 픽셀 직접 발화 (Lead) — eventID 로 CAPI 중복 제거 대비
  fireMeta('Lead', {
    content_ids: [params.contentId],
    content_name: params.contentName,
    content_category: params.contentCategory,
    value: 0,
    currency: CURRENCY,
  }, { eventId: params.orderId })
}

// ─────────────────────────────────────────────────────────────
// 6. InitiateCheckout — 결제 시작 (결제창 호출 직전)
// ─────────────────────────────────────────────────────────────
export function trackBeginCheckout(params: {
  orderId: string
  contentId: string
  contentName: string
  contentCategory?: string | null
  contentSubcategory?: string | null
  instructorName?: string | null
  value: number
  user?: UserContact
}): void {
  pushToDataLayer({
    event: 'begin_checkout',
    content_id: params.contentId,
    content_name: params.contentName,
    content_category: params.contentCategory,
    content_subcategory: params.contentSubcategory,
    instructor_name: params.instructorName,
    value: params.value,
    currency: CURRENCY,
    event_id: params.orderId,
    user_email: params.user?.email,
    user_phone: params.user?.phone,
  })
  // Meta 픽셀 직접 발화 (InitiateCheckout) — eventID 로 CAPI 중복 제거 대비
  fireMeta('InitiateCheckout', {
    content_ids: [params.contentId],
    content_name: params.contentName,
    content_category: params.contentCategory,
    value: params.value,
    currency: CURRENCY,
    num_items: 1,
  }, { eventId: params.orderId })
}

// ─────────────────────────────────────────────────────────────
// 7. Purchase — 유료 구매 완료 (1원 이상)
// ─────────────────────────────────────────────────────────────
// orderId 단위 sessionStorage 중복 방지 — 완료 페이지 새로고침 시 재발화 차단.
// 실제로 발화했으면 true, 이미 발화된 주문이라 skip 했으면 false 반환.
export function trackPurchase(params: {
  orderId: string
  contentId: string
  contentName: string
  contentCategory?: string | null
  contentSubcategory?: string | null
  instructorName?: string | null
  value: number
  coupon?: string | null
  user?: UserContact
}): boolean {
  if (alreadyFired(`tracked_purchase_${params.orderId}`)) return false
  pushToDataLayer({
    event: 'paid_purchase_complete',
    order_id: params.orderId,
    event_id: params.orderId,
    content_id: params.contentId,
    content_name: params.contentName,
    content_category: params.contentCategory,
    content_subcategory: params.contentSubcategory,
    content_type: 'product',
    instructor_name: params.instructorName,
    value: params.value,
    currency: CURRENCY,
    coupon: params.coupon ?? '',
    user_email: params.user?.email,
    user_phone: params.user?.phone,
    items: [{
      item_id: params.contentId,
      item_name: params.contentName,
      item_category: params.contentCategory ?? undefined,
      item_category2: params.contentSubcategory ?? undefined,
      price: params.value,
      quantity: 1,
    }],
  })
  // Meta 픽셀 직접 발화 (Purchase) — eventID(=orderId) 로 CAPI 중복 제거 대비
  fireMeta('Purchase', {
    content_ids: [params.contentId],
    content_name: params.contentName,
    content_type: 'product',
    content_category: params.contentCategory,
    value: params.value,
    currency: CURRENCY,
    contents: [{ id: params.contentId, quantity: 1 }],
  }, { eventId: params.orderId })
  return true
}

// ─────────────────────────────────────────────────────────────
// 5. CompleteRegistration — 회원가입 완료
// ─────────────────────────────────────────────────────────────
export type SignupMethod = 'kakao' | 'naver' | 'google' | 'email' | 'guest'

export function trackSignUp(params: {
  method: SignupMethod
  userId?: string | null
  user?: UserContact
}): void {
  // 같은 유저는 1회만 — OAuth SIGNED_IN 이 여러 번 발생해도 중복 발화 방지.
  if (params.userId && alreadyFired(`tracked_signup_${params.userId}`)) return
  pushToDataLayer({
    event: 'sign_up_complete',
    signup_method: params.method,
    event_id: params.userId ? `signup_${params.userId}` : undefined,
    user_email: params.user?.email,
    user_phone: params.user?.phone,
  })
  // Meta 픽셀 직접 발화 (CompleteRegistration)
  fireMeta('CompleteRegistration', {
    status: true,
    registration_method: params.method,
  }, { eventId: params.userId ? `signup_${params.userId}` : undefined })
}

// ─────────────────────────────────────────────────────────────
// 4. OpenChatJoin — 오픈채팅 입장
// ─────────────────────────────────────────────────────────────
export function trackOpenChatJoin(params: {
  dedupeKey: string
  contentId?: string | null
  contentName?: string | null
  instructorName?: string | null
  campaignId?: string | null
  user?: UserContact
}): void {
  // 동일 안내 링크에 대해 1회만 — 자동 오픈 + '지금 열기' 클릭 양쪽에서 호출돼도 중복 방지.
  if (alreadyFired(`tracked_openchat_${params.dedupeKey}`)) return
  pushToDataLayer({
    event: 'open_chat_join',
    content_id: params.contentId,
    content_name: params.contentName,
    instructor_name: params.instructorName,
    campaign_id: resolveCampaignId(params.campaignId),
    event_id: `openchat_${params.dedupeKey}`,
    user_email: params.user?.email,
    user_phone: params.user?.phone,
  })
  // Meta 픽셀 직접 발화 (OpenChatJoin — 표준 이벤트가 아니라 trackCustom)
  fireMeta('OpenChatJoin', {
    content_ids: params.contentId ? [params.contentId] : undefined,
    content_name: params.contentName,
    instructor_name: params.instructorName,
    campaign_id: resolveCampaignId(params.campaignId),
  }, { eventId: `openchat_${params.dedupeKey}`, custom: true })
}
