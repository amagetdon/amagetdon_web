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
  }
  /** 실제 후기 카드(src = 가림 처리한 캡처) — 휴대폰 화면 틀 안에 넣어 보여 준다 */
  review?: { header?: string; note: string }
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
  /** 탭 제목·공유 미리보기(OG). 서버(api/_lib/render-page)와 화면이 같이 쓴다. image 는 1200×630 */
  seo: { title: string; description: string; image: string }
  cover: {
    poster: string
    video?: string
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
  asks: AskStep[]
  skipNote: string
  done: { line: string; already: string; notice: string; gift?: string; legal: string }
}

import { CUTS as MINRORO_CUTS } from './webtoon-cuts/minroro-blog'

const BASE = '/webtoon/minroro-blog'

// 스토리보드 v6(교안 + 129 상세 실제 후기, 2026-10-19 PM) — 그림 번호 = PM 데모_v6 파일 앞 두 자리
export const WEBTOON_LANDINGS: Record<string, WebtoonLanding> = {
  'minroro-blog': {
    slug: 'minroro-blog',
    courseId: 129,
    liveFallback: '○월 ○일(○) 저녁 7시 30분',
    seo: {
      title: 'AI 블로그 수익화 정답지 | 민로로 무료 라이브',
      description: '누가, 왜 돈을 주는지부터. 블로그로 돈을 주는 사람(사장님·업체·판매자·네이버)과 AI로 빠르게 실행하는 방법을 유튜브 무료 라이브에서 보여 드려요.',
      image: `${BASE}/og.jpg`,
    },
    cover: {
      poster: `${BASE}/00.webp`,
      video: `${BASE}/cover.mp4`,
      kicker: '민로로',
      title: 'AI 블로그 수익화 정답지',
      quote: '누가, 왜 돈을 주는지부터.',
      cta: 'AI 블로그 수익화 정답지 받아보기',
      ctaSub: '무료 · 1분',
      note: '유튜브 무료 라이브 · {live}',
      detailsSummary: '무료 라이브 더 알아보기',
      details: [
        '무엇을 하나요? 블로그로 누가, 왜 돈을 주는지(사장님·업체·판매자·네이버)와 AI로 빠르게 실행하는 방법을 실제 도구 화면으로 보여 드려요.',
        '참여하면 네 가지 자료를 드려요: AI 블로그 수익화 정답지 · 온라인 수익화 로드맵 · 돈 되는 비밀링크 175개 · AI 분석 미니 봇.',
        '무료 라이브는 다시보기가 없어요. 시간 맞춰 들어와 주세요.',
        '라이브 안에서 유료 과정 안내가 있을 수 있어요. 본 강의는 수익을 보장하지 않으며, 결과는 개인의 실행에 따라 다릅니다.',
      ],
    },
    webtoon: {
      skipBubble: '웹툰은 다음에, 바로 신청할게요!',
      endCta: '내 블로그 방향 확인하기',
      endNote: '유튜브 무료 라이브 · 다시보기 없음',
      // 컷·말풍선은 PM 대사목록_v6.json 에서 자동 생성(scripts/webtoon-dialogue.mjs → src/lib/webtoon-cuts/minroro-blog.ts)
      cuts: MINRORO_CUTS,
    },
    chatBg: `${BASE}/35.webp`,
    doneBg: `${BASE}/34.webp`,
    speaker: '민로로',
    signup: {
      line: '어서 오세요, 민로로예요.\n무료 라이브 자리는 카카오로 1초면 잡아 드려요.',
      buttonGuest: '카카오로 1초 만에 신청하기',
      buttonMember: '{name} 님 자리로 신청하기',
      buttonSub: '1분이면 끝나요',
      legal: '가입하면 이용약관·개인정보 처리방침에 동의하게 돼요. (만 14세 이상)',
    },
    saved: { line: '자리 잡아 뒀어요, {name} 님!', full: '이번 라이브는 자리가 다 찼어요.', fullButton: '홈으로' },
    asks: [
      { key: 'blog_exp', line: '{name} 님, 지금 어디에 가장 가까우세요?', options: ['블로그가 처음이에요', '블로그를 하는데 수익이 적거나 없어요', '다른 부업을 해 봤어요', '은퇴 전후로 수입원을 찾아요'], why: '출발점에 따라 라이브에서 먼저 볼 부분이 달라서 여쭤봐요.', button: '다음' },
      { key: 'daily_time', line: '하루에 블로그에 쓸 수 있는 시간은요?', options: ['30분', '1시간', '그 이상'], why: '쓸 수 있는 시간에 맞는 순서를 같이 볼게요.', button: '다음' },
      { key: 'concern', line: '마지막으로, 블로그나 부업에서 제일 막혔던 걸 알려 주세요.\n라이브에서 같이 볼게요.', placeholder: '자유롭게 적어 주세요 (200자)', button: '신청 마치기' },
    ],
    skipNote: '답하지 않아도 다음으로 넘어갈 수 있어요.',
    done: {
      line: '{name} 님, {live}\n유튜브 라이브에서 만나요.\n돈이 되는 기준과 자료 네 가지를 준비해 둘게요.',
      already: '{name} 님은 이미 자리를 잡아 두셨어요.',
      notice: '무료 라이브는 다시보기가 없어요. 시간 맞춰 들어와 주세요.',
      gift: '참여 혜택: AI 블로그 수익화 정답지 · 온라인 수익화 로드맵 · 돈 되는 비밀링크 175개 · AI 분석 미니 봇',
      legal: '본 강의는 수익을 보장하지 않으며, 결과는 개인의 실행에 따라 다릅니다. 무료 라이브에서 유료 과정 안내가 있을 수 있습니다.',
    },
  },
}

export const CONCERN_MAX = 200
