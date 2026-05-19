import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { storageService } from '../../services/storageService'

interface MultiImageUploaderProps {
  bucket: string
  pathPrefix: string
  values: string[]
  /** values 와 인덱스 정렬된 이미지별 클릭 링크. 미지정 시 링크 없음으로 간주. */
  links?: string[]
  onChange: (urls: string[], links: string[]) => void
  compress?: boolean
  helperText?: string
  /** true 면 이미지별 '클릭 시 이동할 링크' 입력란 노출 */
  enableLinks?: boolean
}

export default function MultiImageUploader({
  bucket,
  pathPrefix,
  values,
  links,
  onChange,
  compress = true,
  helperText,
  enableLinks = false,
}: MultiImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const replaceFileRef = useRef<HTMLInputElement>(null)
  const replaceIdxRef = useRef<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  // url → 원본 파일명. 이번 세션에서 업로드한 이미지에 대해서만 채워진다. 새로고침/재진입 시 초기화.
  const [nameMap, setNameMap] = useState<Record<string, string>>({})

  // links 는 항상 values 와 같은 길이로 정규화해서 다룬다 (인덱스 어긋남 방지).
  const linkList = values.map((_, i) => links?.[i] ?? '')

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    try {
      setUploading(true)
      const uploaded: string[] = []
      const newNames: Record<string, string> = {}
      for (const file of list) {
        try {
          const url = await storageService.uploadImage(bucket, pathPrefix, file, { compress })
          uploaded.push(url)
          newNames[url] = file.name
        } catch (err) {
          const message = err instanceof Error ? err.message : '업로드에 실패했습니다.'
          toast.error(`${file.name}: ${message}`)
        }
      }
      if (uploaded.length > 0) {
        setNameMap((prev) => ({ ...prev, ...newNames }))
        onChange([...values, ...uploaded], [...linkList, ...uploaded.map(() => '')])
      }
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = (idx: number) => {
    const nextUrls = [...values]
    const nextLinks = [...linkList]
    nextUrls.splice(idx, 1)
    nextLinks.splice(idx, 1)
    onChange(nextUrls, nextLinks)
  }

  const triggerReplace = (idx: number) => {
    replaceIdxRef.current = idx
    replaceFileRef.current?.click()
  }

  const handleReplaceFile = async (file: File | undefined) => {
    const idx = replaceIdxRef.current
    replaceIdxRef.current = null
    if (!file || idx === null || idx < 0 || idx >= values.length) return
    try {
      setUploading(true)
      const url = await storageService.uploadImage(bucket, pathPrefix, file, { compress })
      setNameMap((prev) => ({ ...prev, [url]: file.name }))
      const next = [...values]
      next[idx] = url
      // 교체는 이미지만 바뀌고 링크는 그대로 유지
      onChange(next, [...linkList])
    } catch (err) {
      const message = err instanceof Error ? err.message : '업로드에 실패했습니다.'
      toast.error(`${file.name}: ${message}`)
    } finally {
      setUploading(false)
    }
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= values.length) return
    const nextUrls = [...values]
    const nextLinks = [...linkList]
    const [u] = nextUrls.splice(from, 1)
    const [l] = nextLinks.splice(from, 1)
    nextUrls.splice(to, 0, u)
    nextLinks.splice(to, 0, l)
    onChange(nextUrls, nextLinks)
  }

  const setLink = (idx: number, value: string) => {
    const nextLinks = [...linkList]
    nextLinks[idx] = value
    onChange([...values], nextLinks)
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
      <input
        ref={replaceFileRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          handleReplaceFile(e.target.files?.[0])
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
                {nameMap[url] && (
                  <p className="text-sm font-medium text-gray-800 truncate" title={nameMap[url]}>{nameMap[url]}</p>
                )}
                <p className="text-xs text-gray-500 truncate" title={url}>{url}</p>
                {enableLinks && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <i className="ti ti-link text-xs text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={linkList[idx]}
                      onChange={(e) => setLink(idx, e.target.value)}
                      placeholder="클릭 시 이동할 링크 (예: /course/12 또는 https://...)"
                      className="flex-1 min-w-0 border border-gray-300 rounded-md px-2 py-1 text-xs outline-none focus:border-[#2ED573]"
                    />
                  </div>
                )}
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
                  onClick={() => triggerReplace(idx)}
                  disabled={uploading}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:text-[#2ED573] hover:bg-[#2ED573]/10 bg-transparent border border-gray-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="이미지 교체"
                  title="이미지 교체"
                >
                  <i className="ti ti-replace text-sm" />
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
