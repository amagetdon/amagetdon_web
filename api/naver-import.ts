// 네이버 블로그 글 가져오기 도우미 (관리자 게시판 글쓰기) — 브라우저가 직접 못 받는 것을 서버가 대신 받는다.
//   GET ?url=<블로그 글 주소>   → { html }   글 본문 페이지(PostView)
//   GET ?img=<pstatic 이미지>   → 이미지 바이트 (네이버는 다른 사이트 referrer 면 403 이라 서버가 referrer 없이 받음)
//   GET ?resolve=<짧은 주소>    → { url }    m.site.naver.com·naver.me 짧은 주소의 최종 주소
// 관리자 로그인 토큰이 있어야 하고, 네이버 주소만 받는다(아무 주소나 대신 받아주는 통로가 되지 않게).

export const config = { runtime: 'edge' }

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

async function isAdmin(token: string) {
  if (!token) return false
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}',
  })
  return res.ok && (await res.json()) === true
}

const hostOf = (u: string) => { try { return new URL(u).hostname } catch { return '' } }

/** blog.naver.com/{id}/{logNo} · m.blog.naver.com/... · PostView 주소 → (blogId, logNo) */
function parsePostUrl(u: string): { blogId: string; logNo: string } | null {
  try {
    const url = new URL(u)
    if (!/(^|\.)blog\.naver\.com$/.test(url.hostname)) return null
    const q = url.searchParams
    if (q.get('blogId') && q.get('logNo')) return { blogId: q.get('blogId')!, logNo: q.get('logNo')! }
    const m = url.pathname.match(/^\/([\w-]+)\/(\d+)/)
    return m ? { blogId: m[1], logNo: m[2] } : null
  } catch {
    return null
  }
}

export default async function handler(request: Request): Promise<Response> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!(await isAdmin(token))) return json({ error: '관리자만 사용할 수 있습니다.' }, 403)
  const q = new URL(request.url).searchParams

  try {
    const postUrl = q.get('url')
    if (postUrl) {
      const p = parsePostUrl(postUrl)
      if (!p) return json({ error: '네이버 블로그 글 주소가 아닙니다.' }, 400)
      const res = await fetch(`https://blog.naver.com/PostView.naver?blogId=${encodeURIComponent(p.blogId)}&logNo=${encodeURIComponent(p.logNo)}&redirect=Dlog&widgetTypeCall=true&directAccess=false`, { headers: { 'user-agent': UA } })
      if (!res.ok) return json({ error: `네이버에서 글을 받지 못했습니다 (HTTP ${res.status})` }, 502)
      const html = await res.text()
      if (!html.includes('se-main-container')) return json({ error: '글 본문을 찾지 못했습니다. 비공개 글이거나 예전 편집기로 쓴 글일 수 있어요.' }, 422)
      return json({ html, blogId: p.blogId, logNo: p.logNo })
    }

    const img = q.get('img')
    if (img) {
      if (!/(^|\.)pstatic\.net$/.test(hostOf(img))) return json({ error: '네이버 이미지 주소가 아닙니다.' }, 400)
      const res = await fetch(img, { headers: { 'user-agent': UA } })
      if (!res.ok) return json({ error: `이미지를 받지 못했습니다 (HTTP ${res.status})` }, 502)
      return new Response(res.body, {
        headers: { 'content-type': res.headers.get('content-type') || 'image/jpeg', 'cache-control': 'no-store' },
      })
    }

    // 블로그 정보: 이름·닉네임·프로필 사진·소개·카테고리(글 수)·최근 글 — 블로그형 화면 사이드바용
    const blogId = q.get('blog')
    if (blogId) {
      if (!/^[\w-]{2,40}$/.test(blogId)) return json({ error: '블로그 아이디가 올바르지 않습니다.' }, 400)
      const MUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
      const mget = async (path: string) => {
        const r = await fetch(`https://m.blog.naver.com/api/blogs/${blogId}${path}`, { headers: { 'user-agent': MUA, referer: `https://m.blog.naver.com/${blogId}` } })
        return r.ok ? ((await r.json()) as { result?: Record<string, unknown> }).result ?? null : null
      }
      const [info, cats, list, introHtml] = await Promise.all([
        mget(''),
        mget('/category-list'),
        mget('/post-list?categoryNo=0&itemCount=30&page=1'),
        fetch(`https://blog.naver.com/profile/intro.naver?blogId=${blogId}`, { headers: { 'user-agent': UA } }).then((r) => (r.ok ? r.text() : '')).catch(() => ''),
      ])
      const items = ((list?.items as { titleWithInspectMessage: string; logNo: number; categoryNo: number }[]) ?? [])
      const perCat = new Map<number, number>()
      for (const it of items) perCat.set(it.categoryNo, (perCat.get(it.categoryNo) ?? 0) + 1)
      const catList = ((cats?.mylogCategoryList as { categoryName: string; categoryNo: number; openYN: boolean }[]) ?? [])
        .filter((c) => c.openYN)
        .map((c) => ({ label: c.categoryName, count: perCat.get(c.categoryNo) ?? 0 }))
      const intro = introHtml.match(/<meta property="og:description" content="([^"]*)"/)?.[1] ?? ''
      return json({
        blogTitle: (info?.blogName as string) ?? '',
        nickname: (info?.nickName as string) ?? '',
        profileImage: (info?.profileImagePath as string) ?? '',
        description: intro.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
        categories: [{ label: '전체보기', count: items.length }, ...catList],
        recent: items.slice(0, 5).map((i) => ({ title: i.titleWithInspectMessage, logNo: String(i.logNo) })),
      })
    }

    const short = q.get('resolve')
    if (short) {
      if (!/^(m\.site\.naver\.com|naver\.me|link\.naver\.com)$/.test(hostOf(short))) return json({ url: short })
      const res = await fetch(short, { headers: { 'user-agent': UA }, redirect: 'follow' })
      return json({ url: res.url || short })
    }

    return json({ error: '알 수 없는 요청' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 502)
  }
}
