// 무료 랜딩 12블록의 섹션 그리기.
import type { RenderContext } from '../context'
import type { Rec } from '../types'
import { formatDate, formatTime, has, isRec, list, objectParticle, plain, rec, rich, str } from '../format'
import { each, liveBadge, schedulePill, studentResults, when, type SectionBuilder } from './common'

/* ───────── 1. 첫 화면 배너 ───────── */

// 표시(==…==)가 없으면 2번째 줄을 강조색으로
function bannerTitle(value: unknown): string {
  const text = str(value)
  if (text.includes('==')) return rich(text)
  return text.split('\n').map((line, i) => (i === 1 ? `<em class="hl">${rich(line)}</em>` : rich(line))).join('<br>')
}

// 이름표: 윗줄(별칭 · 직함) + 이름
function nameTag(ctx: RenderContext): string {
  const F = ctx.facts
  if (!has(F['강사명'])) return ''
  const upper = [F['강사_별칭'], F['강사_직함'] || F['강사_수식어']].filter(has).map(rich).join(' · ')
  return `<div class="nametag">${upper ? `<small>${upper}</small>` : ''}<b>${rich(F['강사명'])}</b></div>`
}

const hook: SectionBuilder = (d, ctx, key) => {
  const photo = ctx.image(d.instructor_photo, `${plain(ctx.facts['강사명'])} 강사`, key)
  const person = photo ? `<div class="banner-photo rv">${photo}${nameTag(ctx)}</div>` : ''
  const hero = ctx.figure('shot gap-m rv', d.hero_image, d.hero_image_alt, key)

  if (has(d.banner_title)) {
    return [
      schedulePill(ctx, 'pill rv'),
      when(d.hook_line, () => `<p class="lead hook-sub rv">${rich(d.hook_line)}</p>`),
      `<h1 class="h1 banner-title rv">${bannerTitle(d.banner_title)}</h1>`,
      hero,
      `<div class="banner-cta rv">${ctx.applyButton()}</div>`,
      person || (nameTag(ctx) ? `<div class="banner-photo nophoto rv">${nameTag(ctx)}</div>` : ''),
    ].join('')
  }

  // 결과형 제목이 없을 때: 큰 성과 숫자 한 줄로 시작하고 강의명·버튼·일정을 묶어 보여 준다
  return [
    when(d.hook_line, () => `<p class="lead hook-sub rv">${rich(d.hook_line)}</p>`),
    when(d.hook_big, () => `<h1 class="h1 rv">${rich(d.hook_big)}</h1>`),
    hero,
    `<div class="titlebox rv">${ctx.titleBlock()}${ctx.applyButton()}${schedulePill(ctx, 'gap-s')}</div>`,
    person,
  ].join('')
}

/* ───────── 2. 참여 선물 (+ 바로 뒤 신청 묶음) ───────── */

const gift: SectionBuilder = (d, ctx, key) => {
  const items = list(d.gift_items).map(rec)
  const card = (x: Rec) => {
    const img = ctx.image(x.image, plain(x.name), key)
    return [
      `<div class="gift rv${img ? '' : ' noimg'}">${img}<div>`,
      '<span class="no"></span>',
      when(x.lead, () => `<small>${rich(x.lead)}</small>`),
      `<b>${rich(x.name)}</b>`,
      when(x.desc, () => `<small>${rich(x.desc)}</small>`),
      // 값어치는 값이 있을 때만
      when(x.value, () => `<span class="val">${rich(x.value)}</span>`),
      '</div></div>',
    ].join('')
  }
  const condition = [d.gift_condition || ctx.facts['선물조건'], items.length > 1 ? `총 ${items.length}종` : ''].filter(has).map(rich).join(' · ')
  // 4종 이상이면 옆으로 넘기는 카드
  const cards = items.length >= 4
    ? `<div class="slider gap-m" data-lpt-slider>${items.map(card).join('')}</div><div class="sdots">${items.map((_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div>`
    : `<div class="gifts gap-m">${items.map(card).join('')}</div>`

  return [
    when(d.title_pre, () => `<p class="lead rv">${rich(d.title_pre)}</p>`),
    `<h2 class="h1 rv">${rich(d.title || '라이브 참여만 해도\n==전원 무료 제공==')}</h2>`,
    when(condition, `<p class="eyebrow solid gap-s rv">${condition}</p>`),
    cards,
    ctx.notes(d.gift_how),
  ].join('')
}

/** 신청 묶음: 강의명 + 일시 + 버튼 */
export const applyBand = (ctx: RenderContext): string =>
  `<div class="rv">${ctx.titleBlock('h3')}${schedulePill(ctx, 'band-when')}${ctx.applyButton()}</div>`

/* ───────── 3. 공감·경계 해소 ───────── */

function noticeText(d: Rec): string {
  if (has(d.notice_text)) return str(d.notice_text)
  if (!has(d.notice_action)) return ''
  const action = str(d.notice_action)
  return `본 강의를 통해서는,\n어떤 경우에도 ==${plain(action)}==${objectParticle(action)} 진행하지 않습니다.`
}

// 고통 목록: 사람별 줄(who + text) · 짧으면 말풍선 · 길면 체크 목록
function painList(points: unknown[]): string {
  if (!points.length) return ''
  if (isRec(points[0])) {
    return `<ul class="rows">${points.map(rec).map(p => `<li class="rv"><small>${rich(p.who)}</small><b>${rich(p.text)}</b></li>`).join('')}</ul>`
  }
  if (points.every(p => plain(p).length <= 14)) {
    return `<div class="bubbles">${points.map(p => `<div class="bubble rv">${rich(p)}</div>`).join('')}</div>`
  }
  return `<ul class="checks">${points.map(p => `<li class="rv">${rich(p)}</li>`).join('')}</ul>`
}

const empathy: SectionBuilder = (d, ctx, key) => {
  const notice = noticeText(d)
  const pains = painList(list(d.pain_points))
  const contrast = isRec(d.contrast) ? d.contrast : null
  const mood = ctx.image(d.mood_image, '', key)
  const versusCell = (side: unknown) => {
    const c = rec(side)
    return `<div>${ctx.image(c.image, '', key)}<small>${rich(c.pre)}</small><b>${rich(c.big)}</b><small>${rich(c.post)}</small></div>`
  }

  return [
    // (B) 업종 고지
    when(notice, `<div class="card glow notice rv"><p class="h3">⚠ ${rich(notice)}</p></div>`),
    // (A) 현실 인정 → 질문 → 원인. 여는 말(작은 줄 + 큰 줄)은 선택
    when(d.opening, () => `<p class="lead hook-sub${notice ? ' gap-l' : ''} rv">${rich(d.opening)}</p>`),
    when(d.opening_big, () => `<h2 class="h1 rv">${rich(d.opening_big)}</h2>`),
    has(d.lead) && (has(d.opening) || has(d.opening_big)) ? '<div class="dots"></div>' : '',
    when(d.lead, () => `<p class="lead${notice && !has(d.opening) && !has(d.opening_big) ? ' gap-l' : ''} rv">${rich(d.lead)}</p>`),
    when(d.lead2, () => `<div class="dots"></div><p class="lead rv">${rich(d.lead2)}</p>`),
    when(d.bubbles, () => `<div class="bubbles gap-m">${each(d.bubbles, p => `<div class="bubble rv">${rich(p)}</div>`)}</div>`),
    when(d.bubbles_after, () => `<p class="h3 gap-m rv">${rich(d.bubbles_after)}</p>`),
    mood
      ? `<div class="moodbox gap-l rv">${mood}<p class="q">${rich(d.question)}</p></div>`
      : when(d.question, () => `<p class="h2 gap-l rv">${rich(d.question)}</p>`),
    // (C) 고통 체크리스트
    when(pains, `<div class="gap-m">${pains}</div>`),
    when(d.bridge, () => `<div class="arrow"></div><h2 class="h2 rv">${rich(d.bridge)}</h2>`),
    when(d.cause_line, () => [
      '<div class="card glow gap-m rv">',
      `<p class="h2 cause">${rich(d.cause_line)}</p>`,
      when(d.cause_detail, () => `<p class="lead gap-s">${rich(d.cause_detail)}</p>`),
      '</div>',
    ].join('')),
    contrast
      ? `<p class="h3 gap-l rv">${rich(contrast.lead)}</p><div class="versus gap-s rv">${versusCell(contrast.a)}${versusCell(contrast.b)}</div>`
      : '',
  ].join('')
}

/* ───────── 4. 강사 등장 + 비포 ───────── */

const instructor: SectionBuilder = (d, ctx, key) => {
  const F = ctx.facts
  const name = plain(F['강사명'])
  return [
    when(d.greeting, () => `<p class="script rv">${rich(d.greeting)}</p>`),
    when(F['강사_수식어'], () => `<p class="hello gap-s rv">${rich(F['강사_수식어'])}</p>`),
    when(F['강사명'], () => `<h2 class="name rv"><em class="hl">${rich(F['강사명'])}</em><small>입니다</small></h2>`),
    ctx.figure('photo gap-m rv', d.instructor_photo, `${name} 강사`, key),
    // 불리했던 출발점
    when(d.story, () => `<div class="card line gap-m rv"><p class="lead">${rich(d.story)}</p></div>`),
    when(d.career_list, () => `<ul class="career gap-m">${each(d.career_list, x => `<li>${rich(x)}</li>`)}</ul>`),
    when(d.authority_title, () => `<h2 class="h2 gap-l rv">${rich(d.authority_title)}</h2>${when(d.authority_line, () => `<p class="lead gap-s rv">${rich(d.authority_line)}</p>`)}`),
    ctx.figure('shot gap-m', d.credential_capture, '자격 증빙', key),
    // 다음 블록(증빙)으로 넘기는 질문
    when(d.question, () => `<div class="arrow"></div><p class="h2 rv">${rich(d.question)}</p>`),
  ].join('')
}

/* ───────── 5. 서류 증빙(애프터) ───────── */

// 성장 단계: 4개 이하면 점점 커지는 계단, 많으면 칸 묶음
function growthSteps(amounts: Rec[]): string {
  if (!amounts.length) return ''
  if (amounts.length <= 4) {
    const cells = amounts.map((a, i) => {
      const size = Math.max(0, 2 - (amounts.length - 1 - i))
      return `${i ? '<i></i>' : ''}<div class="s${size} rv"><small>${rich(a.label)}</small><b>${rich(a.value)}</b></div>`
    })
    return `<div class="stair gap-l">${cells.join('')}</div>`
  }
  return `<div class="amounts gap-l">${amounts.map(a => `<div><small>${rich(a.label)}</small><b>${rich(a.value)}</b></div>`).join('')}</div>`
}

const proof: SectionBuilder = (d, ctx, key) => {
  const summary = isRec(d.proof_summary) ? d.proof_summary : null
  const total = isRec(d.total) ? d.total : has(d.total) ? { value: d.total } : null
  const capture = (item: unknown) => {
    const c = isRec(item) ? item : { image: item }
    const img = ctx.image(c.image, c.alt || '증빙 서류 캡처', key)
    if (!img) return ''
    return [
      `<figure class="gap-m rv"><div class="shot">${img}</div>`,
      // 캡처에서 다시 크게 적는 숫자와 그 기간
      when(c.amount, () => `<p class="capnum"><b>${rich(c.amount)}</b>${when(c.period, () => `<small>${rich(c.period)}</small>`)}</p>`),
      when(c.caption, () => `<figcaption>${rich(c.caption)}</figcaption>`),
      '</figure>',
    ].join('')
  }

  return [
    when(d.after_line, () => `<p class="h2 rv">${rich(d.after_line)}</p>`),
    summary
      ? [
          `<p class="lead${has(d.after_line) ? ' gap-m' : ''} rv">${rich(summary.pre)}</p>`,
          '<div class="ba gap-s rv">',
          when(summary.from, () => `<span class="from">${rich(summary.from)}</span><span class="chev"></span>`),
          `<span class="to">${rich(summary.to)}</span>`,
          '</div>',
        ].join('')
      : '',
    each(d.proof_captures, capture),
    total
      ? `<div class="total gap-l rv"><p class="bignum">${when(total.label, () => `<small>${rich(total.label)}</small>`)}${rich(total.value)}</p></div>`
      : '',
    growthSteps(list(d.proof_amounts).map(rec)),
    ctx.notes(d.proof_basis_note),
    when(d.proof_note, () => [
      '<div class="gap-l rv">',
      when(d.proof_note_label, () => `<p class="eyebrow">${rich(d.proof_note_label)}</p>`),
      `<p class="h3">${rich(d.proof_note)}</p>`,
      '</div>',
    ].join('')),
  ].join('')
}

/* ───────── 6. 핵심 개념 한 단어 ───────── */

const concept: SectionBuilder = (d, ctx, key) => {
  const premise = isRec(d.premise) ? d.premise : null
  return [
    // 상황 가정 묶음(선택): "만약 ~라면?" 으로 질문을 키운다
    premise
      ? [
          when(premise.pre, () => `<p class="lead rv">${rich(premise.pre)}</p>`),
          `<h2 class="h2 gap-s rv">${rich(premise.title)}</h2>`,
          ctx.figure('pic gap-m rv', premise.image, '', key),
          when(premise.to, () => `<p class="h3 hl gap-m rv">${rich(premise.to)}</p>`),
          when(premise.items, () => `<div class="stack gap-s">${each(premise.items, x => `<div class="rv">${rich(x)}</div>`)}</div>`),
          when(premise.post, () => `<p class="lead gap-m rv">${rich(premise.post)}</p>`),
          when(premise.conclusion, () => `<p class="h1 gap-s rv">${rich(premise.conclusion)}</p>`),
          '<div class="dots"></div>',
        ].join('')
      : '',
    // 질문 → 한 단어 답 → 재정의
    when(d.lead, () => `<h2 class="h2 rv">${rich(d.lead)}</h2>`),
    has(d.method_intro)
      ? `<p class="h1 gap-s rv">${rich(d.method_intro)}</p>`
      : when(d.method_name, () => `<p class="h1 word gap-s hl rv">${rich(d.method_name)}</p>`),
    each(d.demo_captures, x => ctx.figure('photo full gap-m rv', x, plain(d.method_name), key)),
    when(d.method_not, () => `<p class="lead gap-m rv">${rich(d.method_not)}</p>`),
    when(d.method_definition, () => `<p class="h3 define ${has(d.method_not) ? 'gap-s' : 'gap-m'} rv">${rich(d.method_definition)}</p>`),
    when(d.market_stat, () => `<p class="lead gap-m">${rich(d.market_stat)}</p>`),
  ].join('')
}

/* ───────── 7. 오해 깨기 ───────── */

const DEFAULT_ANSWER = '아닙니다.'
const SHORT_DOUBT = 18

const objection: SectionBuilder = (d, ctx, key) => {
  const doubts = list(d.doubts)
  const answers = list(d.answers)
  const answerOf = (i: number) => (has(answers[i]) ? answers[i] : DEFAULT_ANSWER)
  // 오해가 모두 짧으면 "○○? 아닙니다." 반복, 길면 인용 상자 + 큰 답
  const short = doubts.length > 0 && doubts.every(q => plain(q).length <= SHORT_DOUBT)
  const rows = short
    ? `<div class="nopes gap-m">${doubts.map((q, i) => `<div class="nope rv"><p class="q">${rich(q)}</p><p class="a">${rich(answerOf(i))}</p></div>`).join('')}</div>`
    : doubts.map((q, i) => `<div class="gap-m rv"><div class="saying">${rich(q)}</div><p class="h2 hl gap-s">${rich(answerOf(i))}</p></div>`).join('')

  return [
    when(d.title_pre, () => `<p class="eyebrow rv">${rich(d.title_pre)}</p>`),
    when(d.title, () => `<h2 class="h2 rv">${rich(d.title)}</h2>`),
    rows,
    each(d.evidence_images, x => ctx.figure('shot gap-m', x, '근거 자료', key)),
    when(d.rebuttal, () => `<div class="arrow"></div><p class="h2 rv">${rich(d.rebuttal)}</p>`),
  ].join('')
}

/* ───────── 8. 비교·가능한 결과 ───────── */

const comparison: SectionBuilder = (d, ctx) => {
  const cards = isRec(d.comparison) ? d.comparison : null
  const oldSide = rec(cards?.old)
  const newSide = rec(cards?.new)
  const methodName = d.method_name || ctx.sections.concept?.method_name || '이 방법'

  return [
    when(d.title_pre, () => `<p class="lead rv">${rich(d.title_pre)}</p>`),
    when(d.title, () => `<h2 class="h2 rv">${rich(d.title)}</h2>`),
    // 좌우 2칸 카드
    cards && has(oldSide)
      ? [
          `<div class="cmp${has(d.title) ? ' gap-m' : ''} rv">`,
          `<div class="old"><h4>${rich(oldSide.title)}</h4><p>${rich(oldSide.text)}</p>`,
          when(oldSide.steps, () => `<ol>${each(oldSide.steps, x => `<li>${rich(x)}</li>`)}</ol>`),
          '</div>',
          `<div class="new"><h4>${rich(newSide.title)}</h4><p>${rich(newSide.text)}</p></div>`,
          '</div>',
        ].join('')
      : '',
    // 2열 표
    when(d.comparison_pairs, () => [
      '<table class="pairs gap-m">',
      `<tr><th>${rich(d.old_name || '기존 방식')}</th><th>${rich(methodName)}</th></tr>`,
      each(d.comparison_pairs, x => `<tr><td>${rich(list(x)[0])}</td><td>${rich(list(x)[1])}</td></tr>`),
      '</table>',
    ].join('')),
    // "~없음" 체크
    when(d.none_checks, () => `<ul class="checks gap-m">${each(d.none_checks, x => `<li class="rv">${rich(x)}</li>`)}</ul>`),
    when(d.result_line, () => `<p class="h3 gap-l rv">${rich(d.result_line)}</p>`),
  ].join('')
}

/* ───────── 10. 알려 드리는 것 ───────── */

const takeaways: SectionBuilder = d => {
  const items = list(d.takeaway_items)
  const twoColumns = items.length === 4 || items.length === 2
  const card = (item: unknown) => {
    const x = isRec(item) ? item : { title: item }
    return [
      `<div class="rv"><b>${rich(x.title)}</b>`,
      when(x.desc, () => `<p>${rich(x.desc)}</p>`),
      when(x.tag, () => `<span class="tag">${rich(x.tag)}</span>`),
      '</div>',
    ].join('')
  }
  return [
    when(d.eyebrow, () => `<p class="eyebrow solid rv">${rich(d.eyebrow)}</p>`),
    `<h2 class="h2 rv">${rich(d.title || `이 강의에서 알려 드릴 ${items.length}가지`)}</h2>`,
    `<div class="steps${twoColumns ? ' g2' : ''} gap-m">${items.map(card).join('')}</div>`,
    when(d.closing_line, () => `<p class="h3 gap-l rv">${rich(d.closing_line)}</p>`),
  ].join('')
}

/* ───────── 11. 마지막 밀어주기 ───────── */

const closing: SectionBuilder = (d, ctx, key) => [
  when(d.quote, () => `<div class="saying rv">${rich(d.quote)}</div><div class="arrow"></div>`),
  when(d.closing_message, () => `<p class="h2 rv">${rich(d.closing_message)}</p>`),
  when(d.closing_big, () => [
    '<div class="dots"></div>',
    when(d.closing_pre, () => `<p class="lead rv">${rich(d.closing_pre)}</p>`),
    `<p class="h1 gap-s rv">${rich(d.closing_big)}</p>`,
  ].join('')),
  ctx.figure('closephoto gap-m', d.closing_photo, plain(ctx.facts['강사명']), key),
].join('')

/* ───────── 12. 일정 재확인 + 신청 ───────── */

const scheduleCta: SectionBuilder = (d, ctx) => {
  const F = ctx.facts
  const live = rec(F['라이브'])
  const guides = [F['입장방법'], has(F['다시보기']) && typeof F['다시보기'] === 'string' ? `다시보기: ${F['다시보기']}` : ''].filter(has)
  // 선물 다시 보여 주기(선택): 참여 선물 이름만 한 번 더
  const giftNames = d.gift_recap ? list(ctx.sections.gift?.gift_items).map(x => plain(rec(x).name)).filter(Boolean) : []

  return [
    '<div class="sched rv">',
    liveBadge(ctx),
    `<p class="date">${rich(formatDate(live['날짜']))}<br><em class="hl">${rich(formatTime(live['시각']))}</em></p>`,
    '<div class="ttl">',
    when(F['강의명_윗줄'], () => `<p class="eyebrow solid">${rich(F['강의명_윗줄'])}</p><br>`),
    rich(F['강의명_제목'] || F['강의명']),
    '</div>',
    giftNames.length
      ? `<div class="recap"><small>${rich(F['선물조건'] || '참여 선물')}</small><ul>${giftNames.map(x => `<li>${rich(x)}</li>`).join('')}</ul></div>`
      : '',
    ctx.applyButton(d.cta_label),
    guides.length ? `<ul class="kv">${guides.map(x => `<li>${rich(x)}</li>`).join('')}</ul>` : '',
    '</div>',
  ].join('')
}

/** 무료 랜딩: 섹션 키 → 그리는 함수 */
export const FREE_BUILDERS: Record<string, SectionBuilder> = {
  hook,
  gift,
  empathy,
  instructor,
  proof,
  concept,
  objection,
  comparison,
  student_results: studentResults,
  takeaways,
  closing,
  schedule_cta: scheduleCta,
}
