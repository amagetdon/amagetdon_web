// '자료로 초안 만들기'(AI)에서 쓰는 순수 함수들.
//  - describeSpec : 입력 칸 명세를 AI 가 읽을 글로 풀어 쓴다(키 이름·값의 모양·무엇을 적는지)
//  - sanitizeResult: AI 가 돌려준 JSON 을 명세와 대조해 걸러 낸다(모르는 키, 모양이 다른 값, 허용 안 된 그림 주소)
//  - mergeResult  : 걸러 낸 결과를 현재 자료에 합친다
// 화면·서버와 무관하게 동작한다.

import { LANDING_FORM } from './form'
import type { FormField } from './formTypes'
import type { LandingDoc } from './types'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v)

const KIND_TEXT: Record<FormField['kind'], string> = {
  text: '한 줄 글', longtext: '여러 줄 글', image: '그림 주소', date: '날짜 YYYY-MM-DD', time: '시각 HH:MM', link: '주소',
  color: '색 #RRGGBB', flag: 'true 또는 생략', select: '고르기', strings: '글자 목록', images: '그림 주소 목록',
  group: '묶음', items: '항목 목록', keyed: '이름표 붙은 묶음',
}

function describeField(f: FormField, depth: number): string[] {
  const pad = '  '.repeat(depth)
  let kind = KIND_TEXT[f.kind]
  if (f.kind === 'select') kind = `고르기: ${f.options.map((o) => `"${o.value}"(${o.label})`).join(' | ')}`
  if (f.kind === 'strings' && (f.min != null || f.max != null)) kind += ` ${f.min ?? 0}~${f.max ?? '여러'}개`
  if (f.kind === 'items') kind = `항목 목록 [{…}]${f.max != null ? ` 최대 ${f.max}개` : ''} — 항목: ${f.itemLabel}`
  if (f.kind === 'keyed') kind = `{ "${f.keyLabel}": {…} } 모양 — 항목: ${f.itemLabel}`
  const line = `${pad}- "${f.key}"${f.required ? ' (필수)' : ''} [${kind}] ${f.label}${f.hint ? ` — ${f.hint.replace(/\s*\n\s*/g, ' ')}` : ''}`
  const children = f.kind === 'group' || f.kind === 'items' || f.kind === 'keyed' ? f.fields.flatMap((c) => describeField(c, depth + 1)) : []
  return [line, ...children]
}

/** 명세를 글로 — AI 에게 "어떤 키에 어떤 모양의 값을 넣는지" 알려 준다 */
export function describeSpec(type: LandingDoc['type']): string {
  const spec = LANDING_FORM[type]
  const lines: string[] = ['## 기본 정보 (facts) — 한 번만 적는 값', ...spec.facts.flatMap((f) => describeField(f, 0)),
    '- 그 밖에 여러 섹션에서 반복해 쓸 글·숫자는 이름을 붙여 facts 에 넣고 글에서 {이름} 으로 불러 쓸 수 있습니다(값은 글 한 줄).', '', '## 섹션 (sections) — 표준 순서']
  for (const s of spec.sections) {
    lines.push(`### "${s.key}" ${s.name} (${s.required ? '필수' : '선택'}) — ${s.role}`)
    if (s.note) lines.push(`  안내: ${s.note.replace(/\s*\n\s*/g, ' ')}`)
    if (s.factsOnly) lines.push('  기본 정보만으로 만들어집니다. 아래 칸은 선택입니다.')
    if (s.toggle) lines.push('  칸을 채우지 않아도 켤 수 있는 섹션입니다. 넣으려면 {} 로라도 키를 둡니다.')
    lines.push(...s.fields.flatMap((f) => describeField(f, 1)))
  }
  return lines.join('\n')
}

export interface AgentSource { where: string; from: string }
export interface CleanResult {
  facts: Rec
  sections: Record<string, Rec>
  sources: AgentSource[]
  missing: string[]
  notes: string[]
  /** 명세와 맞지 않아 뺀 것 (검토자에게 보여 준다) */
  dropped: string[]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{1,2}:\d{2}$/
const COLOR = /^#[0-9a-fA-F]{6}$/

function sanitizeValue(f: FormField, value: unknown, path: string, allowed: Set<string>, dropped: string[]): unknown {
  const drop = (why: string) => { dropped.push(`${path}: ${why}`); return undefined }
  const str = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : null
  switch (f.kind) {
    case 'text': case 'longtext':
      return str == null ? drop('글이 아님') : str || undefined
    case 'link':
      return str == null ? drop('주소가 아님') : /^(https:\/\/|\/(?!\/)|#)/.test(str) ? str : str ? drop('쓸 수 없는 주소') : undefined
    case 'date': return str && DATE.test(str) ? str : str ? drop('날짜 형식(YYYY-MM-DD)이 아님') : undefined
    case 'time': return str && TIME.test(str) ? str.padStart(5, '0') : str ? drop('시각 형식(HH:MM)이 아님') : undefined
    case 'color': return str && COLOR.test(str) ? str : str ? drop('색 형식이 아님') : undefined
    case 'select': return str && f.options.some((o) => o.value === str) ? str : str ? drop('고를 수 없는 값') : undefined
    case 'flag': return value === true ? true : undefined
    case 'image':
      return str && allowed.has(str) ? str : str ? drop('랜딩에 쓸 그림 목록에 없는 주소') : undefined
    case 'images': {
      if (!Array.isArray(value)) return value == null ? undefined : drop('목록이 아님')
      const list = value.filter((x): x is string => typeof x === 'string' && allowed.has(x))
      if (list.length !== value.length) dropped.push(`${path}: 목록에 없는 그림 주소 ${value.length - list.length}개`)
      return list.length ? list : undefined
    }
    case 'strings': {
      if (!Array.isArray(value)) return value == null ? undefined : drop('목록이 아님')
      const list = value.map((x) => (typeof x === 'string' ? x.trim() : typeof x === 'number' ? String(x) : '')).filter(Boolean)
      return list.length ? list : undefined
    }
    case 'group':
      return isRec(value) ? sanitizeFields(f.fields, value, path, allowed, dropped) : value == null ? undefined : drop('묶음이 아님')
    case 'items': {
      if (!Array.isArray(value)) return value == null ? undefined : drop('목록이 아님')
      const first = f.fields[0]?.key
      const list = value
        .map((x, i) => (isRec(x) ? sanitizeFields(f.fields, x, `${path}[${i + 1}]`, allowed, dropped) : typeof x === 'string' && first ? sanitizeFields(f.fields, { [first]: x }, `${path}[${i + 1}]`, allowed, dropped) : undefined))
        .filter((x): x is Rec => !!x)
      return list.length ? list : undefined
    }
    case 'keyed': {
      if (!isRec(value)) return value == null ? undefined : drop('이름표 붙은 묶음이 아님')
      const out: Rec = {}
      for (const [name, item] of Object.entries(value)) {
        if (!name.trim() || !isRec(item)) { dropped.push(`${path}.${name}: 묶음이 아님`); continue }
        const clean = sanitizeFields(f.fields, item, `${path}.${name}`, allowed, dropped)
        if (clean) out[name.trim()] = clean
      }
      return Object.keys(out).length ? out : undefined
    }
  }
}

function sanitizeFields(fields: FormField[], data: Rec, path: string, allowed: Set<string>, dropped: string[], extra?: (key: string, value: unknown) => unknown): Rec | undefined {
  const out: Rec = {}
  for (const [key, value] of Object.entries(data)) {
    const f = fields.find((x) => x.key === key)
    // 검토자에게 보여 줄 위치 — 키 대신 화면의 칸 이름으로
    const here = path ? `${path} · ${f?.label ?? key}` : (f?.label ?? key)
    if (!f) {
      const kept = extra?.(key, value)
      if (kept !== undefined) out[key] = kept
      else dropped.push(`${here}: 명세에 없는 칸`)
      continue
    }
    const clean = sanitizeValue(f, value, here, allowed, dropped)
    if (clean !== undefined) out[key] = clean
  }
  return Object.keys(out).length ? out : undefined
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()) : [])

/** AI 결과를 명세와 대조해 걸러 낸다. allowedImages = 그림 칸에 넣어도 되는 주소(랜딩에 쓸 그림 + 이미 랜딩에 있는 그림) */
export function sanitizeResult(type: LandingDoc['type'], result: unknown, allowedImages: Iterable<string>): CleanResult {
  const spec = LANDING_FORM[type]
  const allowed = new Set(allowedImages)
  const dropped: string[] = []
  const r = isRec(result) ? result : {}

  // 기본 정보: 명세에 없는 키도 글·숫자 한 줄이면 '직접 이름 붙여 쓰는 값'으로 받는다
  const facts = sanitizeFields(spec.facts, isRec(r.facts) ? r.facts : {}, '기본 정보', allowed, dropped,
    (_key, value) => (typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' ? String(value) : undefined)) ?? {}

  const sections: Record<string, Rec> = {}
  for (const [key, data] of Object.entries(isRec(r.sections) ? r.sections : {})) {
    const s = spec.sections.find((x) => x.key === key)
    if (!s) { dropped.push(`${key}: 명세에 없는 섹션`); continue }
    if (!isRec(data)) { dropped.push(`${s.name}: 묶음이 아님`); continue }
    const clean = sanitizeFields(s.fields, data, s.name, allowed, dropped)
    if (clean) sections[key] = clean
    else if (s.toggle || s.factsOnly) sections[key] = {}
  }

  const sources = (Array.isArray(r.sources) ? r.sources : [])
    .filter(isRec)
    .map((x) => ({ where: String(x.where ?? '').trim(), from: String(x.from ?? '').trim() }))
    .filter((x) => x.where && x.from)

  return { facts, sections, sources, missing: strings(r.missing), notes: strings(r.notes), dropped }
}

/** 자료 안에 들어 있는 그림 주소(https)를 모은다 — 이미 랜딩에 넣은 그림은 다시 만들 때도 쓸 수 있게 */
export function collectImageUrls(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') { if (/^https:\/\/\S+\.(png|jpe?g|webp|gif|avif)(\?\S*)?$/i.test(value)) out.add(value) }
  else if (Array.isArray(value)) value.forEach((x) => collectImageUrls(x, out))
  else if (isRec(value)) Object.values(value).forEach((x) => collectImageUrls(x, out))
  return out
}

/**
 * 걸러 낸 결과를 현재 자료에 합친다.
 *  - scope 가 섹션 키면 그 섹션만 바꾼다(기본 정보는 건드리지 않음).
 *  - 섹션은 칸 단위로 덮어쓴다: AI 가 돌려준 칸은 새 값으로, 돌려주지 않은 칸(사람이 넣은 그림 등)은 그대로.
 */
export function mergeResult(doc: LandingDoc, clean: CleanResult, scope: string | null): LandingDoc {
  const sections: Rec = { ...doc.sections }
  for (const [key, data] of Object.entries(clean.sections)) {
    if (scope && key !== scope) continue
    sections[key] = { ...(isRec(sections[key]) ? (sections[key] as Rec) : {}), ...data }
  }
  const facts = scope ? doc.facts : { ...doc.facts, ...clean.facts }
  return { ...doc, facts, sections }
}
