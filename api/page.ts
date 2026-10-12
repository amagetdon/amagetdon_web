// 공개 페이지 HTML (middleware.ts 가 이 함수로 리라이트) — 응답은 CDN 이 5분간 보관해 빠르게 내보낸다.
import { renderPage } from './_lib/render-page'

export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  const path = new URL(request.url).searchParams.get('path') || '/'
  return renderPage(request, path)
}
