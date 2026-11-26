// 강의 상세의 다른 얼굴(미노출 랜딩) — /c/:slug
// 같은 강의(courseId)의 상세 화면을 그대로 쓰고 제목·면책조항만 바꾼다. 신청·결제·방문 집계는 모두 그 강의로 들어간다.
// 메뉴·목록·검색에 나오지 않고, 서버(api/_lib/render-page.ts)가 noindex 로 내보낸다 — 광고 심사·광고 전용 주소.
// 새로 추가하면 api/_lib/render-page.ts 의 /c/ 주소 목록(COURSE_VARIANT_SEO)에도 같은 제목·설명을 넣는다.

export interface CourseVariant {
  courseId: number
  /** 화면·브라우저 탭에 보이는 강의 제목 */
  title: string
  description: string
  /** 상세 맨 위·맨 아래에 작게 넣는 면책조항 */
  disclaimer?: string
}

export const COURSE_VARIANTS: Record<string, CourseVariant> = {
  // 네이버 GFA 광고용 — 강의 129(민태훈 AI 블로그 무료 특강). 원 제목의 금액 표현이 심사 반려(수익 보장 표현)돼 따로 만듦
  'ai-blog-free': {
    courseId: 129,
    title: 'AI 블로그 수익화 무료 특강',
    description: 'AI 블로그 수익화 무료 온라인 특강',
    disclaimer: '* 본 강의는 수익을 보장하는 강의가 아닙니다. 아래 소개 되는 사례는 개인의 역량에 따라 다르며 실제 수강생 및 강사의 성과 자료입니다.',
  },
}
