# 템플릿 랜딩 (`src/lib/landingTemplate`)

섹션 자료(`LandingDoc`)를 표준 순서의 상세 페이지로 그리는 모듈입니다. 그림 파일을 통째로 올리는 대신, 글·숫자·그림 주소만 넣으면 같은 디자인 규칙으로 페이지가 만들어지고 검사 결과가 함께 나옵니다.

```ts
import { renderLanding, mountLandingBehaviors, LANDING_SPEC } from '../lib/landingTemplate'
import { isLandingDoc } from '../lib/landingTemplate/guard' // 가드만 필요할 때(렌더러가 딸려 오지 않음)

const { html, css, report } = renderLanding(doc)            // 순수 함수(fs·DOM 없음)
// css 는 모든 문서에 공통 → head 에 한 번만. html 은 <div class="lpt" style="--ac:…">…</div> 하나.
const release = mountLandingBehaviors(lptElement)           // 스크롤 등장·슬라이더·접기. 해제 함수 반환
```

| 파일 | 하는 일 |
| --- | --- |
| `index.ts` | 공개 함수·타입 |
| `guard.ts` | `isLandingDoc` (의존성 없음) |
| `types.ts` | 문서·보고서·기준서 타입 |
| `spec.free.ts` · `spec.paid.ts` · `spec.ts` | 종류별 표준 순서와 섹션별 필요한 자료(`LANDING_SPEC`) |
| `context.ts` | `{이름}` 불러 쓰기, 그림·버튼 만들기, 보고서 기록 |
| `sections/free.ts` · `sections/paid.ts` · `sections/common.ts` | 섹션 그리기 |
| `assemble.ts` | 순서대로 조립, 바탕색 규칙, 빠진 자료 기록 |
| `checks.ts` | 검사(빈칸 표시·개수·날짜·증빙·강의명·그림 중복) |
| `theme.ts` · `css.ts` | 색 변수, 공통 스타일(모두 `.lpt` 아래) |
| `behaviors.ts` | 동작 붙이기 |

## 규칙

- **글**: 모두 HTML 이스케이프됩니다. 살아남는 표시는 `==강조==`, `**굵게**`, 줄바꿈(`\n`) 세 가지뿐입니다.
- **주소**: 그림은 `https://…` 또는 `/…`(사이트 안 경로)만, 링크는 여기에 `#…` 까지 허용합니다. 그 밖의 값은 빼고 `report.checks` 에 적습니다. 그림 값이 파일 이름이면 `renderLanding(doc, { resolveImage: file => '/…/' + file })` 로 주소를 만들어 줄 수 있습니다.
- **신청 버튼**: 항상 `<a href="#apply" class="btn" data-lpt-apply>` 형태입니다(`facts.신청주소` 가 있으면 그 주소). 호스트가 클릭을 가로채 사이트의 신청 흐름에 잇습니다.
- **그림**: 첫 그림만 `fetchpriority="high"`, 나머지는 `loading="lazy"` 입니다.
- **스타일**: 모든 규칙이 `.lpt` 아래에만 적용되고, 크기는 창이 아니라 `.lpt` 의 너비(container query, `cqw`)를 따릅니다. 글꼴은 `Pretendard` 를 먼저 찾으며, 글꼴 파일은 호스트가 불러옵니다.
- **동작 없이도 보입니다**: 등장 효과의 숨김 상태는 `mountLandingBehaviors` 가 붙이는 `lpt-js` 클래스가 있을 때만 생깁니다. `prefers-reduced-motion` 이면 등장 효과를 쓰지 않습니다.
- 실시간 신청자 수·신청자 팝업 같은 요소는 이 템플릿에 없습니다.

## 문서 형식

```ts
interface LandingDoc {
  version: 1
  type: 'free' | 'paid'
  theme?: { accent?: '#RRGGBB'; base?: 'light' | 'dark'; top?: '#RRGGBB' }
  facts: Record<string, unknown>     // 한 번만 적는 기본 정보(한글 키)
  sections: Record<string, unknown>  // 섹션 키 → 그 섹션의 자료
}
```

### `facts` (기본 정보)

날짜·시각·대표 숫자는 여기에 한 번만 적고, 글 안에서는 `{이름}` 으로 불러 씁니다. 날짜는 `YYYY-MM-DD`, 시각은 `HH:MM` 으로 적으면 "9월 17일(목)", "저녁 7시 30분" 처럼 바뀝니다(요일은 자동 계산).

| 키 | 종류 | 설명 |
| --- | --- | --- |
| `강의명` | 공통 | 등록 강의명(필수) |
| `강의명_윗줄` · `강의명_제목` | 공통 | 강의명을 두 덩어리로 보여 줄 때. 등록 강의명에 없는 문구면 검사에 걸림 |
| `강의명_짧게` | 유료 | 구성 요약 위에 쓰는 짧은 이름 |
| `강사명` | 공통 | 강사 이름(활동명) |
| `강사_수식어` | 무료 | 이름 위 한 줄(직함·소개) |
| `강사_별칭` · `강사_직함` | 무료 | 첫 화면 이름표 윗줄(없으면 `강사_수식어`) |
| `강사_한줄` | 유료 | 마감 안내 위 한 줄 |
| `라이브` | 무료 | `{ "날짜": "YYYY-MM-DD", "시각": "HH:MM" }` |
| `진행방식` | 무료 | 빨간 알약 글자(없으면 "라이브") |
| `입장방법` · `다시보기` | 무료 | 일정 카드 아래 안내(글자) |
| `선물조건` | 무료 | 예: "라이브 참여자 전원" |
| `개강일` | 유료 | `YYYY-MM-DD` (1회차 날짜와 같아야 함) |
| `신청마감` | 유료 | `{ "날짜", "시각" }` |
| `회차` | 유료 | `[{ "번호", "날짜", "시각", "제목", "한정플랜"?, "달력이름"? }]` |
| `플랜` | 유료 | `[{ "이름", "표기"?, "한줄"?, "추천"?, "최상위"? }]` (낮은 플랜부터) |
| `추천문구` | 유료 | 추천 플랜 위 글자 |
| `다시보기` | 유료 | `{ "업로드", "기간" }` |
| `결제안내` | 유료 | 버튼 아래 안내 띠 |
| `신청주소` · `버튼문구` | 공통 | 없으면 `#apply` · "신청하기" |
| `대표숫자` | 공통 | `{ "이름": { "값": "…", "증빙": "그림 주소 또는 null" } }` — 금액·% 는 증빙이 없으면 검사에 걸림 |

불러 쓰기 예: `{강사명}`, `{대표숫자.이름}`, `{회차.1.시각}`, `{회차.2.날짜|M/D}`(형식: `M/D`, `월일`), 자동으로 세는 값 `{본강의수}` · `{회차수}` · `{플랜수}`.

### 무료 (`type: "free"`) — 12블록

필수는 1·2·3·4·5·6·7·12 입니다. 자주 묻는 질문·긴 커리큘럼·카운트다운은 무료 표준에 없습니다(넣어도 그리지 않고 보고서에 적습니다). 신청 버튼은 1번, 2번 바로 뒤(자동), 12번에 들어갑니다.

| # | 키 | 이름 | 필드 |
| --- | --- | --- | --- |
| 1 | `hook` | 첫 화면 배너 (필수) | `banner_title`(결과형 3줄 제목. 표시가 없으면 2번째 줄이 강조색) 또는 `hook_big`(큰 성과 숫자 한 줄) 중 하나 · `hook_line`(작은 윗줄) · `instructor_photo`(누끼 사진, 이름표가 붙음) · `hero_image` + `hero_image_alt` |
| 2 | `gift` | 참여 선물 (필수) | `gift_items: [{ name, desc?, value?, lead?, image? }]`(값어치 `value` 는 있을 때만 표시) · `title`(없으면 "라이브 참여만 해도 전원 무료 제공") · `title_pre` · `gift_condition`(없으면 `facts.선물조건`) · `gift_how`. 바로 뒤에 신청 묶음(강의명 + 일시 + 버튼)이 자동으로 붙음 |
| 3 | `empathy` | 공감·경계 해소 (필수, 셋 중 하나 이상) | (A) `lead`(현실 인정) · `question`(질문) · `cause_line`(원인) / (B) `notice_action`("○○" → "본 강의를 통해서는, 어떤 경우에도 ○○을 진행하지 않습니다") 또는 `notice_text` / (C) `pain_points`(3~5개. 글자 목록 또는 `[{ who, text }]`). 선택: `opening` · `opening_big` · `lead2` · `bubbles` · `bubbles_after` · `mood_image` · `bridge` · `cause_detail` · `contrast: { lead, a: { pre, big, post, image }, b: {…} }` |
| 4 | `instructor` | 강사 등장 + 비포 (필수) | `greeting`(인사) · `story`(불리했던 출발점, 필수) · `question`(궁금증 질문) · `instructor_photo` · `career_list` · `authority_title` + `authority_line` · `credential_capture` |
| 5 | `proof` | 서류 증빙(애프터) (필수) | `after_line`(애프터 한 줄) 또는 `proof_summary: { pre, from?, to }` · `proof_captures: [{ image, alt?, amount?(강조 숫자), period?(기간), caption? }]`(필수) · `total: { label?, value }`(누적 숫자) · `proof_amounts: [{ label, value }]`(성장 단계) · `proof_basis_note` · `proof_note` + `proof_note_label` |
| 6 | `concept` | 핵심 개념 한 단어 (필수) | `lead`(질문) · `method_name`(한 단어 답, 필수) · `method_definition`(재정의 문장, 필수) · `method_intro` · `method_not` · `demo_captures` · `market_stat` · `premise: { pre, title, image, to, items, post, conclusion }` |
| 7 | `objection` | 오해 깨기 (필수) | `doubts`(오해 목록, 필수. 모두 짧으면 "○○? 아닙니다." 반복, 길면 인용 상자) · `answers`(없으면 "아닙니다.") · `rebuttal`(반박 근거) · `evidence_images` · `title` · `title_pre` |
| 8 | `comparison` | 비교·가능한 결과 (권장) | `comparison: { old: { title, text, steps? }, new: { title, text } }` 또는 `comparison_pairs: [[기존, 새 방법], …]` 또는 `none_checks`("~없음" 목록) · `title` · `result_line` |
| 9 | `student_results` | 수강생 성과 (있으면) | `review_summaries: [{ pre?, sub?, big, tag?, captures: [{ image, alt }] }]` · `title` · `cohort_label` · `disclaimer` |
| 10 | `takeaways` | 알려 드리는 것 (권장) | `takeaway_items: [{ title, desc?, tag? }]`(최대 3개, 4개 이상이면 보고서에 표시) · `title` · `eyebrow` · `closing_line` |
| 11 | `closing` | 마지막 밀어주기 (권장) | `closing_message`(필수) · `quote` · `closing_pre` + `closing_big` · `closing_photo` |
| 12 | `schedule_cta` | 일정 재확인 + 신청 (필수) | 자료는 `facts` 에서 옴. 선택: `cta_label` · `gift_recap: true`(선물 이름 다시 보여 주기) |

예시(지어낸 자리 표시 글):

```json
{
  "version": 1,
  "type": "free",
  "theme": { "accent": "#2B33E6", "base": "light" },
  "facts": {
    "강의명": "강의명 예시",
    "강사명": "강사 이름 예시",
    "강사_수식어": "직함 예시",
    "라이브": { "날짜": "2030-01-15", "시각": "19:30" },
    "선물조건": "라이브 참여자 전원",
    "버튼문구": "무료 신청하기"
  },
  "sections": {
    "hook": { "banner_title": "제목 첫 줄 예시\n강조되는 둘째 줄 예시\n제목 셋째 줄 예시", "instructor_photo": "https://example.com/instructor.png" },
    "gift": { "gift_items": [{ "name": "선물 이름 예시", "desc": "선물 설명 예시", "image": "https://example.com/gift.png" }] },
    "empathy": { "pain_points": ["고민 예시 하나", "고민 예시 둘", "고민 예시 셋"] },
    "instructor": { "greeting": "안녕하세요,", "story": "출발점 이야기 예시", "question": "궁금증 질문 예시" },
    "proof": { "after_line": "애프터 한 줄 예시", "proof_captures": [{ "image": "https://example.com/proof.png", "caption": "증빙 설명 예시" }] },
    "concept": { "lead": "질문 예시", "method_name": "한 단어 예시", "method_definition": "재정의 문장 예시" },
    "objection": { "doubts": ["오해 예시?"], "rebuttal": "반박 근거 예시" },
    "schedule_cta": {}
  }
}
```

### 유료 (`type: "paid"`)

순서: 첫 화면 → 걱정과 답 → 강사 권위 → 수강생 성과 → 신청 마감 → 신청 버튼 → 일정 달력 → 구성 요약 → 커리큘럼 → 강의계획서 버튼 → 플랜별 혜택 → 보증·환불 → 플랜 추천 → 이런 분께 → 자주 묻는 질문 → 미래 비교 → 강사 이야기·마무리 → 끝 신청 버튼 → 저작권 안내. 자료가 없는 선택 섹션은 빠집니다. `deadline` · `cta` · `calendar` 는 `facts` 만으로 만들어지며, 선택 섹션은 키를 `{}` 로라도 넣어야 들어갑니다(예: `"final_cta": {}`, `"copyright": {}`).

| 키 | 이름 | 필드 |
| --- | --- | --- |
| `hook` | 첫 화면 (필수) | `promise_line` · `instructor_line` · `instructor_photo` · `sub` · `sub_strong` + `sub_band` · `industry_notice` |
| `worries_answers` | 걱정과 답 (필수) | `worry_items: [{ q, a, strip?, items? }]` · `method_line` |
| `instructor_authority` | 강사 권위 (필수) | `authority_numbers: [{ label, value }]` · `turn` · `photo` · `now_label` + `now_value` + `now_line` · `proof_captures` · `career_list` · `asked_title` + `asked` · `story` + `story_band` · `because_pre` + `because` + `because_image` |
| `student_results` | 수강생 성과 | 무료 9번과 같음 |
| `deadline` | 신청 마감 안내 (필수) | `pre` · `early_close_note` (일시는 `facts.신청마감`) |
| `cta` | 신청 버튼 (필수) | `cta_label` |
| `calendar` | 일정 달력 (필수) | `title` · `extra_events: [{ 회차, text }]` · `offline_place` · `notes` (일정은 `facts.회차`) |
| `summary` | 시작일·구성 요약 (필수) | `summary_items` · `footnote` |
| `curriculum` | 커리큘럼 (필수) | `session_details: { "1": { items: [글자 또는 { t, sub }], assignment?, outcome?, outcome_image? } }` · `title` · `change_note` |
| `syllabus_button` | 강의계획서 버튼 | `syllabus_link` |
| `plans_benefits` | 플랜별 혜택 (필수) | `benefit_items: [{ plan, title, desc, side? }]` · `title` · `title_pre` · `band` · `top_plan_perks: { pre, title, who, image, items: [{ title, desc }] }` · `plan_prices: [{ plan, price }]` |
| `guarantee` | 보증·환불 | `guarantee_plan` · `guarantee_terms` · `title` · `refund_policy_ref` |
| `plan_guide` | 플랜 추천 | `plan_personas: [{ say, plan }]` · `title` |
| `audience` | 이런 분께 | `audience_types` · `title` · `closing_word` |
| `faq` | 자주 묻는 질문 | `faq_items: [{ q, a }]` · `title` |
| `future_price` | 미래 비교 | `future_without` · `future_with` · `title` |
| `instructor_closing` | 강사 이야기·마무리 (필수) | `instructor_message` · `promise` · `lead` · `declare` · `promise_title` · `instructor_photo` · `outcomes3` |
| `final_cta` | 끝 신청 버튼 | `cta_label` |
| `copyright` | 저작권 안내 | 없음(고정 문구) |

예시(지어낸 자리 표시 글):

```json
{
  "version": 1,
  "type": "paid",
  "theme": { "accent": "#2B33E6", "base": "dark", "top": "#FFD83A" },
  "facts": {
    "강의명": "강의명 예시",
    "강사명": "강사 이름 예시",
    "개강일": "2030-02-05",
    "신청마감": { "날짜": "2030-02-04", "시각": "23:00" },
    "회차": [
      { "번호": 1, "날짜": "2030-02-05", "시각": "19:00", "제목": "1회차 제목 예시" },
      { "번호": 2, "날짜": "2030-02-12", "시각": "19:00", "제목": "2회차 제목 예시" }
    ],
    "플랜": [{ "이름": "기본", "한줄": "플랜 설명 예시" }],
    "다시보기": { "업로드": "다음 날 오후 2시" },
    "버튼문구": "강의 신청하기"
  },
  "sections": {
    "hook": { "promise_line": "한 줄 약속 예시", "instructor_line": "강사 한 줄 소개 예시", "instructor_photo": "https://example.com/instructor.png" },
    "worries_answers": { "worry_items": [{ "q": "걱정 예시?", "a": "답 예시", "items": ["제공 자료 예시"] }] },
    "instructor_authority": { "authority_numbers": [{ "label": "이력 예시", "value": "값 예시" }] },
    "summary": { "summary_items": ["라이브 {본강의수}회", "구성 예시"] },
    "curriculum": { "session_details": { "1": { "items": ["내용 예시"] }, "2": { "items": ["내용 예시"] } } },
    "plans_benefits": { "benefit_items": [{ "plan": "기본", "title": "혜택 예시", "desc": "혜택 설명 예시" }] },
    "instructor_closing": { "instructor_message": "강사의 글 예시" },
    "final_cta": {}
  }
}
```

## 보고서 (`report`)

- `used`: 사용한 섹션 이름(순서대로)
- `skipped`: 자료가 없어 뺀 선택 섹션과 넣으려면 필요한 자료
- `lacking`: 자료가 부족한 필수 섹션과 필요한 자료
- `checks`: 검사에서 걸린 것 — `[빈칸 표시]`(N·NN·OO·○○·＿＿, 없는 `{이름}`), `[개수 불일치]`·`[개수 초과]`(글에 적힌 개수와 목록, 무료 "알려 드리는 것" 4개 이상), `[날짜 불일치]`(기본 정보에 없는 날짜, 틀린 요일, 회차 순서), `[증빙 없음]`(증빙이 연결되지 않은 금액·%), `[확인 필요]`(등록하지 않은 금액 문구, 강의명과 다른 제목, 표준에 없는 섹션), `[중복]`(같은 그림 두 번), `[그림 주소]`·`[주소]`(쓸 수 없는 주소), `[단위]`, `[오류]`
- `passed`: 문제 없이 통과한 검사 수
