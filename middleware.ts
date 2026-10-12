import { next } from '@vercel/edge'
import { renderPage } from './api/_lib/render-page'

export const config = {
  // .html 은 제외 — 아래에서 /index.html 을 가져올 때 미들웨어가 다시 돌지 않게
  matcher: '/((?!api|assets|favicon|logo|.*\\.(?:webp|png|jpg|jpeg|gif|svg|ico|css|js|map|woff2?|ttf|json|txt|xml|html)$).*)',
}

// 공개 페이지는 사람·검색엔진·AI·SNS 미리보기 모두 같은 HTML 을 받는다 (SEO 2단계, A′ 방식).
// 빌드된 index.html 에 페이지별 제목·설명·OG·canonical·JSON-LD 와 본문(#root 안)을 채워 돌려주고,
// React 가 뜨면 #root 를 앱 화면으로 교체한다. 회원·관리자·결제 경로는 손대지 않는다(next()).
// 어떤 이유로든 실패하면 next() 로 원래 SPA 를 그대로 내보낸다 — 사이트가 멈추는 일은 없게.
export default async function middleware(request: Request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return next()
  try {
    const res = await renderPage(request)
    return res ?? next()
  } catch {
    return next()
  }
}
