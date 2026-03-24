interface VideoPlayerModalProps {
  isOpen: boolean
  onClose: () => void
  videoUrl: string
  title?: string
}

function VideoPlayerModal({ isOpen, onClose, videoUrl, title }: VideoPlayerModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[900px] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          {title && <p className="text-white font-bold text-sm truncate flex-1">{title}</p>}
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white bg-transparent border-none cursor-pointer text-xl ml-4"
            aria-label="닫기"
          >
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="bg-black rounded-xl overflow-hidden aspect-video">
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full h-full"
          >
            <track kind="captions" />
          </video>
        </div>
      </div>
    </div>
  )
}

export default VideoPlayerModal
