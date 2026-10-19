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
  /** 그림 주소. 없으면 card(글자 장면)로 그린다 */
  src?: string
  /** 그림 세로/가로 비율(자리 미리 잡기용) */
  ratio: number
  bubbles: Bubble[]
  /** 글자 장면 — 그림 없이 검은 바탕에 글자만(제목 1줄 + 본문 여러 줄, 강조 줄은 초록) */
  card?: { title?: string; lines: string[]; highlight?: number[]; note?: string }
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

const textCut = (id: string, card: NonNullable<WebtoonCut['card']>): WebtoonCut => ({ id, ratio: R, bubbles: [], card })

// 스토리보드 v5(교안 그대로 소구, 2026-10-19 PM) — 그림 번호 = PM 데모_v5 파일 앞 두 자리. C14·C22·C23·C26 은 글자 장면
export const WEBTOON_LANDINGS: Record<string, WebtoonLanding> = {
  'minroro-blog': {
    slug: 'minroro-blog',
    courseId: 129,
    liveFallback: '○월 ○일(○) 저녁 7시 30분',
    seo: {
      title: 'AI 블로그 수익화 정답지 | 민로로 무료 라이브',
      description: '방향부터 잡고, AI로 빠르게. 블로그로 돈이 되는 방향과 AI로 빠르게 실행하는 방법을 유튜브 무료 라이브에서 보여 드려요.',
      image: `${BASE}/og.jpg`,
    },
    cover: {
      poster: `${BASE}/00.webp`,
      video: `${BASE}/cover.mp4`,
      kicker: '민로로',
      title: 'AI 블로그 수익화 정답지',
      quote: '방향부터 잡고, AI로 빠르게.',
      cta: 'AI 블로그 수익화 정답지 받아보기',
      ctaSub: '무료 · 1분',
      note: '유튜브 무료 라이브 · {live}',
      detailsSummary: '무료 라이브 더 알아보기',
      details: [
        '무엇을 하나요? 블로그로 돈이 되는 방향(누가·무엇에 돈을 주는지)과, AI로 빠르게 실행하는 방법을 실제 도구 화면으로 보여 드려요.',
        '참여하면 혜택 4가지(AI 블로그 수익화 정답지 · 온라인 수익화 로드맵 · 돈 되는 비밀링크 175개 · AI 분석 미니 봇)를 드려요.',
        '무료 라이브는 다시보기가 없어요. 시간 맞춰 들어와 주세요.',
        '라이브 안에서 유료 과정 안내가 있을 수 있어요. 본 강의는 수익을 보장하지 않으며, 결과는 개인의 실행에 따라 다릅니다.',
      ],
    },
    webtoon: {
      skipBubble: '웹툰은 다음에, 바로 신청할게요!',
      endCta: '내 블로그 방향 확인하기',
      endNote: '유튜브 무료 라이브 · 다시보기 없음',
      cuts: [
        // 인트로 · 다들 배우는데, 왜 안 벌릴까
        cut('01', 'C01', [{ type: 'narration', top: 8, align: 'center', text: '요즘 세상이 좀 이상해요. 사람들이 줄을 서서 강의를 사요.' }]),
        cut('02', 'C02', [
          { type: 'narration', top: 8, align: 'left', text: '강의도, 전자책도 쌓여 가는데,' },
          { type: 'narration', top: 88, align: 'right', text: '첫 수익은 아직이에요.' },
        ]),
        cut('03', 'C03', [{ type: 'narration', top: 85, align: 'left', text: '퇴근 후 빈 화면 앞에서, 무엇부터 해야 할지 막막하고.' }]),
        cut('04', 'C04', [{ type: 'narration', top: 10, align: 'right', text: '매일 글은 쓰는데, 방문자도 수익도 제자리고.' }]),
        cut('05', 'C05', [{ type: 'narration', top: 85, align: 'center', text: '유튜브를 해 보려니, 찍고 편집하고 자막까지.' }]),
        cut('06', 'C06', [{ type: 'narration', top: 8, align: 'center', text: '물건을 팔려니, 재고와 초기 비용부터.' }]),
        cut('07', 'C07', [
          { type: 'dark_box', top: 6, align: 'center', text: '문제는 노력이 아니에요.' },
          { type: 'narration', top: 88, align: 'center', text: '방향이 틀리면, 열심히 할수록 멀어지니까요.' },
        ]),
        cut('08', 'C08', [{ type: 'speech', speaker: '???', top: 10, align: 'left', text: '경험도 근거도 부족한 이야기가 정답처럼 돌아다니니… 방향을 못 잡는 게 당연하죠.' }]),
        cut('09', 'C09', [{ type: 'narration', top: 12, align: 'left', text: '그러던 어느 밤.' }]),
        cut('10', 'C10', [{ type: 'narration', top: 85, align: 'center', text: '또 하나의 강의를 결제하려던 손가락이, 멈췄어요.' }]),
        cut('11', 'C11', [
          { type: 'sfx', top: 12, align: 'left', text: '번쩍' },
          { type: 'speech', speaker: '화면 속 목소리', top: 80, align: 'right', text: '잠깐만요.' },
        ]),
        // 소개
        cut('12', 'C12', [
          { type: 'sfx', top: 8, align: 'left', text: '스윽' },
          { type: 'speech', speaker: '민로로', top: 88, align: 'right', text: '결제는 잠깐 미뤄 두고, 방향부터 같이 봐요.' },
        ]),
        cut('13', 'C13', [
          { type: 'speech', speaker: '민로로', top: 6, align: 'left', text: '저는 민태훈, 민로로예요.' },
          { type: 'narration', top: 18, align: 'right', text: '시작은 2013년, 초등학교 6학년 때 쓴 게임 블로그였어요.' },
          { type: 'narration', top: 76, align: 'left', text: '글이 처음으로 광고비 약 50만 원이 되어 돌아왔고,' },
          { type: 'narration', top: 92, align: 'right', text: '그 한 번의 수익이 2018년 사무실, 2019년 민컴퍼니, 2021년 법인으로 이어졌어요.' },
        ]),
        textCut('C14', {
          lines: ['지금은 광고·커머스·교육 사업을 해요.', '블로그를 시작으로 만들어 온\n누적 사업 매출, 350억 원.'],
          highlight: [1],
          note: '광고+커머스+교육 사업 합산 · 블로그 한 개의 광고 수입이 아님 (실제 자료 이미지로 교체 예정)',
        }),
        cut('15', 'C15', [
          { type: 'speech', speaker: '민로로', top: 8, align: 'right', text: '돈을 받는 블로거로도, 돈을 주는 사업자로도 일해 봤어요.' },
          { type: 'speech', speaker: '민로로', top: 88, align: 'left', text: '그래서 누가, 무엇에 돈을 주는지 알아요.' },
        ]),
        // 본론 1 · 방향 × 속도
        cut('16', 'C16', [
          { type: 'speech', speaker: '민로로', top: 6, align: 'center', text: '블로그 수익화는, 방향 × 속도예요.' },
          { type: 'narration', top: 90, align: 'center', text: '돈이 되는 방향을 먼저 정하고, AI로 빠르게 실행한다.' },
        ]),
        cut('17', 'C17', [
          { type: 'speech', speaker: '민로로', top: 6, align: 'right', text: "방향은 '누가 돈을 쓰고, 무엇에 돈을 주는가'부터 정하는 거예요." },
          { type: 'narration', top: 92, align: 'left', text: '홍보가 필요한 사장님, 상품을 찾는 구매자. 그들은 손님을 이어 주는 글, 구매와 상담을 돕는 정보에 돈을 줘요.' },
        ]),
        cut('18', 'C18', [{ type: 'narration', top: 90, align: 'center', text: '속도는 AI가 맡아요. 검색어를 찾고, 상위 글을 분석하고, 초안을 써요. 나는 경험·사진·사실을 채우고 확인해요.' }]),
        // 본론 2 · 블로그는 나의 무인점포
        cut('19', 'C19', [{ type: 'speech', speaker: '민로로', top: 8, align: 'center', text: '블로그는 나의 무인점포예요. 24시간 열려 있는 가게.' }]),
        cut('20', 'C20', [{ type: 'narration', top: 88, align: 'center', text: "그냥 구경하는 손님 말고, 필요한 걸 찾는 '돈 되는 손님'이 들어오고," }]),
        cut('21', 'C21', [
          { type: 'narration', top: 8, align: 'left', text: '진열대에는 내 상품이 없어도, 다른 회사의 상품과 서비스를 연결해 둘 수 있어요.' },
          { type: 'narration', top: 90, align: 'right', text: '그 흐름이 반복되면, 내가 자리를 비운 동안에도 글이 손님을 만나요.' },
        ]),
        // 본론 3 · 왜 블로그인가
        textCut('C22', {
          title: '왜 하필 블로그일까요?',
          lines: ['① 개설비 0원', '② 돈이 된다', '③ 첫 수익이 빠르다', '④ AI로 쉬워졌다', '⑤ 지금이 기회'],
        }),
        textCut('C23', {
          title: '① 시작 비용 0원',
          lines: ['재고도, 장비도 필요 없어요.', '유튜브는 영상, 쿠팡은 상품부터지만', '블로그는 글 한 편부터.'],
          highlight: [2],
        }),
        cut('24', 'C24', [{ type: 'narration', top: 88, align: 'center', text: '② 돈이 돼요. 글에 붙은 광고, 상품·서비스를 소개하는 수수료, 업체가 필요한 글의 원고료와 대행료.' }]),
        cut('25', 'C25', [{ type: 'narration', top: 86, align: 'center', text: '③ 첫 수익까지 생각보다 빨라요. 한 달이면 돈 벌 수 있는 블로그 세팅이 끝나요. 전부가 아니라, 하나부터.' }]),
        textCut('C26', {
          title: '④ AI로 쉬워졌어요',
          lines: ['빈 화면에서 한 편에\n1~2시간 걸리던 글이,', '이제 초안은 1분.', '나는 확인하고 발행해요.'],
          highlight: [1],
        }),
        cut('27', 'C27', [
          { type: 'narration', top: 6, align: 'center', text: "⑤ 지금이 기회예요. 네이버는 앞으로 5년간 콘텐츠 생태계에 1조 원을 투자한다고 발표했고, 매월 3,000명의 창작자를 뽑아 지원하는 '네이버 메이트'를 만들었어요." },
          { type: 'caption', top: 94, align: 'left', text: 'NAVER 공식 발표 2026.05.28 · 2026.08.07 · 1조 원은 콘텐츠 생태계 전체 투자(블로그만의 예산 아님)' },
        ]),
        // 결론
        cut('28', 'C28', [
          { type: 'speech', speaker: '민로로', top: 5, align: 'center', text: '이런 분이라면, 끝까지 들어 보세요.' },
          { type: 'narration', top: 16, align: 'left', text: '퇴근 후 월급 외 수입을, 육아와 집안일 사이에, 은퇴 후에도 꾸준히 할 수 있는 수입원을, 초기 투자금 없이 찾는 분.' },
          { type: 'narration', top: 86, align: 'right', text: '블로그는 하는데 수익이 없거나, 체험단만 하거나, 강의와 전자책만 쌓인 분.' },
          { type: 'caption', top: 95, align: 'left', text: '가장 오래 일한 직장을 그만둔 평균 나이 53.0세 · 국가데이터처 2026.08.05' },
        ]),
        cut('29', 'C29', [
          { type: 'speech', speaker: '민로로', top: 5, align: 'left', text: '라이브에서는 돈이 되는 기준을 보여 드리고, 실제 도구로 글 한 편을 같이 만들어 봐요.' },
          { type: 'narration', top: 22, align: 'right', text: '참여하면 정답지·로드맵·비밀링크 175개·AI 분석 미니 봇을 드려요.' },
          { type: 'speech', speaker: '민로로', top: 92, align: 'center', text: '그다음, 내 블로그에 적용하는 길은 혼자 가도 되고 같이 가도 돼요. 라이브를 보고 정하세요.' },
        ]),
        cut('30', 'C30', [
          { type: 'speech', speaker: '민로로', top: 6, align: 'left', text: '무료 강의라도, 여러분의 시간은 쓰니까요.' },
          { type: 'speech', speaker: '민로로', top: 18, align: 'right', text: '어차피 들을 무료 강의라면, 이번엔 방향부터 잡고 가세요.' },
        ]),
      ],
    },
    chatBg: `${BASE}/31.webp`,
    doneBg: `${BASE}/30.webp`,
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
      { key: 'blog_exp', line: '반가워요 {name} 님.\n지금 어디에 가장 가까우세요?', options: ['블로그가 처음이에요', '블로그를 하는데 수익이 적거나 없어요', '다른 부업을 해 봤어요', '은퇴 전후로 수입원을 찾아요'], why: '지금 상황에 따라 라이브에서 볼 부분이 달라서 여쭤봐요.', button: '다음' },
      { key: 'daily_time', line: '하루에 블로그에 쓸 수 있는 시간은?', options: ['30분', '1시간', '그 이상'], why: '쓸 수 있는 시간에 맞는 순서를 같이 볼게요.', button: '다음' },
      { key: 'concern', line: '마지막으로, 블로그나 부업에서 제일 막혔던 걸 알려 주세요.\n라이브에서 같이 볼게요.', placeholder: '자유롭게 적어 주세요 (200자)', button: '신청 마치기' },
    ],
    skipNote: '답하지 않아도 다음으로 넘어갈 수 있어요.',
    done: {
      line: '{name} 님, {live}\n유튜브 라이브에서 만나요.',
      already: '{name} 님은 이미 자리를 잡아 두셨어요.',
      notice: '돈이 되는 기준과 자료 네 가지를 준비해 둘게요. 무료 라이브는 다시보기가 없어요.',
      legal: '본 강의는 수익을 보장하지 않으며, 결과는 개인의 실행에 따라 다릅니다. 무료 라이브에서 유료 과정 안내가 있을 수 있습니다.',
    },
  },
}

export const CONCERN_MAX = 200
