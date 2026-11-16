// 표준 순서대로 섹션을 조립한다: 자료가 없는 선택 섹션은 빼고, 필수 섹션의 빈 자료는 보고서에 적는다.
import type { RenderContext } from './context'
import type { LandingFieldSpec, LandingSectionSpec, Rec } from './types'
import { has, isRec, list, rec, str } from './format'
import type { SectionBuilder } from './sections/common'
import { applyBand, FREE_BUILDERS } from './sections/free'
import { PAID_BUILDERS } from './sections/paid'

type Tone = 'light' | 'tint' | 'dark' | 'dark2' | 'accent'

/* 바탕색 규칙: [밝은 바탕 강의, 어두운 바탕 강의] */
const TONE: Record<'free' | 'paid', Record<string, [Tone, Tone]>> = {
  free: {
    hook: ['tint', 'dark'],
    gift: ['dark', 'dark2'],
    cta_band: ['accent', 'accent'],
    empathy: ['dark', 'light'],
    instructor: ['light', 'dark2'],
    proof: ['dark', 'dark'],
    concept: ['light', 'light'],
    objection: ['tint', 'tint'],
    comparison: ['light', 'light'],
    student_results: ['dark', 'dark'],
    takeaways: ['tint', 'tint'],
    closing: ['light', 'dark2'],
    schedule_cta: ['dark', 'dark'],
  },
  paid: {
    hook: ['light', 'dark'],
    worries_answers: ['tint', 'tint'],
    instructor_authority: ['accent', 'accent'],
    student_results: ['dark', 'dark'],
    deadline: ['dark', 'dark2'],
    cta: ['dark', 'dark2'],
    calendar: ['tint', 'tint'],
    summary: ['light', 'light'],
    curriculum: ['tint', 'tint'],
    syllabus_button: ['tint', 'tint'],
    plans_benefits: ['dark', 'dark'],
    guarantee: ['dark2', 'dark2'],
    plan_guide: ['light', 'light'],
    audience: ['dark2', 'dark2'],
    faq: ['tint', 'tint'],
    future_price: ['light', 'light'],
    instructor_closing: ['dark', 'dark'],
    final_cta: ['accent', 'accent'],
    copyright: ['dark2', 'dark2'],
  },
}
// 앞 섹션과 바탕이 같아지면 비슷한 다른 바탕으로 바꾼다
const SWAP: Partial<Record<Tone, Tone>> = { light: 'tint', tint: 'light', dark: 'dark2', dark2: 'dark' }
// 앞 섹션과 한 덩어리로 붙는 섹션
const JOIN_PREVIOUS = new Set(['cta', 'syllabus_button'])
// 기본 정보만으로 만들어지는 섹션(sections 에 없어도 자료가 있다고 본다)
const FACT_ONLY = new Set(['schedule_cta', 'deadline', 'cta', 'calendar'])

/* 기준서의 필드가 기본 정보(facts)에서 채워지는 경우 */
const FACT_FIELDS: Record<string, (ctx: RenderContext) => unknown> = {
  course_title: ctx => ctx.rawFacts['강의명'],
  instructor_name: ctx => ctx.rawFacts['강사명'],
  instructor_title: ctx => ctx.rawFacts['강사_수식어'],
  instructor_line: ctx => ctx.rawFacts['강사_한줄'],
  live_date: ctx => rec(ctx.rawFacts['라이브'])['날짜'],
  live_time: ctx => rec(ctx.rawFacts['라이브'])['시각'],
  delivery_method: ctx => ctx.rawFacts['진행방식'],
  replay_policy: ctx => ctx.rawFacts['다시보기'],
  entry_guide: ctx => ctx.rawFacts['입장방법'],
  cta_label: ctx => ctx.rawFacts['버튼문구'],
  cta_link: ctx => ctx.rawFacts['신청주소'],
  payment_note: ctx => ctx.rawFacts['결제안내'],
  gift_condition: ctx => ctx.rawFacts['선물조건'],
  apply_deadline: ctx => rec(ctx.rawFacts['신청마감'])['날짜'],
  start_date: ctx => ctx.startDate(),
  sessions: ctx => ctx.sessions,
  session_titles: ctx => ctx.sessions.map(s => s['제목']).filter(Boolean),
  replay_upload: ctx => rec(ctx.rawFacts['다시보기'])['업로드'],
  replay_period: ctx => rec(ctx.rawFacts['다시보기'])['기간'],
  plans: ctx => ctx.plans,
  plan_taglines: ctx => ctx.plans.map(p => p['한줄']).filter(Boolean),
  recommended_plan: ctx => ctx.plans.filter(p => p['추천']),
}

/* 다른 필드 안에 들어 있는 자료로 채워지는 경우 */
const ALIAS: Record<string, (d: Rec) => unknown> = {
  // 후기 캡처는 사례 카드 안에 들어 있다
  review_captures: d => list(d.review_summaries).flatMap(c => list(rec(c).captures)),
  // 애프터 한 줄은 이전→이후 묶음으로 대신할 수 있다
  after_line: d => d.after_line || d.proof_summary,
}

function fieldValue(ctx: RenderContext, sectionKey: string, fieldKey: string): unknown {
  const d = rec(ctx.rawSections[sectionKey])
  const alias = ALIAS[fieldKey]?.(d)
  if (has(alias)) return alias
  if (has(d[fieldKey])) return d[fieldKey]
  return FACT_FIELDS[fieldKey]?.(ctx)
}

const describeNeed = (f: LandingFieldSpec) => `${f.label_ko}${f.hint_ko ? ` (${f.hint_ko})` : ''}`

/** 섹션에 지금 빠져 있는 필수 자료 설명 목록 */
function missingNeeds(ctx: RenderContext, sp: LandingSectionSpec): { missing: string[]; requiredCount: number } {
  const required = sp.fields.filter(f => f.required)
  const missing = required.filter(f => !has(fieldValue(ctx, sp.key, f.key))).map(describeNeed)
  let requiredCount = required.length
  if (sp.any_of?.length) {
    requiredCount++
    if (!sp.any_of.some(k => has(fieldValue(ctx, sp.key, k)))) {
      const labels = sp.any_of.map(k => sp.fields.find(f => f.key === k)?.label_ko ?? k)
      missing.push(`다음 중 하나: ${labels.join(' · ')}`)
    }
  }
  return { missing, requiredCount }
}

function allRequiredNeeds(sp: LandingSectionSpec): string {
  const needs = sp.fields.filter(f => f.required).map(describeNeed)
  if (sp.any_of?.length) needs.push(`다음 중 하나: ${sp.any_of.map(k => sp.fields.find(f => f.key === k)?.label_ko ?? k).join(' · ')}`)
  return needs.join(' / ')
}

/** 섹션들을 순서대로 그려 <section> 문자열 목록으로 돌려준다 */
export function assembleSections(ctx: RenderContext, darkBase: boolean): string[] {
  const { report, rawSections, type } = ctx
  const builders: Record<string, SectionBuilder> = type === 'free' ? FREE_BUILDERS : PAID_BUILDERS
  const out: string[] = []
  let previousTone: Tone | '' = ''

  function push(key: string, name: string | null, html: string) {
    if (!html) return
    let tone: Tone = (TONE[type][key] ?? ['light', 'light'])[darkBase ? 1 : 0]
    const joined = JOIN_PREVIOUS.has(key) && previousTone !== ''
    if (joined) tone = previousTone as Tone
    else if (tone === previousTone) tone = SWAP[tone] ?? tone
    out.push(`<section class="sec t-${tone} s-${key}${joined ? ' tight-top' : ''}" data-sec="${key}">${html}</section>`)
    previousTone = tone
    if (name) report.used.push(name)
  }

  for (const sp of ctx.spec) {
    const key = sp.key
    const present = key in rawSections || FACT_ONLY.has(key)
    const { missing, requiredCount } = missingNeeds(ctx, sp)
    // 강의명은 어느 강의에나 있으므로 "자료가 있다"의 근거로 치지 않는다
    const anyMaterial = present && sp.fields.some(f => has(fieldValue(ctx, key, f.key)) && !(f.key === 'course_title' && !FACT_ONLY.has(key)))

    if (!sp.required) {
      if (!present) {
        const required = sp.fields.filter(f => f.required)
        const fixedTextOnly = !missing.length && required.length > 0
        report.skipped.push(fixedTextOnly
          ? `${sp.name_ko} — 고정 문구라 자료는 충분하지만, 넣을지 정해지지 않아 뺌`
          : `${sp.name_ko} — 자료 없음. 넣으려면: ${(required.length ? required : sp.fields).map(f => f.label_ko).join(', ')}`)
        continue
      }
      if (missing.length) {
        report.skipped.push(`${sp.name_ko} — 자료가 일부만 있어 뺌. 빠진 것: ${missing.join(' / ')}`)
        continue
      }
    } else {
      const nothingAtAll = missing.length > 0 && missing.length === requiredCount && !has(rawSections[key])
      if (!anyMaterial || nothingAtAll) {
        report.lacking.push(`${sp.name_ko} — 자료가 전혀 없어 이번 페이지에서는 섹션이 빠졌습니다. 필요한 자료: ${allRequiredNeeds(sp)}${sp.fallback_ko ? ` · 대안: ${sp.fallback_ko}` : ''}`)
        continue
      }
      if (missing.length) report.lacking.push(`${sp.name_ko} — 섹션은 만들었지만 빠진 자료: ${missing.join(' / ')}`)
    }

    const builder = builders[key]
    if (!builder) continue
    try {
      push(key, sp.name_ko, builder(ctx.sections[key] ?? {}, ctx, key))
    } catch (e) {
      ctx.flag('오류', `${sp.name_ko}: 자료 형식이 맞지 않아 섹션을 만들지 못했습니다. (${e instanceof Error ? e.message : str(e)})`)
      continue
    }

    // 무료: 참여 선물 바로 뒤에 신청 묶음(강의명 + 일시 + 버튼)을 붙인다
    if (type === 'free' && key === 'gift') push('cta_band', null, applyBand(ctx))
  }

  // 표준에 없는 섹션 키는 그리지 않고 알려 준다
  const known = new Set(ctx.spec.map(sp => sp.key))
  const unknown = Object.keys(rawSections).filter(k => !known.has(k))
  if (unknown.length) {
    ctx.flag('확인 필요', `${type === 'free' ? '무료' : '유료'} 표준에 없는 섹션이라 넣지 않았습니다: ${unknown.join(', ')}`)
  }
  for (const [key, value] of Object.entries(rawSections)) {
    if (known.has(key) && !isRec(value)) ctx.flag('확인 필요', `${ctx.sectionName(key)}: 섹션 자료는 { … } 형태여야 합니다.`)
  }
  return out
}
