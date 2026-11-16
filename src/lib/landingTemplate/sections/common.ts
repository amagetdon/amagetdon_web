// 무료·유료가 함께 쓰는 섹션과 작은 조각들.
import type { RenderContext } from '../context'
import type { Rec } from '../types'
import { has, list, rec, rich, str } from '../format'

/** 섹션 하나를 그리는 함수: (그 섹션의 자료, 공용 자료, 섹션 키) → 섹션 안쪽 HTML */
export type SectionBuilder = (d: Rec, ctx: RenderContext, key: string) => string

/** 값이 있을 때만 조각을 넣는다 */
export function when(condition: unknown, html: string | (() => string)): string {
  if (!has(condition)) return ''
  return typeof html === 'function' ? html() : html
}

/** 목록의 각 항목을 그려 이어 붙인다 */
export function each(value: unknown, render: (item: unknown, index: number) => string): string {
  return list(value).map(render).join('')
}

/** 빨간 "라이브" 알약 */
export function liveBadge(ctx: RenderContext): string {
  return `<span class="live">${rich(ctx.facts['진행방식'] || '라이브')}</span>`
}

/** 일정 알약: 진행 방식 + 날짜·시각 */
export function schedulePill(ctx: RenderContext, extraClass = ''): string {
  return `<p class="when${extraClass ? ` ${extraClass}` : ''}">${liveBadge(ctx)}${rich(ctx.liveWhen())}</p>`
}

/* ───────── 이런 분께 ───────── */

export const audience: SectionBuilder = d => {
  const types = list(d.audience_types)
  // 3개 이하면 큰 알약, 많으면 체크 목록
  const body = types.length <= 3
    ? `<div class="pills">${types.map(x => `<div class="rv${/\n/.test(str(x)) ? ' multi' : ''}">${rich(x)}</div>`).join('')}</div>`
    : `<ul class="checks">${types.map(x => `<li class="rv">${rich(x)}</li>`).join('')}</ul>`
  return [
    when(d.title, () => `<h2 class="h2">${rich(d.title)}</h2><div class="gap-m"></div>`),
    body,
    when(d.closing_word, () => `<div class="arrow"></div><p class="h1 rv">${rich(d.closing_word)}</p>`),
  ].join('')
}

/* ───────── 자주 묻는 질문 (유료 표준에서만 쓴다) ───────── */

export const faq: SectionBuilder = d => {
  const items = list(d.faq_items).map(rec)
  return [
    `<h2 class="h2">${rich(d.title || '자주 묻는 질문')}</h2>`,
    '<div class="faq gap-m">',
    items.map((x, i) => `<details${i === 0 ? ' open' : ''}><summary>Q. ${rich(x.q)}</summary><p>${rich(x.a)}</p></details>`).join(''),
    '</div>',
  ].join('')
}

/* ───────── 수강생 성과 ───────── */

export const studentResults: SectionBuilder = (d, ctx, key) => {
  const cases = list(d.review_summaries).map(rec)
  const card = (c: Rec) => [
    '<div class="case rv">',
    when(c.pre, () => `<p class="pre">${rich(c.pre)}</p>`),
    when(c.sub, () => `<p class="sub">${rich(c.sub)}</p>`),
    when(c.big, () => `<p class="big">${rich(c.big)}</p>`),
    when(c.tag, () => `<span class="tag">${rich(c.tag)}</span>`),
    each(c.captures, x => ctx.figure('shot', rec(x).image ?? x, rec(x).alt, key)),
    '</div>',
  ].join('')

  return [
    `<h2 class="h2 rv">${rich(d.title || '수강생 성과')}</h2>`,
    when(d.cohort_label, () => `<p class="eyebrow gap-s">${rich(d.cohort_label)}</p>`),
    `<div class="gap-m">${cases.map(card).join('')}</div>`,
    ctx.notes(d.disclaimer),
  ].join('')
}
