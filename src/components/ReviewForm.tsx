import { Fragment, useEffect, useState } from 'react'
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { reviewService } from '../services/reviewService'
import StarRatingInput from './StarRatingInput'

interface ReviewFormProps {
  courseId: number
  courseName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ReviewForm({
  courseId,
  courseName,
  isOpen,
  onClose,
  onSuccess,
}: ReviewFormProps) {
  const { user, profile } = useAuth()
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  useEffect(() => {
    if (!isOpen || !user) return
    let cancelled = false
    setLoading(true)
    setEditingId(null)
    setRating(5)
    setTitle('')
    setContent('')
    reviewService
      .getByUser(user.id, courseId)
      .then((existing) => {
        if (cancelled || !existing) return
        setEditingId(existing.id)
        setRating(existing.rating)
        setTitle(existing.title)
        setContent(existing.content)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, user, courseId])

  const handleSubmit = async () => {
    if (!user || !profile) return

    if (!title.trim()) {
      toast.error('제목을 입력해주세요.')
      return
    }
    if (!content.trim()) {
      toast.error('내용을 입력해주세요.')
      return
    }

    setSubmitting(true)
    try {
      if (editingId != null) {
        await reviewService.update(editingId, {
          title: title.trim(),
          content: content.trim(),
          rating,
        })
        toast.success('후기가 수정되었습니다.')
      } else {
        await reviewService.create({
          user_id: user.id,
          course_id: courseId,
          instructor_id: null,
          author_name: profile.name ?? '익명',
          title: title.trim(),
          content: content.trim(),
          rating,
        })
        toast.success('후기가 등록되었습니다.')
      }
      setRating(5)
      setTitle('')
      setContent('')
      setEditingId(null)
      onSuccess()
      onClose()
    } catch {
      toast.error(editingId != null ? '후기 수정에 실패했습니다.' : '후기 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

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
            <DialogPanel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <DialogTitle className="text-lg font-bold text-gray-900 mb-1">
                {editingId != null ? '후기 수정' : '후기 작성'}
              </DialogTitle>
              <p className="text-sm text-gray-500 mb-5">{courseName}</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    별점
                  </label>
                  <StarRatingInput value={rating} onChange={setRating} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    제목
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="후기 제목을 입력해주세요"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2ED573] focus:ring-1 focus:ring-[#2ED573] focus:outline-none"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    내용
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="강의에 대한 솔직한 후기를 작성해주세요"
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-[#2ED573] focus:ring-1 focus:ring-[#2ED573] focus:outline-none"
                    maxLength={1000}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || loading}
                  className="flex-1 rounded-lg bg-[#2ED573] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#25B866] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting
                    ? editingId != null ? '수정 중...' : '등록 중...'
                    : editingId != null ? '후기 수정' : '후기 등록'}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
