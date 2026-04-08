import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { storageService } from '../../services/storageService'

interface ImageUploaderProps {
  bucket: string
  path: string
  currentUrl?: string | null
  onUpload: (url: string) => void
  className?: string
  accept?: 'image' | 'video' | 'both'
}

export default function ImageUploader({ bucket, path, currentUrl, onUpload, className = '', accept = 'image' }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl || null)
  const [isVideo, setIsVideo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPreview(currentUrl || null)
    if (currentUrl) {
      const ext = currentUrl.split('?')[0].split('.').pop()?.toLowerCase()
      setIsVideo(ext === 'mp4' || ext === 'webm')
    } else {
      setIsVideo(false)
    }
  }, [currentUrl])

  const acceptStr = accept === 'video' ? 'video/mp4,video/webm'
    : accept === 'both' ? 'image/*,video/mp4,video/webm'
    : 'image/*'

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileIsVideo = file.type.startsWith('video/')
    setIsVideo(fileIsVideo)
    setPreview(URL.createObjectURL(file))

    try {
      setUploading(true)
      const url = fileIsVideo
        ? await storageService.uploadVideo(bucket, path, file)
        : await storageService.uploadImage(bucket, path, file)
      onUpload(url)
    } catch (err) {
      setPreview(currentUrl || null)
      const message = err instanceof Error ? err.message : '업로드에 실패했습니다.'
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreview(null)
    setIsVideo(false)
    onUpload('')
  }

  const label = accept === 'video' ? '동영상 업로드'
    : accept === 'both' ? '이미지/동영상 업로드'
    : '이미지 업로드'

  const icon = accept === 'video' ? 'ti-video-plus'
    : accept === 'both' ? 'ti-cloud-upload'
    : 'ti-photo-plus'

  return (
    <div
      className={`relative border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#2ED573] transition-colors overflow-hidden ${className}`}
      onClick={() => fileRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click() }}
    >
      <input
        ref={fileRef}
        type="file"
        accept={acceptStr}
        onChange={handleFileChange}
        className="hidden"
      />
      {uploading ? (
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-[#2ED573] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-400 mt-2">업로드 중...</p>
        </div>
      ) : preview ? (
        <>
          {isVideo ? (
            <video src={preview} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <img src={preview} alt="미리보기" className="w-full h-full object-cover" />
          )}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"
            aria-label="제거"
          >
            <i className="ti ti-x text-sm" />
          </button>
          {isVideo && (
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">
              <i className="ti ti-video text-xs" /> 동영상
            </div>
          )}
        </>
      ) : (
        <div className="text-center p-4">
          <i className={`ti ${icon} text-2xl text-gray-400`} />
          <p className="text-xs text-gray-400 mt-1">{label}</p>
          {accept === 'both' && <p className="text-[10px] text-gray-300 mt-0.5">이미지 5MB / 동영상 50MB</p>}
          {accept === 'video' && <p className="text-[10px] text-gray-300 mt-0.5">MP4, WebM (최대 50MB)</p>}
        </div>
      )}
    </div>
  )
}
