import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'

interface AdminFormModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  onSubmit: () => void
  submitText?: string
  loading?: boolean
}

export default function AdminFormModal({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitText = '저장',
  loading = false,
}: AdminFormModalProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="bg-white rounded-2xl w-full max-w-[640px] max-h-[90vh] overflow-y-auto shadow-xl">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
            <DialogTitle className="text-lg font-bold text-gray-900">{title}</DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
              aria-label="닫기"
            >
              <i className="ti ti-x text-xl" />
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
          <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex gap-2 justify-end rounded-b-2xl">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={onSubmit}
              disabled={loading}
              className="px-5 py-2.5 text-sm text-white bg-[#04F87F] rounded-lg cursor-pointer border-none disabled:opacity-50 font-bold hover:bg-[#03d46d]"
            >
              {loading ? '저장 중...' : submitText}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
