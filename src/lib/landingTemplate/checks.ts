// 조립이 끝난 뒤 돌리는 검사: 빈칸 표시, 개수·날짜 불일치, 증빙 없는 숫자, 강의명·그림 중복.
// 걸린 것은 report.checks 에 "[종류] 설명" 으로, 통과한 검사는 report.passed 로 센다.
import type { RenderContext } from './context'
import { has, isRec, list, looksLikeUrl, parseDate, plain, rec, str, weekdayOf } from './format'

interface TextEntry {
  /** 자료 안에서의 위치. 예: sections.proof.proof_captures.0.caption */
  path: string
  text: string
}

// 글이 아닌 값(그림·주소)의 위치
const NON_TEXT_PATH = /\.(image|alt)$|(_image|_photo|_link|_capture)$|(_captures|_images)\.\d+$|신청주소$|증빙$/
// 날짜·금액 검사에서 빼는 위치(캡션·기간은 서류에 적힌 값을 그대로 옮긴 것)
const QUOTED_PATH = /\.(caption|period)$|proof_period/
const MONEY = /\d[\d,.]*\s*(억|천만|만\s*원|만원|원|%)|\d억\s*\d천/
const MAX_FREE_TAKEAWAYS = 3
const MAX_PAIN_POINTS = 5

function collectTexts(ctx: RenderContext): TextEntry[] {
  const out: TextEntry[] = []
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') {
      if (!NON_TEXT_PATH.test(path) && !looksLikeUrl(value.trim())) out.push({ path, text: value })
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}.${i}`))
    } else if (isRec(value)) {
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k)
    }
  }
  walk({ facts: ctx.facts, sections: ctx.sections }, '')
  return out
}

export function runChecks(ctx: RenderContext): void {
  const { facts, sections, sessions, plans, type, flag, pass } = ctx
  const texts = collectTexts(ctx)
  const whereOf = (path: string) => (path.startsWith('facts') ? '기본 정보' : ctx.sectionName(path.split('.')[1] ?? ''))
  const inSections = (path: string) => path.startsWith('sections.')

  checkPlaceholders()
  checkCounts()
  checkDates()
  checkProof()
  checkTitleAndImages()

  /* 1) 빈칸 표시가 남았는지 */
  function checkPlaceholders() {
    const placeholder = /(^|[^A-Za-z0-9])N{1,2}(?=\s*(억|만|천|원|명|개|종|회|기|주|일|배|%))|O{2,}|○{2,}|X{2,}|\?{3,}|[_＿]{2,}/
    const hits = texts.filter(x => placeholder.test(x.text))
    if (hits.length) {
      for (const x of hits) flag('빈칸 표시', `${whereOf(x.path)}: “${plain(x.text)}” — ‘N’ 같은 빈칸 표시가 남아 있습니다. 숫자를 채우거나, 의도한 표현이면 확인이 필요합니다.`)
    } else pass()

    if (ctx.unresolved.length) {
      for (const x of ctx.unresolved) flag('빈칸 표시', `${ctx.sectionName(x.where)}: ${x.token} — 기본 정보에 없는 이름을 불러 썼습니다.`)
    } else pass()
  }

  /* 2) 글에 적힌 개수와 실제 목록 개수 */
  function checkCounts() {
    let bad = 0
    const compare = (label: string, text: unknown, pattern: RegExp, actual: number) => {
      const m = pattern.exec(plain(text))
      if (m && Number(m[1]) !== actual) {
        bad++
        flag('개수 불일치', `${label}: 글에는 “${m[0]}”, 실제 목록은 ${actual}개입니다.`)
      }
    }
    const { takeaways, gift, plans_benefits: benefits, worries_answers: worries, curriculum, empathy } = sections

    if (takeaways) {
      const count = list(takeaways.takeaway_items).length
      compare(ctx.sectionName('takeaways'), takeaways.title, /(\d+)\s*(단계|가지)/, count)
      if (type === 'free' && count > MAX_FREE_TAKEAWAYS) {
        bad++
        flag('개수 초과', `${ctx.sectionName('takeaways')}: ${count}개입니다. 무료 표준은 최대 ${MAX_FREE_TAKEAWAYS}개입니다.`)
      }
    }
    if (gift) {
      for (const t of [gift.title, gift.title_pre, gift.gift_condition]) compare(ctx.sectionName('gift'), t, /(\d+)\s*종/, list(gift.gift_items).length)
    }
    if (type === 'free' && empathy && list(empathy.pain_points).length > MAX_PAIN_POINTS) {
      bad++
      flag('개수 초과', `${ctx.sectionName('empathy')}: 고통 체크리스트가 ${list(empathy.pain_points).length}개입니다. 3~${MAX_PAIN_POINTS}개를 권합니다.`)
    }
    if (benefits) compare('플랜별 혜택', benefits.title, /플랜\s*(\d+)\s*종/, plans.length)
    if (worries) compare('걱정과 답', worries.title, /(\d+)\s*가지/, list(worries.worry_items).length)
    for (const x of texts) {
      if (inSections(x.path)) compare(whereOf(x.path), x.text, /라이브\s*(?:강의\s*)?(\d+)\s*회(?!차)/, ctx.computed['본강의수'])
    }
    if (type === 'paid' && curriculum) {
      const detailed = Object.keys(rec(curriculum.session_details))
      const missing = sessions.filter(s => !detailed.includes(str(s['번호'])))
      const extra = detailed.filter(n => !sessions.some(s => str(s['번호']) === n))
      if (missing.length || extra.length) {
        bad++
        flag('개수 불일치', `커리큘럼: 일정에 있는 회차(${sessions.length}개)와 세부 내용이 적힌 회차(${detailed.length}개)가 맞지 않습니다.`)
      }
    }
    if (!bad) pass()
  }

  /* 3) 글에 적힌 날짜가 기본 정보와 맞는지 */
  function checkDates() {
    let bad = 0
    const known = new Set<string>()
    const remember = (value: unknown) => {
      const d = parseDate(value)
      if (d) known.add(`${d.getUTCMonth() + 1}/${d.getUTCDate()}`)
    }
    const live = rec(facts['라이브'])
    const deadline = rec(facts['신청마감'])
    remember(facts['개강일'])
    remember(live['날짜'])
    remember(deadline['날짜'])
    sessions.forEach(s => remember(s['날짜']))

    const start = ctx.startDate()
    const year = (start || str(live['날짜']) || '2026').slice(0, 4)
    const pad2 = (n: number) => String(n).padStart(2, '0')

    for (const x of texts) {
      if (QUOTED_PATH.test(x.path)) continue
      // "9월 17일(목)" 또는 "9/17"
      const pattern = /(\d{1,2})월\s*(\d{1,2})일(?:\s*\((.)\))?|(?<![\d/.])(\d{1,2})\/(\d{1,2})(?![\d/])/g
      let m: RegExpExecArray | null
      while ((m = pattern.exec(x.text))) {
        const month = Number(m[1] || m[4])
        const day = Number(m[2] || m[5])
        if (month < 1 || month > 12 || day < 1 || day > 31) continue
        if (!known.has(`${month}/${day}`)) {
          bad++
          flag('날짜 불일치', `${whereOf(x.path)}: “${m[0]}” — 기본 정보에 없는 날짜입니다.`)
        } else if (m[3] && m[3] !== weekdayOf(`${year}-${pad2(month)}-${pad2(day)}`)) {
          bad++
          flag('날짜 불일치', `${whereOf(x.path)}: “${m[0]}” — 요일이 달력과 다릅니다.`)
        }
      }
    }

    if (type === 'paid') {
      const firstDate = str(sessions[0]?.['날짜'])
      if (has(facts['개강일']) && firstDate && facts['개강일'] !== firstDate) {
        bad++
        flag('날짜 불일치', `개강일(${str(facts['개강일'])})과 1회차 날짜(${firstDate})가 다릅니다.`)
      }
      const startDay = parseDate(start)
      const deadlineDay = parseDate(deadline['날짜'])
      if (startDay && deadlineDay) {
        const daysBefore = (startDay.getTime() - deadlineDay.getTime()) / 864e5
        if (daysBefore < 0) {
          bad++
          flag('날짜 불일치', '신청 마감이 개강일보다 늦습니다.')
        } else if (daysBefore !== 1 || deadline['시각'] !== '23:00') {
          flag('확인 필요', '신청 마감이 ‘개강 전날 23시’(기존 유료 랜딩 공통)와 다릅니다.')
        }
      }
      for (let i = 1; i < sessions.length; i++) {
        const cur = parseDate(sessions[i]['날짜'])
        const prev = parseDate(sessions[i - 1]['날짜'])
        if (cur && prev && cur.getTime() <= prev.getTime()) {
          bad++
          flag('날짜 불일치', `${str(sessions[i]['번호'])}회차 날짜가 앞 회차보다 빠르거나 같습니다.`)
        }
      }
    }
    if (!bad) pass()
  }

  /* 4) 금액·숫자에 증빙이 연결돼 있는지 */
  function checkProof() {
    const numbers = Object.entries(rec(facts['대표숫자'])).map(([name, v]) => ({ name, value: str(rec(v)['값']), proof: rec(v)['증빙'] }))

    const withoutProof: string[] = []
    for (const n of numbers) {
      if (!MONEY.test(n.value)) continue
      if (!has(n.proof)) {
        const usedIn = [...new Set([...(ctx.tokenUse.get(`대표숫자.${n.name}`) ?? [])].map(k => ctx.sectionName(k)))]
        withoutProof.push(`${n.value}${usedIn.length ? `(${usedIn.join('·')})` : ''}`)
      } else if (!ctx.imageUrl(n.proof)) {
        flag('증빙 없음', `${n.value} — 연결한 증빙 그림(${str(n.proof)})의 주소를 쓸 수 없습니다.`)
      }
    }
    if (withoutProof.length) {
      flag('증빙 없음', `대표 숫자 ${withoutProof.length}개에 연결된 증빙 캡처가 없습니다: ${withoutProof.join(', ')}. 서류·화면 캡처를 받거나 표현을 낮춰야 합니다.`)
    } else pass()

    // 대표 숫자로 등록하지 않고 글에 직접 적은 금액·%
    const loose: string[] = []
    for (const x of texts) {
      if (!inSections(x.path) || /student_results/.test(x.path) || QUOTED_PATH.test(x.path)) continue
      let rest = plain(x.text)
      for (const n of numbers) if (n.value) rest = rest.split(n.value).join('')
      const m = MONEY.exec(rest)
      if (m && !/^0\s*원/.test(m[0])) {
        const shown = plain(x.text)
        loose.push(`${whereOf(x.path)} “${shown.slice(0, 26)}${shown.length > 26 ? '…' : ''}”`)
      }
    }
    if (loose.length) {
      flag('확인 필요', `대표 숫자로 등록하지 않고 글에 직접 적힌 금액·% 문구 ${loose.length}건(근거 확인 필요): ${loose.slice(0, 4).join(', ')}${loose.length > 4 ? ' 외' : ''}`)
    } else pass()

    const results = sections.student_results
    if (results) {
      const bare = list(results.review_summaries).filter(c => !has(rec(c).captures))
      if (bare.length) flag('증빙 없음', `수강생 성과 ${bare.length}건에 캡처가 없습니다.`)
      else pass()
    }

    // "1,000,000만 원" 처럼 원 단위 숫자 뒤에 '만원'이 붙은 경우
    const wrongUnit = texts.filter(x => /\d{1,3}(,\d{3}){2,}\s*만\s*원/.test(x.text))
    if (wrongUnit.length) {
      for (const x of wrongUnit) flag('단위', `${whereOf(x.path)}: “${plain(x.text)}” — 원 단위 숫자 뒤에 ‘만원’이 붙었습니다.`)
    } else pass()
  }

  /* 5) 강의명·그림 중복 */
  function checkTitleAndImages() {
    const normalize = (v: unknown) => plain(v).replace(/[^가-힣A-Za-z0-9]/g, '')
    const registered = normalize(facts['강의명'])
    if (registered) {
      const shown = [str(facts['강의명_윗줄']), ...str(facts['강의명_제목']).split('\n')].filter(Boolean)
      const notInName = shown.filter(x => !registered.includes(normalize(x)))
      if (notInName.length) {
        flag('확인 필요', `첫 화면 제목의 “${notInName.map(plain).join(' / ')}”이(가) 등록 강의명(“${str(facts['강의명'])}”)에 없는 문구입니다. 강의명을 하나로 정해야 합니다.`)
      } else pass()
    } else {
      flag('확인 필요', '기본 정보에 강의명이 없습니다.')
    }

    const duplicated = [...ctx.usedImages.entries()].filter(([, where]) => new Set(where).size > 1)
    if (duplicated.length) flag('중복', `같은 그림이 두 섹션에 쓰였습니다: ${duplicated.map(([url]) => url).join(', ')}`)
    else pass()

    const recommended = plans.filter(p => p['추천'])
    if (recommended.length > 1) {
      flag('확인 필요', `추천 표시가 플랜 ${recommended.length}개(${recommended.map(p => str(p['이름'])).join(', ')})에 붙어 있습니다. 보통은 하나만 추천합니다.`)
    }
  }
}
