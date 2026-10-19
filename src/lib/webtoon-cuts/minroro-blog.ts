// 자동 생성 — scripts/webtoon-dialogue.mjs (대사목록_v72.json). 직접 고치지 말고 대사 목록을 고쳐 다시 만든다.
import type { Bubble, WebtoonCut } from '../webtoonLandings'

const BASE = '/webtoon/minroro-blog'
const R = 1376 / 768
const cut = (n: string, id: string, bubbles: Bubble[]): WebtoonCut => ({ id, src: `${BASE}/${n}.webp`, ratio: R, bubbles })
const textCut = (id: string, card: NonNullable<WebtoonCut['card']>): WebtoonCut => ({
  id, ratio: R, bubbles: [], card: { ...card, images: card.images?.map((n) => `${BASE}/${n}.webp`) },
})

export const CUTS: WebtoonCut[] = [
  cut("01", "K01", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"지금, 세상이 좀 이상해."}]),
  cut("02", "K02", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"사람들이 고액 강의를 줄 서서 사거든."}]),
  cut("03", "K03", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"누군가는 이 흐름을 나쁘게 보지만,"},{"type":"narration","top":18,"align":"right","anchor":"top","text":"사실, 그냥 자연스러운 현상이지."}]),
  cut("04", "K04", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"돈이라는 건 모든 인간이 갈망하는 것. 그걸 가지게 해 준다는 안내는, 당연히 달콤하고.","maxW":55}]),
  cut("05", "K05", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"특히 은퇴가 다가와 새 일자리를 구하기 어려운 세대에게,"},{"type":"narration","top":30,"align":"right","anchor":"top","text":"'집에서 노트북 한 대로 월 300'이라는 유혹은, 뿌리치기 쉽지 않은 게 당연해."}]),
  cut("06", "K06", [{"type":"dark_box","top":40,"align":"center","anchor":"top","text":"하지만, 그게 마냥 옳을까?"},{"type":"narration","top":94,"align":"center","anchor":"bottom","text":"아니. 문제는 따로 있어."}]),
  textCut("K07", {"lines":["요즘 고액 강의가 문제 되는 지점은, 크게 두 가지.","하나, 말처럼 쉽지 않다.","둘, 가르치는 사람의 자질."]}),
  cut("08", "K08", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"쇼핑쇼츠는 영상을 만들고, 편집하고, 올리는 것부터 일인데,"},{"type":"narration","top":18,"align":"right","anchor":"top","text":"조회수가 언제 나올지는 기약이 없지."}]),
  textCut("K09", {"lines":["쿠팡 파트너스 같은 판매 수수료형 부업은,","팔려도 대부분 판매가의 3% 내외.","이걸로 꾸준히 월 300?","확률이 너무 낮아."]}),
  cut("10", "K10", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"자사몰이나 건기식처럼 내 제품을 파는 방식도 마찬가지.","maxW":55},{"type":"narration","top":95,"align":"left","anchor":"bottom","text":"만들고 가져오는 비용, 팔기 위한 광고비."}]),
  cut("11", "K11", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"운 좋게 잘 팔려도, 경쟁자가 너무 빨리 생기지."}]),
  cut("12", "K12", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"애초에 이런 방식은 '누구나 집에서 노트북 한 대로'와 맞지 않아."}]),
  cut("13", "K13", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"돈을 조금 벌면, 너도나도 강의를 만들어 팔고,"}]),
  cut("14", "K14", [{"type":"narration","top":3,"align":"left","anchor":"top","text":"수강생 케어는 뒷전. 일단 팔고, 과정이 빨리 끝나기만 기다리지."}]),
  cut("15", "K15", [{"type":"narration","top":3,"align":"right","anchor":"top","text":"모든 게 처음인 수강생은,","maxW":50},{"type":"narration","top":95,"align":"right","anchor":"bottom","text":"이 늪에서 엄청난 좌절과 상실을 느끼고."}]),
  cut("16", "K16", [{"type":"speech","speaker":"민로로","top":36,"align":"right","anchor":"top","text":"아, 그런데 이런 말을 하는 내가 누구냐고?","maxW":40,"tail":"up","tailX":22}]),
  cut("17", "K17", [{"type":"speech","speaker":"민로로","top":1,"align":"left","anchor":"top","text":"난 민태훈.","maxW":40,"tail":"down","tailX":78},{"type":"narration","top":99,"align":"center","anchor":"bottom","text":"광고대행사 민컴퍼니를 비롯해 법인 3개, 개인사업자 3개를 운영하며, 02년생임에도 누적 350억 원을 달성했다."},{"type":"caption","top":97,"align":"center","anchor":"bottom","text":"광고+커머스+교육 사업 합산 매출"}]),
  cut("18", "K18", [{"type":"speech","speaker":"민로로","top":96,"align":"left","anchor":"bottom","text":"그리고 내 모든 시작에는, 항상 네이버 블로그가 있었지.","maxW":45,"tail":"up","tailX":78},{"type":"caption","top":97,"align":"center","anchor":"bottom","text":"2013년 초등학교 6학년, 게임 블로그로 시작"}]),
  cut("19", "K19", [{"type":"speech","speaker":"민로로","top":1,"align":"right","anchor":"top","text":"네가 돈을 못 번 이유? 노력이 부족해서가 아니야.","maxW":45,"tail":"down","tailX":22},{"type":"speech","speaker":"민로로","top":96,"align":"right","anchor":"bottom","text":"방향이 틀렸던 거지.","tail":"up"}]),
  cut("20", "K20", [{"type":"speech","speaker":"민로로","top":1,"align":"left","anchor":"top","text":"블로그 수익화는 방향 × 속도.","maxW":40,"tail":"down","tailX":78},{"type":"narration","top":96,"align":"center","anchor":"bottom","text":"누가, 무엇에 돈을 주는지 먼저 보고. AI로 빠르게 실행한다."}]),
  cut("21", "K21", [{"type":"speech","speaker":"민로로(화면 밖)","top":1,"align":"left","anchor":"top","text":"글을 읽는 사람은 돈을 안 내. 돈 주는 사람이 따로 있지.","maxW":50},{"type":"narration","top":98,"align":"center","anchor":"bottom","text":"가게를 알리고 싶은 사장님, 손님이 필요한 업체, 물건을 팔고 싶은 판매자, 그리고 네이버."}]),
  textCut("K22", {"lines":["시작 비용 0원. 재고도, 장비도 없이 글 한 편부터.","글 한 편? AI로 초안 1분.","네이버는 지금 창작자에게 돈을 뿌리는 중.","네이버 메이트, 매월 3,000명, 월 30만~1,000만 원."],"note":"NAVER 공식 발표 2026.08.07 · 조건 적용"}),
  cut("23", "K23", [{"type":"speech","speaker":"민로로","top":1,"align":"left","anchor":"top","text":"네 인생이 아무리 꼬였어도 겁먹을 거 없어.","maxW":40,"tail":"down","tailX":78},{"type":"narration","top":96,"align":"center","anchor":"bottom","text":"막힌 길을 뚫고, 순서를 바로잡는 게 내 일이니까."}]),
  cut("24", "K24", [{"type":"speech","speaker":"민로로","top":1,"align":"left","anchor":"top","text":"더는 혼자 헤매지 마.","maxW":38,"tail":"down","tailX":78},{"type":"speech","speaker":"민로로","top":30,"align":"left","anchor":"top","text":"안쪽은, 내가 직접 풀어 주지.","maxW":40,"tailX":78}]),
]
