// 한 번의 그리기에 쓰는 공용 자료: 기본 정보 불러 쓰기({이름}), 그림·버튼 만들기, 보고서 기록.
import type { LandingDoc, LandingRenderOptions, LandingReport, LandingSectionSpec, Rec } from './types'
import {
  esc, formatDate, formatTime, has, isDateString, isRec, isSafeImageUrl, isSafeLinkUrl, isTimeString, list, rec, rich, str,
} from './format'

export interface UnresolvedToken {
  where: string
  token: string
}

export interface RenderContext {
  type: 'free' | 'paid'
  spec: LandingSectionSpec[]
  /** 입력 그대로의 기본 정보·섹션 자료 */
  rawFacts: Rec
  rawSections: Rec
  /** {이름} 을 값으로 바꾼 기본 정보·섹션 자료 */
  facts: Rec
  sections: Record<string, Rec>
  sessions: Rec[]
  plans: Rec[]
  /** 목록에서 세어 만든 값: 본강의수·회차수·플랜수 */
  computed: Record<string, number>
  /** 기본 정보 이름 → 그 값을 불러 쓴 섹션들 */
  tokenUse: Map<string, Set<string>>
  unresolved: UnresolvedToken[]
  /** 그림 주소 → 쓰인 섹션들 */
  usedImages: Map<string, string[]>
  report: LandingReport

  flag(kind: string, message: string): void
  pass(): void
  sectionName(key: string): string
  /** 안전한 주소면 <img>, 아니면 빈 문자열(보고서에 적는다) */
  image(value: unknown, alt: unknown, where: string): string
  /** 그림이 있을 때만 <figure class="…"> 로 감싼다 */
  figure(className: string, value: unknown, alt: unknown, where: string): string
  /** 그림 값을 실제 주소로(쓸 수 없으면 null). 기록은 남기지 않는다 */
  imageUrl(value: unknown): string | null
  applyButton(label?: unknown): string
  notes(value: unknown): string
  liveWhen(): string
  deadlineText(): string
  startDate(): string
  titleBlock(headingClass?: string): string
}

const TOKEN_RE = /\{([^{}|]+)(?:\|([^{}]+))?\}/g
const MAX_TOKEN_DEPTH = 5

export function createContext(doc: LandingDoc, spec: LandingSectionSpec[], options: LandingRenderOptions): RenderContext {
  const rawFacts = rec(doc.facts)
  const rawSections = rec(doc.sections)
  const rawSessions = list(rawFacts['회차']).filter(isRec)
  const rawPlans = list(rawFacts['플랜']).filter(isRec)

  const computed: Record<string, number> = {
    본강의수: rawSessions.filter(s => !s['한정플랜']).length,
    회차수: rawSessions.length,
    플랜수: rawPlans.length,
  }
  const report: LandingReport = { used: [], skipped: [], lacking: [], checks: [], passed: 0 }
  const tokenUse = new Map<string, Set<string>>()
  const unresolved: UnresolvedToken[] = []
  const usedImages = new Map<string, string[]>()

  /* ── {이름} / {이름|형식} 불러 쓰기 ── */

  // "회차.1.시각" 처럼 점으로 이어진 이름을 따라간다. 목록은 번호(또는 순서)로 찾는다.
  function lookup(path: string): unknown {
    let cur: unknown = { ...rawFacts, ...computed }
    for (const part of path.split('.')) {
      if (cur == null) return undefined
      if (Array.isArray(cur)) {
        cur = cur.find(x => isRec(x) && String(x['번호']) === part) ?? cur[Number(part) - 1]
      } else if (isRec(cur)) {
        cur = cur[part]
      } else {
        return undefined
      }
    }
    if (isRec(cur) && '값' in cur) cur = cur['값']
    return cur
  }

  function resolveText(text: string, where: string, depth = 0): string {
    return text.replace(TOKEN_RE, (token: string, rawName: string, format?: string) => {
      const name = rawName.trim()
      const value = lookup(name)
      if (value == null || typeof value === 'object') {
        unresolved.push({ where, token })
        return token
      }
      if (!tokenUse.has(name)) tokenUse.set(name, new Set())
      tokenUse.get(name)?.add(where)

      let out = String(value)
      if (isDateString(out)) out = formatDate(out, format)
      else if (isTimeString(out)) out = formatTime(out)
      return depth < MAX_TOKEN_DEPTH ? resolveText(out, where, depth + 1) : out
    })
  }

  function resolveDeep(value: unknown, where: string): unknown {
    if (typeof value === 'string') return resolveText(value, where)
    if (Array.isArray(value)) return value.map(x => resolveDeep(x, where))
    if (isRec(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveDeep(v, where)]))
    return value
  }

  const sections: Record<string, Rec> = {}
  for (const key of Object.keys(rawSections)) sections[key] = rec(resolveDeep(rawSections[key], key))
  const facts = rec(resolveDeep(rawFacts, 'facts'))
  const sessions = list(facts['회차']).filter(isRec)
  const plans = list(facts['플랜']).filter(isRec)

  /* ── 보고서 ── */

  const flag = (kind: string, message: string) => { report.checks.push(`[${kind}] ${message}`) }
  const pass = () => { report.passed++ }
  const sectionName = (key: string) => {
    if (key === 'facts') return '기본 정보'
    return spec.find(x => x.key === key)?.name_ko ?? key
  }

  /* ── 그림 ── */

  function imageUrl(value: unknown): string | null {
    const raw = str(value).trim()
    if (!raw) return null
    if (isSafeImageUrl(raw)) return raw
    // 주소가 아니면 파일 이름으로 보고 호스트가 준 함수로 바꾼다
    let resolved = raw
    try {
      if (options.resolveImage) resolved = str(options.resolveImage(raw))
    } catch {
      resolved = raw
    }
    return isSafeImageUrl(resolved) ? resolved : null
  }

  let imageCount = 0
  function image(value: unknown, alt: unknown, where: string): string {
    const raw = str(value).trim()
    if (!raw) return ''
    const url = imageUrl(raw)
    if (!url) {
      flag('그림 주소', `${sectionName(where)}: “${raw}” — https:// 또는 / 로 시작하는 주소만 쓸 수 있어 그림을 뺐습니다.`)
      return ''
    }
    usedImages.set(url, [...(usedImages.get(url) ?? []), where])
    // 페이지의 첫 그림만 바로 받고, 나머지는 보일 때 받는다
    const loading = imageCount++ === 0 ? ' fetchpriority="high"' : ' loading="lazy"'
    return `<img src="${esc(url)}" alt="${esc(alt)}" decoding="async"${loading}>`
  }

  function figure(className: string, value: unknown, alt: unknown, where: string): string {
    const img = image(value, alt, where)
    return img ? `<figure class="${className}">${img}</figure>` : ''
  }

  /* ── 신청 버튼 ── */

  const rawApply = str(facts['신청주소']).trim()
  let applyHref = '#apply'
  if (rawApply) {
    if (isSafeLinkUrl(rawApply)) applyHref = rawApply
    else flag('주소', `기본 정보: 신청주소 “${rawApply}” — https://, / 또는 # 로 시작하는 주소만 쓸 수 있어 #apply 로 바꿨습니다.`)
  }

  function applyButton(label?: unknown): string {
    const text = has(label) ? label : has(facts['버튼문구']) ? facts['버튼문구'] : '신청하기'
    return `<a href="${esc(applyHref)}" class="btn" data-lpt-apply>${rich(text)} <i>&rsaquo;&rsaquo;&rsaquo;</i></a>`
  }

  /* ── 자주 쓰는 조각 ── */

  function notes(value: unknown): string {
    if (!has(value)) return ''
    const items = Array.isArray(value) ? value : [value]
    return `<ul class="note">${items.map(x => `<li>${rich(x)}</li>`).join('')}</ul>`
  }

  const dateTime = (value: unknown) => {
    const v = rec(value)
    return has(v['날짜']) ? `${formatDate(v['날짜'])} ${formatTime(v['시각'])}`.trim() : ''
  }
  const liveWhen = () => dateTime(facts['라이브'])
  const deadlineText = () => dateTime(facts['신청마감'])
  const startDate = () => str(facts['개강일']) || str(sessions[0]?.['날짜'])

  function titleBlock(headingClass = 'h2'): string {
    const upper = has(facts['강의명_윗줄']) ? `<p class="eyebrow solid">${rich(facts['강의명_윗줄'])}</p>` : ''
    return `${upper}<h2 class="${headingClass}">${rich(facts['강의명_제목'] || facts['강의명'])}</h2>`
  }

  return {
    type: doc.type, spec, rawFacts, rawSections, facts, sections, sessions, plans, computed,
    tokenUse, unresolved, usedImages, report,
    flag, pass, sectionName, image, figure, imageUrl, applyButton, notes, liveWhen, deadlineText, startDate, titleBlock,
  }
}
