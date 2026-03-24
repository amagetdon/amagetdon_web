import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message?: string
  confirmText?: string
  confirmColor?: 'red' | 'green'
  loading?: boolean
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = '삭제 확인',
  message = '정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
  confirmText = '삭제',
  confirmColor = 'red',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
          <DialogTitle className="text-lg font-bold text-gray-900">{title}</DialogTitle>
          <p className="text-sm text-gray-500 mt-2">{message}</p>
          <div className="flex gap-2 mt-6 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg cursor-pointer border-none hover:bg-gray-200"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 text-sm text-white rounded-lg cursor-pointer border-none disabled:opacity-50 ${
                confirmColor === 'red' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#04F87F] hover:bg-[#03d46d]'
              }`}
            >
              {loading ? '처리 중...' : confirmText}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
