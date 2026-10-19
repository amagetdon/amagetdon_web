// 웹툰식 랜딩(/w/:slug) 설정 — 표지 → 세로 웹툰 → 캐릭터 대화형 신청 화면.
// 랜딩 하나 = 강의 하나. 그림·대사는 여기서 바꾼다(1차: 코드 설정, 바꾸면 배포 필요).
// 그림 속에는 글자가 없고, 말풍선·내레이션은 그림 위에 HTML 로 얹는다(AI 그림 속 한글 깨짐 방지).
// 빈칸: {name} = 회원 이름, {live} = 강의 라이브 일시(courses.scheduled_at, 없으면 liveFallback)

export type BubbleType = 'narration' | 'speech' | 'dark_box' | 'sfx' | 'caption'

export interface Bubble {
  type: BubbleType
  text: string
  speaker?: string
  /** 그림 높이 기준 위치(%) — 말풍선 위쪽 기준 */
  top: number
  align: 'left' | 'center' | 'right'
}

export interface WebtoonCut {
  id: string
  src: string
  /** 그림 세로/가로 비율(자리 미리 잡기용) */
  ratio: number
  bubbles: Bubble[]
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

const BASE = '/webtoon/minroro-blog'
const R = 1376 / 768
const cut = (n: string, id: string, bubbles: Bubble[]): WebtoonCut => ({ id, src: `${BASE}/${n}.webp`, ratio: R, bubbles })

export const WEBTOON_LANDINGS: Record<string, WebtoonLanding> = {
  'minroro-blog': {
    slug: 'minroro-blog',
    courseId: 129,
    liveFallback: '○월 ○일(○) 저녁 7시 30분',
    seo: {
      title: 'AI 블로그 정답지 | 민로로 무료 라이브',
      description: '접기 전에, 딱 한 번만 제대로 봐요. 민로로가 AI로 블로그 글을 쓰고 노출시키는 순서를 유튜브 무료 라이브에서 보여 드려요.',
      image: `${BASE}/og.jpg`,
    },
    cover: {
      poster: `${BASE}/00.webp`,
      video: `${BASE}/cover.mp4`,
      kicker: '민로로',
      title: 'AI 블로그 정답지',
      quote: '접기 전에, 딱 한 번만 제대로 봐요.',
      cta: 'AI 블로그 정답지 받아보기',
      ctaSub: '무료 · 1분',
      note: '유튜브 무료 라이브 · {live}',
      detailsSummary: '무료 라이브 더 알아보기',
      details: [
        '무엇을 하나요? 민로로(민태훈)가 AI로 블로그 글을 쓰고 노출시키는 순서를 유튜브 라이브에서 화면으로 보여 드려요.',
        '무료 라이브는 다시보기가 없어요. 시간 맞춰 들어와 주세요.',
        '라이브 안에서 유료 과정 안내가 있을 수 있어요. 본 강의는 수익을 보장하지 않으며, 결과는 개인의 실행에 따라 다릅니다.',
        '자주 묻는 질문: 블로그를 한 번도 안 해 봤어도 되나요? → 네, 처음 하는 분 기준으로 설명해요. / 글솜씨가 없어도 되나요? → AI로 초안을 만드는 순서를 보여 드려요. / 신청은 어떻게 하나요? → 카카오로 1초면 끝나요.',
      ],
    },
    webtoon: {
      skipBubble: '웹툰은 다음에, 바로 신청할게요!',
      endCta: '내 블로그 순서 확인하기',
      endNote: '유튜브 무료 라이브 · 다시보기 없음',
      cuts: [
        cut('01', 'C01', [{ type: 'narration', top: 12, align: 'center', text: '검색창 너머에는 아주 큰 마을이 있어요.' }]),
        cut('02', 'C02', [
          { type: 'narration', top: 10, align: 'left', text: '사람들은 매일 이 마을을 지나며 누군가의 글을 읽고,' },
          { type: 'narration', top: 80, align: 'right', text: '무엇을 살지, 어디에 갈지 정했죠.' },
        ]),
        cut('03', 'C03', [{ type: 'narration', top: 82, align: 'center', text: '그런데 이상하게도, 사람들은 늘 몇몇 집에만 몰렸어요.' }]),
        cut('04', 'C04', [{ type: 'speech', speaker: '???', top: 15, align: 'left', text: '다들 참 열심히 쓰는데… 길을 모르네요.' }]),
        cut('05', 'C05', [
          { type: 'dark_box', top: 6, align: 'center', text: '그도 그럴 것이…' },
          { type: 'narration', top: 78, align: 'left', text: '퇴근하고 쓴 글 하나에 세 시간,' },
        ]),
        cut('06', 'C06', [{ type: 'narration', top: 12, align: 'right', text: '석 달을 써도 늘지 않는 방문자,' }]),
        cut('07', 'C07', [{ type: 'narration', top: 80, align: 'center', text: "'이 나이에 뭘…' 하며 덮어 버린 노트북." }]),
        cut('08', 'C08', [{ type: 'narration', top: 50, align: 'center', text: '그렇게 많은 사람이, 조용히 블로그를 접었어요.' }]),
        cut('09', 'C09', [{ type: 'narration', top: 12, align: 'left', text: '그러던 어느 밤.' }]),
        cut('10', 'C10', [{ type: 'narration', top: 82, align: 'center', text: '블로그를 지우려던 손가락 하나가, 멈췄어요.' }]),
        cut('11', 'C11', [
          { type: 'sfx', top: 15, align: 'left', text: '번쩍' },
          { type: 'speech', speaker: '화면 속 목소리', top: 78, align: 'right', text: '잠깐만요.' },
        ]),
        cut('12', 'C12', [{ type: 'sfx', top: 12, align: 'left', text: '스윽' }]),
        cut('13', 'C13', [
          { type: 'narration', top: 10, align: 'left', text: '고등학생 때 블로그로 시작해, 지금은 광고대행사 민컴퍼니를 이끄는 사람.' },
          { type: 'narration', top: 80, align: 'right', text: "사람들은 그를 '민로로'라고 불렀어요." },
          { type: 'caption', top: 92, align: 'left', text: '02년생 · 민컴퍼니 대표 · AI 블로그 자동화 시스템 구축' },
        ]),
        cut('14', 'C14', [{ type: 'speech', speaker: '민로로', top: 12, align: 'right', text: '그 블로그, 아직 끝난 거 아니에요.' }]),
        cut('15', 'C15', [
          { type: 'speech', speaker: '민로로', top: 10, align: 'left', text: '글을 못 써서 안 된 게 아니에요.' },
          { type: 'speech', speaker: '민로로', top: 75, align: 'right', text: '순서를 몰랐던 거예요.' },
        ]),
        cut('16', 'C16', [{ type: 'narration', top: 85, align: 'center', text: '어떤 글이 검색에 뜨는지, 민로로는 그 순서를 AI에 담았어요.' }]),
        cut('17', 'C17', [{ type: 'speech', speaker: '민로로', top: 12, align: 'left', text: '주제만 넣으면, 나머지는 순서대로 누르면 돼요.' }]),
        cut('18', 'C18', [{ type: 'speech', speaker: '민로로', top: 10, align: 'center', text: '글솜씨가 없어도, 하루 30분뿐이어도 겁먹지 마세요.' }]),
        cut('19', 'C19', [{ type: 'speech', speaker: '민로로', top: 80, align: 'right', text: '막힌 순서를 풀어 드리는 게 제 일이거든요.' }]),
        cut('20', 'C20', [
          { type: 'speech', speaker: '민로로', top: 8, align: 'left', text: '이제 혼자 새벽까지 헤매지 마세요.' },
          { type: 'speech', speaker: '민로로', top: 20, align: 'right', text: '당신 블로그의 순서, 무료 라이브에서 제가 직접 보여 드릴게요.' },
        ]),
      ],
    },
    chatBg: `${BASE}/21.webp`,
    doneBg: `${BASE}/20.webp`,
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
      { key: 'blog_exp', line: '반가워요 {name} 님.\n블로그는 해 보셨어요?', options: ['처음이에요', '해 봤는데 멈췄어요', '하고 있어요'], why: '처음 하는 분과 다시 시작하는 분은 라이브에서 볼 부분이 달라서 여쭤봐요.', button: '다음' },
      { key: 'daily_time', line: '하루에 블로그에 얼마나 쓸 수 있어요?', options: ['30분', '1시간', '그 이상'], why: '쓸 수 있는 시간에 맞는 순서를 같이 볼게요.', button: '다음' },
      { key: 'concern', line: '마지막으로, 블로그 하면서 제일 막혔던 게 있으면 알려 주세요.\n라이브에서 같이 볼게요.', placeholder: '자유롭게 적어 주세요 (200자)', button: '신청 마치기' },
    ],
    skipNote: '답하지 않아도 다음으로 넘어갈 수 있어요.',
    done: {
      line: '{name} 님, {live}\n유튜브 라이브에서 만나요.',
      already: '{name} 님은 이미 자리를 잡아 두셨어요.',
      notice: '무료 라이브는 다시보기가 없어요. 시간 맞춰 들어와 주세요.',
      legal: '본 강의는 수익을 보장하지 않으며, 결과는 개인의 실행에 따라 다릅니다. 무료 라이브에서 유료 과정 안내가 있을 수 있습니다.',
    },
  },
}

export const CONCERN_MAX = 200
