// 받은 HTML 그대로 쓰는 랜딩(메뉴·검색에 안 나오는 화면) 설정 — /lp/:slug
// 화면은 public/lp-assets/<slug>/index.html 을 꽉 찬 화면으로 띄운다. 앱 안에서 띄워 UTM·유입 경로 기록과 픽셀이 그대로 동작한다.
// 결제·문의 버튼 주소는 각 index.html 맨 아래 CONFIG.links 와 .y-ask 에 넣는다.

export interface StaticLanding {
  /** 정적 화면 주소 */
  src: string
  title: string
  description: string
}

const EUNWOO_REPLAY = {
  title: '인스타 알고리즘 마스터클래스 · 다시보기 + 전자책',
  description: '누적 매출 20억, 유료 수강생 500명. 은퇴한 콘텐츠 제작자 은우의 400만원대 강의, 이제 다시보기와 전자책으로만 만날 수 있습니다.',
}

export const STATIC_LANDINGS: Record<string, StaticLanding> = {
  // 은우 다시보기 — 실천조사 참여자용(할인가 결제)
  'eunwoo-replay-p': { ...EUNWOO_REPLAY, src: '/lp-assets/eunwoo-replay-p/index.html' },
  // 은우 다시보기 — 미참여자용(정가 결제 + 실천조사 안내)
  'eunwoo-replay-n': { ...EUNWOO_REPLAY, src: '/lp-assets/eunwoo-replay-n/index.html' },
}
