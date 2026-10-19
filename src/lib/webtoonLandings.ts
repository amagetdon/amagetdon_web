// 웹툰식 랜딩(/w/:slug) 설정 — 표지 → 세로 웹툰 → 캐릭터 대화형 신청 화면.
// 랜딩 하나 = 강의 하나. 그림·대사는 여기서 바꾼다(1차: 코드 설정, 바꾸면 배포 필요).
// 그림 속에는 글자가 없고, 말풍선·내레이션은 그림 위에 HTML 로 얹는다(AI 그림 속 한글 깨짐 방지).
// 빈칸: {name} = 회원 이름, {live} = 강의 라이브 일시(courses.scheduled_at, 없으면 liveFallback)

export type BubbleType = 'narration' | 'speech' | 'dark_box' | 'sfx' | 'caption'

export interface Bubble {
  type: BubbleType
  text: string
  speaker?: string
  /** 그림 높이 기준 위치(%) — anchor 가 top 이면 말풍선 위 끝, bottom 이면 아래 끝(없으면 60% 넘을 때 bottom) */
  top: number
  align: 'left' | 'center' | 'right'
  anchor?: 'top' | 'bottom'
  /** 폭(그림 폭 기준 %). 없으면 종류별 기본 */
  w?: number
  /** 최대 폭(그림 폭 기준 %) — 옆 얼굴을 피하려고 줄을 더 일찍 바꿀 때 */
  maxW?: number
  /** 대사 꼬리 방향(기본: 위쪽 말풍선은 아래로, 아래쪽 말풍선은 위로) · 꼬리 가로 위치(말풍선 폭 기준 %) */
  tail?: 'up' | 'down' | 'none'
  tailX?: number
}

export interface WebtoonCut {
  id: string
  /** 그림 주소. 없으면 card(글자 장면)로 그린다 */
  src?: string
  /** 그림 세로/가로 비율(자리 미리 잡기용) */
  ratio: number
  bubbles: Bubble[]
  /** 글자 장면 — 그림 없이 검은 바탕에 글자만(제목 1줄 + 본문 여러 줄, 강조 줄은 초록) */
  card?: {
    title?: string
    lines: string[]
    highlight?: number[]
    note?: string
    /** 함께 보여 줄 작은 그림(앞 컷 재사용) */
    images?: string[]
    /** typing: 빈 화면에 초안이 한 줄씩 채워지는 연출 */
    animation?: 'typing'
    /** 줄 안에서 초록으로 강조할 낱말 */
    emphasis?: string[]
  }
  /** 실제 후기 카드(src = 가림 처리한 캡처) — 휴대폰 화면 틀 안에 넣어 보여 준다 */
  review?: { header?: string; note: string }
  /** 실제 자료(증빙·근거 화면·프로그램 화면) — 검은 띠 안에 앞 문구 + 그림(여러 장이면 세로로) + 출처 작은 글.
   *  pending: 공개 전 확인이 끝나지 않아 그림 대신 자리 표시 */
  real?: { before?: { type: 'narration' | 'speech'; text: string; speaker?: string }; images: string[]; note?: string; pending?: string }
  /** 후기 여러 장 넘기기(휴대폰 틀, 자동 넘김) */
  carousel?: { before?: { type: 'narration' | 'speech'; text: string; speaker?: string }; images: string[]; note: string; intervalMs?: number }
  /** 컷 이음새(청월당 측정값, 그림 폭 %) — 위·아래 가장자리를 color 로 흐리는 길이, 아래에 붙는 띠 */
  fadeTop?: { size: number; color: string }
  fadeBottom?: { size: number; color: string }
  band?: { size: number; color: string }
}

/** 웹툰 뒤 페이월(v7.1 P1~P9) — 잠긴 안쪽 → 후기 → 마지막 제안 → 오퍼 카드 → 신청 확인 → 신청하면 안쪽이 열림.
 *  결제 자리 = 무료 강의 신청(카카오 1초). 가짜 정가·할인율·반복 타이머는 쓰지 않는다 */
export interface Paywall {
  /** P1 민로로 생각 말풍선 카드 */
  thought: string[]
  /** P2 잠긴 목차 — 제목은 보이고 설명만 흐림(신청하면 열림) */
  lockedKicker: string
  lockedTitle: string
  items: { no: string; title: string; desc: string }[]
  extrasLabel: string
  extras: { label: string; title: string }[]
  /** P3 들어야 하는 이유 */
  reasonsTitle: string
  reasons: { main: string; sub: string }[]
  reasonsTail: string
  /** P4 실제 후기 */
  reviewsTitle: string
  reviews: { src: string; note: string }[]
  /** P5 마지막 제안(컷 + 말풍선) */
  lastImage: string
  lastLine: string
  /** P6 오퍼 카드 */
  offer: { kicker: string; title: string; items: string[]; bonusLast?: boolean; price: string; button: string; note: string }
  /** P7 떠 있는 바 버튼 */
  floatButton: string
  /** 이미 신청한 사람 — 오퍼 카드 자리 */
  alreadyLine: string
  /** P8 신청 확인 화면 */
  confirm: { kicker: string; title: string; price: string; assurances: string[]; button: string; back: string; legal: string }
  /** P9 신청 완료 */
  doneTitle: string
  doneLine: string
}

export interface AskStep {
  key: 'blog_exp' | 'daily_time' | 'concern'
  line: string
  options?: string[]
  why?: string
  placeholder?: string
  button: string
}

export interface WebtoonLanding {
  slug: string
  courseId: number
  liveFallback: string
  /** 색 테마 — 바탕·글자·덮개·기본 띠 색(WebtoonLandingPage THEMES). 없으면 light */
  theme?: 'dark' | 'light'
  /** 탭 제목·공유 미리보기(OG). 서버(api/_lib/render-page)와 화면이 같이 쓴다. image 는 1200×630 */
  seo: { title: string; description: string; image: string }
  cover: {
    poster: string
    video?: string
    /** 있으면 맨 위 로고 + 글자를 화면 아래쪽에 모은다(얼굴이 위에 있는 표지, v7.2) */
    logo?: string
    /** 로고형에서 제목을 위쪽에(그림 위가 비어 있는 표지, vF) */
    titleTop?: boolean
    kicker: string
    title: string
    quote: string
    cta: string
    ctaSub: string
    note: string
    detailsSummary: string
    details: string[]
  }
  webtoon: {
    cuts: WebtoonCut[]
    skipBubble: string
    endCta: string
    endNote: string
  }
  /** 대화 화면(W3~W6) 배경, 완료(W7) 배경 */
  chatBg: string
  doneBg: string
  speaker: string
  signup: { line: string; buttonGuest: string; buttonMember: string; buttonSub: string; legal: string }
  saved: { line: string; full: string; fullButton: string }
  /** 신청 뒤 선택 질문 화면. 비우면(v7.1) 신청 저장 → 바로 완료 */
  asks: AskStep[]
  skipNote: string
  done: { line: string; already: string; notice: string; gift?: string; legal: string }
  /** 있으면 웹툰 아래에 페이월을 붙이고, 신청은 '신청 확인' 화면(P8)에서 한다(v7.1) */
  paywall?: Paywall
}

import { CUTS as MINRORO_CUTS } from './webtoon-cuts/minroro-blog'

const BASE = '/webtoon/minroro-blog'

// 스토리보드 v7.1 · 대사목록 vF(밝은 톤)(흑월도령 오마주 · 페이월 구조 · 운 보기 문답 삭제, 2026-10-19 PM) — 그림 번호 = PM 데모_v72 파일 앞 두 자리
export const WEBTOON_LANDINGS: Record<string, WebtoonLanding> = {
  'minroro-blog': {
    slug: 'minroro-blog',
    courseId: 129,
    liveFallback: '○월 ○일(○) 저녁 7시 30분',
    seo: {
      title: '민로로의 AI 블로그 수익화 | 무료 라이브',
      description: '고액 강의 다 들어봐도, 돈 못 벌었지? 그 이유부터 바로 풀어준다. 민로로의 AI 블로그 수익화 유튜브 무료 라이브.',
      image: `${BASE}/og.jpg`,
    },
    cover: {
      poster: `${BASE}/00.webp`,
      video: `${BASE}/cover.mp4`,
      logo: '아마겟돈',
      titleTop: true,
      kicker: '민로로의',
      title: 'AI 블로그 수익화',
      quote: '돈 못 버는 고액 강의 거르는 법까지.',
      cta: 'AI 블로그로 월 300 바로가기',
      ctaSub: '',
      note: '유튜브 무료 라이브 · {live} · 무료 · 1분',
      detailsSummary: '무료 라이브 더 알아보기',
      details: [
        '무엇을 하나요? 블로그로 누가, 왜 돈을 주는지와 AI로 빠르게 실행하는 방법을 실제 도구 화면으로 보여 드려요.',
        '참여하면 네 가지 자료를 드려요: AI 블로그 수익화 정답지 · 온라인 수익화 로드맵 · 돈 되는 비밀링크 175개 · AI 분석 미니 봇.',
        '무료 라이브는 다시보기가 없어요. 시간 맞춰 들어와 주세요.',
        '라이브 안에서 유료 과정 안내가 있을 수 있어요. 본 강의는 수익을 보장하지 않으며, 결과는 개인의 실행에 따라 다릅니다.',
      ],
    },
    webtoon: {
      skipBubble: '웹툰은 다음에, 안쪽부터 볼래요',
      endCta: '안쪽 열어 보기',
      endNote: '유튜브 무료 라이브 · 다시보기 없음',
      // 컷·말풍선은 PM 대사목록에서 자동 생성(scripts/webtoon-dialogue.mjs → src/lib/webtoon-cuts/minroro-blog.ts)
      cuts: MINRORO_CUTS,
    },
    chatBg: `${BASE}/40.webp`,
    doneBg: `${BASE}/40.webp`,
    speaker: '민로로',
    signup: {
      line: '어서 오세요, 민로로예요.\n무료 라이브 자리는 카카오로 1초면 잡아 드려요.',
      buttonGuest: '카카오로 1초 만에 무료 신청',
      buttonMember: '{name} 님 자리로 무료 신청',
      buttonSub: '',
      legal: '가입하면 이용약관·개인정보 처리방침에 동의하게 돼요. (만 14세 이상)',
    },
    saved: { line: '자리 잡아 뒀다, {name}.', full: '이번 라이브는 자리가 다 찼어.', fullButton: '홈으로' },
    // v7.1: 운 보기 문답·선택 질문 삭제(대표님) — 신청 저장 → 바로 완료
    asks: [],
    skipNote: '',
    done: {
      line: '전부, {live} 라이브에서 내가 직접 풀어 주지.',
      already: '이미 자리를 잡아 뒀어. {live}에 보자.',
      notice: '무료 라이브는 다시보기가 없어요. 시간 맞춰 들어와 주세요.',
      legal: '본 강의는 수익을 보장하지 않으며, 결과는 개인의 실행에 따라 다릅니다. 무료 라이브에서 유료 과정 안내가 있을 수 있습니다.',
    },
    paywall: {
      thought: ["혹시, 이런 생각이었냐. '무료 강의 다 거기서 거기 아닌가.'", '그럼 안쪽을 조금만 보여 주지.'],
      lockedKicker: '민로로 무료 라이브의 안쪽',
      lockedTitle: '이 라이브에서 받게 될 것',
      items: [
        { no: '01', title: '1단계 애드포스트', desc: '조회수가 수익이 되는 글과 승인 준비' },
        { no: '02', title: '2단계 체험단', desc: '돈 받는 체험단·원고료까지 가는 순서' },
        { no: '03', title: '3단계 제휴 마케팅', desc: '상품·상담 소개 수수료가 붙는 글 구조' },
        { no: '04', title: '4단계 대행', desc: '사장님 블로그 운영을 맡는 방법' },
        { no: '05', title: '자동화 시스템 실제 시연', desc: '주제 → 분석 → 원고 → 발행' },
        { no: '06', title: '지금 바로 해야 할 일', desc: '내 첫 번째 고르기' },
      ],
      extrasLabel: '+ 라이브에서 더 풀어 주는 것',
      extras: [
        { label: 'LEVEL 1', title: '글 10개짜리 블로그로 당장 돈 버는 방법' },
        { label: 'LEVEL 2', title: '클릭을 곧 수입으로 바꾸는 비밀 공식' },
        { label: 'LEVEL 3', title: 'AI 딸깍으로 업로드할 때마다 돈 받는 방법' },
        { label: 'LEVEL 4', title: '내 블로그에 매일 돈 붙는 자석 붙이기' },
        { label: 'LEVEL MAX', title: '세상 모든 블로그를 나의 수입원으로 만들기' },
      ],
      reasonsTitle: '이 무료 강의를 들어야 하는 이유',
      reasons: [
        { main: '이렇게도 돈을 버는구나', sub: '가능성을 알고' },
        { main: '나는 여기부터 하면 되겠네', sub: '내 출발점을 정하고' },
        { main: '이건 직접 해 봐야겠다', sub: '작게라도 시작하도록' },
      ],
      reasonsTail: '무료 강의라도, 여러분의 시간은 쓰니까.',
      reviewsTitle: '먼저 들은 사람들',
      reviews: [
        { src: `${BASE}/reviews/h1.webp`, note: '129 상세 수록 후기 원문 · 닉네임·프로필 가림 · 개인의 경험이며 결과는 사람마다 다릅니다' },
        { src: `${BASE}/reviews/h2.webp`, note: '129 상세 수록 후기 원문 · 닉네임·프로필 가림 · 개인의 경험이며 결과는 사람마다 다릅니다' },
        { src: `${BASE}/reviews/h3.webp`, note: '129 상세 수록 후기 원문 · 닉네임·프로필·멘션 가림 · 개인의 경험이며 결과는 사람마다 다릅니다' },
      ],
      lastImage: `${BASE}/40.webp`,
      lastLine: '안쪽은 라이브에서 내가 직접 풀어 주지. 다시보기는 없어.',
      offer: {
        kicker: 'MINRORO FREE LIVE',
        title: '민로로의 무료 LIVE 비책',
        items: ['AI 블로그 수익화 정답지', '온라인 수익화 로드맵', '돈 되는 비밀링크 175개', 'AI 분석 미니 봇'],
        bonusLast: true,
        price: '무료',
        button: '무료 강의 신청하고 안쪽 열기',
        note: '카카오로 1초 · 유튜브 무료 라이브 {live}',
      },
      floatButton: '안쪽 열어 보기',
      alreadyLine: '이미 자리를 잡아 뒀어. {live}에 보자.',
      confirm: {
        kicker: '마지막 문 · 민로로 무료 라이브',
        title: '네 블로그, 끝까지 들어 볼 테냐.',
        price: '0원 · 무료',
        assurances: [
          '유튜브 무료 라이브 · {live} · 다시보기 없음',
          '카카오로 1초면 신청 끝',
          '참여하면 자료 4가지',
          '라이브에서 유료 과정 안내가 있을 수 있어요 · 수익을 보장하지 않아요',
        ],
        button: '카카오로 1초 만에 무료 신청',
        back: '이전으로',
        legal: '가입하면 이용약관·개인정보 처리방침에 동의하게 돼요. (만 14세 이상)',
      },
      doneTitle: '{name}, 안쪽이 열렸다.',
      doneLine: '전부, {live} 라이브에서 내가 직접 풀어 주지.',
    },
  },
}

export const CONCERN_MAX = 200
