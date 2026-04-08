import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment, useState, useRef, useEffect } from 'react'

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
  const [confirmClose, setConfirmClose] = useState(false)
  const dirty = useRef(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      dirty.current = false
      // 초기 렌더 후 input 감지 시작 (React 렌더링의 input 이벤트 무시)
      const timer = setTimeout(() => {
        const el = bodyRef.current
        if (!el) return
        const handler = () => { dirty.current = true }
        el.addEventListener('input', handler)
        el.addEventListener('change', handler)
        return () => {
          el.removeEventListener('input', handler)
          el.removeEventListener('change', handler)
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleClose = () => {
    if (dirty.current) {
      setConfirmClose(true)
    } else {
      onClose()
    }
  }

  return (
    <>
      <Transition show={isOpen} as={Fragment}>
        <Dialog onClose={handleClose} className="relative z-50">
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
              enterFrom="opacity-0 scale-95 translate-y-4"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="bg-white rounded-2xl w-full max-w-[640px] max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <DialogTitle className="text-base font-bold text-gray-900">{title}</DialogTitle>
                  <button
                    onClick={handleClose}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 bg-transparent border-none cursor-pointer transition-colors"
                    aria-label="닫기"
                  >
                    <i className="ti ti-x text-lg" />
                  </button>
                </div>

                <div ref={bodyRef} className="p-6 overflow-y-auto flex-1">
                  {children}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end shrink-0 bg-gray-50/50">
                  <button
                    onClick={handleClose}
                    className="px-5 py-2.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={onSubmit}
                    disabled={loading}
                    className="px-5 py-2.5 text-sm text-white bg-[#2ED573] rounded-xl cursor-pointer border-none disabled:opacity-50 font-bold hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        저장 중...
                      </span>
                    ) : submitText}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      <Transition show={confirmClose} as={Fragment}>
        <Dialog onClose={() => setConfirmClose(false)} className="relative z-[60]">
          <TransitionChild as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30" />
          </TransitionChild>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <TransitionChild as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <DialogPanel className="bg-white rounded-xl p-6 max-w-xs w-full shadow-xl text-center">
                <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <i className="ti ti-alert-triangle text-yellow-500 text-xl" />
                </div>
                <p className="text-sm font-bold text-gray-900 mb-1">작성을 취소하시겠습니까?</p>
                <p className="text-xs text-gray-400 mb-5">작성한 내용이 저장되지 않습니다.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmClose(false)}
                    className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg border-none cursor-pointer hover:bg-gray-200 transition-colors">
                    계속 작성
                  </button>
                  <button onClick={() => { setConfirmClose(false); onClose() }}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg border-none cursor-pointer hover:bg-red-600 transition-colors">
                    닫기
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}
