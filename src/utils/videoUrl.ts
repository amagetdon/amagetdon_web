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

function extractVimeoId(url: string): string | null {
  const patterns = [
    /(?:vimeo\.com\/)(\d+)/,
    /(?:player\.vimeo\.com\/video\/)(\d+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function parseVideoUrl(url: string): VideoInfo | null {
  if (!url || !url.trim()) return null

  try {
    new URL(url)
  } catch {
    return null
  }

  const youtubeId = extractYouTubeId(url)
  if (youtubeId) {
    return {
      provider: 'youtube',
      videoId: youtubeId,
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    }
  }

  const vimeoId = extractVimeoId(url)
  if (vimeoId) {
    return {
      provider: 'vimeo',
      videoId: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      thumbnailUrl: null,
    }
  }

  return {
    provider: 'direct',
    videoId: null,
    embedUrl: url,
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
