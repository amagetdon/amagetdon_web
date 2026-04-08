import { supabase } from '../lib/supabase'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
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

function validateImage(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('이미지 크기는 5MB 이하만 업로드할 수 있습니다.')
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error('허용되지 않는 이미지 형식입니다. JPEG, PNG, WebP, GIF만 지원합니다.')
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
