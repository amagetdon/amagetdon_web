import imageCompression from 'browser-image-compression'
import { supabase } from '../lib/supabase'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB (압축 전 원본 한도)
const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50MB
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

// GIF 는 애니메이션이 깨질 수 있어 압축 스킵
const SHOULD_COMPRESS = (file: File) => file.type !== 'image/gif'

function validateImage(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('이미지 크기는 10MB 이하만 업로드할 수 있습니다.')
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

  async uploadImage(bucket: string, basePath: string, file: File): Promise<string> {
    validateImage(file)

    const compressed = await compressImage(file)
    const fileName = generateUniqueName(compressed.name)
    const uploadPath = `${basePath}/${fileName}`
    const maxRetries = 2
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resultPath = await this.uploadFile(bucket, uploadPath, compressed)
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
