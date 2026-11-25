// 인터뷰 채널 영상 조회수·댓글 수 갱신 (관리자 상품 대시보드) — POST /api/youtube-video-stats
//   { kind, product_id } → 그 상품에 등록한 인터뷰 영상(product_interview_videos)의 제목·조회수·댓글·좋아요를 받아 저장
// 필요한 Vercel 환경변수: YOUTUBE_API_KEY (Google Cloud 의 YouTube Data API v3 키, 공개 데이터 읽기만)
// DB 읽기·쓰기는 요청한 관리자 본인의 로그인 토큰으로 한다 — 관리자만 통과하는 RLS 가 그대로 지켜진다.
// 할당량: videos.list 50개 묶음 1회 = 1 unit (하루 기본 10,000 unit)

export const config = { runtime: 'edge' }

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
const YT_KEY = env.YOUTUBE_API_KEY || ''

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

async function db(path: string, userToken: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${userToken}`,
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  })
}

interface YtItem {
  id: string
  snippet?: { title?: string; channelTitle?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> }
  statistics?: { viewCount?: string; commentCount?: string; likeCount?: string }
}

const num = (v: string | undefined) => (v == null || v === '' ? null : Number(v))

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
  const userToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!userToken) return json({ error: '로그인이 필요합니다.' }, 401)

  const adminRes = await db('rpc/is_admin', userToken, { method: 'POST', body: '{}' })
  if (!adminRes.ok || (await adminRes.json()) !== true) return json({ error: '관리자만 사용할 수 있습니다.' }, 403)

  if (!YT_KEY) {
    return json({ error: '유튜브 API 키가 아직 설정되지 않았습니다 (Vercel 환경변수 YOUTUBE_API_KEY).' }, 400)
  }

  let body: { kind?: string; product_id?: number }
  try {
    body = await request.json()
  } catch {
    return json({ error: '잘못된 요청' }, 400)
  }
  const kind = body.kind === 'ebook' ? 'ebook' : body.kind === 'course' ? 'course' : null
  const productId = Number(body.product_id)
  if (!kind || !Number.isInteger(productId)) return json({ error: '상품 정보가 없습니다.' }, 400)

  const listRes = await db(`product_interview_videos?select=id,video_id&kind=eq.${kind}&product_id=eq.${productId}`, userToken)
  if (!listRes.ok) return json({ error: `영상 목록을 읽지 못했습니다 (HTTP ${listRes.status})` }, 500)
  const videos = (await listRes.json()) as { id: number; video_id: string }[]
  if (videos.length === 0) return json({ updated: 0 })

  // 유튜브에서 50개씩 받아 온다
  const ids = [...new Set(videos.map((v) => v.video_id))]
  const found = new Map<string, YtItem>()
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${chunk.map(encodeURIComponent).join(',')}&key=${encodeURIComponent(YT_KEY)}`,
    )
    const data = (await res.json()) as { items?: YtItem[]; error?: { message?: string } }
    if (!res.ok || data.error) return json({ error: `유튜브 API 오류: ${data.error?.message || `HTTP ${res.status}`}` }, 502)
    for (const it of data.items ?? []) found.set(it.id, it)
  }

  const now = new Date().toISOString()
  let updated = 0
  for (const v of videos) {
    const it = found.get(v.video_id)
    const patch = it
      ? {
          title: it.snippet?.title ?? null,
          channel_title: it.snippet?.channelTitle ?? null,
          published_at: it.snippet?.publishedAt ?? null,
          thumbnail: it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url ?? null,
          view_count: num(it.statistics?.viewCount),
          // 댓글을 막아 둔 영상은 commentCount 가 없다
          comment_count: num(it.statistics?.commentCount),
          like_count: num(it.statistics?.likeCount),
          stats_updated_at: now,
          stats_error: null,
        }
      : { stats_updated_at: now, stats_error: '유튜브에서 영상을 찾지 못했습니다 (비공개·삭제·주소 오류).' }
    const up = await db(`product_interview_videos?id=eq.${v.id}`, userToken, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    })
    if (up.ok) updated++
  }
  return json({ updated, missing: videos.filter((v) => !found.has(v.video_id)).length })
}
