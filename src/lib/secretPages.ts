// 시크릿 페이지(메뉴·검색에 안 나오는 광고 전용 화면) 설정 — /s/:slug
// 화면은 public/secret-assets/<slug>/index.html (받은 HTML 을 그대로 쪼갠 정적 파일)을 꽉 찬 화면으로 띄우고,
// 마지막 '무료 강의 신청하기'를 누르면 이 사이트가 129 상세와 같은 흐름으로 신청·추적한다(SecretGamePage).
// 신청 대상 강의는 여기 courseId 한 곳만 바꾸면 된다.

export interface SecretPage {
  /** 무료 신청할 강의 id */
  courseId: number
  /** 정적 화면 주소 */
  src: string
  /** 전환 추적의 content_subcategory(어디서 신청했는지 구분용) */
  trackingLabel: string
}

export const SECRET_PAGES: Record<string, SecretPage> = {
  // 사주 포맷 미니게임 → 민태훈 AI 블로그 수익화 1기(10/23 라이브). 2026-10-21 대표님 지시
  'minroro-saju': {
    courseId: 129,
    src: '/secret-assets/minroro-saju/index.html',
    trackingLabel: '시크릿: 사주 포맷',
  },
}
