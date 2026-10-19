// 자동 생성 — scripts/webtoon-dialogue.mjs (대사목록_v5.json). 직접 고치지 말고 대사 목록을 고쳐 다시 만든다.
import type { Bubble, WebtoonCut } from '../webtoonLandings'

const BASE = '/webtoon/minroro-blog'
const R = 1376 / 768
const cut = (n: string, id: string, bubbles: Bubble[]): WebtoonCut => ({ id, src: `${BASE}/${n}.webp`, ratio: R, bubbles })
const textCut = (id: string, card: NonNullable<WebtoonCut['card']>): WebtoonCut => ({
  id, ratio: R, bubbles: [], card: { ...card, images: card.images?.map((n) => `${BASE}/${n}.webp`) },
})

export const CUTS: WebtoonCut[] = [
  cut("01", "C01", [{"type":"narration","top":10,"align":"center","text":"요즘 세상이 좀 이상해요."},{"type":"narration","top":82,"align":"center","text":"사람들이 줄을 서서 강의를 사요."}]),
  cut("02", "C02", [{"type":"narration","top":10,"align":"left","text":"강의도, 전자책도 쌓여 가는데,"},{"type":"narration","top":82,"align":"right","text":"첫 수익은 아직이에요."}]),
  cut("03", "C03", [{"type":"narration","top":80,"align":"left","text":"퇴근 후 빈 화면 앞에서, 무엇부터 해야 할지 막막하고."}]),
  cut("04", "C04", [{"type":"narration","top":12,"align":"right","text":"매일 글은 쓰는데, 방문자도 수익도 제자리고."}]),
  cut("05", "C05", [{"type":"narration","top":10,"align":"left","text":"유튜브를 해 보려니, 찍고 편집하고 자막까지."}]),
  cut("06", "C06", [{"type":"narration","top":10,"align":"center","text":"물건을 팔려니, 재고와 초기 비용부터."}]),
  cut("07", "C07", [{"type":"dark_box","top":6,"align":"center","text":"문제는 노력이 아니에요."},{"type":"narration","top":85,"align":"center","text":"방향이 틀리면, 열심히 할수록 멀어지니까요."}]),
  cut("08", "C08", [{"type":"speech","speaker":"???","top":12,"align":"left","text":"경험도 근거도 부족한 이야기가 정답처럼 돌아다니니… 방향을 못 잡는 게 당연하죠."}]),
  cut("09", "C09", [{"type":"narration","top":12,"align":"left","text":"그러던 어느 밤."}]),
  cut("10", "C10", [{"type":"narration","top":82,"align":"center","text":"또 하나의 강의를 결제하려던 손가락이, 멈췄어요."}]),
  cut("11", "C11", [{"type":"sfx","top":15,"align":"left","text":"번쩍"},{"type":"speech","speaker":"화면 속 목소리","top":78,"align":"right","text":"잠깐만요."}]),
  cut("12", "C12", [{"type":"sfx","top":12,"align":"left","text":"스윽"},{"type":"speech","speaker":"민로로","top":18,"align":"right","text":"결제는 잠깐 미뤄 두고, 방향부터 같이 봐요."}]),
  cut("13", "C13", [{"type":"speech","speaker":"민로로","top":8,"align":"left","text":"저는 민태훈, 민로로예요."},{"type":"narration","top":22,"align":"right","text":"시작은 2013년, 초등학교 6학년 때 쓴 게임 블로그였어요."},{"type":"narration","top":72,"align":"left","text":"글이 처음으로 광고비 약 50만 원이 되어 돌아왔고,"},{"type":"narration","top":86,"align":"right","text":"그 한 번의 수익이 2018년 사무실, 2019년 민컴퍼니, 2021년 법인으로 이어졌어요."}]),
  textCut("C14", {"lines":["지금은 광고 · 커머스 · 교육 사업을 해요.","블로그를 시작으로 만들어 온 누적 사업 매출","350억 원"],"highlight":[2],"note":"광고+커머스+교육 사업 합산 · 블로그 한 개의 광고 수입이 아님"}),
  cut("15", "C15", [{"type":"speech","speaker":"민로로","top":10,"align":"right","text":"돈을 받는 블로거로도, 돈을 주는 사업자로도 일해 봤어요."},{"type":"speech","speaker":"민로로","top":80,"align":"left","text":"그래서 누가, 무엇에 돈을 주는지 알아요."}]),
  cut("16", "C16", [{"type":"speech","speaker":"민로로","top":8,"align":"left","text":"블로그 수익화는, 방향 × 속도예요."},{"type":"narration","top":86,"align":"center","text":"돈이 되는 방향을 먼저 정하고, AI로 빠르게 실행한다."}]),
  cut("17", "C17", [{"type":"speech","speaker":"민로로","top":8,"align":"left","text":"방향은 '누가 돈을 쓰고, 무엇에 돈을 주는가'부터 정하는 거예요."},{"type":"narration","top":84,"align":"right","text":"홍보가 필요한 사장님, 상품을 찾는 구매자. 그들은 손님을 이어 주는 글, 구매와 상담을 돕는 정보에 돈을 줘요."}]),
  cut("18", "C18", [{"type":"narration","top":86,"align":"center","text":"속도는 AI가 맡아요. 검색어를 찾고, 상위 글을 분석하고, 초안을 써요. 나는 경험·사진·사실을 채우고 확인해요."}]),
  cut("19", "C19", [{"type":"speech","speaker":"민로로","top":8,"align":"center","text":"블로그는 나의 무인점포예요. 24시간 열려 있는 가게."}]),
  cut("20", "C20", [{"type":"narration","top":10,"align":"left","text":"그냥 구경하는 손님 말고, 필요한 걸 찾는 '돈 되는 손님'이 들어오고,"}]),
  cut("21", "C21", [{"type":"narration","top":8,"align":"left","text":"진열대에는 내 상품이 없어도, 다른 회사의 상품과 서비스를 연결해 둘 수 있어요."},{"type":"narration","top":86,"align":"center","text":"그 흐름이 반복되면, 내가 자리를 비운 동안에도 글이 손님을 만나요."}]),
  textCut("C22", {"lines":["왜 하필 블로그일까요?","① 시작 비용 0원","② 돈이 된다","③ 첫 수익이 빠르다","④ AI로 쉬워졌다","⑤ 지금이 기회"]}),
  textCut("C23", {"lines":["① 시작 비용 0원.","재고도, 장비도 필요 없어요.","유튜브는 영상, 쿠팡은 상품부터.","블로그는 글 한 편부터."],"highlight":[3],"images":["05","06"]}),
  cut("24", "C24", [{"type":"speech","speaker":"민로로","top":8,"align":"left","text":"② 돈이 돼요."},{"type":"narration","top":84,"align":"center","text":"글에 붙은 광고, 상품·서비스를 소개하는 수수료, 업체가 필요한 글의 원고료와 대행료."}]),
  cut("25", "C25", [{"type":"narration","top":10,"align":"center","text":"③ 첫 수익까지, 생각보다 빨라요."},{"type":"speech","speaker":"민로로","top":82,"align":"right","text":"한 달이면 돈 벌 수 있는 블로그 세팅이 끝나요. 전부가 아니라, 하나부터요."}]),
  textCut("C26", {"lines":["④ AI로 쉬워졌어요.","빈 화면에서 한 편에 1~2시간 걸리던 글,","이제 초안은 1분.","나는 확인하고 발행해요."],"highlight":[2],"animation":"typing"}),
  cut("27", "C27", [{"type":"narration","top":8,"align":"left","text":"⑤ 지금이 기회예요."},{"type":"narration","top":80,"align":"center","text":"네이버는 앞으로 5년간 콘텐츠 생태계에 1조 원을 투자한다고 발표했고, 매월 3,000명의 창작자를 뽑아 지원하는 '네이버 메이트'를 만들었어요."},{"type":"caption","top":95,"align":"center","text":"NAVER 공식 발표 2026.05.28 · 2026.08.07 · 1조 원은 콘텐츠 생태계 전체 투자(블로그만의 예산 아님)"}]),
  cut("28", "C28", [{"type":"speech","speaker":"민로로","top":6,"align":"center","text":"이런 분이라면, 끝까지 들어 보세요."},{"type":"narration","top":55,"align":"left","text":"퇴근 후 월급 외 수입을, 육아와 집안일 사이에, 은퇴 후에도 꾸준히 할 수 있는 수입원을, 초기 투자금 없이 찾는 분."},{"type":"narration","top":80,"align":"right","text":"블로그는 하는데 수익이 없거나, 체험단만 하거나, 강의와 전자책만 쌓인 분."},{"type":"caption","top":95,"align":"center","text":"가장 오래 일한 직장을 그만둔 평균 나이 53.0세 · 국가데이터처 2026.08.05"}]),
  cut("29", "C29", [{"type":"speech","speaker":"민로로","top":6,"align":"left","text":"라이브에서는 돈이 되는 기준을 보여 드리고, 실제 도구로 글 한 편을 같이 만들어 봐요."},{"type":"narration","top":45,"align":"right","text":"참여하면 정답지 · 로드맵 · 비밀링크 175개 · AI 분석 미니 봇을 드려요."},{"type":"speech","speaker":"민로로","top":84,"align":"left","text":"그다음, 내 블로그에 적용하는 길은 혼자 가도 되고 같이 가도 돼요. 라이브를 보고 정하세요."}]),
  cut("30", "C30", [{"type":"speech","speaker":"민로로","top":8,"align":"left","text":"무료 강의라도, 여러분의 시간은 쓰니까요."},{"type":"speech","speaker":"민로로","top":20,"align":"right","text":"어차피 들을 무료 강의라면, 이번엔 방향부터 잡고 가세요."}]),
]
