import { useCallback, useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'

interface ImageCropDialogProps {
  isOpen: boolean
  src: string | null
  fileName: string
  fileType: string
  aspect?: number | undefined
  onClose: () => void
  onCropped: (file: File) => void
}

async function getCroppedBlob(src: string, area: Area, mime: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('이미지 로드 실패'))
    i.src = src
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width)
  canvas.height = Math.round(area.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 컨텍스트 생성 실패')
  ctx.drawImage(
    img,
    area.x, area.y, area.width, area.height,
    0, 0, area.width, area.height
  )
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('blob 변환 실패'))),
      mime,
      0.92
    )
  })
}

export default function ImageCropDialog({ isOpen, src, fileName, fileType, aspect, onClose, onCropped }: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedArea(null)
    }
  }, [isOpen])

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels)
  }, [])

  const handleApply = async () => {
    if (!src || !croppedArea || busy) return
    try {
      setBusy(true)
      const mime = fileType.startsWith('image/') ? fileType : 'image/png'
      const blob = await getCroppedBlob(src, croppedArea, mime)
      const ext = mime.split('/')[1] || 'png'
      const baseName = fileName.replace(/\.[^.]+$/, '')
      const file = new File([blob], `${baseName}-cropped.${ext}`, { type: mime })
      onCropped(file)
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-gray-900">이미지 자르기</DialogTitle>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 bg-transparent border-none cursor-pointer" aria-label="닫기">
              <i className="ti ti-x text-base" />
            </button>
          </div>
          <div className="relative w-full h-[420px] bg-gray-900">
            {src && (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                restrictPosition={false}
                objectFit="contain"
                showGrid
              />
            )}
          </div>
          <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3">
            <span className="text-xs text-gray-500 whitespace-nowrap">확대/축소</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[#2ED573]"
            />
            <span className="text-xs text-gray-500 w-10 text-right">{zoom.toFixed(2)}×</span>
          </div>
          <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer">
              취소
            </button>
            <button onClick={handleApply} disabled={busy || !croppedArea}
              className="px-4 py-2 rounded-xl text-sm border-none bg-[#2ED573] text-white font-bold hover:bg-[#25B866] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {busy ? '처리 중...' : '적용'}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
