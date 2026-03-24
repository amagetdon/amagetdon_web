import { useState, useRef } from 'react'
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPreview(URL.createObjectURL(file))

    try {
      setUploading(true)
      const url = await storageService.uploadImage(bucket, path, file)
      onUpload(url)
    } catch {
      setPreview(currentUrl || null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className={`relative border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#04F87F] transition-colors overflow-hidden ${className}`}
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
        <div className="w-6 h-6 border-2 border-[#04F87F] border-t-transparent rounded-full animate-spin" />
      ) : preview ? (
        <img src={preview} alt="미리보기" className="w-full h-full object-cover" />
      ) : (
        <div className="text-center p-4">
          <i className="ti ti-photo-plus text-2xl text-gray-400" />
          <p className="text-xs text-gray-400 mt-1">이미지 업로드</p>
        </div>
      )}
    </div>
  )
}
