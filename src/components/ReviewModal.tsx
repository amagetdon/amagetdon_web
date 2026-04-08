import { Link } from 'react-router-dom'

interface ReviewData {
  title: string
  author: string
  date: string
  rating: number
  content: string
  courseName: string
  courseId: number | null
}

interface ReviewModalProps {
  isOpen: boolean
  onClose: () => void
  review: ReviewData
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`text-sm ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}>
          ★
        </span>
      ))}
      <span className="text-xs text-gray-900 font-bold ml-1">{rating.toFixed(1)}</span>
    </div>
  )
}

function ReviewModal({ isOpen, onClose, review }: ReviewModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl p-8 max-w-[600px] w-full mx-4 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-600"
          aria-label="닫기"
        >
          <i className="ti ti-x text-xl" />
        </button>

        <div className="mb-3">
          <span className="text-xs text-gray-400">{review.author} | {review.date}</span>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-3">{review.title}</h2>

        <div className="mb-4">
          <StarRating rating={review.rating} />
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-8 whitespace-pre-line">
          {review.content}
        </p>

        {review.courseId ? (
          <Link
            to={`/course/${review.courseId}`}
            onClick={onClose}
            className="inline-block bg-[#5FFF85] text-white rounded-full px-6 py-3 text-sm font-medium no-underline hover:bg-[#4de673] transition-colors"
          >
            이 수강생이 선택한 강의 &gt;
          </Link>
        ) : review.courseName ? (
          <span className="inline-block bg-gray-100 text-gray-500 rounded-full px-6 py-3 text-sm font-medium">
            {review.courseName}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default ReviewModal
