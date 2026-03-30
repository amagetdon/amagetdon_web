import { parseVideoUrl } from '../utils/videoUrl'

interface VideoEmbedProps {
  url: string
  className?: string
}

export default function VideoEmbed({ url, className = '' }: VideoEmbedProps) {
  const videoInfo = parseVideoUrl(url)

  if (!videoInfo) return null

  if (videoInfo.provider === 'youtube' || videoInfo.provider === 'vimeo') {
    return (
      <div className={`aspect-video rounded-xl overflow-hidden ${className}`}>
        <iframe
          src={videoInfo.embedUrl}
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
    <div className={`aspect-video rounded-xl overflow-hidden ${className}`}>
      <video
        src={videoInfo.embedUrl}
        controls
        preload="metadata"
        className="w-full h-full"
      >
        <track kind="captions" />
      </video>
    </div>
  )
}
