// 광고 매체 정의 — 관리자 '픽셀 관리' 화면과 사이트 픽셀 엔진이 함께 쓰는 단일 기준.

export type StdEvent =
  | 'PageView'
  | 'ViewContent'
  | 'Lead'
  | 'OpenChatJoin'
  | 'CompleteRegistration'
  | 'InitiateCheckout'
  | 'Purchase'

export const STD_EVENTS: { key: StdEvent; label: string }[] = [
  { key: 'PageView', label: '페이지뷰' },
  { key: 'ViewContent', label: '상세 조회' },
  { key: 'Lead', label: '무료 신청' },
  { key: 'OpenChatJoin', label: '오픈채팅 입장' },
  { key: 'CompleteRegistration', label: '회원가입' },
  { key: 'InitiateCheckout', label: '결제 시작' },
  { key: 'Purchase', label: '구매 완료' },
]

export type MediaId = 'meta' | 'gtm' | 'ga4' | 'google_ads' | 'kakao' | 'tiktok' | 'naver' | 'karrot' | 'dable' | 'taboola'

export interface MediaDef {
  id: MediaId
  name: string
  idLabel: string
  placeholder: string
  /** 저장 시 형식 검사 — 통과 못 하면 저장 막음 */
  pattern?: RegExp
  patternHint?: string
  /** 이 매체로 보낼 수 있는 이벤트(나머지는 체크박스 비활성). 빈 배열 = 이벤트 없음(스크립트만 로드) */
  supported: StdEvent[]
  /** 이벤트별 매체 쪽 이름 (화면 안내용) */
  eventNames?: Partial<Record<StdEvent, string>>
  /** 같은 매체를 여러 개 등록 가능한지 */
  multiple: boolean
  note?: string
}

export const MEDIA: MediaDef[] = [
  {
    id: 'meta', name: 'Meta (페이스북·인스타그램)', idLabel: 'Pixel ID', placeholder: '예) 1234567890123456',
    pattern: /^\d{15,16}$/, patternHint: '숫자 15~16자리',
    supported: ['PageView', 'ViewContent', 'Lead', 'OpenChatJoin', 'CompleteRegistration', 'InitiateCheckout', 'Purchase'],
    eventNames: { PageView: 'PageView', ViewContent: 'ViewContent', Lead: 'Lead', OpenChatJoin: "trackCustom('OpenChatJoin')", CompleteRegistration: 'CompleteRegistration', InitiateCheckout: 'InitiateCheckout', Purchase: 'Purchase' },
    multiple: true,
  },
  {
    id: 'gtm', name: 'Google Tag Manager', idLabel: 'Container ID', placeholder: '예) GTM-XXXXXXX',
    pattern: /^GTM-[A-Z0-9]+$/, patternHint: 'GTM- 로 시작',
    supported: [], multiple: false,
    note: '컨테이너만 불러옵니다. 이벤트는 dataLayer 로 항상 전달되고, GTM 안의 태그가 받아 처리합니다(GA4 이벤트 포함).',
  },
  {
    id: 'ga4', name: 'Google Analytics 4', idLabel: 'Measurement ID', placeholder: '예) G-XXXXXXXXXX',
    pattern: /^G-[A-Z0-9]+$/, patternHint: 'G- 로 시작',
    supported: [], multiple: false,
    note: '기본 태그(페이지뷰)만 불러옵니다. GA4 이벤트는 기존대로 GTM 에서 보냅니다. GTM 에 같은 ID 의 Google 태그가 있어도 페이지뷰는 1번만 집계됩니다.',
  },
  {
    id: 'google_ads', name: 'Google Ads', idLabel: 'Conversion ID', placeholder: '예) AW-123456789',
    pattern: /^AW-\d+$/, patternHint: 'AW- 로 시작',
    supported: ['PageView', 'Lead', 'OpenChatJoin', 'CompleteRegistration', 'Purchase'],
    eventNames: { PageView: '리마케팅(기본 config)', Lead: 'conversion (Lead 라벨)', OpenChatJoin: 'conversion (라벨 있을 때만)', CompleteRegistration: 'conversion (가입 라벨)', Purchase: 'conversion (Purchase 라벨)' },
    multiple: true,
    note: '전환 이벤트는 아래 이벤트별 전환 라벨이 있어야 전송됩니다(비워 두면 전송 안 함).',
  },
  {
    id: 'kakao', name: 'Kakao 픽셀', idLabel: 'Track ID', placeholder: '예) 1234567890123456789',
    pattern: /^\d+$/, patternHint: '숫자',
    supported: ['PageView', 'ViewContent', 'Lead', 'CompleteRegistration', 'Purchase'],
    eventNames: { PageView: 'pageView()', ViewContent: 'viewContent()', Lead: 'participation()', CompleteRegistration: 'completeRegistration()', Purchase: 'purchase()' },
    multiple: true,
  },
  {
    id: 'tiktok', name: 'TikTok', idLabel: 'Pixel ID', placeholder: '예) C1ABCDEF2GHIJ3KLMN4O',
    pattern: /^[A-Z0-9]{10,30}$/i, patternHint: '영문+숫자',
    supported: ['PageView', 'ViewContent', 'Lead', 'CompleteRegistration', 'InitiateCheckout', 'Purchase'],
    eventNames: { PageView: 'ttq.page()', ViewContent: 'ViewContent', Lead: 'Lead', CompleteRegistration: 'CompleteRegistration', InitiateCheckout: 'InitiateCheckout', Purchase: 'Purchase' },
    multiple: true,
  },
  {
    id: 'naver', name: 'Naver 전환추적', idLabel: '공통 인증키 (wa)', placeholder: '예) s_234dfs1423',
    pattern: /^s_[0-9a-z]+$/i, patternHint: 's_ 로 시작',
    supported: ['PageView', 'ViewContent', 'Lead', 'OpenChatJoin', 'CompleteRegistration', 'InitiateCheckout', 'Purchase'],
    eventNames: { PageView: 'wcs_do()', ViewContent: 'view_product', Lead: 'lead', OpenChatJoin: 'custom001', CompleteRegistration: 'sign_up', InitiateCheckout: 'begin_checkout', Purchase: 'purchase (+금액)' },
    multiple: false,
    note: '네이버 광고주시스템에서 검수 중인 전환 유형과 맞춰 두세요(오픈채팅 입장 = 사용자 정의 #1).',
  },
  {
    id: 'karrot', name: '당근 (전환 추적 코드)', idLabel: '전환 추적 코드 ID', placeholder: '당근비즈니스 광고 관리자에서 발급',
    supported: ['PageView', 'ViewContent', 'Lead', 'CompleteRegistration', 'Purchase'],
    eventNames: { PageView: 'ViewPage', ViewContent: 'ViewContent', Lead: 'Lead', CompleteRegistration: 'CompleteRegistration', Purchase: 'Purchase' },
    multiple: false,
  },
  {
    id: 'dable', name: 'Dable', idLabel: '광고 계정 번호', placeholder: '예) 001-000-001',
    supported: ['PageView', 'ViewContent', 'Lead', 'CompleteRegistration', 'Purchase'],
    eventNames: { PageView: 'PageView', ViewContent: 'ViewContent', Lead: 'Lead', CompleteRegistration: 'CompleteRegistration', Purchase: 'Purchase' },
    multiple: false,
    note: '데이블 대시보드 > 전환 스크립트의 계정 번호(dablena init 값)를 입력하세요.',
  },
  {
    id: 'taboola', name: 'Taboola', idLabel: 'Account ID', placeholder: '예) 1234567',
    pattern: /^\d+$/, patternHint: '숫자',
    supported: ['PageView', 'Lead', 'CompleteRegistration', 'Purchase'],
    eventNames: { PageView: 'page_view', Lead: 'lead', CompleteRegistration: 'complete_registration', Purchase: 'make_purchase' },
    multiple: false,
    note: 'Taboola 는 광고 관리자에서 만든 전환 이름과 같아야 잡힙니다. 다르면 아래 이벤트별 이름을 바꿔 주세요.',
  },
]

export const getMedia = (id: string): MediaDef | undefined => MEDIA.find((m) => m.id === id)

export interface AdPixelRow {
  id: number
  media: MediaId
  enabled: boolean
  scope: 'all' | 'preview'
  pixel_id: string
  events: Partial<Record<StdEvent, boolean>>
  extra: {
    /** Google Ads 이벤트별 전환 라벨 */
    labels?: Partial<Record<StdEvent, string>>
    /** Taboola 이벤트별 이름 override */
    names?: Partial<Record<StdEvent, string>>
  }
  memo: string | null
  sort_order: number
  updated_at: string
}

/** 운영 도메인 판별 — 그 외(Vercel 미리보기·로컬)는 미리보기 */
export const isProductionHost = (host = typeof window !== 'undefined' ? window.location.hostname : ''): boolean =>
  host === 'amag-class.com' || host === 'www.amag-class.com'
