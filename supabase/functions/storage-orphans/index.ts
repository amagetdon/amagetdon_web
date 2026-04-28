// Storage 의 orphan 파일(어느 DB 컬럼에서도 참조하지 않는 파일) 을 찾아주거나 일괄 삭제.
// admin 만 호출 가능. service_role 토큰 또는 admin 사용자 JWT.
//
// POST 본문:
//   { action: 'buckets' }         → 검사 대상 버킷 목록 반환 (클라이언트 진행률 표시용)
//   { action: 'list' }            → 모든 버킷 일괄 스캔 (legacy, 큰 사이트에선 느림)
//   { action: 'list', bucket: 'courses' }
//                                  → 해당 버킷만 스캔 — 클라이언트가 버킷 단위로 호출하며 진행률 표시
//   { action: 'delete', items: [{ bucket, path }, ...] }
//                                  → 지정된 파일들 일괄 삭제
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

type ListItem = { bucket: string; path: string; size: number; updated_at: string | null; publicUrl: string }

// 검사할 버킷 목록
const BUCKETS = ['courses', 'ebooks', 'instructors', 'banners', 'coupons', 'achievements', 'results']

// 재귀적으로 버킷 내 모든 파일 path 수집
async function listAllFiles(supabase: ReturnType<typeof createClient>, bucket: string): Promise<Array<{ path: string; size: number; updated_at: string | null }>> {
  const out: Array<{ path: string; size: number; updated_at: string | null }> = []
  const stack: string[] = ['']
  while (stack.length > 0) {
    const prefix = stack.pop()!
    let offset = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset })
      if (error) {
        // 버킷이 없거나 권한 없으면 skip
        return out
      }
      const rows = (data ?? []) as Array<{ name: string; id: string | null; metadata: { size?: number } | null; updated_at: string | null }>
      if (rows.length === 0) break
      for (const r of rows) {
        // id 가 null 이면 디렉토리 — 재귀
        if (r.id == null) {
          stack.push(prefix ? `${prefix}/${r.name}` : r.name)
        } else {
          const fullPath = prefix ? `${prefix}/${r.name}` : r.name
          out.push({ path: fullPath, size: r.metadata?.size ?? 0, updated_at: r.updated_at })
        }
      }
      if (rows.length < PAGE) break
      offset += PAGE
    }
  }
  return out
}

// DB 에서 storage 를 참조하는 모든 URL 수집
async function collectReferencedUrls(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  const refs = new Set<string>()

  const addJson = (val: unknown) => {
    if (!val) return
    const s = typeof val === 'string' ? val : JSON.stringify(val)
    // /storage/v1/object/public/<bucket>/<path>  또는 /storage/v1/render/image/public/<bucket>/<path>
    const re = /\/storage\/v1\/(?:object|render\/image)\/public\/([^/\s"]+)\/([^"\s?#]+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(s)) !== null) {
      refs.add(`${m[1]}/${m[2]}`)
    }
  }

  // courses: thumbnail, landing, video, seo (json)
  {
    const { data } = await supabase.from('courses').select('thumbnail_url, landing_image_url, video_url, seo')
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      addJson(r.thumbnail_url); addJson(r.landing_image_url); addJson(r.video_url); addJson(r.seo)
    }
  }
  // ebooks
  {
    const { data } = await supabase.from('ebooks').select('thumbnail_url, landing_image_url, file_url, seo')
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      addJson(r.thumbnail_url); addJson(r.landing_image_url); addJson(r.file_url); addJson(r.seo)
    }
  }
  // instructors
  {
    const { data } = await supabase.from('instructors').select('profile_image_url, hero_portrait_url')
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      addJson(r.profile_image_url); addJson(r.hero_portrait_url)
    }
  }
  // hero_banners
  try {
    const { data } = await supabase.from('hero_banners').select('image_url, poster_url')
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      addJson(r.image_url); addJson(r.poster_url)
    }
  } catch { /* 테이블 없을 수 있음 */ }
  // event_banners
  try {
    const { data } = await supabase.from('event_banners').select('image_url')
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      addJson(r.image_url)
    }
  } catch { /* 테이블 없을 수 있음 */ }
  // coupons
  try {
    const { data } = await supabase.from('coupons').select('banner_image_url')
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      addJson(r.banner_image_url)
    }
  } catch { /* 무시 */ }
  // achievements
  try {
    const { data } = await supabase.from('achievements').select('image_url')
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      addJson(r.image_url)
    }
  } catch { /* 무시 */ }
  // review_results
  try {
    const { data } = await supabase.from('review_results').select('thumbnail_url')
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      addJson(r.thumbnail_url)
    }
  } catch { /* 무시 */ }
  // landing_categories seo
  try {
    const { data } = await supabase.from('landing_categories').select('seo')
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      addJson(r.seo)
    }
  } catch { /* 무시 */ }
  // site_settings (key/value json) - SEO/branding/footer 등
  try {
    const { data } = await supabase.from('site_settings').select('value')
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      addJson(r.value)
    }
  } catch { /* 무시 */ }

  return refs
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authorization header missing' }, 401)
    const token = authHeader.replace('Bearer ', '')

    // service_role 또는 admin 사용자만 허용
    let isServiceRole = token === serviceKey
    if (!isServiceRole) {
      try {
        const probe = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
          headers: { 'Authorization': `Bearer ${token}`, 'apikey': token },
        })
        if (probe.ok) isServiceRole = true
      } catch { /* ignore */ }
    }
    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
      const { data: userRes, error } = await userClient.auth.getUser(token)
      if (error || !userRes.user) return json({ error: 'invalid auth' }, 401)
      const { data: prof } = await userClient.from('profiles').select('role').eq('id', userRes.user.id).maybeSingle()
      if ((prof as { role?: string } | null)?.role !== 'admin') return json({ error: 'admin only' }, 403)
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({})) as { action?: string; bucket?: string; items?: Array<{ bucket: string; path: string }> }

    if (body.action === 'buckets') {
      return json({ status: 'ok', buckets: BUCKETS })
    }

    if (body.action === 'delete') {
      const items = body.items ?? []
      if (!Array.isArray(items) || items.length === 0) return json({ error: 'items required' }, 400)
      // 버킷별 그룹핑 후 일괄 remove
      const grouped = new Map<string, string[]>()
      for (const it of items) {
        if (!BUCKETS.includes(it.bucket)) continue
        if (!grouped.has(it.bucket)) grouped.set(it.bucket, [])
        grouped.get(it.bucket)!.push(it.path)
      }
      const results: Array<{ bucket: string; deleted: number; error?: string }> = []
      for (const [bucket, paths] of grouped) {
        const { error } = await supabase.storage.from(bucket).remove(paths)
        results.push({ bucket, deleted: error ? 0 : paths.length, error: error?.message })
      }
      return json({ status: 'ok', results })
    }

    // action: 'list' (기본)
    // bucket 파라미터 있으면 해당 버킷만, 없으면 전체
    const targetBuckets = body.bucket ? [body.bucket].filter((b) => BUCKETS.includes(b)) : BUCKETS
    const referenced = await collectReferencedUrls(supabase)

    const orphans: ListItem[] = []
    let totalSize = 0
    let scannedCount = 0
    for (const bucket of targetBuckets) {
      const files = await listAllFiles(supabase, bucket)
      scannedCount += files.length
      for (const f of files) {
        const key = `${bucket}/${f.path}`
        if (referenced.has(key)) continue
        const { data } = supabase.storage.from(bucket).getPublicUrl(f.path)
        orphans.push({ bucket, path: f.path, size: f.size, updated_at: f.updated_at, publicUrl: data.publicUrl })
        totalSize += f.size
      }
    }

    return json({
      status: 'ok',
      scanned: scannedCount,
      referenced: referenced.size,
      orphan_count: orphans.length,
      orphan_total_bytes: totalSize,
      orphans,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
