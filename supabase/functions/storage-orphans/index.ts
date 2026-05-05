// Storage 의 orphan 파일(어느 DB 컬럼에서도 참조하지 않는 파일) 을 찾아주거나 일괄 삭제.
// admin 만 호출 가능. service_role 토큰 또는 admin 사용자 JWT.
//
// Supabase Storage 7개 버킷 + Cloudflare R2 (external_storage_config 활성 시) 모두 스캔.
//
// POST 본문:
//   { action: 'buckets' }
//     → 검사 대상 버킷 목록 반환. [{ source: 'supabase'|'r2', name }, ...]
//   { action: 'list', source: 'supabase'|'r2', bucket }
//     → 해당 버킷만 스캔
//   { action: 'delete', items: [{ source, bucket, path }, ...] }
//     → 지정된 파일들 삭제
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

type ListItem = {
  source: 'supabase' | 'r2'
  bucket: string
  path: string
  size: number
  updated_at: string | null
  publicUrl: string
}

type BucketSpec = { source: 'supabase' | 'r2'; name: string }

// Supabase 검사 대상 버킷 목록
const SUPABASE_BUCKETS = ['courses', 'ebooks', 'instructors', 'banners', 'coupons', 'achievements', 'results']

interface R2Config {
  enabled: boolean
  account_id: string
  bucket: string
  endpoint: string
  access_key_id: string
  secret_access_key: string
  public_base_url: string | null
}

async function loadR2Config(supabase: ReturnType<typeof createClient>): Promise<R2Config | null> {
  const { data } = await supabase.from('external_storage_config').select('*').eq('id', 'r2').maybeSingle()
  if (!data) return null
  const r = data as Record<string, string | boolean | null>
  if (!r.enabled || !r.bucket || !r.endpoint || !r.access_key_id || !r.secret_access_key) return null
  return {
    enabled: !!r.enabled,
    account_id: (r.account_id as string) || '',
    bucket: (r.bucket as string) || '',
    endpoint: (r.endpoint as string) || '',
    access_key_id: (r.access_key_id as string) || '',
    secret_access_key: (r.secret_access_key as string) || '',
    public_base_url: (r.public_base_url as string) || null,
  }
}

// Supabase Storage 의 버킷 내 모든 파일 path 수집
async function listAllFilesSupabase(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
): Promise<Array<{ path: string; size: number; updated_at: string | null }>> {
  const out: Array<{ path: string; size: number; updated_at: string | null }> = []
  const stack: string[] = ['']
  while (stack.length > 0) {
    const prefix = stack.pop()!
    let offset = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset })
      if (error) return out
      const rows = (data ?? []) as Array<{ name: string; id: string | null; metadata: { size?: number } | null; updated_at: string | null }>
      if (rows.length === 0) break
      for (const r of rows) {
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

// R2 (S3 호환) 의 모든 객체 list — ListObjectsV2 + pagination + 간이 XML 파서
async function listAllObjectsR2(
  client: AwsClient,
  endpoint: string,
  bucket: string,
): Promise<Array<{ key: string; size: number; updated_at: string }>> {
  const out: Array<{ key: string; size: number; updated_at: string }> = []
  let continuationToken: string | null = null
  // 안전장치: 무한루프 방지
  for (let i = 0; i < 1000; i++) {
    const url = new URL(`${endpoint.replace(/\/+$/, '')}/${bucket}`)
    url.searchParams.set('list-type', '2')
    url.searchParams.set('max-keys', '1000')
    if (continuationToken) url.searchParams.set('continuation-token', continuationToken)
    const signed = await client.sign(url.toString(), { method: 'GET' })
    const res = await fetch(signed)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`R2 list 실패 (${res.status}): ${text.slice(0, 300)}`)
    }
    const xml = await res.text()
    const contents = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) || []
    for (const block of contents) {
      const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1] || ''
      const size = Number(block.match(/<Size>(\d+)<\/Size>/)?.[1] || '0')
      const lm = block.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] || ''
      if (key) out.push({ key, size, updated_at: lm })
    }
    const isTruncated = /<IsTruncated>true<\/IsTruncated>/.test(xml)
    const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] || null
    if (!isTruncated || !next) break
    continuationToken = next
  }
  return out
}

async function deleteR2Object(
  client: AwsClient,
  endpoint: string,
  bucket: string,
  key: string,
): Promise<void> {
  const url = `${endpoint.replace(/\/+$/, '')}/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`
  const signed = await client.sign(url, { method: 'DELETE' })
  const res = await fetch(signed)
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '')
    throw new Error(`R2 delete 실패 (${res.status}): ${text.slice(0, 200)}`)
  }
}

// DB 에서 storage 를 참조하는 모든 URL 수집.
// 한 번이라도 select 에 실패하면 reference 집합이 불완전해져서 멀쩡한 파일이 orphan 으로 잡힐 수 있다.
// 따라서 (a) 실제 스키마에 존재하는 컬럼만 조회하고, (b) 필수 테이블 쿼리가 실패하면 throw 해서
// 스캔 자체를 중단시킨다.
async function collectReferencedUrls(
  supabase: ReturnType<typeof createClient>,
  r2PublicBase: string | null,
): Promise<{ supabase: Set<string>; r2: Set<string> }> {
  const supabaseRefs = new Set<string>() // 'bucket/path' 형식
  const r2Refs = new Set<string>()       // R2 object key 형식

  const supabaseRe = /\/storage\/v1\/(?:object|render\/image)\/public\/([^/\s"]+)\/([^"\s?#]+)/g
  // R2 public URL → 객체 key 추출 정규식
  const r2Base = r2PublicBase?.replace(/\/+$/, '') || ''
  const r2Re = r2Base
    ? new RegExp(`${r2Base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^"'\\s?#]+)`, 'g')
    : null

  const addJson = (val: unknown) => {
    if (val == null) return
    if (Array.isArray(val)) {
      for (const v of val) addJson(v)
      return
    }
    const s = typeof val === 'string' ? val : JSON.stringify(val)
    let m: RegExpExecArray | null
    while ((m = supabaseRe.exec(s)) !== null) {
      supabaseRefs.add(`${m[1]}/${m[2]}`)
    }
    if (r2Re) {
      let m2: RegExpExecArray | null
      while ((m2 = r2Re.exec(s)) !== null) {
        // URL 디코드 — R2 key 는 raw 문자열
        try { r2Refs.add(decodeURIComponent(m2[1])) } catch { r2Refs.add(m2[1]) }
      }
    }
  }

  const required = async (table: string, columns: string, extract: (r: Record<string, unknown>) => void) => {
    const { data, error } = await supabase.from(table).select(columns)
    if (error) throw new Error(`[storage-orphans] ${table} reference 수집 실패: ${error.message} — 스캔 중단`)
    for (const r of (data ?? []) as Array<Record<string, unknown>>) extract(r)
  }
  const optional = async (table: string, columns: string, extract: (r: Record<string, unknown>) => void) => {
    const { data, error } = await supabase.from(table).select(columns)
    if (error) {
      const msg = error.message || ''
      const code = (error as { code?: string }).code || ''
      const isMissing = code === 'PGRST205' || /could not find the table/i.test(msg) || /relation .* does not exist/i.test(msg)
      if (isMissing) return
      throw new Error(`[storage-orphans] ${table} reference 수집 실패: ${msg} — 스캔 중단`)
    }
    for (const r of (data ?? []) as Array<Record<string, unknown>>) extract(r)
  }

  await required('courses', 'thumbnail_url, landing_image_url, landing_image_urls, video_url, seo', (r) => {
    addJson(r.thumbnail_url); addJson(r.landing_image_url); addJson(r.landing_image_urls); addJson(r.video_url); addJson(r.seo)
  })
  await required('ebooks', 'thumbnail_url, landing_image_url, landing_image_urls, file_url, seo', (r) => {
    addJson(r.thumbnail_url); addJson(r.landing_image_url); addJson(r.landing_image_urls); addJson(r.file_url); addJson(r.seo)
  })
  await required('instructors', 'image_url, thumbnail_url, hero_portrait_url', (r) => {
    addJson(r.image_url); addJson(r.thumbnail_url); addJson(r.hero_portrait_url)
  })
  await required('banners', 'image_url, video_url', (r) => {
    addJson(r.image_url); addJson(r.video_url)
  })
  await required('results', 'image_url, video_url', (r) => {
    addJson(r.image_url); addJson(r.video_url)
  })
  await required('faqs', 'video_url, file_url', (r) => {
    addJson(r.video_url); addJson(r.file_url)
  })
  await required('curriculum_items', 'video_url', (r) => { addJson(r.video_url) })
  await required('coupons', 'banner_image_url', (r) => { addJson(r.banner_image_url) })
  await required('achievements', 'image_url', (r) => { addJson(r.image_url) })
  await required('landing_categories', 'seo', (r) => { addJson(r.seo) })
  await optional('site_settings', 'value', (r) => { addJson(r.value) })

  return { supabase: supabaseRefs, r2: r2Refs }
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
    const body = await req.json().catch(() => ({})) as {
      action?: string
      source?: 'supabase' | 'r2'
      bucket?: string
      items?: Array<{ source?: 'supabase' | 'r2'; bucket: string; path: string }>
    }

    const r2cfg = await loadR2Config(supabase)
    const r2Client = r2cfg
      ? new AwsClient({
        accessKeyId: r2cfg.access_key_id,
        secretAccessKey: r2cfg.secret_access_key,
        service: 's3',
        region: 'auto',
      })
      : null

    if (body.action === 'buckets') {
      const list: BucketSpec[] = SUPABASE_BUCKETS.map((b) => ({ source: 'supabase' as const, name: b }))
      if (r2cfg && r2Client) list.push({ source: 'r2', name: r2cfg.bucket })
      return json({ status: 'ok', buckets: list, r2_enabled: !!r2cfg })
    }

    if (body.action === 'delete') {
      const items = body.items ?? []
      if (!Array.isArray(items) || items.length === 0) return json({ error: 'items required' }, 400)
      const results: Array<{ source: string; bucket: string; deleted: number; error?: string }> = []

      // Supabase 그룹핑
      const supabaseGroup = new Map<string, string[]>()
      const r2Items: Array<{ bucket: string; path: string }> = []
      for (const it of items) {
        const src = it.source ?? 'supabase'
        if (src === 'r2') {
          if (!r2cfg) continue
          if (it.bucket !== r2cfg.bucket) continue
          r2Items.push({ bucket: it.bucket, path: it.path })
        } else {
          if (!SUPABASE_BUCKETS.includes(it.bucket)) continue
          if (!supabaseGroup.has(it.bucket)) supabaseGroup.set(it.bucket, [])
          supabaseGroup.get(it.bucket)!.push(it.path)
        }
      }

      // Supabase remove
      for (const [bucket, paths] of supabaseGroup) {
        const { error } = await supabase.storage.from(bucket).remove(paths)
        results.push({ source: 'supabase', bucket, deleted: error ? 0 : paths.length, error: error?.message })
      }
      // R2 delete (개별)
      if (r2Items.length > 0 && r2Client && r2cfg) {
        let deleted = 0
        const errors: string[] = []
        for (const it of r2Items) {
          try {
            await deleteR2Object(r2Client, r2cfg.endpoint, r2cfg.bucket, it.path)
            deleted++
          } catch (err) {
            errors.push(err instanceof Error ? err.message : String(err))
          }
        }
        results.push({ source: 'r2', bucket: r2cfg.bucket, deleted, error: errors.length ? errors.slice(0, 3).join('; ') : undefined })
      }
      return json({ status: 'ok', results })
    }

    // action: 'list'
    const referenced = await collectReferencedUrls(supabase, r2cfg?.public_base_url ?? null)

    const orphans: ListItem[] = []
    let totalSize = 0
    let scannedCount = 0

    const wantSupabase = !body.source || body.source === 'supabase'
    const wantR2 = !body.source || body.source === 'r2'
    const targetSupabaseBuckets = body.bucket && body.source !== 'r2'
      ? [body.bucket].filter((b) => SUPABASE_BUCKETS.includes(b))
      : SUPABASE_BUCKETS

    if (wantSupabase) {
      const buckets = body.source === 'supabase' && body.bucket
        ? targetSupabaseBuckets
        : (body.source === 'supabase' ? targetSupabaseBuckets : (body.source ? [] : SUPABASE_BUCKETS))
      const finalBuckets = body.source === 'supabase' && body.bucket ? targetSupabaseBuckets : buckets
      for (const bucket of finalBuckets) {
        const files = await listAllFilesSupabase(supabase, bucket)
        scannedCount += files.length
        for (const f of files) {
          const key = `${bucket}/${f.path}`
          if (referenced.supabase.has(key)) continue
          const { data } = supabase.storage.from(bucket).getPublicUrl(f.path)
          orphans.push({ source: 'supabase', bucket, path: f.path, size: f.size, updated_at: f.updated_at, publicUrl: data.publicUrl })
          totalSize += f.size
        }
      }
    }

    if (wantR2 && r2cfg && r2Client && (body.source !== 'supabase')) {
      // R2 는 단일 버킷만. body.bucket 이 다른 값이면 skip.
      if (!body.bucket || body.bucket === r2cfg.bucket) {
        const objects = await listAllObjectsR2(r2Client, r2cfg.endpoint, r2cfg.bucket)
        scannedCount += objects.length
        const base = r2cfg.public_base_url?.replace(/\/+$/, '') || ''
        for (const o of objects) {
          if (referenced.r2.has(o.key)) continue
          const publicUrl = base
            ? `${base}/${o.key.split('/').map(encodeURIComponent).join('/')}`
            : ''
          orphans.push({
            source: 'r2',
            bucket: r2cfg.bucket,
            path: o.key,
            size: o.size,
            updated_at: o.updated_at,
            publicUrl,
          })
          totalSize += o.size
        }
      }
    }

    return json({
      status: 'ok',
      scanned: scannedCount,
      referenced: referenced.supabase.size + referenced.r2.size,
      orphan_count: orphans.length,
      orphan_total_bytes: totalSize,
      orphans,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
