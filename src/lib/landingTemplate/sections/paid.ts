// 유료 랜딩의 섹션 그리기.
import type { RenderContext } from '../context'
import type { Rec } from '../types'
import { esc, formatDate, formatTime, has, isRec, isSafeLinkUrl, list, parseDate, plain, rec, rich, str } from '../format'
import { audience, each, faq, studentResults, when, type SectionBuilder } from './common'

const instructorAlt = (ctx: RenderContext) => `${plain(ctx.facts['강사명'])} 강사`

/* ───────── 첫 화면 ───────── */

const hook: SectionBuilder = (d, ctx, key) => {
  const F = ctx.facts
  const photo = ctx.image(d.instructor_photo, instructorAlt(ctx), key)
  const lines = `${rich(d.instructor_line)}<br>${rich(d.promise_line)}`
  return [
    '<div class="rv">',
    when(F['강의명_윗줄'], () => `<p class="lead over-title">${rich(F['강의명_윗줄'])}</p>`),
    `<h1 class="h1">${rich(F['강의명_제목'] || F['강의명'])}</h1>`,
    '</div>',
    when(d.industry_notice, () => `<div class="card glow gap-m"><p>⚠ ${rich(d.industry_notice)}</p></div>`),
    when(d.sub, () => `<p class="lead gap-m rv">${rich(d.sub)}</p>`),
    when(d.sub_strong, () => `<p class="h3 gap-s rv">${rich(d.sub_strong)}<br><span class="band">${rich(d.sub_band)}</span></p>`),
    photo
      ? `<div class="hero-photo rv">${photo}<p class="over">${lines}</p></div>`
      : `<p class="h3 gap-m">${lines}</p>`,
  ].join('')
}

/* ───────── 걱정과 답 ───────── */

const worriesAnswers: SectionBuilder = d => {
  const card = (item: unknown) => {
    const w = rec(item)
    return [
      '<div class="wcard rv">',
      `<p class="q">${rich(w.q)}</p><p class="a">${rich(w.a)}</p>`,
      when(w.strip, () => `<p class="strip">${rich(w.strip)}</p>`),
      when(w.items, () => `<ul>${each(w.items, x => `<li>${rich(x)}</li>`)}</ul>`),
      '</div>',
    ].join('')
  }
  return [
    `<div class="wcards">${each(d.worry_items, card)}</div>`,
    when(d.method_line, () => `<p class="h3 gap-m">${rich(d.method_line)}</p>`),
  ].join('')
}

/* ───────── 강사 권위 ───────── */

const instructorAuthority: SectionBuilder = (d, ctx, key) => {
  // 흰 편지 상자: 주변 질문 → 강사 이야기 → "지금을 만든 건"
  const letter = () => [
    '<div class="card paper gap-m rv">',
    when(d.asked_title, () => `<p class="lead asked-title"><b>${rich(d.asked_title)}</b></p>`),
    when(d.asked, () => `<div class="quote">${each(d.asked, x => `<p>${rich(x)}</p>`)}</div>`),
    when(d.story, () => `<p class="lead story gap-m">${rich(d.story)}</p>`),
    when(d.story_band, () => `<p class="gap-s"><span class="band ink">${rich(d.story_band)}</span></p>`),
    when(d.because, () => `<p class="lead gap-m">${rich(d.because_pre)}</p><p class="h1">${rich(d.because)}</p>`),
    ctx.figure('pic blend gap-s', d.because_image, '', key),
    '</div>',
  ].join('')

  return [
    `<div class="agelist">${each(d.authority_numbers, a => `<div class="rv">${rich(rec(a).label)} ${rich(rec(a).value)}</div>`)}</div>`,
    when(d.turn, () => `<p class="h1 turn gap-m rv">${rich(d.turn)}</p>`),
    ctx.figure('photo stand gap-s rv', d.photo, instructorAlt(ctx), key),
    when(d.now_value, () => [
      '<div class="card shade rv">',
      `<p class="bignum">${when(d.now_label, () => `<small>${rich(d.now_label)}</small>`)}${rich(d.now_value)}</p>`,
      when(d.now_line, () => `<p class="h3 gap-s">${rich(d.now_line)}</p>`),
      '</div>',
    ].join('')),
    each(d.proof_captures, c => ctx.figure('shot gap-m', isRec(c) ? c.image : c, '증빙 캡처', key)),
    when(d.career_list, () => `<ul class="career gap-m">${each(d.career_list, x => `<li>${rich(x)}</li>`)}</ul>`),
    has(d.story) || has(d.because) ? letter() : '',
  ].join('')
}

/* ───────── 신청 마감 · 신청 버튼 ───────── */

const deadline: SectionBuilder = (d, ctx) => {
  const F = ctx.facts
  // 강의명이 길면 "올인원"·"클래스" 앞에서 줄을 바꾼다
  const title = plain(F['강의명_제목'] || F['강의명']).replace(/ (?=올인원|클래스)/, '\n')
  return [
    when(d.pre, () => `<p class="h3 rv">${rich(d.pre)}</p>`),
    when(F['강사_한줄'], () => `<p class="h3 tight rv">${rich(F['강사_한줄'])}</p>`),
    `<div class="deadbox gap-m rv">${rich(title)}</div><div class="arrow"></div>`,
    `<p class="dead rv"><em class="hl">${rich(ctx.deadlineText())}까지</em><br>신청가능</p>`,
    ctx.notes(d.early_close_note),
  ].join('')
}

const payNote = (ctx: RenderContext) => when(ctx.facts['결제안내'], () => `<p class="paynote">${rich(ctx.facts['결제안내'])}</p>`)

const cta: SectionBuilder = (d, ctx) => `<div class="rv">${ctx.applyButton(d.cta_label)}${payNote(ctx)}</div>`

/* ───────── 일정 달력 ───────── */

const pad2 = (n: number) => String(n).padStart(2, '0')
const sessionWhen = (s: Rec) => `${rich(formatDate(s['날짜']))} ${rich(formatTime(s['시각']))}`

// 한 달 달력(월요일 시작). 강의가 없는 주는 빼서 짧게 만든다.
function monthCalendar(yearMonth: string, byDate: Map<string, Rec>): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const cells: number[] = Array.from({ length: (firstWeekday + 6) % 7 }, () => 0)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)
  while (cells.length % 7) cells.push(0)

  const sessionOn = (day: number) => (day ? byDate.get(`${yearMonth}-${pad2(day)}`) : undefined)
  let weeks: number[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  const hasSession = (week: number[]) => week.some(day => sessionOn(day))
  const firstWeek = weeks.findIndex(hasSession)
  const lastWeek = weeks.length - 1 - [...weeks].reverse().findIndex(hasSession)
  weeks = weeks.slice(firstWeek, lastWeek + 1)

  const cell = (day: number) => {
    if (!day) return '<td><span></span></td>'
    const s = sessionOn(day)
    if (!s) return `<td><span>${day}</span></td>`
    const label = has(s['달력이름']) ? s['달력이름'] : `${str(s['번호'])}회차`
    return `<td class="on${s['한정플랜'] ? ' lim' : ''}"><span>${day}</span><small>${esc(label)}<i>${esc(formatTime(s['시각']))}</i></small></td>`
  }
  const head = '월화수목금토일'.split('').map(x => `<th>${x}</th>`).join('')
  return `<div class="cal rv"><h4>${month}월</h4><table><tr>${head}</tr>${weeks.map(w => `<tr>${w.map(cell).join('')}</tr>`).join('')}</table></div>`
}

const calendar: SectionBuilder = (d, ctx) => {
  const sessions = ctx.sessions.filter(s => parseDate(s['날짜']))
  const byDate = new Map(sessions.map(s => [str(s['날짜']), s]))
  const months = [...new Set(sessions.map(s => str(s['날짜']).slice(0, 7)))]

  const sessionList = `<ul class="slist">${sessions.map(s => [
    `<li><b>${esc(s['번호'])}회차</b><span>${sessionWhen(s)}</span>`,
    when(s['한정플랜'], () => `<span class="lim">${esc(s['한정플랜'])} 한정</span>`),
    '</li>',
  ].join('')).join('')}</ul>`

  // 추가 모임: 회차 번호로 날짜·제목을 가져온다
  const extra = each(d.extra_events, item => {
    const e = rec(item)
    const s = sessions.find(x => String(x['번호']) === String(e['회차'])) ?? {}
    return `<div class="card line compact gap-s rv"><b>+ ${esc(formatDate(s['날짜'], '월일'))} ${rich(s['제목'])}</b><br>${rich(e.text)}</div>`
  })

  return [
    `<h2 class="h2 rv">${rich(d.title || '강의 일정')}</h2>`,
    `<div class="gap-m">${months.map(m => monthCalendar(m, byDate)).join('<div class="gap-s"></div>')}</div>`,
    sessionList,
    extra,
    when(d.offline_place, () => `<p class="lead gap-s">${rich(d.offline_place)}</p>`),
    ctx.notes(d.notes),
  ].join('')
}

/* ───────── 시작일·구성 요약 ───────── */

const summary: SectionBuilder = (d, ctx) => [
  when(ctx.facts['강의명_짧게'], () => `<p class="lead rv"><b>${rich(ctx.facts['강의명_짧게'])}</b></p>`),
  `<h2 class="h1 gap-s rv"><em class="hl">${rich(formatDate(ctx.startDate()))}</em> 시작!</h2>`,
  `<ul class="plus gap-m">${each(d.summary_items, x => `<li class="rv">${rich(x)}</li>`)}</ul>`,
  ctx.notes(d.footnote),
].join('')

/* ───────── 커리큘럼 ───────── */

const curriculum: SectionBuilder = (d, ctx, key) => {
  const details = rec(d.session_details)
  const item = (x: unknown) => {
    if (!isRec(x)) return `<li>${rich(x)}</li>`
    return `<li>${rich(x.t)}${when(x.sub, () => `<ul>${each(x.sub, u => `<li>${rich(u)}</li>`)}</ul>`)}</li>`
  }
  const session = (s: Rec) => {
    const no = str(s['번호'])
    const x = rec(details[no])
    const outcomeImage = ctx.image(x.outcome_image, '', key)
    return [
      '<div class="sess rv">',
      `<span class="bar"><b>${esc(no)}회차</b>${sessionWhen(s)}</span>`,
      when(s['한정플랜'], () => `<span class="lim">${esc(s['한정플랜'])} 플랜 한정</span>`),
      `<h4>${rich(s['제목'])}</h4>`,
      `<ol>${each(x.items, item)}</ol>`,
      when(x.assignment, () => `<p class="lead gap-s">과제: ${rich(x.assignment)}</p>`),
      when(x.outcome, () => `<div class="outcome"><div><small>${esc(no)}회차가 끝나면?</small><p>${rich(x.outcome)}</p></div>${outcomeImage}</div>`),
      '</div>',
    ].join('')
  }
  return [
    `<h2 class="h2 rv">${rich(d.title || '커리큘럼')}</h2>`,
    `<div class="cur gap-m">${ctx.sessions.map(session).join('')}</div>`,
    ctx.notes(d.change_note),
  ].join('')
}

const syllabusButton: SectionBuilder = (d, ctx) => {
  const link = str(d.syllabus_link).trim()
  if (!isSafeLinkUrl(link)) {
    ctx.flag('주소', `강의계획서 버튼: “${link}” — https://, / 또는 # 로 시작하는 주소만 쓸 수 있어 버튼을 뺐습니다.`)
    return ''
  }
  const external = link.startsWith('https://') ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<a class="btn" href="${esc(link)}"${external}>강의계획서 다운받기 <i>&rarr;</i></a>`
}

/* ───────── 플랜별 혜택 ───────── */

const plansBenefits: SectionBuilder = (d, ctx, key) => {
  const { plans, facts: F } = ctx
  const benefits = list(d.benefit_items).map(rec)
  const perks = isRec(d.top_plan_perks) ? d.top_plan_perks : null

  const planIndex = (name: unknown) => plans.findIndex(p => p['이름'] === name)
  // 플랜 색: 최상위는 두 번째 색, 그 외 2번째 플랜부터는 연한 강조색
  const planClass = (i: number) => (i < 0 ? '' : plans[i]['최상위'] ? ' top' : i > 0 ? ' p1' : '')
  // 그 플랜이 받는 혜택 수(아래 플랜 혜택 포함)
  const benefitCount = (i: number) => benefits.filter(b => planIndex(b.plan) <= i).length

  const planCard = (p: Rec, i: number) => [
    `<div class="plan rv${planClass(i)}">`,
    when(p['추천'], () => `<span class="rec">${rich(F['추천문구'] || '추천')}</span>`),
    `<span class="nm">${rich(p['이름'])} 플랜</span>`,
    `<p>${rich(p['한줄'])}</p>`,
    `<span class="cnt">혜택 ${benefitCount(i)}종${i ? ` (${rich(plans[i - 1]['이름'])} 혜택 포함)` : ''}</span>`,
    '</div>',
  ].join('')

  // 혜택 카드는 2열. 설명에 목록(- …)이 있으면 한 줄을 다 쓰고, 홀로 남는 카드도 넓힌다.
  const isLong = (b: Rec | undefined) => /\n- /.test(str(b?.desc))
  let column = 0
  const benefitCard = (b: Rec, n: number) => {
    const i = planIndex(b.plan)
    let wide = isLong(b)
    if (!wide && column === 0 && (n === benefits.length - 1 || isLong(benefits[n + 1]))) wide = true
    column = wide ? 0 : (column + 1) % 2
    const fromThisPlan = i >= 0 && i < plans.length - 1 && plans.length > 1
    return [
      `<div class="ben rv${planClass(i)}${wide ? ' wide' : ''}">`,
      i >= 0 ? `<span class="tg">${rich(plans[i]['표기'] || plans[i]['이름'])}${fromThisPlan ? ' 부터' : ''}</span>` : '',
      when(b.side, () => `<em class="side">* ${rich(b.side)}</em>`),
      `<b>${rich(b.title)}</b><p>${rich(b.desc)}</p>`,
      '</div>',
    ].join('')
  }

  const topPlanName = plans.length ? plans[plans.length - 1]['이름'] : ''
  const perkBlock = perks
    ? [
        '<div class="gap-l rv">',
        when(perks.pre, () => `<p class="lead">${rich(perks.pre)}</p>`),
        `<h2 class="h2">${rich(perks.title)}</h2>`,
        when(topPlanName, () => `<p class="eyebrow top-plan gap-s">${rich(topPlanName)} 플랜 한정</p>`),
        '<div class="perkbox">',
        ctx.image(perks.image, '', key),
        when(perks.who, () => `<p class="h2">${rich(perks.who)}</p>`),
        `<ul class="perks">${each(perks.items, x => `<li><b>${rich(rec(x).title)}</b><span>${rich(rec(x).desc)}</span></li>`)}</ul>`,
        '</div></div>',
      ].join('')
    : ''

  return [
    when(d.title_pre, () => `<p class="lead rv">${rich(d.title_pre)}</p>`),
    `<h2 class="h2 rv">${rich(d.title || '플랜별 혜택')}</h2>`,
    when(d.band, () => `<p class="h3 gap-s rv"><span class="band wide">${rich(d.band)}</span></p>`),
    plans.length > 1 ? `<div class="plans gap-m">${plans.map(planCard).join('')}</div>` : '',
    `<div class="bens gap-m">${benefits.map(benefitCard).join('')}</div>`,
    perkBlock,
    when(d.plan_prices, () => `<div class="amounts gap-m">${each(d.plan_prices, x => `<div><small>${rich(rec(x).plan)}</small><b>${rich(rec(x).price)}</b></div>`)}</div>`),
  ].join('')
}

/* ───────── 보증 · 플랜 추천 · 미래 비교 ───────── */

const guarantee: SectionBuilder = (d, ctx) => [
  `<p class="eyebrow solid">${rich(d.guarantee_plan)} 전용</p>`,
  `<h2 class="h2">${rich(d.title)}</h2>`,
  `<ul class="checks gap-m">${each(d.guarantee_terms, x => `<li>${rich(x)}</li>`)}</ul>`,
  ctx.notes(d.refund_policy_ref),
].join('')

const planGuide: SectionBuilder = d => [
  `<h2 class="h2">${rich(d.title || '당신에게 딱 맞는 플랜은?')}</h2>`,
  '<div class="gap-m">',
  each(d.plan_personas, x => `<div class="gap-s"><div class="saying">${rich(rec(x).say)}</div><p class="h3 hl gap-s">→ ${rich(rec(x).plan)}</p></div>`),
  '</div>',
].join('')

const futurePrice: SectionBuilder = d => [
  `<h2 class="h2">${rich(d.title)}</h2>`,
  '<div class="versus left gap-m">',
  `<div><ul class="note">${each(d.future_without, x => `<li>${rich(x)}</li>`)}</ul></div>`,
  `<div><ul class="note same-color">${each(d.future_with, x => `<li>${rich(x)}</li>`)}</ul></div>`,
  '</div>',
].join('')

/* ───────── 강사 이야기·마무리 · 끝 버튼 · 저작권 ───────── */

const instructorClosing: SectionBuilder = (d, ctx, key) => {
  const photo = ctx.figure('closephoto gap-m rv', d.instructor_photo, instructorAlt(ctx), key)
  return [
    when(d.lead, () => `<p class="lead rv">${rich(d.lead)}</p>`),
    when(d.declare, () => `<p class="h1 gap-m rv">${rich(d.declare)}</p><div class="dots"></div>`),
    when(d.promise_title, () => `<p class="script rv">${rich(d.promise_title)}</p>`),
    photo,
    // 사진이 있으면 약속 상자가 사진 아래쪽에 겹친다
    `<div class="card glow pledge${photo ? ' overlap' : ' gap-m'} rv">`,
    `<p class="promise">${rich(d.instructor_message)}</p>`,
    when(d.promise, () => `<p class="promise hl gap-s">${rich(d.promise)}</p>`),
    '</div>',
    when(d.outcomes3, () => `<div class="steps gap-m">${each(d.outcomes3, x => `<div><b>${rich(x)}</b></div>`)}</div>`),
  ].join('')
}

const finalCta: SectionBuilder = (d, ctx) => {
  const F = ctx.facts
  return [
    '<div class="rv">',
    when(F['강의명_윗줄'], () => `<p class="lead strong">${rich(F['강의명_윗줄'])}</p>`),
    `<h2 class="h2">${rich(F['강의명_제목'] || F['강의명'])}</h2>`,
    when(F['신청마감'], () => `<p class="h3 gap-s"><em class="hl">${rich(ctx.deadlineText())}까지</em> 신청가능</p>`),
    '<div class="gap-m"></div>',
    ctx.applyButton(d.cta_label),
    payNote(ctx),
    '</div>',
  ].join('')
}

const copyright: SectionBuilder = (_d, ctx) => [
  '<h2 class="h3">저작권 보호 대상 콘텐츠</h2>',
  `<div class="card gap-s"><p>${rich(ctx.facts['강의명'])}의 강의 자료는 외부 배포, 무단 공유, 공동 구매, 재판매가 일절 금지됩니다.</p></div>`,
].join('')

/** 유료 랜딩: 섹션 키 → 그리는 함수 */
export const PAID_BUILDERS: Record<string, SectionBuilder> = {
  hook,
  worries_answers: worriesAnswers,
  instructor_authority: instructorAuthority,
  student_results: studentResults,
  deadline,
  cta,
  calendar,
  summary,
  curriculum,
  syllabus_button: syllabusButton,
  plans_benefits: plansBenefits,
  guarantee,
  plan_guide: planGuide,
  audience,
  faq,
  future_price: futurePrice,
  instructor_closing: instructorClosing,
  final_cta: finalCta,
  copyright,
}
