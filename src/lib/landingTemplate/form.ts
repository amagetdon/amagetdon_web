// 어드민 입력 화면의 실제 명세: 섹션마다 어떤 칸을 어떤 입력 방식으로 받는지.
// 키 이름과 모양은 sections/*.ts · context.ts · checks.ts 가 읽는 그대로다(타입은 formTypes.ts).
// 코드가 두 가지 모양을 받는 값은 한 가지로 정했다(예: 증빙 캡처는 항상 { image, … } 항목).
import type { FormField, FormSection, LandingFormSpec } from './formTypes'

/* ───────── 칸 만들기 도우미 ───────── */

interface Extra {
  hint?: string
  required?: boolean
}
type Scalar = 'text' | 'longtext' | 'image' | 'date' | 'time' | 'link' | 'color' | 'flag'

const scalar = (kind: Scalar) => (key: string, label: string, extra: Extra = {}): FormField => ({ kind, key, label, ...extra })
/** 한 줄 글 */
const text = scalar('text')
/** 여러 줄 글 */
const long = scalar('longtext')
/** 그림 1장 */
const image = scalar('image')
const date = scalar('date')
const time = scalar('time')
const link = scalar('link')
const color = scalar('color')
/** 켜고 끄기 */
const flag = scalar('flag')

interface ListExtra extends Extra {
  min?: number
  max?: number
}
/** 글자 목록 */
const strings = (key: string, label: string, itemLabel: string, extra: ListExtra & { long?: boolean } = {}): FormField =>
  ({ kind: 'strings', key, label, itemLabel, ...extra })
/** 그림 여러 장 */
const images = (key: string, label: string, extra: Extra & { max?: number } = {}): FormField =>
  ({ kind: 'images', key, label, ...extra })
/** 묶음 */
const group = (key: string, label: string, fields: FormField[], extra: Extra = {}): FormField =>
  ({ kind: 'group', key, label, fields, ...extra })
/** 항목 목록 — 첫 칸은 항목이 글자 하나로 저장돼 있을 때 그 글자가 들어갈 칸 */
const items = (key: string, label: string, itemLabel: string, fields: FormField[], extra: ListExtra = {}): FormField =>
  ({ kind: 'items', key, label, itemLabel, fields, ...extra })

/* ───────── 자주 쓰는 안내 문구 ───────── */

const MARK = '강조할 말은 ==강조== 처럼 감싸면 강조색이 됩니다.'
const BREAK = '줄을 바꾸면 그대로 줄이 바뀝니다.'
const NUMBER = '금액·%는 기본 정보의 대표 숫자에 먼저 등록하고 {대표숫자.이름} 으로 불러 씁니다.'
const SOURCE = '강사가 준 자료에 있는 내용만 적습니다.'
const PROOF = '증빙 그림이 있는 숫자만 적습니다.'
const HIDE = '이름·연락처 같은 개인정보는 가린 그림을 올립니다.'
const OWN_LABEL = '이 버튼만 다른 글자로 하고 싶을 때 적습니다. 비우면 기본 정보의 버튼 글자입니다.'

/* ───────── 색·바탕 ───────── */

const THEME: FormField[] = [
  color('accent', '강조색', { hint: '버튼과 강조 글자에 쓰는 색. 비우면 기본 파랑입니다. 예: #2B33E6' }),
  {
    kind: 'select',
    key: 'base',
    label: '바탕',
    hint: '페이지 전체 분위기. 밝은 바탕과 어두운 바탕 중 하나를 고릅니다.',
    options: [
      { value: 'light', label: '밝은 바탕' },
      { value: 'dark', label: '어두운 바탕' },
    ],
  },
  color('top', '두 번째 색', { hint: '최상위 플랜·포인트에 쓰는 색. 비우면 기본 노랑입니다. 예: #FFD83A' }),
]

/* ───────── 기본 정보(무료·유료 공통 칸) ───────── */

const courseName = text('강의명', '등록 강의명', { required: true, hint: '사이트에 등록한 강의 이름 그대로 적습니다. 모든 섹션이 이 값을 씁니다.' })
const courseNameUpper = text('강의명_윗줄', '강의명 윗줄', { hint: '강의명을 두 덩어리로 보여 줄 때 위에 작게 놓는 부분. 등록 강의명에 있는 말만 씁니다.' })
const courseNameTitle = long('강의명_제목', '강의명 큰 제목', { hint: `크게 보여 줄 부분. 등록 강의명에 있는 말만 씁니다. 비우면 등록 강의명이 그대로 나옵니다. ${BREAK}` })
const applyLabel = (example: string) => text('버튼문구', '신청 버튼 글자', { hint: `비우면 "신청하기"로 나옵니다. 예: ${example}` })
const applyLink = (extra: string, required = false) =>
  link('신청주소', '신청 주소', { ...(required ? { required } : {}), hint: `버튼을 누르면 가는 주소. https:// 또는 / 로 시작해야 합니다. ${extra}` })

/** 대표 숫자: 이름을 붙여 등록하고 글에서 {대표숫자.이름} 으로 불러 쓴다 */
const keyNumbers: FormField = {
  kind: 'keyed',
  key: '대표숫자',
  label: '대표 숫자',
  keyLabel: '숫자 이름',
  itemLabel: '숫자',
  hint: '페이지에 쓰는 금액·%·횟수를 여기 한 번만 등록합니다. 글에서는 {대표숫자.이름} 으로 불러 씁니다. 금액·%는 증빙 그림이 없으면 검사에 걸립니다. 이름 예: 월매출_이후',
  fields: [
    text('값', '값', { required: true, hint: '페이지에 보일 글자 그대로. 강사 자료에 적힌 값만 씁니다. 예: ○○만 원' }),
    image('증빙', '증빙 그림', { hint: `이 숫자가 적힌 서류·화면 캡처 1장. ${HIDE}` }),
  ],
}

/** 일시 묶음(라이브 · 신청마감)의 칸 */
const dateTimeFields = (dateHint: string, timeHint: string): FormField[] => [
  date('날짜', '날짜', { required: true, hint: dateHint }),
  time('시각', '시각', { required: true, hint: timeHint }),
]

/* ───────── 기본 정보: 무료 ───────── */

const FREE_FACTS: FormField[] = [
  courseName,
  courseNameUpper,
  courseNameTitle,
  text('강사명', '강사 이름', { required: true, hint: '페이지에 보일 이름(활동명).' }),
  text('강사_수식어', '강사 소개 한 줄', { hint: '이름 위에 붙는 직함·소개. 강사 자료에 있는 말만 씁니다. 예: ○○ 분야 강사' }),
  text('강사_별칭', '이름표 별칭', { hint: '첫 화면 사진 아래 이름표 윗줄의 앞부분. 없으면 비웁니다.' }),
  text('강사_직함', '이름표 직함', { hint: '첫 화면 이름표 윗줄의 뒷부분. 비우면 강사 소개 한 줄이 들어갑니다.' }),
  group('라이브', '라이브 일시', dateTimeFields('라이브 날짜. 요일은 자동으로 붙습니다.', '시작 시각. 예: 19:30'), { required: true, hint: '일정 알약, 신청 묶음, 마지막 일정 안내에 모두 이 값이 쓰입니다.' }),
  text('진행방식', '진행 방식', { hint: '빨간 알약에 들어가는 글자. 비우면 "라이브"입니다. 예: 유튜브 라이브' }),
  text('선물조건', '선물 받는 조건', { hint: '참여 선물 제목 아래에 붙습니다. 예: 라이브 참여자 전원' }),
  text('입장방법', '입장 방법', { hint: '마지막 일정 안내 아래 한 줄. 예: 강의 10분 전 오픈채팅방에 링크 전송' }),
  text('다시보기', '다시보기 안내', { hint: '마지막 일정 안내 아래 "다시보기: …"로 붙습니다. 실제 운영 방식 그대로 적고, 제공하지 않으면 비웁니다.' }),
  applyLabel('무료 신청하기'),
  applyLink('비우면 사이트의 신청 창으로 이어집니다.'),
  keyNumbers,
]

/* ───────── 기본 정보: 유료 ───────── */

const PAID_FACTS: FormField[] = [
  courseName,
  courseNameUpper,
  courseNameTitle,
  text('강의명_짧게', '짧은 강의명', { hint: '구성 요약 위에 작게 쓰는 줄임 이름.' }),
  text('강사명', '강사 이름', { hint: '페이지에 보일 이름(활동명). 사진 설명과 글 안의 {강사명} 에 쓰입니다.' }),
  long('강사_한줄', '강사 한 줄', { hint: `신청 마감 안내 위에 놓는 한 줄. ${SOURCE} ${NUMBER}` }),
  date('개강일', '개강일', { hint: '1회차 날짜와 같아야 합니다. 비우면 1회차 날짜를 씁니다.' }),
  group('신청마감', '신청 마감 일시', dateTimeFields('보통 개강 전날입니다.', '보통 23:00 입니다.'), { required: true, hint: '신청 마감 안내와 끝 신청 버튼에 쓰입니다.' }),
  items('회차', '회차 일정', '회차', [
    text('번호', '회차 번호', { required: true, hint: '1부터 차례대로. 커리큘럼의 회차 번호와 같아야 합니다.' }),
    date('날짜', '날짜', { required: true, hint: '앞 회차보다 뒤 날짜여야 합니다. 요일은 자동으로 붙습니다.' }),
    time('시각', '시작 시각', { required: true, hint: '예: 19:00' }),
    long('제목', '회차 제목', { required: true, hint: `커리큘럼에 보이는 제목. 한두 줄. ${BREAK}` }),
    text('한정플랜', '한정 플랜 이름', { hint: '특정 플랜만 듣는 회차일 때 그 플랜 이름. 적으면 본강의 횟수에서 빠집니다. 모두 듣는 회차면 비웁니다.' }),
    text('달력이름', '달력에 쓸 이름', { hint: '달력 칸에 "N회차" 대신 보일 짧은 이름. 예: 특강' }),
  ], { required: true, min: 1, hint: '달력·커리큘럼·시작일이 모두 이 목록에서 만들어집니다. 글에서는 {회차.1.날짜}, {본강의수} 처럼 불러 쓸 수 있습니다.' }),
  items('플랜', '플랜', '플랜', [
    text('이름', '플랜 이름', { required: true, hint: '혜택 목록의 "해당 플랜"에 이 이름을 그대로 적습니다. 예: 기본' }),
    text('표기', '혜택 꼬리표 글자', { hint: '혜택 카드 꼬리표에 이름 대신 보일 글자. 비우면 플랜 이름입니다.' }),
    long('한줄', '플랜 한 줄 설명', { hint: '플랜 카드에 보이는 한 줄. 어떤 사람에게 맞는지.' }),
    flag('추천', '추천 플랜', { hint: '켜면 추천 표시가 붙습니다. 보통 한 플랜에만 켭니다.' }),
    flag('최상위', '최상위 플랜', { hint: '켜면 두 번째 색으로 보입니다. 가장 높은 플랜에만 켭니다.' }),
  ], { hint: '낮은 플랜부터 차례대로 적습니다. 플랜이 하나뿐이면 플랜 카드 없이 혜택만 보입니다.' }),
  text('추천문구', '추천 표시 글자', { hint: '추천 플랜 위에 붙는 글자. 비우면 "추천"입니다.' }),
  group('다시보기', '다시보기', [
    text('업로드', '올라오는 시점', { required: true, hint: '예: 다음 날 오후 2시. 글에서 {다시보기.업로드} 로 불러 씁니다.' }),
    text('기간', '볼 수 있는 기간', { hint: '실제 운영 기준 그대로. 글에서 {다시보기.기간} 으로 불러 씁니다.' }),
  ], { hint: '여기 한 번만 적고 일정 안내·자주 묻는 질문에서 불러 씁니다.' }),
  long('결제안내', '결제 안내 띠', { hint: '신청 버튼 아래 작은 안내. 예: 카드 할부 안내 문구' }),
  applyLabel('강의 신청하기'),
  // 유료는 결제 주소가 없으면 끝 신청 버튼이 빠지고, 신청 버튼도 빠진 자료로 적힌다(기준서의 cta_link 가 필수)
  applyLink('비우면 사이트의 결제 창으로 이어집니다.'),
  keyNumbers,
]

/* ───────── 무료·유료가 함께 쓰는 섹션 칸 ───────── */

/** 수강생 성과(무료 9번 · 유료) */
const studentResultFields: FormField[] = [
  items('review_summaries', '사례 카드', '사례', [
    long('pre', '윗줄', { hint: '누구의 사례인지. 이름은 가립니다. 예: 직장인 수강생' }),
    long('sub', '둘째 줄', { hint: '상황 설명 한 줄. 없으면 비웁니다.' }),
    long('big', '성과 한 줄', { required: true, hint: `크게 보이는 결과. 캡처에 실제로 보이는 값만 적습니다. ${MARK}` }),
    text('tag', '꼬리표', { hint: '작은 딱지 글자. 예: 수강 ○주차' }),
    items('captures', '후기·성과 캡처', '캡처', [
      image('image', '캡처 그림', { required: true, hint: HIDE }),
      text('alt', '그림 설명', { hint: '그림을 못 보는 사람을 위한 한 줄 설명.' }),
    ], { required: true, min: 1, hint: '캡처가 없는 사례는 검사에 걸립니다.' }),
  ], { required: true, min: 1, hint: '수강생이 실제로 보낸 후기·성과만 넣습니다.' }),
  long('title', '제목', { hint: '비우면 "수강생 성과"입니다.' }),
  text('cohort_label', '기수 표시', { hint: '제목 아래 작은 줄. 예: 1기 수강생' }),
  long('disclaimer', '안내 한 줄', { hint: '결과는 사람마다 다르다는 안내.' }),
]

/* ───────── 무료 12블록 ───────── */

const FREE_SECTIONS: FormSection[] = [
  {
    key: 'hook',
    block: 1,
    name: '첫 화면 배너',
    role: '일정·결과형 제목·신청 버튼·강사를 한 화면에 보여 준다',
    required: true,
    note: '"결과형 제목"과 "큰 성과 한 줄" 중 하나는 꼭 채웁니다. 둘 다 있으면 결과형 제목을 씁니다. 일정과 이름표는 기본 정보에서 옵니다.',
    fields: [
      long('banner_title', '결과형 제목', { hint: `세 줄로 적습니다. 표시가 없으면 둘째 줄이 강조색이 됩니다. ${MARK} ${SOURCE}` }),
      long('hook_big', '큰 성과 한 줄', { hint: `결과형 제목이 없을 때 대신 쓰는 시작 줄. ${NUMBER}` }),
      long('hook_line', '제목 위 작은 줄', { hint: '제목 위에 놓는 한두 줄.' }),
      image('instructor_photo', '강사 사진', { hint: '배경을 지운 상반신 1장. 아래에 이름표가 붙습니다. 얼굴을 공개하지 않으면 비웁니다.' }),
      image('hero_image', '첫 화면 그림', { hint: '강사 사진 대신 또는 함께 쓰는 주제 그림 1장.' }),
      text('hero_image_alt', '첫 화면 그림 설명', { hint: '그림을 못 보는 사람을 위한 한 줄 설명.' }),
    ],
  },
  {
    key: 'gift',
    block: 2,
    name: '참여 선물',
    role: '라이브에 참여하면 받는 자료를 먼저 보여 주고 바로 신청하게 한다',
    required: true,
    note: '선물은 최소 1종이 필요합니다. 4종 이상이면 옆으로 넘기는 카드가 됩니다. 이 섹션 바로 뒤에 신청 묶음(강의명·일시·버튼)이 자동으로 붙습니다.',
    fields: [
      items('gift_items', '선물 목록', '선물', [
        long('name', '선물 이름', { required: true, hint: '실제로 주는 자료 이름 그대로.' }),
        long('desc', '선물 설명', { hint: '무엇이 들어 있는지 한두 줄.' }),
        image('image', '선물 그림', { hint: '자료 표지나 미리보기 1장.' }),
        text('lead', '이름 위 작은 줄', { hint: '이름 위에 붙는 짧은 말. 없으면 비웁니다.' }),
        text('value', '값어치', { hint: '근거가 있을 때만 적습니다. 비우면 표시하지 않습니다. 예: ○만 원 상당' }),
      ], { required: true, min: 1, max: 5 }),
      long('title', '제목', { hint: `비우면 "라이브 참여만 해도 전원 무료 제공"입니다. "N종"이라고 쓰면 선물 개수와 같아야 합니다. ${MARK}` }),
      long('title_pre', '제목 위 작은 줄'),
      text('gift_condition', '받는 조건', { hint: '비우면 기본 정보의 "선물 받는 조건"이 들어갑니다.' }),
      long('gift_how', '받는 방법', { hint: '카드 아래 작은 안내. 예: 라이브 후반 채팅방 링크로 전달' }),
    ],
  },
  {
    key: 'empathy',
    block: 3,
    name: '공감·경계 해소',
    role: '시장의 현실을 인정하거나, 하지 않는 일을 먼저 밝히거나, 고통을 대신 말해 경계를 푼다',
    required: true,
    note: '세 가지 방법 중 하나만 채워도 됩니다. (가) 현실 인정 → 질문 → 원인, (나) 하지 않는 일 먼저 밝히기, (다) 고민 목록. 자료가 있으면 여러 개를 함께 써도 됩니다.',
    fields: [
      long('lead', '(가) 현실 인정', { hint: `시장·상황에 공감하는 두세 줄. ${SOURCE}` }),
      long('question', '(가) 질문', { hint: '방문자에게 묻는 한 문장. 상황 그림이 있으면 그림 위에 놓입니다.' }),
      long('cause_line', '(가) 원인 한마디', { hint: `문제의 원인을 한 단어·한 문장으로. 상자 안에 크게 보입니다. ${MARK}` }),
      text('notice_action', '(나) 하지 않는 일', { hint: '적은 말이 "본 강의를 통해서는, 어떤 경우에도 ○○을 진행하지 않습니다"의 ○○ 자리에 들어갑니다. 예: 상품 판매' }),
      long('notice_text', '(나) 고지 문장 직접 쓰기', { hint: '위의 정해진 문장 대신 쓸 때만 적습니다.' }),
      items('pain_points', '(다) 고민 목록', '고민', [
        long('text', '고민', { required: true, hint: '방문자가 속으로 하는 말 한 줄.' }),
        text('who', '누구의 고민인지', { hint: '고민 위에 작게 붙는 말. 예: 직장인. 없으면 비웁니다.' }),
      ], { min: 3, max: 5, hint: '3~5개. 6개 이상이면 검사에 걸립니다.' }),
      long('opening', '여는 말(작은 줄)', { hint: '섹션 맨 위 작은 줄.' }),
      long('opening_big', '여는 말(큰 줄)', { hint: `작은 줄 아래 크게 보이는 줄. ${MARK}` }),
      long('lead2', '현실 인정 둘째 문단', { hint: '(가) 현실 인정 뒤에 점선을 두고 이어지는 문단.' }),
      strings('bubbles', '말풍선', '말풍선', { hint: '주변에서 흔히 듣는 짧은 말들.' }),
      long('bubbles_after', '말풍선 뒤 한 줄', { hint: '말풍선을 받아 정리하는 한 줄.' }),
      image('mood_image', '상황 그림', { hint: '질문 뒤에 깔리는 사진 1장.' }),
      long('bridge', '이어 주는 한 줄', { hint: '고민 목록 뒤 화살표 아래에 놓여 원인으로 넘기는 줄.' }),
      long('cause_detail', '원인 풀이', { hint: '원인 한마디 아래 작은 설명. 원인 한마디가 있을 때만 보입니다.' }),
      group('contrast', '둘을 나란히 비교', [
        long('lead', '비교 위 한 줄'),
        group('a', '왼쪽', [
          long('pre', '윗줄'),
          long('big', '큰 글자', { hint: NUMBER }),
          long('post', '아랫줄'),
          image('image', '그림'),
        ]),
        group('b', '오른쪽', [
          long('pre', '윗줄'),
          long('big', '큰 글자', { hint: NUMBER }),
          long('post', '아랫줄'),
          image('image', '그림'),
        ]),
      ], { hint: `섹션 끝에 두 경우를 좌우로 놓고 싶을 때만 채웁니다. ${SOURCE}` }),
    ],
  },
  {
    key: 'instructor',
    block: 4,
    name: '강사 등장 + 비포',
    role: '강사가 인사하고, 불리했던 출발점을 밝혀 공감대를 만든다',
    required: true,
    note: '강사 이름과 소개 한 줄은 기본 정보에서 옵니다.',
    fields: [
      long('story', '불리했던 출발점', { required: true, hint: `시작할 때의 상황 2~4줄. ${SOURCE} ${NUMBER}` }),
      long('greeting', '인사', { hint: '이름 위에 놓는 한 줄. 예: 안녕하세요,' }),
      long('question', '궁금증 질문', { hint: '다음 섹션(증빙)으로 넘기는 한 문장. 섹션 맨 끝에 놓입니다.' }),
      image('instructor_photo', '강사 사진', { hint: '1장. 다른 섹션에 쓴 사진과 겹치지 않게 합니다.' }),
      strings('career_list', '이력', '이력', { hint: `4~7줄. ${SOURCE}` }),
      long('authority_title', '이력 뒤 제목', { hint: '이력 아래 크게 놓는 한 줄. 없으면 비웁니다.' }),
      long('authority_line', '이력 뒤 설명', { hint: '위 제목 아래 설명. 제목이 있을 때만 보입니다.' }),
      image('credential_capture', '자격 증빙 캡처', { hint: `자격이 핵심일 때 1장. ${HIDE}` }),
    ],
  },
  {
    key: 'proof',
    block: 5,
    name: '서류 증빙(애프터)',
    role: '지금의 결과를 서류·화면 캡처로 증명한다',
    required: true,
    note: '"애프터 한 줄"과 "이전 → 이후 묶음" 중 하나를 채우고, 증빙 캡처는 꼭 넣습니다. 증빙이 없는 숫자는 크게 내세우지 않습니다.',
    fields: [
      long('after_line', '애프터 한 줄', { hint: `지금의 결과 한 문장. ${NUMBER} ${MARK}` }),
      group('proof_summary', '이전 → 이후 묶음', [
        long('pre', '윗줄', { hint: '숫자 위 설명 한 줄.' }),
        long('from', '이전 숫자', { hint: `화살표 앞. 없으면 비웁니다. ${NUMBER}` }),
        long('to', '이후 숫자', { required: true, hint: `화살표 뒤. ${NUMBER}` }),
      ], { hint: '애프터 한 줄 대신(또는 함께) 숫자를 화살표로 이어 보여 줍니다.' }),
      items('proof_captures', '증빙 캡처', '증빙', [
        image('image', '캡처 그림', { required: true, hint: `서류·화면 캡처. ${HIDE}` }),
        text('alt', '그림 설명', { hint: '무슨 서류인지 한 줄. 비우면 "증빙 서류 캡처"입니다.' }),
        text('amount', '강조 숫자', { hint: '캡처에 적힌 숫자를 아래에 크게 다시 적습니다. 캡처에 실제로 보이는 값만.' }),
        text('period', '기간', { hint: '강조 숫자 옆 작은 글자. 강조 숫자가 있을 때만 보입니다. 예: ○○년 ○월' }),
        long('caption', '캡처 설명', { hint: '그림 아래 작은 설명.' }),
      ], { required: true, min: 1, max: 4, hint: '1~4장.' }),
      group('total', '누적 숫자', [
        text('label', '이름', { hint: '숫자 위 작은 글자. 예: 누적 매출' }),
        text('value', '값', { hint: NUMBER }),
      ], { hint: `캡처 아래 크게 보이는 숫자 하나. ${PROOF}` }),
      items('proof_amounts', '성장 단계', '단계', [
        text('label', '이름', { required: true, hint: '예: ○○년' }),
        text('value', '값', { required: true, hint: NUMBER }),
      ], { hint: `연도별·단계별 숫자 2~4개. 4개 이하면 계단 모양으로 보입니다. ${PROOF}` }),
      long('proof_basis_note', '계산 기준 주석', { hint: '합친 숫자를 쓸 때 어떤 값을 합쳤는지.' }),
      long('proof_note', '덧붙이는 한마디', { hint: '섹션 끝에 놓는 강조 문장.' }),
      text('proof_note_label', '한마디 위 작은 줄', { hint: '덧붙이는 한마디가 있을 때만 보입니다.' }),
    ],
  },
  {
    key: 'concept',
    block: 6,
    name: '핵심 개념 한 단어',
    role: '질문을 던지고 한 단어로 답한 뒤, 그 단어를 다시 정의한다',
    required: true,
    note: '질문 → 한 단어 답 → 재정의 순서로 보입니다. "상황 가정 묶음"을 채우면 그 앞에 "만약 ~라면?" 이야기가 붙습니다.',
    fields: [
      long('lead', '질문', { hint: '답을 궁금하게 만드는 한 문장.' }),
      text('method_name', '한 단어 답', { required: true, hint: '한 단어 또는 짧은 이름. 강사와 정한 말을 씁니다.' }),
      long('method_definition', '재정의 문장', { required: true, hint: `1~3줄. "이것은 ~이 아니라 ~입니다" 꼴. ${MARK}` }),
      long('method_intro', '답을 넣은 문장', { hint: `한 단어만 크게 보이는 대신 문장으로 보여 줄 때 적습니다. ${MARK}` }),
      long('method_not', '재정의 앞 한 줄', { hint: '재정의 문장 바로 위에 놓는 작은 줄. 예: 흔히 아는 것과 다릅니다' }),
      images('demo_captures', '시연 화면', { max: 4, hint: '한 단어 답 아래에 놓는 화면 1~4장.' }),
      long('market_stat', '시장 통계', { hint: '수치와 출처를 함께 적습니다. 출처가 없으면 쓰지 않습니다.' }),
      group('premise', '상황 가정 묶음', [
        long('pre', '윗줄'),
        long('title', '가정 질문', { required: true, hint: '예: 만약 ~라면?' }),
        image('image', '그림'),
        long('to', '이어지는 한 줄', { hint: '그림 아래 강조색 줄.' }),
        strings('items', '쌓이는 항목', '항목', { hint: '차례로 쌓여 보이는 짧은 줄들.' }),
        long('post', '정리 한 줄'),
        long('conclusion', '결론 큰 줄'),
      ], { hint: `질문 앞에 이야기를 붙이고 싶을 때만 채웁니다. ${SOURCE}` }),
    ],
  },
  {
    key: 'objection',
    block: 7,
    name: '오해 깨기',
    role: '방문자가 믿고 있는 오해를 꺼내 "아닙니다"로 끊는다',
    required: true,
    note: '오해가 모두 짧으면 "오해? 아닙니다."가 반복되고, 긴 오해가 있으면 인용 상자 + 큰 답으로 보입니다.',
    fields: [
      strings('doubts', '오해', '오해', { required: true, min: 1, max: 5, long: true, hint: '강사가 가장 많이 듣는 오해 1~5개.' }),
      strings('answers', '오해별 답', '답', { long: true, hint: '오해와 같은 순서로 적습니다. 비운 자리는 "아닙니다."가 됩니다.' }),
      long('rebuttal', '반박 근거', { hint: `오해를 끊은 뒤 화살표 아래에 놓는 한 문장. ${SOURCE}` }),
      images('evidence_images', '근거 자료', { hint: `과거 사진·서류·기사 캡처 등. ${HIDE}` }),
      long('title', '제목'),
      long('title_pre', '제목 위 작은 줄'),
    ],
  },
  {
    key: 'comparison',
    block: 8,
    name: '비교·가능한 결과',
    role: '기존 방식과 이 방법을 나란히 놓거나, 필요 없는 것을 체크로 보여 준다',
    required: false,
    note: '"좌우 비교 카드"와 "없어도 되는 것 목록" 중 하나만 채워도 됩니다. 둘 다 비우면 섹션이 빠집니다.',
    fields: [
      group('comparison', '좌우 비교 카드', [
        group('old', '기존 방식', [
          long('title', '제목', { required: true }),
          long('text', '설명', { required: true }),
          strings('steps', '거치는 단계', '단계', { hint: '기존 방식이 얼마나 번거로운지 차례로 적을 때만.' }),
        ]),
        group('new', '이 방법', [
          long('title', '제목', { required: true }),
          long('text', '설명', { required: true, hint: SOURCE }),
        ]),
      ], { hint: '기존 방식을 채워야 카드가 보입니다.' }),
      strings('none_checks', '없어도 되는 것 목록', '항목', { min: 3, max: 5, hint: `3~5개. 예: 초기 비용 없음. ${SOURCE}` }),
      long('title', '제목'),
      long('title_pre', '제목 위 작은 줄'),
      long('result_line', '결과 한 줄', { hint: '섹션 끝에 놓는 한 줄.' }),
    ],
  },
  {
    key: 'student_results',
    block: 9,
    name: '수강생 성과',
    role: '강사만 된 게 아니라는 것을 사례로 보여 준다',
    required: false,
    note: '후기가 없는 강의는 비워 두면 섹션이 빠집니다.',
    fields: studentResultFields,
  },
  {
    key: 'takeaways',
    block: 10,
    name: '알려 드리는 것',
    role: '무료 강의에서 다룰 내용을 최대 3가지로 보여 준다',
    required: false,
    note: '최대 3개입니다. 4개 이상이면 검사에 걸립니다.',
    fields: [
      items('takeaway_items', '알려 드리는 것', '내용', [
        long('title', '제목', { required: true }),
        long('desc', '설명', { hint: '1~3줄.' }),
        text('tag', '꼬리표', { hint: '작은 딱지 글자. 없으면 비웁니다.' }),
      ], { required: true, min: 1, max: 3, hint: '교안에 실제로 있는 내용만 적습니다.' }),
      long('title', '제목', { hint: '비우면 "이 강의에서 알려 드릴 N가지"입니다. "N가지"라고 쓰면 개수와 같아야 합니다.' }),
      text('eyebrow', '제목 위 작은 줄'),
      long('closing_line', '마무리 문장', { hint: '카드 아래 한 줄.' }),
    ],
  },
  {
    key: 'closing',
    block: 11,
    name: '마지막 밀어주기',
    role: '마지막으로 한 번 더 확신을 준다',
    required: false,
    fields: [
      long('closing_message', '마무리 문장', { required: true, hint: `2~3줄. ${SOURCE} ${MARK}` }),
      long('quote', '인용 상자', { hint: '마무리 문장 위에 놓는 방문자의 속말. 없으면 비웁니다.' }),
      long('closing_big', '결론 큰 줄', { hint: '마무리 문장 뒤 점선 아래에 크게 놓는 줄.' }),
      long('closing_pre', '결론 위 작은 줄', { hint: '결론 큰 줄이 있을 때만 보입니다.' }),
      image('closing_photo', '강사 사진', { hint: '1장. 다른 섹션에 쓴 사진과 겹치지 않게 합니다.' }),
    ],
  },
  {
    key: 'schedule_cta',
    block: 12,
    name: '일정 재확인 + 신청',
    role: '날짜·요일·시각을 다시 알리고 신청하게 한다',
    required: true,
    factsOnly: true,
    note: '일시·강의명·입장 방법·다시보기 안내는 기본 정보에서 옵니다. 아래 칸은 비워도 섹션이 들어갑니다.',
    fields: [
      text('cta_label', '버튼 글자', { hint: OWN_LABEL }),
      flag('gift_recap', '선물 다시 보여 주기', { hint: '켜면 참여 선물 이름을 버튼 위에 한 번 더 적습니다.' }),
    ],
  },
]

/* ───────── 유료 ───────── */

const PAID_SECTIONS: FormSection[] = [
  {
    key: 'hook',
    name: '첫 화면',
    role: '강의명, 한 줄 약속, 강사를 한 화면에 보여 준다',
    required: true,
    note: '강의명은 기본 정보에서 옵니다.',
    fields: [
      long('promise_line', '한 줄 약속', { required: true, hint: `이 강의가 약속하는 것 한 줄. 근거 자료가 있는 내용만 적습니다. ${MARK}` }),
      long('instructor_line', '강사 한 줄 소개', { required: true, hint: `약속 바로 위에 놓입니다. 직함과 대표 숫자. ${NUMBER}` }),
      image('instructor_photo', '강사 사진', { hint: '배경을 지운 상반신 1장. 소개와 약속이 사진 위에 겹쳐 보입니다.' }),
      long('sub', '제목 아래 설명', { hint: '강의명 아래 작은 문단.' }),
      long('sub_strong', '강조 한 줄', { hint: '설명 아래 굵은 줄.' }),
      text('sub_band', '띠 글자', { hint: '강조 한 줄 아래 색 띠 안의 글자. 강조 한 줄이 있을 때만 보입니다.' }),
      long('industry_notice', '업종 고지', { hint: '보험처럼 고지가 필요한 업종만 적습니다.' }),
    ],
  },
  {
    key: 'worries_answers',
    name: '걱정과 답',
    role: '수강 전 걱정을 꺼내고 걱정마다 제공물·해결책으로 답한다',
    required: true,
    fields: [
      items('worry_items', '걱정과 답 묶음', '걱정', [
        long('q', '걱정', { required: true, hint: '수강 전에 드는 걱정을 질문으로.' }),
        long('a', '답 한마디', { required: true, hint: `걱정에 대한 짧은 답. ${MARK}` }),
        text('strip', '띠 글자', { hint: '답 아래 작은 띠. 예: 이렇게 도와드립니다' }),
        strings('items', '제공 자료', '자료', { hint: '이 걱정을 풀어 주는 자료·지원 이름 3~4개. 실제로 제공하는 것만.' }),
      ], { required: true, min: 1, hint: '3~5개.' }),
      long('method_line', '해결 방법 한 줄', { hint: '카드 아래에 놓는, 이 강의의 방법 한 문장.' }),
    ],
  },
  {
    key: 'instructor_authority',
    name: '강사 권위',
    role: '강사의 대표 숫자·이력으로 믿을 근거를 준다',
    required: true,
    note: '"강사 이야기"나 "지금을 만든 것"을 채우면 아래에 흰 편지 상자가 생기고, 주변 질문·이야기·그림이 그 안에 들어갑니다.',
    fields: [
      items('authority_numbers', '대표 숫자 줄', '줄', [
        text('label', '앞 글자', { required: true, hint: '예: ○○살,' }),
        text('value', '뒤 글자', { required: true, hint: NUMBER }),
      ], { required: true, min: 1, max: 4, hint: `1~4줄. 한 줄에 앞 글자와 뒤 글자가 이어져 보입니다. ${PROOF}` }),
      long('turn', '전환 한 줄', { hint: '숫자 줄 아래 크게 놓는 한 줄.' }),
      image('photo', '강사 사진', { hint: '서 있는 사진 1장. 다른 섹션에 쓴 사진과 겹치지 않게 합니다.' }),
      text('now_value', '지금의 숫자', { hint: `상자 안에 크게 보입니다. ${NUMBER}` }),
      text('now_label', '지금의 숫자 이름', { hint: '숫자 위 작은 글자. 지금의 숫자가 있을 때만 보입니다.' }),
      long('now_line', '지금의 숫자 아래 한 줄', { hint: '지금의 숫자가 있을 때만 보입니다.' }),
      images('proof_captures', '증빙 캡처', { max: 3, hint: `1~3장. ${HIDE}` }),
      strings('career_list', '이력', '이력', { hint: `학력·활동·실적. ${SOURCE}` }),
      long('story', '강사 이야기', { hint: `편지 상자 안의 이야기. 강사가 직접 쓴 내용만. ${BREAK}` }),
      long('story_band', '이야기 아래 띠 글자', { hint: '이야기 아래 색 띠 안의 한 줄.' }),
      long('asked_title', '주변 질문 제목', { hint: '편지 상자 맨 위 굵은 줄. 예: 주변에서 이렇게 묻습니다' }),
      strings('asked', '주변에서 들은 질문', '질문', { hint: '편지 상자 안 인용. 실제로 들은 말만.' }),
      long('because', '지금을 만든 것', { hint: '편지 상자 끝에 크게 놓는 한마디.' }),
      long('because_pre', '지금을 만든 것 윗줄', { hint: '위 한마디 바로 위 작은 줄. 한마디가 있을 때만 보입니다.' }),
      image('because_image', '편지 상자 그림', { hint: '편지 상자 맨 아래 그림 1장.' }),
    ],
  },
  {
    key: 'student_results',
    name: '수강생 성과·후기',
    role: '이전 수강생의 결과를 캡처로 보여 준다',
    required: false,
    note: '후기가 없는 강의는 비워 두면 섹션이 빠집니다.',
    fields: studentResultFields,
  },
  {
    key: 'deadline',
    name: '신청 마감 안내',
    role: '언제까지 신청할 수 있는지 알린다',
    required: true,
    factsOnly: true,
    note: '마감 일시·강의명·강사 한 줄은 기본 정보에서 옵니다. 아래 칸은 비워도 섹션이 들어갑니다.',
    fields: [
      long('pre', '윗줄', { hint: '섹션 맨 위에 놓는 한 줄.' }),
      strings('early_close_note', '조기 마감 안내', '안내', { hint: '실제 정원·조기 마감이 있을 때만 적습니다.' }),
    ],
  },
  {
    key: 'cta',
    name: '신청 버튼',
    role: '결제로 보낸다',
    required: true,
    factsOnly: true,
    note: '버튼 글자·신청 주소·결제 안내는 기본 정보에서 옵니다.',
    fields: [
      text('cta_label', '버튼 글자', { hint: OWN_LABEL }),
    ],
  },
  {
    key: 'calendar',
    name: '일정 달력',
    role: '회차별 날짜·시간, 다시보기 규칙을 보여 준다',
    required: true,
    factsOnly: true,
    note: '달력과 회차 목록은 기본 정보의 회차 일정에서 만들어집니다. 아래 칸은 비워도 섹션이 들어갑니다.',
    fields: [
      long('title', '제목', { hint: '비우면 "강의 일정"입니다.' }),
      items('extra_events', '추가 모임', '모임', [
        text('회차', '회차 번호', { required: true, hint: '기본 정보 회차 일정의 번호. 그 회차의 날짜와 제목이 함께 보입니다.' }),
        long('text', '설명', { required: true, hint: '누가 참여하는지, 어떻게 진행하는지.' }),
      ], { hint: '특강·모임처럼 따로 알릴 회차가 있을 때만.' }),
      long('offline_place', '오프라인 장소', { hint: '만나서 진행하는 회차가 있을 때 주소.' }),
      strings('notes', '일정 안내', '안내', { long: true, hint: '달력 아래 작은 안내 줄. 다시보기 규칙은 {다시보기.업로드} 로 불러 쓸 수 있습니다.' }),
    ],
  },
  {
    key: 'summary',
    name: '시작일·구성 요약',
    role: '개강일과 받는 것을 + 목록으로 요약한다',
    required: true,
    note: '시작일과 짧은 강의명은 기본 정보에서 옵니다.',
    fields: [
      strings('summary_items', '구성 요약', '구성', { required: true, min: 1, hint: '4~8줄. 라이브 횟수는 {본강의수} 로 적으면 회차 일정에서 자동으로 셉니다. 예: 라이브 {본강의수}회' }),
      long('footnote', '아래 작은 안내', { hint: '목록 아래 주석.' }),
    ],
  },
  {
    key: 'curriculum',
    name: '커리큘럼',
    role: '회차별로 무엇을 배우는지 보여 준다',
    required: true,
    note: '회차의 날짜·시각·제목은 기본 정보의 회차 일정에서 옵니다. 여기서는 회차 번호마다 세부 내용을 적습니다. 일정에 있는 회차는 모두 적어야 검사에 걸리지 않습니다.',
    fields: [
      {
        kind: 'keyed',
        key: 'session_details',
        label: '회차별 세부 내용',
        keyLabel: '회차 번호',
        itemLabel: '회차',
        required: true,
        hint: '회차 번호는 기본 정보 회차 일정의 번호와 같게 적습니다. 예: 1',
        fields: [
          items('items', '배우는 내용', '내용', [
            long('t', '내용', { required: true, hint: '한 줄.' }),
            strings('sub', '세부 항목', '세부', { hint: '이 내용 아래 들여 쓰는 작은 항목. 없으면 비웁니다.' }),
          ], { required: true, min: 1, hint: '회차마다 3~6줄. 강의계획서에 있는 내용만.' }),
          long('assignment', '과제', { hint: '"과제: …"로 보입니다.' }),
          long('outcome', '회차가 끝나면', { hint: '이 회차를 마치면 무엇이 되는지 한 문장.' }),
          image('outcome_image', '회차가 끝나면 그림', { hint: '위 문장 옆에 놓는 그림. 문장이 있을 때만 보입니다.' }),
        ],
      },
      long('title', '제목', { hint: '비우면 "커리큘럼"입니다.' }),
      long('change_note', '변동 안내', { hint: '커리큘럼이 바뀔 수 있다는 안내 한 줄.' }),
    ],
  },
  {
    key: 'syllabus_button',
    name: '강의계획서 버튼',
    role: '자세한 계획서 파일로 연결한다',
    required: false,
    fields: [
      link('syllabus_link', '강의계획서 주소', { required: true, hint: '계획서 파일이나 페이지 주소. https:// 또는 / 로 시작해야 합니다.' }),
    ],
  },
  {
    key: 'plans_benefits',
    name: '플랜별 혜택',
    role: '플랜마다 받는 것을 카드로 보여 준다',
    required: true,
    note: '플랜 이름·한 줄 설명·추천 표시는 기본 정보의 플랜에서 옵니다. 플랜별 혜택 수는 혜택 목록에서 자동으로 셉니다.',
    fields: [
      items('benefit_items', '혜택 목록', '혜택', [
        text('plan', '해당 플랜', { required: true, hint: '이 혜택을 받기 시작하는 플랜. 기본 정보의 플랜 이름과 똑같이 적습니다.' }),
        long('title', '혜택 이름', { required: true }),
        long('desc', '혜택 설명', { required: true, hint: '2~3줄. 수량·기간을 함께. 줄 앞에 "- "를 붙여 목록으로 쓰면 카드가 넓어집니다.' }),
        long('side', '곁 안내', { hint: '카드 위쪽의 작은 별표 안내. 없으면 비웁니다.' }),
      ], { required: true, min: 1, hint: '실제로 제공하는 혜택만, 낮은 플랜 혜택부터 적습니다.' }),
      long('title', '제목', { hint: '비우면 "플랜별 혜택"입니다. "플랜 N종"이라고 쓰면 플랜 수와 같아야 합니다.' }),
      long('title_pre', '제목 위 작은 줄'),
      long('band', '띠 글자', { hint: '제목 아래 색 띠 안의 한 줄.' }),
      group('top_plan_perks', '최상위 플랜 특전', [
        long('pre', '윗줄'),
        long('title', '특전 제목', { required: true }),
        long('who', '대상', { hint: '누가 받는지. 인원은 강사·운영 자료에 있는 값만 적습니다.' }),
        image('image', '그림'),
        items('items', '특전', '특전', [
          long('title', '이름', { required: true }),
          long('desc', '설명', { required: true }),
        ], { hint: '2~3개.' }),
      ], { hint: '가장 높은 플랜만 받는 특전이 있을 때만 채웁니다.' }),
      items('plan_prices', '플랜별 가격', '가격', [
        text('plan', '플랜 이름', { required: true }),
        text('price', '가격', { required: true, hint: '실제 판매가 그대로.' }),
      ], { hint: '페이지에 가격을 적을 때만 채웁니다.' }),
    ],
  },
  {
    key: 'guarantee',
    name: '보증·환불',
    role: '최상위 플랜의 성과 보증·페이백 조건을 알린다',
    required: false,
    note: '실제로 운영하는 보증·환불 조건이 있을 때만 채웁니다.',
    fields: [
      text('guarantee_plan', '적용 플랜', { required: true, hint: '"○○ 전용"으로 보입니다. 플랜 이름을 적습니다.' }),
      strings('guarantee_terms', '조건', '조건', { required: true, min: 1, long: true, hint: '기간, 달성 기준, 돌려주는 금액·비율. 약관과 같은 내용만.' }),
      long('title', '제목', { hint: '보증 내용을 한 줄로.' }),
      long('refund_policy_ref', '환불 정책 안내', { hint: '자세한 환불 정책을 어디서 볼 수 있는지.' }),
    ],
  },
  {
    key: 'plan_guide',
    name: '플랜 추천',
    role: '어떤 사람에게 어떤 플랜이 맞는지 골라 준다',
    required: false,
    fields: [
      items('plan_personas', '성향별 추천', '추천', [
        long('say', '수강생의 말', { required: true, hint: '수강생 말투로 한 문장. 예: 혼자서도 해 보고 싶어요' }),
        text('plan', '맞는 플랜', { required: true, hint: '화살표 뒤에 보일 플랜 이름.' }),
      ], { required: true, min: 1 }),
      long('title', '제목', { hint: '비우면 "당신에게 딱 맞는 플랜은?"입니다.' }),
    ],
  },
  {
    key: 'audience',
    name: '이런 분께',
    role: '누구에게 맞는 강의인지 알린다',
    required: false,
    note: '3개 이하면 큰 알약 모양, 4개 이상이면 체크 목록으로 보입니다.',
    fields: [
      strings('audience_types', '대상 유형', '유형', { required: true, min: 1, long: true, hint: '4~6개.' }),
      long('title', '제목'),
      long('closing_word', '맺음 한 줄', { hint: '목록 아래 화살표 뒤에 크게 놓는 한 줄.' }),
    ],
  },
  {
    key: 'faq',
    name: '자주 묻는 질문',
    role: '신청 전 걱정에 답한다',
    required: false,
    fields: [
      items('faq_items', '질문과 답', '질문', [
        long('q', '질문', { required: true }),
        long('a', '답', { required: true, hint: '추가 비용은 있는 그대로 적습니다. 기간·금액은 다른 섹션과 같은 값으로.' }),
      ], { required: true, min: 1, hint: '3~5쌍. 첫 질문만 펼쳐져 보입니다.' }),
      long('title', '제목', { hint: '비우면 "자주 묻는 질문"입니다.' }),
    ],
  },
  {
    key: 'future_price',
    name: '미래 비교',
    role: '신청한 미래와 안 한 미래를 나란히 비교한다',
    required: false,
    note: '두 목록을 줄 수가 맞게 짝지어 적습니다.',
    fields: [
      long('title', '제목'),
      strings('future_without', '신청 안 한 경우', '줄', { hint: '5~6줄.' }),
      strings('future_with', '신청한 경우', '줄', { hint: `5~6줄, 위와 짝이 맞게. ${SOURCE}` }),
    ],
  },
  {
    key: 'instructor_closing',
    name: '강사 이야기·마무리',
    role: '강사가 1인칭으로 왜 가르치는지, 무엇을 약속하는지 말한다',
    required: true,
    fields: [
      long('instructor_message', '강사의 글', { required: true, hint: `약속 상자 안에 들어갑니다. 강사가 직접 쓴 내용만. 짧게는 2~3줄. ${BREAK}` }),
      long('promise', '약속 문장', { hint: '강사의 글 아래 강조색 한 문장.' }),
      long('lead', '여는 말', { hint: '섹션 맨 위 작은 문단.' }),
      long('declare', '선언 큰 줄', { hint: '여는 말 아래 크게 놓는 한 줄.' }),
      long('promise_title', '약속 위 손글씨 줄', { hint: '사진 위에 놓는 짧은 줄. 예: 약속드립니다' }),
      image('instructor_photo', '강사 사진', { hint: '1장. 약속 상자가 사진 아래쪽에 겹칩니다.' }),
      strings('outcomes3', '수강 후 달라지는 것', '변화', { max: 3, hint: `3가지. ${SOURCE}` }),
    ],
  },
  {
    key: 'final_cta',
    name: '끝 신청 버튼',
    role: '다 읽은 사람을 결제로 보낸다',
    required: false,
    toggle: true,
    note: '켜 두면 강의명·마감 일시·버튼이 한 번 더 나옵니다. 기본 정보에 신청 주소가 있어야 들어갑니다.',
    fields: [
      text('cta_label', '버튼 글자', { hint: OWN_LABEL }),
    ],
  },
  {
    key: 'copyright',
    name: '저작권 안내',
    role: '무단 공유·재판매 금지를 알린다',
    required: false,
    toggle: true,
    note: '정해진 문구라 적을 칸이 없습니다. 켜 두면 페이지 맨 끝에 들어갑니다.',
    fields: [],
  },
]

export const LANDING_FORM: LandingFormSpec = {
  theme: THEME,
  free: { facts: FREE_FACTS, sections: FREE_SECTIONS },
  paid: { facts: PAID_FACTS, sections: PAID_SECTIONS },
}
