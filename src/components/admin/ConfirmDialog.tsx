import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment } from 'react'

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
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                confirmColor === 'red' ? 'bg-red-50' : 'bg-[#04F87F]/10'
              }`}>
                <i className={`ti ${confirmColor === 'red' ? 'ti-trash text-red-500' : 'ti-check text-[#04F87F]'} text-xl`} />
              </div>
              <DialogTitle className="text-base font-bold text-gray-900">{title}</DialogTitle>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{message}</p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl cursor-pointer border-none hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className={`flex-1 px-4 py-2.5 text-sm text-white rounded-xl cursor-pointer border-none disabled:opacity-50 transition-colors ${
                    confirmColor === 'red' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#04F87F] hover:bg-[#03d46d]'
                  }`}
                >
                  {loading ? '처리 중...' : confirmText}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
