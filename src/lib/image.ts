// Supabase Storage Image Transformation 헬퍼
// 대상 URL 이 Supabase Storage 의 public object URL 일 때만 transform 을 적용해
// WebP 변환 + 사이즈 축소로 Cached Egress 절감.
// 외부 URL (cafe24, blog 등) 은 그대로 반환.

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const STORAGE_OBJECT_PREFIX = `${SUPABASE_URL}/storage/v1/object/`
const STORAGE_RENDER_PREFIX = `${SUPABASE_URL}/storage/v1/render/image/`

export type ImageTransformPreset = 'thumb' | 'card' | 'hero' | 'avatar' | 'wide'

const PRESETS: Record<ImageTransformPreset, { width: number; height?: number; quality: number; resize: 'cover' | 'contain' }> = {
  // 카탈로그 카드 썸네일 (강의·전자책 그리드)
  thumb:  { width: 480,  quality: 75, resize: 'cover' },
  // 상세 페이지 카드 / 중간 사이즈
  card:   { width: 720,  quality: 78, resize: 'cover' },
  // 랜딩 hero / 큰 배너
  hero:   { width: 1200, quality: 80, resize: 'cover' },
  // 강사·프로필 아바타
  avatar: { width: 240,  quality: 80, resize: 'cover' },
  // 가로형 와이드 배너 (이벤트 배너 등)
  wide:   { width: 1600, quality: 80, resize: 'cover' },
}

interface TransformOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'origin'
  resize?: 'cover' | 'contain' | 'fill'
}

function isSupabaseStorage(url: string) {
  return SUPABASE_URL.length > 0 && url.startsWith(STORAGE_OBJECT_PREFIX)
}

function applyTransform(url: string, opts: TransformOptions): string {
  const transformedBase = url.replace(STORAGE_OBJECT_PREFIX, STORAGE_RENDER_PREFIX)
  const params = new URLSearchParams()
  if (opts.width) params.set('width', String(opts.width))
  if (opts.height) params.set('height', String(opts.height))
  params.set('quality', String(opts.quality ?? 75))
  params.set('format', opts.format ?? 'webp')
  if (opts.resize) params.set('resize', opts.resize)
  return `${transformedBase}?${params.toString()}`
}

export function imgUrl(url: string | null | undefined, presetOrOpts: ImageTransformPreset | TransformOptions = 'card'): string {
  if (!url) return ''
  if (!isSupabaseStorage(url)) return url
  const opts = typeof presetOrOpts === 'string' ? PRESETS[presetOrOpts] : presetOrOpts
  return applyTransform(url, opts)
}

// 동일 이미지의 srcset 후보 (반응형) — Storage 자산 한정
export function imgSrcSet(url: string | null | undefined, widths: number[], quality = 75): string | undefined {
  if (!url || !isSupabaseStorage(url)) return undefined
  return widths
    .map((w) => `${applyTransform(url, { width: w, quality, resize: 'cover' })} ${w}w`)
    .join(', ')
}
