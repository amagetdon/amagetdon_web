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

  const vimeoInfo = extractVimeoInfo(url)
  if (vimeoInfo) {
    const hashParam = vimeoInfo.hash ? `?h=${vimeoInfo.hash}` : ''
    return {
      provider: 'vimeo',
      videoId: vimeoInfo.id,
      embedUrl: `https://player.vimeo.com/video/${vimeoInfo.id}${hashParam}`,
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
