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
//
// 한 번이라도 select 에 실패하면 reference 집합이 불완전해져서 멀쩡한 파일이 orphan 으로 잡힐 수 있다.
// 따라서 (a) 실제 스키마에 존재하는 컬럼만 조회하고, (b) 필수 테이블 쿼리가 실패하면 throw 해서
// 스캔 자체를 중단시킨다.
async function collectReferencedUrls(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  const refs = new Set<string>()

  const addJson = (val: unknown) => {
    if (val == null) return
    if (Array.isArray(val)) {
      for (const v of val) addJson(v)
      return
    }
    const s = typeof val === 'string' ? val : JSON.stringify(val)
    // /storage/v1/object/public/<bucket>/<path>  또는 /storage/v1/render/image/public/<bucket>/<path>
    const re = /\/storage\/v1\/(?:object|render\/image)\/public\/([^/\s"]+)\/([^"\s?#]+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(s)) !== null) {
      refs.add(`${m[1]}/${m[2]}`)
    }
  }

  // 필수 테이블: 실패 시 throw — 잘못된 reference 집합으로 잘못된 파일을 지우는 사고를 막음.
  const required = async (
    table: string,
    columns: string,
    extract: (r: Record<string, unknown>) => void,
  ) => {
    const { data, error } = await supabase.from(table).select(columns)
    if (error) {
      throw new Error(`[storage-orphans] ${table} reference 수집 실패: ${error.message} — 스캔 중단`)
    }
    for (const r of (data ?? []) as Array<Record<string, unknown>>) extract(r)
  }

  // 선택 테이블: 미존재(테이블 자체가 없는 환경) 만 무시하고, 그 외 에러는 throw.
  const optional = async (
    table: string,
    columns: string,
    extract: (r: Record<string, unknown>) => void,
  ) => {
    const { data, error } = await supabase.from(table).select(columns)
    if (error) {
      // PostgREST 에러 코드 — "PGRST205": Could not find the table — 테이블 없음만 무시
      const msg = error.message || ''
      const code = (error as { code?: string }).code || ''
      const isMissingTable = code === 'PGRST205' || /could not find the table/i.test(msg) || /relation .* does not exist/i.test(msg)
      if (isMissingTable) return
      throw new Error(`[storage-orphans] ${table} reference 수집 실패: ${msg} — 스캔 중단`)
    }
    for (const r of (data ?? []) as Array<Record<string, unknown>>) extract(r)
  }

  // courses
  await required('courses', 'thumbnail_url, landing_image_url, landing_image_urls, video_url, seo', (r) => {
    addJson(r.thumbnail_url); addJson(r.landing_image_url); addJson(r.landing_image_urls); addJson(r.video_url); addJson(r.seo)
  })
  // ebooks
  await required('ebooks', 'thumbnail_url, landing_image_url, landing_image_urls, file_url, seo', (r) => {
    addJson(r.thumbnail_url); addJson(r.landing_image_url); addJson(r.landing_image_urls); addJson(r.file_url); addJson(r.seo)
  })
  // instructors — 실제 컬럼: image_url, thumbnail_url, hero_portrait_url
  await required('instructors', 'image_url, thumbnail_url, hero_portrait_url', (r) => {
    addJson(r.image_url); addJson(r.thumbnail_url); addJson(r.hero_portrait_url)
  })
  // banners — 단일 테이블, page_key 로 home/results/reviews 등 구분
  await required('banners', 'image_url, video_url', (r) => {
    addJson(r.image_url); addJson(r.video_url)
  })
  // results — 후기/성과 사례 (구 review_results 가 아님)
  await required('results', 'image_url, video_url', (r) => {
    addJson(r.image_url); addJson(r.video_url)
  })
  // faqs — 첨부 파일/영상
  await required('faqs', 'video_url, file_url', (r) => {
    addJson(r.video_url); addJson(r.file_url)
  })
  // curriculum_items — 영상 (외부 URL 위주이지만 storage 일 수도 있음)
  await required('curriculum_items', 'video_url', (r) => {
    addJson(r.video_url)
  })
  // coupons — 배너 이미지
  await required('coupons', 'banner_image_url', (r) => {
    addJson(r.banner_image_url)
  })
  // achievements — 이미지
  await required('achievements', 'image_url', (r) => {
    addJson(r.image_url)
  })
  // landing_categories — SEO json
  await required('landing_categories', 'seo', (r) => {
    addJson(r.seo)
  })
  // site_settings — 모든 value json (SEO/branding/footer 등)
  await optional('site_settings', 'value', (r) => {
    addJson(r.value)
  })

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
