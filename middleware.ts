import { next } from '@vercel/edge'

export const config = {
  matcher: '/((?!api|assets|favicon|logo|.*\\.(?:webp|png|jpg|jpeg|gif|svg|ico|css|js|map|woff2?|ttf|json|txt|xml)$).*)',
}

// 링크 미리보기(OG) 크롤러만 매칭. 카카오톡 인앱 브라우저는 UA 에 `KAKAOTALK` 토큰이 있지만
// 실제 사용자이므로 제외 — 크롤러 전용 UA(`kakaotalk-scrap`)만 잡는다. (LINE 도 `line-poker` 로 동일)
const BOT_UA = /kakaotalk-scrap|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|slack-imgproxy|discordbot|telegrambot|whatsapp|yeti|naverbot|googlebot|bingbot|duckduckbot|baiduspider|applebot|petalbot|bytespider|line-poker/i

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || ''

type Og = {
  title: string
  description: string
  image: string
  url: string
  siteName: string
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

async function sbRest<T>(path: string): Promise<T | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        accept: 'application/json',
      },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

type SiteSettingsRow = { value: { title?: string; ogTitle?: string; ogDescription?: string; description?: string; ogImage?: string } }
type CourseRow = { title: string; thumbnail_url: string | null; seo: { title?: string; description?: string; ogTitle?: string; ogDescription?: string; ogImage?: string } | null }
type EbookRow = { title: string; thumbnail_url: string | null; seo: { title?: string; description?: string; ogTitle?: string; ogDescription?: string; ogImage?: string } | null }
type LandingRow = { title: string; seo: { title?: string; description?: string; ogTitle?: string; ogDescription?: string; ogImage?: string } | null }

async function getDefaults(siteUrl: string): Promise<Og> {
  const rows = await sbRest<SiteSettingsRow[]>(
    `site_settings?key=eq.seo_settings&select=value`
  )
  const s = rows?.[0]?.value || {}
  return {
    title: s.ogTitle || s.title || '아마겟돈 클래스',
    description: s.ogDescription || s.description || '',
    image: s.ogImage || '',
    url: siteUrl,
    siteName: s.title || '아마겟돈 클래스',
  }
}

async function getCourseOg(id: string, base: Og, fullUrl: string): Promise<Og> {
  const rows = await sbRest<CourseRow[]>(
    `courses?id=eq.${encodeURIComponent(id)}&is_published=eq.true&select=title,thumbnail_url,seo&limit=1`
  )
  const row = rows?.[0]
  if (!row) return { ...base, url: fullUrl }
  const seo = row.seo || {}
  return {
    title: seo.ogTitle || seo.title || row.title || base.title,
    description: seo.ogDescription || seo.description || base.description,
    image: seo.ogImage || row.thumbnail_url || base.image,
    url: fullUrl,
    siteName: base.siteName,
  }
}

async function getEbookOg(id: string, base: Og, fullUrl: string): Promise<Og> {
  const rows = await sbRest<EbookRow[]>(
    `ebooks?id=eq.${encodeURIComponent(id)}&is_published=eq.true&select=title,thumbnail_url,seo&limit=1`
  )
  const row = rows?.[0]
  if (!row) return { ...base, url: fullUrl }
  const seo = row.seo || {}
  return {
    title: seo.ogTitle || seo.title || row.title || base.title,
    description: seo.ogDescription || seo.description || base.description,
    image: seo.ogImage || row.thumbnail_url || base.image,
    url: fullUrl,
    siteName: base.siteName,
  }
}

async function getLandingOg(slug: string, base: Og, fullUrl: string): Promise<Og> {
  const rows = await sbRest<LandingRow[]>(
    `landing_categories?slug=eq.${encodeURIComponent(slug)}&select=title,seo&limit=1`
  )
  const row = rows?.[0]
  if (!row) return { ...base, url: fullUrl }
  const seo = row.seo || {}
  return {
    title: seo.ogTitle || seo.title || row.title || base.title,
    description: seo.ogDescription || seo.description || base.description,
    image: seo.ogImage || base.image,
    url: fullUrl,
    siteName: base.siteName,
  }
}

function renderHtml(og: Og): string {
  const t = escapeHtml(og.title)
  const d = escapeHtml(og.description)
  const img = escapeHtml(og.image)
  const u = escapeHtml(og.url)
  const site = escapeHtml(og.siteName)
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${t}</title>
<meta name="description" content="${d}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${site}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
${img ? `<meta property="og:image" content="${img}" />` : ''}
<meta property="og:url" content="${u}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
${img ? `<meta name="twitter:image" content="${img}" />` : ''}
<link rel="canonical" href="${u}" />
</head>
<body><p><a href="${u}">${t}</a></p></body>
</html>`
}

async function resolveOg(url: URL): Promise<Og> {
  const fullUrl = url.origin + url.pathname
  const base = await getDefaults(fullUrl)
  const segs = url.pathname.split('/').filter(Boolean)
  if (segs.length === 0) return base
  if (segs[0] === 'course' && segs[1]) return getCourseOg(segs[1], base, fullUrl)
  if (segs[0] === 'ebook' && segs[1]) return getEbookOg(segs[1], base, fullUrl)
  if (segs[0] === 'landing' && segs[1]) return getLandingOg(segs[1], base, fullUrl)
  return { ...base, url: fullUrl }
}

export default async function middleware(request: Request) {
  const ua = request.headers.get('user-agent') || ''
  if (!BOT_UA.test(ua)) return next()

  try {
    const url = new URL(request.url)
    const og = await resolveOg(url)
    const html = renderHtml(og)
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=600',
        'x-og-source': 'edge-middleware',
      },
    })
  } catch {
    return next()
  }
}
