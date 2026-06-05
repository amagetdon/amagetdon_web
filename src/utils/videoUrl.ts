interface VideoInfo {
  provider: 'youtube' | 'vimeo' | 'direct'
  videoId: string | null
  embedUrl: string
  thumbnailUrl: string | null
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

function extractVimeoInfo(url: string): { id: string; hash: string | null } | null {
  // player.vimeo.com/video/ID?h=HASH
  const playerMatch = url.match(/player\.vimeo\.com\/video\/(\d+)(?:\?h=([a-zA-Z0-9]+))?/)
  if (playerMatch) return { id: playerMatch[1], hash: playerMatch[2] || null }

  // vimeo.com/ID/HASH (비공개 영상)
  const privateMatch = url.match(/vimeo\.com\/(\d+)\/([a-zA-Z0-9]+)/)
  if (privateMatch) return { id: privateMatch[1], hash: privateMatch[2] }

  // vimeo.com/ID (공개 영상)
  const publicMatch = url.match(/vimeo\.com\/(\d+)/)
  if (publicMatch) return { id: publicMatch[1], hash: null }

  return null
}

// 원본 URL 의 쿼리 파라미터(autoplay, mute, start 등)를 수집한다.
// '?' 가 정상이지만 'youtu.be/ID&autoplay=1' 처럼 '&' 로 잘못 붙인 경우도 관대하게 처리한다.
function extractQueryParams(url: string): URLSearchParams {
  const params = new URLSearchParams()
  const match = url.match(/[?&](.+)$/)
  if (match) {
    new URLSearchParams(match[1]).forEach((value, key) => {
      if (key !== 'v') params.set(key, value) // watch?v=ID 의 v 는 embed 경로에 이미 포함
    })
  }
  return params
}

// 자동재생은 브라우저 정책상 음소거가 필수 → autoplay 만 있고 mute 가 없으면 자동으로 켜준다.
function ensureMutedAutoplay(params: URLSearchParams, muteKey: 'mute' | 'muted'): void {
  if (params.get('autoplay') === '1' && !params.has(muteKey)) {
    params.set(muteKey, '1')
  }
}

function appendQuery(base: string, params: URLSearchParams): string {
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export function parseVideoUrl(url: string): VideoInfo | null {
  if (!url || !url.trim()) return null

  // 'youtu.be/...' 처럼 스킴(https://) 없이 입력해도 인식되도록 보정한다.
  // 스킴이 없으면 new URL() 이 예외를 던져 영상이 아예 렌더링되지 않으므로 https:// 를 붙인다.
  const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`

  try {
    new URL(normalizedUrl)
  } catch {
    return null
  }

  const youtubeId = extractYouTubeId(normalizedUrl)
  if (youtubeId) {
    const params = extractQueryParams(normalizedUrl)
    ensureMutedAutoplay(params, 'mute')
    return {
      provider: 'youtube',
      videoId: youtubeId,
      embedUrl: appendQuery(`https://www.youtube.com/embed/${youtubeId}`, params),
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    }
  }

  const vimeoInfo = extractVimeoInfo(normalizedUrl)
  if (vimeoInfo) {
    const params = extractQueryParams(normalizedUrl)
    if (vimeoInfo.hash) params.set('h', vimeoInfo.hash)
    ensureMutedAutoplay(params, 'muted')
    return {
      provider: 'vimeo',
      videoId: vimeoInfo.id,
      embedUrl: appendQuery(`https://player.vimeo.com/video/${vimeoInfo.id}`, params),
      thumbnailUrl: null,
    }
  }

  return {
    provider: 'direct',
    videoId: null,
    embedUrl: normalizedUrl,
    thumbnailUrl: null,
  }
}

export function getVideoThumbnail(url: string): string | null {
  const info = parseVideoUrl(url)
  if (!info) return null
  return info.thumbnailUrl
}

export function isValidVideoUrl(url: string): boolean {
  return parseVideoUrl(url) !== null
}

export type { VideoInfo }
