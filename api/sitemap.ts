// /sitemap.xml (vercel.json rewrite) — 공개 페이지 목록을 요청 시 DB 에서 만들어 응답(캐시 1시간).
// 빌드 없이 강의·전자책·강사·뉴스레터 글 추가/마감이 자동 반영된다.
import { SITE, getPublicData } from './_lib/public-data'

export const config = { runtime: 'edge' }

// 로그인 없이 보이는 고정 공개 페이지 (robots.txt 에서 막는 경로는 넣지 않음)
const STATIC_PATHS = [
  '/', '/academy', '/academy/free', '/academy/premium', '/instructors', '/reviews', '/results',
  '/ebooks/free', '/ebooks/secret', '/board', '/faq', '/notice', '/privacy', '/terms',
]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '')

export default async function handler(): Promise<Response> {
  const d = await getPublicData()
  const urls: { loc: string; lastmod?: string }[] = [
    ...STATIC_PATHS.map((p) => ({ loc: SITE + p })),
    ...d.courses.map((c) => ({ loc: `${SITE}/course/${c.id}`, lastmod: day(c.updated_at) })),
    ...d.ebooks.map((e) => ({ loc: `${SITE}/ebook/${e.id}`, lastmod: day(e.updated_at) })),
    ...d.instructors.map((i) => ({ loc: `${SITE}/instructors/${i.id}`, lastmod: day(i.updated_at) })),
    ...d.board.map((b) => ({ loc: `${SITE}/board/${b.id}`, lastmod: day(b.created_at) })),
  ]
  const body = urls
    .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
