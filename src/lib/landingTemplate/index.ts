// 템플릿 랜딩 — 섹션 자료(LandingDoc)를 표준 순서의 페이지로 그린다. 자료 형식은 README.md 참고.
import type { LandingDoc, LandingRenderOptions, LandingReport } from './types'
import { assembleSections } from './assemble'
import { runChecks } from './checks'
import { createContext } from './context'
import { LANDING_CSS } from './css'
import { LANDING_SPEC } from './spec'
import { themeVariables } from './theme'

export type {
  LandingDoc, LandingFieldSpec, LandingFieldType, LandingRenderOptions, LandingReport, LandingSectionSpec, LandingTheme,
} from './types'
export { isLandingDoc } from './guard'
export { mountLandingBehaviors } from './behaviors'
export { LANDING_SPEC } from './spec'

/**
 * 순수 함수. 브라우저·Node 어디서나 동작(fs·DOM 사용 금지).
 * - html: 루트 요소 하나(<div class="lpt" style="--ac:…">…</div>). script·style 태그는 없다.
 * - css: 모든 문서에 공통인 스타일(.lpt 아래로만 적용). 호스트가 한 번만 넣으면 된다.
 * - report: 사용한 섹션·뺀 섹션·부족한 자료·검사 결과.
 */
export function renderLanding(doc: LandingDoc, options: LandingRenderOptions = {}): { html: string; css: string; report: LandingReport } {
  const type = doc.type === 'paid' ? 'paid' : 'free'
  const ctx = createContext({ ...doc, type }, LANDING_SPEC[type], options)
  const sections = assembleSections(ctx, doc.theme?.base === 'dark')
  runChecks(ctx)

  const html = `<div class="lpt" style="${themeVariables(doc.theme)}">${sections.join('')}</div>`
  return { html, css: LANDING_CSS, report: ctx.report }
}
