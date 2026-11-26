// 강의 상세의 다른 얼굴(미노출 랜딩) — /c/:slug
// 같은 강의(courseId)의 상세 화면을 그대로 쓰고 제목·면책조항(·이미지 일부)만 바꾼다. 신청·결제·방문 집계는 모두 그 강의로 들어간다.
// 메뉴·목록·검색에 나오지 않고, 서버(api/_lib/render-page.ts)가 noindex 로 내보낸다 — 광고 심사·광고 전용 주소.
// 새로 추가하면 api/_lib/render-page.ts 의 /c/ 주소 목록에도 같은 제목·설명을 넣는다.

export interface CourseVariant {
  courseId: number
  /** 화면·브라우저 탭에 보이는 강의 제목 */
  title: string
  description: string
  /** 홍보 영상(썸네일) 바로 아래 면책조항 — 굵게 */
  topDisclaimer?: string
  /** 상세 이미지 맨 아래 면책조항 */
  bottomDisclaimer?: string
  /** 상세 이미지 바꿔 끼우기 — 원래 주소 → 이 랜딩에서 쓸 주소 (원래 강의 화면은 그대로) */
  imageReplace?: Record<string, string>
}

const DISCLAIMER_HEAD = '* 본 강의는 수익을 보장하는 강의가 아닙니다.'
const DISCLAIMER_TAIL = '개인의 역량에 따라 다르며 실제 수강생 및 강사의 성과 자료입니다.'

export const COURSE_VARIANTS: Record<string, CourseVariant> = {
  // 네이버 GFA 광고용 — 강의 129(민태훈 AI 블로그 무료 특강). 원 제목의 금액 표현이 심사 반려(수익 보장 표현)돼 따로 만듦
  'ai-blog-free': {
    courseId: 129,
    title: 'AI 블로그 수익화 무료 특강',
    description: 'AI 블로그 수익화 무료 온라인 특강',
    topDisclaimer: `${DISCLAIMER_HEAD} 아래 소개 되는 사례는 ${DISCLAIMER_TAIL}`,
    bottomDisclaimer: `${DISCLAIMER_HEAD} 위 소개 되는 사례는 ${DISCLAIMER_TAIL}`,
    imageReplace: {
      // 맨 아래 초록 날짜 카드가 10/23 그대로 → 위 카드(12/11)와 같게 고친 이미지
      'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1791790043990_vam1zyvr.webp': '/c-assets/ai-blog-free/date-card-1211.webp',
    },
  },
}
