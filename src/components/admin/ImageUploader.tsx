import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { storageService } from '../../services/storageService'

interface ImageUploaderProps {
  bucket: string
  path: string
  currentUrl?: string | null
  onUpload: (url: string) => void
  className?: string
}

export default function ImageUploader({ bucket, path, currentUrl, onUpload, className = '' }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl || null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPreview(currentUrl || null)
  }, [currentUrl])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPreview(URL.createObjectURL(file))

    try {
      setUploading(true)
      const url = await storageService.uploadImage(bucket, path, file)
      onUpload(url)
    } catch (err) {
      setPreview(currentUrl || null)
      const message = err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.'
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreview(null)
    onUpload('')
  }

  return (
    <div
      className={`relative border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#5FFF85] transition-colors overflow-hidden ${className}`}
      onClick={() => fileRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click() }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      {uploading ? (
        <div className="w-6 h-6 border-2 border-[#5FFF85] border-t-transparent rounded-full animate-spin" />
      ) : preview ? (
        <>
          <img src={preview} alt="미리보기" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"
            aria-label="이미지 제거"
          >
            <i className="ti ti-x text-sm" />
          </button>
        </>
      ) : (
        <div className="text-center p-4">
          <i className="ti ti-photo-plus text-2xl text-gray-400" />
          <p className="text-xs text-gray-400 mt-1">이미지 업로드</p>
        </div>
      )}
    </div>
  )
}
