import { useState, useEffect } from 'react'
import { parseVideoUrl } from '../../utils/videoUrl'
import type { VideoInfo } from '../../utils/videoUrl'

interface VideoUrlInputProps {
  value: string | null
  onChange: (url: string | null) => void
  label?: string
}

export default function VideoUrlInput({ value, onChange, label }: VideoUrlInputProps) {
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)

  useEffect(() => {
    if (value) {
      setVideoInfo(parseVideoUrl(value))
    } else {
      setVideoInfo(null)
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    onChange(url || null)
  }

  const handleClear = () => {
    onChange(null)
    setVideoInfo(null)
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value || ''}
          onChange={handleChange}
          placeholder="https://youtube.com/watch?v=... 또는 https://vimeo.com/..."
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all pr-9"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="URL 삭제"
          >
            <i className="ti ti-x text-sm" />
          </button>
        )}
      </div>

      {videoInfo && (videoInfo.provider === 'youtube' || videoInfo.provider === 'vimeo') && (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2.5">
          {videoInfo.thumbnailUrl && (
            <div className="relative h-[80px] w-[142px] flex-shrink-0 overflow-hidden rounded-lg">
              <img
                src={videoInfo.thumbnailUrl}
                alt="동영상 썸네일"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex items-center gap-2 min-w-0">
            {videoInfo.provider === 'youtube' && (
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
                <i className="ti ti-brand-youtube text-xs" />
              </span>
            )}
            {videoInfo.provider === 'vimeo' && (
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                <i className="ti ti-brand-vimeo text-xs" />
              </span>
            )}
            <span className="text-xs text-gray-600">
              {videoInfo.provider === 'youtube' ? 'YouTube 동영상' : 'Vimeo 동영상'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
