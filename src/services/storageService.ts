import imageCompression from 'browser-image-compression'
import * as tus from 'tus-js-client'
import { supabase } from '../lib/supabase'

// R2 모드 — DB(external_storage_config) 의 enabled 가 true 면 신규 업로드를 Cloudflare R2 로 보낸다.
// 한 번 조회 후 메모리 캐싱. admin 이 설정 저장 후 invalidate 또는 새로고침 시 다시 반영.
let cachedR2Config: { enabled: boolean; publicBaseUrl: string | null } | null = null
let r2ConfigPromise: Promise<{ enabled: boolean; publicBaseUrl: string | null }> | null = null

async function getR2Config(): Promise<{ enabled: boolean; publicBaseUrl: string | null }> {
  if (cachedR2Config) return cachedR2Config
  if (r2ConfigPromise) return r2ConfigPromise
  r2ConfigPromise = (async () => {
    try {
      const { data } = await supabase.rpc('get_storage_config_public')
      const row = (data ?? {}) as { enabled?: boolean; public_base_url?: string | null }
      cachedR2Config = {
        enabled: !!row.enabled,
        publicBaseUrl: row.public_base_url ?? null,
      }
      return cachedR2Config
    } catch {
      cachedR2Config = { enabled: false, publicBaseUrl: null }
      return cachedR2Config
    } finally {
      r2ConfigPromise = null
    }
  })()
  return r2ConfigPromise
}

export function invalidateR2ConfigCache() {
  cachedR2Config = null
  r2ConfigPromise = null
}

// Supabase Storage 의 single-shot REST upload 는 ~6MB 가 권장 한계.
// 그보다 큰 파일은 TUS resumable upload 로 청크 분할해서 보내야 한다.
const TUS_THRESHOLD = 6 * 1024 * 1024
const TUS_CHUNK_SIZE = 6 * 1024 * 1024

// Cloudflare R2 — 클라이언트가 edge function 으로부터 presigned PUT URL 을 받아서
// 직접 R2 에 PUT 한다. 데이터가 한 번만 흐르고 Supabase egress 비용도 안 든다.
// 반환값은 사용자 페이지에서 그대로 src 로 쓸 수 있는 public URL.
async function uploadToR2(logicalBucket: string, path: string, file: File): Promise<string> {
  const { data, error } = await supabase.functions.invoke('r2-presign', {
    body: { logicalBucket, path, contentType: file.type || 'application/octet-stream' },
  })
  if (error) throw new Error(`R2 presign 실패: ${error.message}`)
  const { uploadUrl, publicUrl, hasPublicBase } = data as { uploadUrl: string; publicUrl: string | null; hasPublicBase: boolean }
  if (!uploadUrl) throw new Error('R2 presign 응답에 uploadUrl 누락')

  // PUT body 는 File 자체. 명시적 Content-Type 헤더는 넣지 않는다 — presigned URL 의
  // SignedHeaders 가 host 만 포함하므로, 추가 헤더 보내봐야 R2 는 무시한다. fetch 가 자동으로
  // Content-Type 을 추론해서 보내지만 서명과 무관해 안전하게 통과.
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`R2 업로드 실패 (${res.status}) ${text.slice(0, 200)}`)
  }
  if (!hasPublicBase || !publicUrl) {
    throw new Error('R2 PUBLIC URL 이 설정되지 않았습니다. R2 버킷의 Public Access 를 활성화하고 R2_PUBLIC_BASE_URL 을 등록해 주세요.')
  }
  return publicUrl
}

async function uploadFileResumable(bucket: string, path: string, file: File): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('인증 세션이 없어 업로드할 수 없습니다. 다시 로그인해 주세요.')

  // supabase-js 가 노출하는 internal URL 을 직접 못 가져오므로 env 에서 빼오는 대신
  // session 의 token 만 사용하고 storage URL 은 supabase 클라이언트에서 동일하게 추출.
  const supabaseUrl = (supabase as unknown as { supabaseUrl: string }).supabaseUrl
  const endpoint = `${supabaseUrl}/storage/v1/upload/resumable`

  return new Promise<string>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      chunkSize: TUS_CHUNK_SIZE,
      onError: (err) => {
        reject(new Error(`TUS 업로드 실패: ${err.message}`))
      },
      onSuccess: () => resolve(path),
    })
    upload.start()
  })
}

const MAX_FILE_SIZE = 150 * 1024 * 1024 // 150MB (원본 한도). 분할 상세 이미지 등 대용량 케이스 대응.
const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50MB
// 50MB 이상 이미지는 압축 시도 자체가 브라우저 메모리/시간을 크게 잡아먹으므로 raw 업로드 강제.
const COMPRESS_SIZE_CAP = 50 * 1024 * 1024
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
] as const

// 업로드 직전 client-side 에서 적용할 사이즈/포맷 캡.
// 1920px·WebP·82q 로 통일하면 사용자 페이지에서 raw URL 그대로 써도 충분히 작아서
// Supabase image transform endpoint 를 거치지 않아도 된다 → transform quota 절감.
const COMPRESS_OPTIONS = {
  maxWidthOrHeight: 1920,
  initialQuality: 0.82,
  fileType: 'image/webp' as const,
  useWebWorker: true,
  // 어차피 maxWidthOrHeight 로 캡되니 byte 한도는 넉넉히
  maxSizeMB: 4,
}

// GIF (애니메이션 깨짐) 와 50MB 초과 (브라우저 부하) 파일은 압축 스킵.
const SHOULD_COMPRESS = (file: File) => file.type !== 'image/gif' && file.size <= COMPRESS_SIZE_CAP

function validateImage(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('이미지 크기는 150MB 이하만 업로드할 수 있습니다.')
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error('허용되지 않는 이미지 형식입니다. JPEG, PNG, WebP, GIF만 지원합니다.')
  }
}

async function compressImage(file: File): Promise<File> {
  if (!SHOULD_COMPRESS(file)) return file
  try {
    const compressed = await imageCompression(file, COMPRESS_OPTIONS)
    // compressed 가 원본보다 더 클 수 있는 엣지 케이스 (이미 작은 파일) — 그래도 일관된 .webp 확장자가 의미 있음
    return new File([compressed], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' })
  } catch {
    // 압축 실패 시 원본으로 진행 (업로드는 막지 않음)
    return file
  }
}

function validateVideo(file: File): void {
  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error('동영상 크기는 50MB 이하만 업로드할 수 있습니다.')
  }

  if (!ALLOWED_VIDEO_TYPES.includes(file.type as (typeof ALLOWED_VIDEO_TYPES)[number])) {
    throw new Error('허용되지 않는 동영상 형식입니다. MP4, WebM만 지원합니다.')
  }
}

function generateUniqueName(fileName: string): string {
  const ext = fileName.split('.').pop() || 'png'
  const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  return `${uniqueId}.${ext}`
}

export const storageService = {
  async uploadFile(bucket: string, path: string, file: File) {
    const r2 = await getR2Config()
    // R2 모드: bucket 안 prefix 로 매핑된 R2 key 에 PUT, public URL 그대로 반환.
    // 호출부 호환을 위해 'path' 를 그대로 반환 (Supabase storage 의 path 와 동일 의미).
    if (r2.enabled) {
      await uploadToR2(bucket, path, file)
      return path
    }
    // 6MB 초과 파일은 single-shot 으로 보내면 storage gateway 에서 400 으로 거부.
    // resumable (TUS) 로 분할 업로드.
    if (file.size > TUS_THRESHOLD) {
      return uploadFileResumable(bucket, path, file)
    }
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      })
    if (error) {
      throw new Error(`Storage 업로드 실패 [${error.message}] statusCode: ${(error as unknown as Record<string, unknown>).statusCode}`)
    }
    return data.path
  },

  // R2 모드일 때 호출부에서 public URL 을 직접 받고 싶을 때 사용 (PDF 업로드 등).
  // 기존 흐름 (uploadFile + getPublicUrl) 호환성 유지.
  async getPublicUrlFor(bucket: string, path: string): Promise<string> {
    const r2 = await getR2Config()
    if (r2.enabled) {
      const base = r2.publicBaseUrl?.replace(/\/+$/, '') || ''
      if (!base) return ''
      return `${base}/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
    }
    return this.getPublicUrl(bucket, path)
  },

  getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  },

  async deleteFile(bucket: string, path: string) {
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (error) throw error
  },

  async uploadImage(bucket: string, basePath: string, file: File, options?: { compress?: boolean }): Promise<string> {
    validateImage(file)

    const compress = options?.compress !== false
    const prepared = compress ? await compressImage(file) : file
    const fileName = generateUniqueName(prepared.name)
    const uploadPath = `${basePath}/${fileName}`

    const r2 = await getR2Config()
    // R2 모드: presigned URL 로 직접 업로드 → public URL 반환
    if (r2.enabled) {
      return uploadToR2(bucket, uploadPath, prepared)
    }

    const maxRetries = 2
    let lastError: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resultPath = await this.uploadFile(bucket, uploadPath, prepared)
        return this.getPublicUrl(bucket, resultPath)
      } catch (err) {
        lastError = err
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
    }
    throw lastError
  },

  async uploadVideo(bucket: string, basePath: string, file: File): Promise<string> {
    validateVideo(file)

    const fileName = generateUniqueName(file.name)
    const uploadPath = `${basePath}/${fileName}`

    const r2 = await getR2Config()
    if (r2.enabled) {
      return uploadToR2(bucket, uploadPath, file)
    }

    const maxRetries = 2
    let lastError: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resultPath = await this.uploadFile(bucket, uploadPath, file)
        return this.getPublicUrl(bucket, resultPath)
      } catch (err) {
        lastError = err
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
    }
    throw lastError
  },
}
