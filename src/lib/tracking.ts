// 전환 이벤트 추적
//
// 설계: 모든 전환 이벤트는 (1) window.dataLayer.push() 로 GTM(→GA4)에 전달하고,
// (2) 관리자 '픽셀 관리'에서 켠 광고 매체(Meta·Google Ads·Kakao·TikTok·Naver·당근·Dable·Taboola)에
// 픽셀 엔진(lib/pixels/engine)이 매체별 형식으로 변환해 전달한다. 이벤트 발생 지점·중복 방지는 이 파일이 담당.
//
// - 모든 이벤트에 event_id 를 포함해 추후 CAPI 중복 제거에 대비한다.
// - user_email / user_phone 은 가능한 경우 함께 전달해 Meta CAPI 매칭률을 높인다.
// - value 는 숫자형, currency 는 'KRW' 고정.
// - 발화 실패는 절대 앱 동작을 막지 않는다 (try-catch 로 무음 처리).
// - 광고 매체로는 개인정보(이메일·전화)를 보내지 않는다(dataLayer 의 user_email/phone 은 기존 GTM 구성 유지).

import { stampPurchaseTouch } from './attribution'
import { dispatchPixelEvent } from './pixels/engine'

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
  dispatchPixelEvent('ViewContent', {
    contentId: params.contentId,
    contentName: params.contentName,
    contentCategory: params.contentCategory,
    instructorName: params.instructorName,
    value: params.value,
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
  // 이번 구매 경로(last touch)를 purchases 행에 기록 — 관리자 수강생/구매자 목록 '유입 경로'
  stampPurchaseTouch(params.contentId)
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
  // event_id(=orderId) 로 향후 서버 이벤트(CAPI 등)와 중복 제거
  dispatchPixelEvent('Lead', {
    contentId: params.contentId,
    contentName: params.contentName,
    contentCategory: params.contentCategory,
    instructorName: params.instructorName,
    value: 0,
    orderId: params.orderId,
    eventId: params.orderId,
  })
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
  dispatchPixelEvent('InitiateCheckout', {
    contentId: params.contentId,
    contentName: params.contentName,
    contentCategory: params.contentCategory,
    instructorName: params.instructorName,
    value: params.value,
    orderId: params.orderId,
    eventId: params.orderId,
  })
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
  stampPurchaseTouch(params.contentId)
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
  // 위 alreadyFired(주문ID) 안쪽이라 모든 매체에 같은 중복 방지가 적용됨(새로고침·뒤로가기 재발화 X)
  dispatchPixelEvent('Purchase', {
    contentId: params.contentId,
    contentName: params.contentName,
    contentCategory: params.contentCategory,
    instructorName: params.instructorName,
    value: params.value,
    orderId: params.orderId,
    eventId: params.orderId,
  })
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
  dispatchPixelEvent('CompleteRegistration', {
    method: params.method,
    eventId: params.userId ? `signup_${params.userId}` : undefined,
  })
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
  // Meta 는 trackCustom('OpenChatJoin'), 네이버는 사용자 정의 #1(custom001)
  dispatchPixelEvent('OpenChatJoin', {
    contentId: params.contentId,
    contentName: params.contentName,
    instructorName: params.instructorName,
    campaignId: resolveCampaignId(params.campaignId),
    eventId: `openchat_${params.dedupeKey}`,
  })
}
