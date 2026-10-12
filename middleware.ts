import { next, rewrite } from '@vercel/edge'
import { normalizePath, shouldRender } from './api/_lib/render-page'

export const config = {
  matcher: '/((?!api|assets|favicon|logo|.*\\.(?:webp|png|jpg|jpeg|gif|svg|ico|css|js|map|woff2?|ttf|json|txt|xml|html)$).*)',
}

// 공개 페이지는 사람·검색엔진·AI·SNS 미리보기 모두 같은 HTML 을 받는다 (SEO 2단계, A′ 방식).
// /api/page 가 빌드된 index.html 에 페이지별 제목·설명·OG·canonical·JSON-LD 와 본문(#root 안)을 채워 돌려주고
// (CDN 5분 보관), React 가 뜨면 #root 를 앱 화면으로 교체한다. 회원·관리자·결제 경로와 실제 파일은 그대로(next()).
export default function middleware(request: Request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return next()
  try {
    const path = normalizePath(new URL(request.url).pathname)
    if (!shouldRender(path)) return next()
    const dest = new URL('/api/page', request.url)
    dest.searchParams.set('path', path)
    return rewrite(dest)
  } catch {
    return next()
  }
}
