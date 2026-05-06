import { useEffect, useState } from 'react'
import { parseVideoUrl } from '../../utils/videoUrl'
import type { VideoInfo } from '../../utils/videoUrl'

interface VideoUrlInputProps {
  value: string | null
  onChange: (url: string | null) => void
  label?: string
  /** 외부 리다이렉트 링크 모드 여부 — undefined 면 토글 UI 자체를 숨김 (기존 호출자 호환) */
  isRedirect?: boolean
  onIsRedirectChange?: (next: boolean) => void
}

export default function VideoUrlInput({ value, onChange, label, isRedirect, onIsRedirectChange }: VideoUrlInputProps) {
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const showToggle = typeof isRedirect === 'boolean' && !!onIsRedirectChange
  const redirect = !!isRedirect

  useEffect(() => {
    if (value && !redirect) {
      setVideoInfo(parseVideoUrl(value))
    } else {
      setVideoInfo(null)
    }
  }, [value, redirect])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    onChange(url || null)
    // 입력 당시에만 자동 분기 — youtube/vimeo 로 인식되면 영상, 그 외면 외부 링크.
    // 이후 사용자가 토글로 직접 변경하면 그 선택이 유지됨 (토글 클릭 시 onChange 가 호출되지 않으므로).
    if (showToggle && url) {
      const info = parseVideoUrl(url)
      const shouldRedirect = !(info && (info.provider === 'youtube' || info.provider === 'vimeo'))
      if (shouldRedirect !== redirect) onIsRedirectChange?.(shouldRedirect)
    }
  }

  const handleClear = () => {
    onChange(null)
    setVideoInfo(null)
  }

  return (
    <div>
      {(label || showToggle) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
          {showToggle && (
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => onIsRedirectChange?.(false)}
                className={`px-2.5 py-1 rounded-md font-medium border-none cursor-pointer flex items-center gap-1 transition-colors ${
                  redirect ? 'bg-transparent text-gray-500 hover:text-gray-800' : 'bg-white text-gray-900 shadow-sm'
                }`}
              >
                <i className="ti ti-player-play text-[11px]" />
                영상
              </button>
              <button
                type="button"
                onClick={() => onIsRedirectChange?.(true)}
                className={`px-2.5 py-1 rounded-md font-medium border-none cursor-pointer flex items-center gap-1 transition-colors ${
                  redirect ? 'bg-white text-gray-900 shadow-sm' : 'bg-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <i className="ti ti-external-link text-[11px]" />
                외부 링크
              </button>
            </div>
          )}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={value || ''}
          onChange={handleChange}
          placeholder={
            redirect
              ? 'https://example.com/...  (새 탭으로 열림)'
              : 'https://youtube.com/watch?v=... 또는 https://vimeo.com/...'
          }
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

      {redirect && value && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs text-gray-600">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-700 text-white">
            <i className="ti ti-external-link text-[10px]" />
          </span>
          <span className="truncate">외부 링크 — 클릭 시 새 탭으로 이동</span>
        </div>
      )}

      {!redirect && videoInfo && (videoInfo.provider === 'youtube' || videoInfo.provider === 'vimeo') && (
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
