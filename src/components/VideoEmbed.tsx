import { parseVideoUrl } from '../utils/videoUrl'

interface VideoEmbedProps {
  url: string
  className?: string
  aspectRatio?: string
  /** 자동재생 + 무한루프 (브라우저 정책상 muted 도 함께 켬). 컨트롤은 그대로 유지. */
  autoLoop?: boolean
}

export default function VideoEmbed({ url, className = '', aspectRatio = 'aspect-video', autoLoop = false }: VideoEmbedProps) {
  const videoInfo = parseVideoUrl(url)

  if (!videoInfo) return null

  // 자동재생/루프 파라미터를 embedUrl 에 덧붙임 (provider 별 키가 다름).
  const buildSrc = (): string => {
    if (!autoLoop) return videoInfo.embedUrl
    const url = videoInfo.embedUrl
    const sep = url.includes('?') ? '&' : '?'
    if (videoInfo.provider === 'youtube') {
      // YouTube 는 단일 영상 loop 시 playlist 에 같은 videoId 를 줘야 동작
      return `${url}${sep}autoplay=1&mute=1&loop=1&playlist=${videoInfo.videoId ?? ''}&playsinline=1`
    }
    if (videoInfo.provider === 'vimeo') {
      return `${url}${sep}autoplay=1&muted=1&loop=1&playsinline=1`
    }
    return url
  }

  if (videoInfo.provider === 'youtube' || videoInfo.provider === 'vimeo') {
    return (
      <div className={`${aspectRatio} rounded-xl overflow-hidden ${className}`}>
        <iframe
          src={buildSrc()}
          title="동영상 플레이어"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="w-full h-full border-0"
        />
      </div>
    )
  }

  return (
    <div className={`${aspectRatio} rounded-xl overflow-hidden ${className}`}>
      <video
        src={videoInfo.embedUrl}
        controls
        preload="metadata"
        autoPlay={autoLoop}
        loop={autoLoop}
        muted={autoLoop}
        playsInline={autoLoop}
        className="w-full h-full"
      >
        <track kind="captions" />
      </video>
    </div>
  )
}
