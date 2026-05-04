import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { storageService } from '../../services/storageService'

interface MultiImageUploaderProps {
  bucket: string
  pathPrefix: string
  values: string[]
  onChange: (urls: string[]) => void
  compress?: boolean
  helperText?: string
}

export default function MultiImageUploader({
  bucket,
  pathPrefix,
  values,
  onChange,
  compress = true,
  helperText,
}: MultiImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    try {
      setUploading(true)
      const uploaded: string[] = []
      for (const file of list) {
        try {
          const url = await storageService.uploadImage(bucket, pathPrefix, file, { compress })
          uploaded.push(url)
        } catch (err) {
          const message = err instanceof Error ? err.message : '업로드에 실패했습니다.'
          toast.error(`${file.name}: ${message}`)
        }
      }
      if (uploaded.length > 0) {
        onChange([...values, ...uploaded])
      }
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = (idx: number) => {
    const next = [...values]
    next.splice(idx, 1)
    onChange(next)
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= values.length) return
    const next = [...values]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const handleDragStart = (idx: number) => setDragIndex(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === idx) return
  }
  const handleDrop = (idx: number) => {
    if (dragIndex === null || dragIndex === idx) {
      setDragIndex(null)
      return
    }
    move(dragIndex, idx)
    setDragIndex(null)
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
        className="hidden"
      />

      {values.length > 0 && (
        <ul className="space-y-2">
          {values.map((url, idx) => (
            <li
              key={`${url}-${idx}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              className={`flex items-center gap-3 p-2 bg-white border border-gray-200 rounded-lg ${
                dragIndex === idx ? 'opacity-60' : ''
              }`}
            >
              <span className="w-6 text-center text-xs font-bold text-gray-400 cursor-grab select-none" title="드래그하여 순서 변경">
                <i className="ti ti-grip-vertical" />
              </span>
              <span className="w-8 text-center text-xs font-bold text-gray-600">{idx + 1}</span>
              <img src={url} alt={`상세 이미지 ${idx + 1}`} className="w-20 h-20 object-cover rounded-md bg-gray-100" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 truncate" title={url}>{url}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, idx - 1)}
                  disabled={idx === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 bg-transparent border border-gray-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="위로"
                >
                  <i className="ti ti-chevron-up text-sm" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, idx + 1)}
                  disabled={idx === values.length - 1}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 bg-transparent border border-gray-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="아래로"
                >
                  <i className="ti ti-chevron-down text-sm" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border border-gray-200 cursor-pointer"
                  aria-label="삭제"
                >
                  <i className="ti ti-trash text-sm" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full py-3 rounded-lg text-xs font-medium border border-dashed border-gray-300 text-gray-500 bg-white cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
      >
        {uploading ? (
          <>
            <span className="w-4 h-4 border-2 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
            업로드 중...
          </>
        ) : (
          <>
            <i className="ti ti-photo-plus text-sm" />
            이미지 추가 (여러 장 선택 가능)
          </>
        )}
      </button>

      {helperText && <p className="text-xs text-gray-400">{helperText}</p>}
    </div>
  )
}
