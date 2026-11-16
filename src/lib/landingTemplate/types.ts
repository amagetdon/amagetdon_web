// 템플릿 랜딩의 자료 형식과 결과 형식. 자세한 필드 설명은 README.md 참고.

export interface LandingTheme {
  /** 강조색(#RRGGBB). 없으면 기본 파랑 */
  accent?: string
  /** 바탕이 밝은 강의인지 어두운 강의인지 */
  base?: 'light' | 'dark'
  /** 최상위 플랜·포인트에 쓰는 두 번째 색(#RRGGBB) */
  top?: string
}

export interface LandingDoc {
  version: 1
  type: 'free' | 'paid'
  theme?: LandingTheme
  /** 날짜·시각·대표 숫자처럼 한 번만 적는 기본 정보 (한글 키) */
  facts: Record<string, unknown>
  /** 섹션 키 → 그 섹션의 자료 */
  sections: Record<string, unknown>
}

export interface LandingReport {
  /** 사용한 섹션 이름(순서대로) */
  used: string[]
  /** 자료가 없어 뺀 선택 섹션 */
  skipped: string[]
  /** 자료가 부족한 필수 섹션과 필요한 자료 */
  lacking: string[]
  /** 검사에서 걸린 것 ("[종류] 설명") */
  checks: string[]
  /** 문제 없이 통과한 검사 수 */
  passed: number
}

export interface LandingRenderOptions {
  /** 그림 값이 주소가 아니라 파일 이름일 때 주소로 바꿔 주는 함수 */
  resolveImage?: (file: string) => string
}

export type LandingFieldType = 'text' | 'longtext' | 'list' | 'image' | 'images' | 'date' | 'link' | 'number' | 'flag'

export interface LandingFieldSpec {
  key: string
  label_ko: string
  type: LandingFieldType
  required: boolean
  hint_ko?: string
}

export interface LandingSectionSpec {
  key: string
  name_ko: string
  role: string
  required: boolean
  /** 무료 표준 12블록에서의 순번 */
  block?: number
  /** 기존 랜딩 조사에서 이 섹션이 보인 횟수 / 조사한 랜딩 수 */
  seen_in?: number
  total?: number
  fields: LandingFieldSpec[]
  /** 이 중 하나만 있어도 섹션을 만들 수 있는 필드 키 */
  any_of?: string[]
  variants: string[]
  fallback_ko?: string
}

/** 형식을 알 수 없는 자료 묶음 */
export type Rec = Record<string, unknown>
