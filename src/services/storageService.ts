import imageCompression from 'browser-image-compression'
import * as tus from 'tus-js-client'
import { supabase } from '../lib/supabase'

// Supabase Storage 의 single-shot REST upload 는 ~6MB 가 권장 한계.
// 그보다 큰 파일은 TUS resumable upload 로 청크 분할해서 보내야 한다.
const TUS_THRESHOLD = 6 * 1024 * 1024
const TUS_CHUNK_SIZE = 6 * 1024 * 1024

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
