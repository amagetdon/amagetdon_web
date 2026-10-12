export type ExternalServiceId =
  | 'GOOGLE_TAG_MANAGER'
  | 'NAVER_SEARCH_ADVISOR'
  | 'GOOGLE_SEARCH_CONSOLE'
  | 'KAKAO_PLUS_FRIEND'
  | 'GOOGLE_ANALYTICS'
  | 'KAKAO_LOGIN'
  | 'CHANNEL_TALK'
  | 'KAKAO_SHARE'
  | 'META_PIXEL'
  | 'META_DOMAIN_VERIFICATION'
  | 'NAVER_CTS'

export interface ExternalServiceDefinition {
  id: ExternalServiceId
  name: string
  description: string
  placeholder: string
  codeLabel?: string
}

export interface ExternalServiceItem {
  code: string
  enabled: boolean
}

export type ExternalServiceSettings = Record<ExternalServiceId, ExternalServiceItem>

// GTM · GA4 · 메타 픽셀 · 네이버 전환추적은 관리자 '픽셀 관리'(ad_pixels)로 이전되어 목록에서 제외 (ID 타입은 기존 저장값 호환용으로 유지)
export const EXTERNAL_SERVICE_DEFINITIONS: ExternalServiceDefinition[] = [
  {
    id: 'NAVER_SEARCH_ADVISOR',
    name: '네이버 서치 어드바이저',
    description: '네이버 서치 어드바이저에 사용될 코드를 입력해주세요.',
    placeholder: '예) kd17s7cvaz',
  },
  {
    id: 'GOOGLE_SEARCH_CONSOLE',
    name: '구글 서치 콘솔',
    description: '구글 서치 콘솔 소유권 확인 메타 태그 값을 입력해주세요.',
    placeholder: '예) abcdEfGh1234...',
  },
  {
    id: 'KAKAO_PLUS_FRIEND',
    name: '카카오 플러스친구',
    description: '카카오 플러스친구 홈 URL 또는 ID를 입력해주세요.',
    placeholder: '예) _xabcxb 또는 https://pf.kakao.com/_xabcxb',
  },
  {
    id: 'KAKAO_LOGIN',
    name: '카카오 로그인',
    description: '카카오 개발자 센터에서 발급받은 JavaScript 키를 입력해주세요.',
    placeholder: '예) 1a2b3c4d5e6f7g8h9i',
  },
  {
    id: 'CHANNEL_TALK',
    name: '채널톡',
    description: '채널톡 플러그인 키를 입력해주세요.',
    placeholder: '예) 00000000-0000-0000-0000-000000000000',
  },
  {
    id: 'KAKAO_SHARE',
    name: '카카오톡 공유',
    description: '카카오톡 공유 기능에 사용할 JavaScript 키를 입력해주세요.',
    placeholder: '예) 1a2b3c4d5e6f7g8h9i',
  },
  {
    id: 'META_DOMAIN_VERIFICATION',
    name: '메타 도메인 인증',
    description: '메타 비즈니스에서 발급받은 도메인 인증 코드(meta content 값)를 입력해주세요.',
    placeholder: '예) abcd1234efgh5678ijkl...',
  },
]

export const getExternalServiceDefinition = (id: string): ExternalServiceDefinition | undefined =>
  EXTERNAL_SERVICE_DEFINITIONS.find((d) => d.id === id)
