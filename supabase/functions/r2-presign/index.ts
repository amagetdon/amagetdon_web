// R2 presigned PUT URL 발급 — 관리자만 호출 가능.
// 클라이언트가 이 URL 로 직접 R2 에 PUT 하면 Supabase 가 데이터를 중계하지 않아 빠르고 비용 효율적.
//
// POST 본문:
//   { logicalBucket: 'courses' | 'ebooks' | ..., path: 'subdir/file.webp', contentType: 'image/webp' }
//
// 응답:
//   { uploadUrl, publicUrl, key, expiresIn }
//
// 환경변수:
//   R2_ACCOUNT_ID, R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
//   R2_PUBLIC_BASE_URL (선택 — Public Access 활성 시 pub-xxxxxxxx.r2.dev 형식)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// 기존 Supabase Storage 의 logical bucket 명을 R2 의 단일 버킷 안에서 prefix 로 매핑.
// (test 버킷 안에 courses/, ebooks/, instructors/ ... 식으로 정리)
const ALLOWED_LOGICAL_BUCKETS = ['courses', 'ebooks', 'instructors', 'banners', 'coupons', 'achievements', 'results']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // 인증
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authorization header missing' }, 401)
    const token = authHeader.replace('Bearer ', '')
    const isServiceRole = token === serviceKey
    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
      const { data: userRes, error } = await userClient.auth.getUser(token)
      if (error || !userRes.user) return json({ error: 'invalid auth' }, 401)
      const { data: prof } = await userClient.from('profiles').select('role').eq('id', userRes.user.id).maybeSingle()
      if ((prof as { role?: string } | null)?.role !== 'admin') return json({ error: 'admin only' }, 403)
    }

    // R2 credentials — DB(external_storage_config) 우선, 없으면 환경변수 fallback
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: cfg } = await adminClient
      .from('external_storage_config')
      .select('*')
      .eq('id', 'r2')
      .maybeSingle()
    const cfgRow = (cfg ?? {}) as Record<string, string | boolean | null>
    const r2AccountId = (cfgRow.account_id as string) || Deno.env.get('R2_ACCOUNT_ID') || ''
    const r2Bucket = (cfgRow.bucket as string) || Deno.env.get('R2_BUCKET') || ''
    const r2Endpoint = (cfgRow.endpoint as string) || Deno.env.get('R2_ENDPOINT') || ''
    const r2AccessKey = (cfgRow.access_key_id as string) || Deno.env.get('R2_ACCESS_KEY_ID') || ''
    const r2SecretKey = (cfgRow.secret_access_key as string) || Deno.env.get('R2_SECRET_ACCESS_KEY') || ''
    const r2PublicBase = (cfgRow.public_base_url as string) || Deno.env.get('R2_PUBLIC_BASE_URL') || ''
    if (!r2AccountId || !r2Bucket || !r2Endpoint || !r2AccessKey || !r2SecretKey) {
      return json({ error: 'R2 설정이 비어있습니다. 관리자 → 사이트 설정 에서 R2 정보를 입력해 주세요.' }, 500)
    }

    const body = await req.json().catch(() => ({})) as { logicalBucket?: string; path?: string; contentType?: string }
    const logical = body.logicalBucket
    const inputPath = body.path
    const contentType = body.contentType || 'application/octet-stream'

    if (!logical || !ALLOWED_LOGICAL_BUCKETS.includes(logical)) {
      return json({ error: '허용되지 않은 logicalBucket' }, 400)
    }
    if (!inputPath || inputPath.includes('..') || inputPath.startsWith('/')) {
      return json({ error: '잘못된 path' }, 400)
    }

    // R2 안의 실제 key = "<logical>/<path>"
    const key = `${logical}/${inputPath}`
    const expiresIn = 600 // 10분

    const r2 = new AwsClient({
      accessKeyId: r2AccessKey,
      secretAccessKey: r2SecretKey,
      service: 's3',
      region: 'auto',
    })

    // presigned PUT URL — aws4fetch 의 sign 메서드를 query string 모드로 사용
    const objectUrl = `${r2Endpoint}/${r2Bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`
    const signed = await r2.sign(
      new Request(objectUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
      }),
      {
        aws: { signQuery: true, allHeaders: true },
        // X-Amz-Expires
        headers: { 'x-amz-expires': String(expiresIn) },
      } as unknown as RequestInit,
    )
    // signed.url 에 X-Amz-Signature 등이 포함됨
    const uploadUrl = signed.url

    // 사용자 페이지에서 GET 할 때 쓸 public URL
    const publicUrl = r2PublicBase
      ? `${r2PublicBase.replace(/\/+$/, '')}/${encodeURIComponent(key).replace(/%2F/g, '/')}`
      : null

    void r2AccountId // 현재 sign 에 직접 안 쓰지만 향후 API endpoint 식별용으로 보관

    return json({
      uploadUrl,
      publicUrl,
      key,
      bucket: r2Bucket,
      expiresIn,
      hasPublicBase: !!r2PublicBase,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
