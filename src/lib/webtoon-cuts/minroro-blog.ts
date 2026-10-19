// 자동 생성 — scripts/webtoon-dialogue.mjs (대사목록_v6.json). 직접 고치지 말고 대사 목록을 고쳐 다시 만든다.
import type { Bubble, WebtoonCut } from '../webtoonLandings'

const BASE = '/webtoon/minroro-blog'
const R = 1376 / 768
const cut = (n: string, id: string, bubbles: Bubble[]): WebtoonCut => ({ id, src: `${BASE}/${n}.webp`, ratio: R, bubbles })
const textCut = (id: string, card: NonNullable<WebtoonCut['card']>): WebtoonCut => ({
  id, ratio: R, bubbles: [], card: { ...card, images: card.images?.map((n) => `${BASE}/${n}.webp`) },
})
const reviewCut = (n: string, id: string, review: NonNullable<WebtoonCut['review']>): WebtoonCut => ({ id, src: `${BASE}/${n}.webp`, ratio: 1, bubbles: [], review })

export const CUTS: WebtoonCut[] = [
  cut("01", "C01", [{"type":"narration","top":4,"align":"left","anchor":"top","text":"요즘 세상이 좀 이상해요."},{"type":"narration","top":40,"align":"right","anchor":"top","text":"사람들이 줄을 서서 강의를 사요."}]),
  cut("02", "C02", [{"type":"narration","top":4,"align":"left","anchor":"top","text":"강의도, 전자책도 쌓여 가는데,"},{"type":"narration","top":92,"align":"right","anchor":"bottom","text":"첫 수익은 아직이에요."}]),
  cut("03", "C03", [{"type":"narration","top":92,"align":"left","anchor":"bottom","text":"퇴근 후 빈 화면 앞에서, 무엇부터 해야 할지 막막하고."}]),
  cut("04", "C04", [{"type":"narration","top":4,"align":"left","anchor":"top","text":"유튜브를 해 보려니, 찍고 편집하고 자막까지."}]),
  cut("05", "C05", [{"type":"narration","top":4,"align":"left","anchor":"top","text":"물건을 팔려니, 재고와 초기 비용부터."}]),
  cut("06", "C06", [{"type":"dark_box","top":4,"align":"left","anchor":"top","text":"문제는 노력이 아니에요."},{"type":"narration","top":94,"align":"left","anchor":"bottom","text":"방향이 틀리면, 열심히 할수록 멀어지니까요."}]),
  cut("07", "C07", [{"type":"narration","top":6,"align":"left","anchor":"top","text":"그러던 어느 밤."}]),
  cut("08", "C08", [{"type":"narration","top":5,"align":"left","anchor":"top","text":"또 하나의 강의를 결제하려던 손가락이, 멈췄어요."}]),
  cut("09", "C09", [{"type":"sfx","top":6,"align":"left","anchor":"top","text":"번쩍"},{"type":"speech","speaker":"화면 속 목소리","top":92,"align":"left","anchor":"bottom","text":"잠깐만요.","tail":"up","tailX":78}]),
  cut("10", "C10", [{"type":"sfx","top":4,"align":"left","anchor":"top","text":"스윽"},{"type":"speech","speaker":"민로로","top":34,"align":"right","anchor":"top","text":"결제는 잠깐 미뤄 두고, 방향부터 같이 봐요.","tail":"up","tailX":22}]),
  cut("11", "C11", [{"type":"speech","speaker":"민로로","top":28,"align":"left","anchor":"top","text":"저는 민태훈, 민로로예요.","tail":"up","tailX":78},{"type":"narration","top":44,"align":"right","anchor":"top","text":"시작은 2013년, 초등학교 6학년 때 쓴 게임 블로그였어요."},{"type":"narration","top":94,"align":"right","anchor":"bottom","text":"글이 처음으로 광고비 약 50만 원이 되어 돌아왔고, 그 한 번의 수익이 2018년 사무실, 2019년 민컴퍼니, 2021년 법인으로 이어졌어요."}]),
  textCut("C12", {"lines":["지금은 광고 · 커머스 · 교육 사업을 해요.","블로그를 시작으로 만들어 온 누적 사업 매출","350억 원"],"highlight":[2],"note":"광고+커머스+교육 사업 합산 · 블로그 한 개의 광고 수입이 아님"}),
  cut("13", "C13", [{"type":"speech","speaker":"민로로","top":1,"align":"left","anchor":"top","text":"돈을 받는 블로거로도, 돈을 주는 사업자로도 일해 봤어요.","tail":"down"},{"type":"speech","speaker":"민로로","top":99,"align":"left","anchor":"bottom","text":"그래서 오늘은 누가, 왜 돈을 주는지부터 보여 드릴게요.","tail":"down","tailX":78}]),
  textCut("C14", {"lines":["블로그로 어떻게 돈을 버냐고요?","글을 읽는 사람은 돈을 내지 않아요.","돈을 주는 사람이, 따로 있어요."],"highlight":[2]}),
  cut("15", "C15", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"가게를 알리고 싶은 사장님, 손님이 필요한 업체,"},{"type":"narration","top":17,"align":"right","anchor":"top","text":"물건을 팔고 싶은 판매자, 그리고 네이버."}]),
  cut("16", "C16", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"STEP 1 · 누군가 '노량진 회식 장소'를 검색해요."},{"type":"narration","top":95,"align":"left","anchor":"bottom","text":"STEP 2 · 검색 결과 맨 위에, 내 글이 떠요."}]),
  cut("17", "C17", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"STEP 3 · 글을 읽고, 가게에 가고, 사고, 신청해요."},{"type":"narration","top":95,"align":"right","anchor":"bottom","text":"STEP 4 · 바로 그 순간이, 블로그 주인의 수익이 돼요."}]),
  cut("18", "C18", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"그래서 블로그는 나의 무인점포예요."},{"type":"narration","top":94,"align":"right","anchor":"bottom","text":"내가 자리를 비운 동안에도, 글이 손님을 만나요."}]),
  cut("19", "C19", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"① 사장님은 가게를 알려 줄 글이 필요해요."},{"type":"narration","top":15,"align":"right","anchor":"top","text":"그래서 글 한 편에 원고료를 줘요. 공고에 적힌 원고료, 건당 2만~7만 원."},{"type":"caption","top":97,"align":"center","anchor":"bottom","text":"원고료는 강의 속 사례·공고 기준 · 조건과 시기에 따라 다릅니다"}]),
  cut("20", "C20", [{"type":"narration","top":3,"align":"center","anchor":"top","text":"글 한 편이면, 맛집 식사 · 뷰티 · 호텔 · 생활용품 · 육아용품을 직접 누리는 체험단도 있어요."},{"type":"caption","top":97,"align":"center","anchor":"bottom","text":"체험단은 현금이 아닌 상품·서비스 제공 · 선정과 후기 조건 충족 필요"}]),
  cut("21", "C21", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"② 업체는 상담 고객이 필요해요. 내 글을 보고 신청한 손님 한 명마다 소개비를 줘요.","maxW":58},{"type":"narration","top":91,"align":"center","anchor":"bottom","text":"모집 사이트에 표시된 단가: 상담 신청 건당 최대 21,000원, 입주청소·이사 건당 8,000~24,000원."},{"type":"caption","top":97,"align":"center","anchor":"bottom","text":"사이트 표시 모집 단가 · 인정된 건만 · 승인 조건과 시기에 따라 다릅니다"}]),
  cut("22", "C22", [{"type":"narration","top":56,"align":"left","anchor":"top","text":"③ 판매자는 물건을 팔아 줄 글이 필요해요. 내 상품이 없어도, 소개한 상품이 팔리면 수수료를 받아요."},{"type":"narration","top":88,"align":"right","anchor":"bottom","text":"네이버도 '쇼핑 커넥트'를 정식으로 열었어요."},{"type":"caption","top":97,"align":"center","anchor":"bottom","text":"NAVER 공식 발표 2025.07.23 · 참여·판매 인정 조건 적용"}]),
  cut("23", "C23", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"④ 네이버는 글에 광고를 붙이고, 그 수익을 나눠 줘요."},{"type":"narration","top":70,"align":"right","anchor":"bottom","text":"그리고 창작자를 직접 뽑아 지원해요. 네이버 메이트, 매월 3,000명 선정, 월 30만~1,000만 원."},{"type":"caption","top":97,"align":"center","anchor":"bottom","text":"NAVER 공식 발표 2026.08.07 · 5년 1조 원 투자 2026.05.28(콘텐츠 생태계 전체, 블로그만의 예산 아님)"}]),
  cut("24", "C24", [{"type":"speech","speaker":"민로로","top":1,"align":"left","anchor":"top","text":"읽는 사람은 공짜로 읽고, 돈은 사장님 · 업체 · 판매자 · 네이버가 줘요.","maxW":50,"tail":"down","tailX":78},{"type":"narration","top":94,"align":"left","anchor":"bottom","text":"블로그는, 그 사이를 잇는 자리예요."}]),
  reviewCut("25", "H1", {"header":"먼저 시작한 수강생들 이야기","note":"129 상세 수록 후기 원문 · 닉네임·프로필 가림 · 개인의 경험이며 결과는 사람마다 다릅니다"}),
  reviewCut("26", "H2", {"note":"129 상세 수록 후기 원문 · 닉네임·프로필 가림 · 개인의 경험이며 결과는 사람마다 다릅니다"}),
  reviewCut("27", "H3", {"note":"129 상세 수록 후기 원문 · 닉네임·프로필·멘션 가림 · 개인의 경험이며 결과는 사람마다 다릅니다"}),
  cut("28", "C28", [{"type":"speech","speaker":"민로로","top":30,"align":"left","anchor":"top","text":"그래서 블로그 수익화는, 방향 × 속도예요.","maxW":40,"tail":"up","tailX":78},{"type":"narration","top":92,"align":"left","anchor":"bottom","text":"누가 돈을 주는지 먼저 정하고(방향), AI로 빠르게 실행해요(속도)."}]),
  cut("29", "C29", [{"type":"narration","top":92,"align":"center","anchor":"bottom","text":"검색어 찾기, 상위 글 분석, 초안 쓰기는 AI가. 나는 경험 · 사진 · 사실을 채우고 확인해요."}]),
  textCut("C30", {"lines":["빈 화면에서 한 편에 1~2시간 걸리던 글,","이제 초안은 1분.","나는 확인하고 발행해요."],"highlight":[1],"animation":"typing"}),
  textCut("C31", {"lines":["그리고 블로그는","시작 비용 0원 · 재고도 장비도 없이","한 달이면 돈 벌 수 있는 블로그 세팅","네이버도 지금 창작자를 밀어주는 중"]}),
  cut("32", "C32", [{"type":"speech","speaker":"민로로","top":22,"align":"left","anchor":"top","text":"이런 분이라면, 끝까지 들어 보세요.","maxW":40,"tail":"up","tailX":78},{"type":"narration","top":40,"align":"left","anchor":"top","text":"퇴근 후 월급 외 수입을, 육아와 집안일 사이에, 은퇴 후에도 꾸준히 할 수 있는 수입원을, 초기 투자금 없이 찾는 분."},{"type":"narration","top":90,"align":"right","anchor":"bottom","text":"블로그는 하는데 수익이 없거나, 체험단만 하거나, 강의와 전자책만 쌓인 분."},{"type":"caption","top":97,"align":"center","anchor":"bottom","text":"가장 오래 일한 직장을 그만둔 평균 나이 53.0세 · 국가데이터처 2026.08.05"}]),
  cut("33", "C33", [{"type":"speech","speaker":"민로로","top":1,"align":"left","anchor":"top","text":"라이브에서는 돈이 되는 기준을 보여 드리고, 실제 도구로 글 한 편을 같이 만들어 봐요.","maxW":45,"tail":"down","tailX":78},{"type":"narration","top":80,"align":"left","anchor":"bottom","text":"참여하면 정답지 · 로드맵 · 비밀링크 175개 · AI 분석 미니 봇을 드려요."},{"type":"speech","speaker":"민로로","top":96,"align":"right","anchor":"bottom","text":"그다음, 내 블로그에 적용하는 길은 혼자 가도, 같이 가도 돼요. 라이브를 보고 정하세요.","tail":"up"}]),
  cut("34", "C34", [{"type":"speech","speaker":"민로로","top":1,"align":"left","anchor":"top","text":"무료 강의라도, 여러분의 시간은 쓰니까요.","maxW":42,"tail":"down","tailX":78},{"type":"speech","speaker":"민로로","top":26,"align":"left","anchor":"top","text":"어차피 들을 무료 강의라면, 이번엔 방향부터 잡고 가세요.","maxW":42,"tailX":78}]),
]
