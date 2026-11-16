// 어드민 입력 화면을 그리기 위한 명세의 타입.
// 섹션마다 어떤 칸을 어떤 입력 방식으로 받을지를 자료(LandingDoc)의 모양 그대로 적는다. 실제 명세는 form.ts.

interface FormFieldBase {
  /** 자료에서의 키 (facts 는 한글 키, sections 는 영문 키) */
  key: string
  /** 화면에 보이는 이름 */
  label: string
  /** 칸 아래 도움말 — 무엇을, 어떤 자료에서 가져와 적는지 */
  hint?: string
  placeholder?: string
  /** 이 칸이 비면 섹션을 만들 수 없음 */
  required?: boolean
}

/** 한 줄 글 / 여러 줄 글 / 그림 1장 / 날짜(YYYY-MM-DD) / 시각(HH:MM) / 주소 / 색(#RRGGBB) / 켜고 끄기(true) */
export interface FormScalarField extends FormFieldBase {
  kind: 'text' | 'longtext' | 'image' | 'date' | 'time' | 'link' | 'color' | 'flag'
}

/** 정해진 값 중 하나 */
export interface FormSelectField extends FormFieldBase {
  kind: 'select'
  options: { value: string; label: string }[]
}

/** 글자 목록(string[]) */
export interface FormStringsField extends FormFieldBase {
  kind: 'strings'
  /** 항목 하나를 부르는 말 (예: "고민", "오해") */
  itemLabel?: string
  /** 항목이 여러 줄 글인지 */
  long?: boolean
  min?: number
  max?: number
}

/** 그림 여러 장(string[]) */
export interface FormImagesField extends FormFieldBase {
  kind: 'images'
  max?: number
}

/** 묶음 — 안에 칸이 있는 객체 */
export interface FormGroupField extends FormFieldBase {
  kind: 'group'
  fields: FormField[]
}

/** 항목 목록 — 같은 모양의 객체가 여러 개(예: 선물 3개, 증빙 2건). 저장된 항목이 글자 하나면 첫 칸의 값으로 본다. */
export interface FormItemsField extends FormFieldBase {
  kind: 'items'
  itemLabel: string
  fields: FormField[]
  min?: number
  max?: number
}

/** 이름표가 붙은 묶음 — 키가 이름인 객체(예: 대표숫자 { "연매출": {…} }, 회차별 상세 { "1": {…} }) */
export interface FormKeyedField extends FormFieldBase {
  kind: 'keyed'
  /** 이름(키) 칸의 이름 (예: "숫자 이름", "회차 번호") */
  keyLabel: string
  itemLabel: string
  fields: FormField[]
}

export type FormField =
  | FormScalarField | FormSelectField | FormStringsField | FormImagesField
  | FormGroupField | FormItemsField | FormKeyedField

export interface FormSection {
  /** sections 의 키 */
  key: string
  name: string
  /** 이 섹션이 방문자에게 하는 일 (한 줄) */
  role: string
  required: boolean
  /** 무료 12블록 순번 */
  block?: number
  /** 섹션 머리에 보여 줄 안내 (예: "셋 중 하나만 채워도 됩니다") */
  note?: string
  /** 내용이 기본 정보(facts)에서만 오는 섹션 — 칸이 없어도 들어간다 */
  factsOnly?: boolean
  /** 선택 섹션인데 칸을 채우지 않아도 켜 둘 수 있는 섹션(자료에 키를 {} 로 넣어야 나옴) */
  toggle?: boolean
  fields: FormField[]
}

export interface FormSpec {
  /** 기본 정보(facts) — 한 번만 적는 값 */
  facts: FormField[]
  /** 표준 순서대로 */
  sections: FormSection[]
}

export interface LandingFormSpec {
  /** 색·바탕 (doc.theme) */
  theme: FormField[]
  free: FormSpec
  paid: FormSpec
}
