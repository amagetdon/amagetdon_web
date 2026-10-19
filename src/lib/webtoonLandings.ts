// 웹툰식 랜딩(/w/:slug) 설정 — 표지 → 세로 웹툰 → 캐릭터 대화형 신청 화면.
// 랜딩 하나 = 강의 하나. 그림·대사·일시는 여기서 바꾼다(1차: 코드 설정, 바꾸면 배포 필요).
// 그림은 /r2 중계 주소 또는 public/ 아래 경로. 말풍선·내레이션 글자는 그림 위에 HTML 로 얹는다(AI 그림 속 한글 깨짐 방지).

/** 그림 위에 얹는 글 — narration: 흰 네모 박스, line: 말풍선(말하는 사람), sfx: 큰 효과음 */
export type WebtoonText =
  | { kind: 'narration'; text: string }
  | { kind: 'line'; speaker?: string; text: string }
  | { kind: 'sfx'; text: string }

export interface WebtoonCut {
  id: string
  /** 그림 주소. 없으면 '그림 준비 중' 자리 표시 */
  src?: string
  /** 그림 세로/가로 비율(자리 미리 잡기용). 기본 4:5 */
  ratio?: number
  /** 그림이 없을 때 자리 표시에 보여 줄 장면 설명 */
  scene?: string
  texts?: WebtoonText[]
}

export interface WebtoonLanding {
  slug: string
  courseId: number
  cover: {
    poster: string
    video?: string
    kicker: string
    title: string
    quote: string
    cta: string
    note: string
  }
  webtoon: {
    cuts: WebtoonCut[]
    skipBubble: string
    endCta: string
  }
  /** 대화 화면 배경(캐릭터 정면) */
  portrait: string
  donePortrait: string
  speaker: string
  lines: {
    signup: string
    saved: string
    full: string
    already: string
    q1: string
    q2: string
    done: string
  }
  doneNotes: string[]
  disclaimer: string
}

const BASE = '/webtoon/minroro-blog'

export const WEBTOON_LANDINGS: Record<string, WebtoonLanding> = {
  'minroro-blog': {
    slug: 'minroro-blog',
    courseId: 129,
    cover: {
      poster: `${BASE}/s0.webp`,
      video: `${BASE}/cover.mp4`,
      kicker: '민로로',
      title: 'AI 블로그 정답지',
      quote: '접기 전에, 딱 한 번만 제대로 봐요.',
      cta: 'AI 블로그 정답지 무료로 받아보기',
      note: '유튜브 무료 라이브 · ○월 ○일(○) 저녁 ○시',
    },
    webtoon: {
      skipBubble: '웹툰은 다음에, 바로 신청할게요!',
      endCta: '내 블로그 순서 확인하기',
      cuts: [
        { id: 'C01', scene: '넓은 밤 풍경. 도시 하늘에 거대한 검색창, 아래로 끝없는 창문 불빛', texts: [{ kind: 'narration', text: '검색창 너머에는 아주 큰 마을이 있어요.' }] },
        { id: 'C02', scene: '창마다 글이 하나씩 떠 있는 마을. 사람들이 창을 들여다본다', texts: [{ kind: 'narration', text: '사람들은 매일 이 마을을 지나며 누군가의 글을 읽고, 무엇을 살지, 어디에 갈지 정했죠.' }] },
        { id: 'C03', scene: '몇몇 집만 유난히 환하고 줄을 섰다. 나머지 창은 희미하다', texts: [{ kind: 'narration', text: '그런데 이상하게도, 사람들은 늘 몇몇 집에만 몰렸어요.' }] },
        { id: 'C04', scene: '빌딩 옥상 난간에 걸터앉은 실루엣. 손에 든 휴대폰에서 초록빛', texts: [{ kind: 'line', speaker: '???', text: '다들 참 열심히 쓰는데… 길을 모르네요.' }] },
        { id: 'C05', scene: '새벽 1시 식탁. 빈 글쓰기 화면 앞에서 턱을 괸 30대 여성', texts: [{ kind: 'narration', text: '그도 그럴 것이…' }, { kind: 'narration', text: '퇴근하고 쓴 글 하나에 세 시간,' }] },
        { id: 'C06', scene: "휴대폰 클로즈업: 바닥에 붙은 통계 그래프, '오늘 방문자 3'", texts: [{ kind: 'narration', text: '석 달을 써도 늘지 않는 방문자,' }] },
        { id: 'C07', scene: '낮의 부엌. 40대 후반 여성이 노트북을 조용히 덮는다', texts: [{ kind: 'narration', text: "'이 나이에 뭘…' 하며 덮어 버린 노트북." }] },
        { id: 'C08', scene: '마을의 창문 불빛들이 하나둘 꺼진다', texts: [{ kind: 'narration', text: '그렇게 많은 사람이, 조용히 블로그를 접었어요.' }] },
        { id: 'C09', scene: '밤의 아파트 단지. 휴대폰 불빛이 켜진 창 하나', texts: [{ kind: 'narration', text: '그러던 어느 밤.' }] },
        { id: 'C10', scene: "블로그 앱 '앱 삭제' 위에서 멈춘 손가락", texts: [{ kind: 'narration', text: '블로그를 지우려던 손가락 하나가, 멈췄어요.' }] },
        { id: 'C11', scene: '휴대폰 화면이 번쩍 빛나고 초록 빛줄기가 방을 가른다', texts: [{ kind: 'sfx', text: '번쩍' }, { kind: 'line', speaker: '화면 속 목소리', text: '잠깐만요.' }] },
        { id: 'C12', src: `${BASE}/c12.webp`, ratio: 1376 / 768, texts: [{ kind: 'sfx', text: '스윽' }] },
        { id: 'C13', scene: '전신, 어두운 사무실 창밖 야경', texts: [{ kind: 'narration', text: '고등학생 때 블로그로 시작해, 지금은 광고대행사 민컴퍼니를 이끄는 사람.' }, { kind: 'narration', text: "사람들은 그를 '민로로'라고 불렀어요." }] },
        { id: 'C14', scene: '얼굴 클로즈업. 휴대폰 불빛이 눈에 비친다', texts: [{ kind: 'line', speaker: '민로로', text: '그 블로그, 아직 끝난 거 아니에요.' }] },
        { id: 'C15', scene: '민로로 상반신, 단호한 표정', texts: [{ kind: 'line', speaker: '민로로', text: '글을 못 써서 안 된 게 아니에요.' }, { kind: 'line', speaker: '민로로', text: '순서를 몰랐던 거예요.' }] },
        { id: 'C16', scene: '공중에 펼쳐진 화면 3장: AI 주제 분석 · 키워드 분석 · 원고 작성과 발행', texts: [{ kind: 'narration', text: '어떤 글이 검색에 뜨는지, 민로로는 그 순서를 AI에 담았어요.' }] },
        { id: 'C17', scene: "'발행' 버튼 위로 초록 체크 표시", texts: [{ kind: 'line', speaker: '민로로', text: '주제만 넣으면, 나머지는 순서대로 누르면 돼요.' }] },
        { id: 'C18', scene: '한쪽 무릎을 꿇어 눈높이를 맞춘 민로로. 바닥에 초록빛', texts: [{ kind: 'line', speaker: '민로로', text: '글솜씨가 없어도, 하루 30분뿐이어도 겁먹지 마세요.' }] },
        { id: 'C19', scene: '엉킨 초록 실타래가 손끝에서 한 줄로 풀려 길이 된다', texts: [{ kind: 'line', speaker: '민로로', text: '막힌 순서를 풀어 드리는 게 제 일이거든요.' }] },
        { id: 'C20', src: `${BASE}/c20.webp`, ratio: 1376 / 768, texts: [{ kind: 'line', speaker: '민로로', text: '이제 혼자 새벽까지 헤매지 마세요.' }, { kind: 'line', speaker: '민로로', text: '당신 블로그의 순서, 무료 라이브에서 제가 직접 보여 드릴게요.' }] },
      ],
    },
    portrait: `${BASE}/s0.webp`,
    donePortrait: `${BASE}/c20.webp`,
    speaker: '민로로',
    lines: {
      signup: '어서 오세요, 민로로예요.\n무료 라이브 자리는 카카오로 1초면 잡아 드려요.',
      saved: '자리 잡아 뒀어요, {name} 님!',
      full: '이번 라이브는 자리가 다 찼어요.\n다음 라이브 때 꼭 만나요.',
      already: '이미 자리를 잡아 두셨어요, {name} 님!',
      q1: '반가워요 {name} 님.\n블로그는 해 보셨어요?',
      q2: '마지막으로, 블로그 하면서 제일 막혔던 게 있으면 알려 주세요.\n라이브에서 같이 볼게요.',
      done: '{name} 님, ○월 ○일 ○시\n유튜브 라이브에서 만나요.',
    },
    doneNotes: ['무료 라이브는 다시보기가 없어요. 시간 맞춰 들어와 주세요.'],
    disclaimer: '본 강의는 수익을 보장하지 않으며, 결과는 개인의 실행에 따라 다릅니다. 무료 라이브에서 유료 과정 안내가 있을 수 있습니다.',
  },
}

export const BLOG_EXP_OPTIONS = ['처음이에요', '해 봤는데 멈췄어요', '하고 있어요'] as const
export const DAILY_TIME_OPTIONS = ['30분', '1시간', '그 이상'] as const
export const CONCERN_MAX = 200
