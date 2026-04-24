import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { reviewService } from '../services/reviewService'
import { usePurchaseCheck } from '../hooks/usePurchaseCheck'
import Pagination from './Pagination'
import ReviewForm from './ReviewForm'

interface CourseReviewSectionProps {
  courseId: number
  courseName: string
}

const PER_PAGE = 4

export default function CourseReviewSection({
  courseId,
  courseName,
}: CourseReviewSectionProps) {
  const { user } = useAuth()
  const { purchased } = usePurchaseCheck(courseId)

  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const queryClient = useQueryClient()

  // course review 통계 (평균/총개수) — dedup, 같은 courseId 로 여러 컴포넌트에서 호출해도 1번만
  const statsQ = useQuery({
    queryKey: ['course-review-stats', courseId],
    queryFn: () => reviewService.getCourseStats(courseId),
  })
  const avgRating = statsQ.data?.avgRating ?? 0
  const totalCount = statsQ.data?.totalCount ?? 0

  // course review 목록 — 페이지별 캐싱
  const listQ = useQuery({
    queryKey: ['course-reviews', courseId, page, PER_PAGE],
    queryFn: () => reviewService.getByCourse(courseId, page, PER_PAGE),
  })
  const reviews = listQ.data?.data ?? []
  const loading = listQ.isLoading

  // 해당 유저가 이 강의 리뷰를 이미 작성했는지
  const myReviewQ = useQuery({
    queryKey: ['my-course-review', user?.id ?? null, courseId],
    queryFn: () => (user ? reviewService.getByUser(user.id, courseId) : Promise.resolve(null)),
    enabled: !!user,
  })
  const alreadyReviewed = !!myReviewQ.data

  const totalPages = Math.ceil(totalCount / PER_PAGE)

  const handleSuccess = () => {
    setPage(1)
    queryClient.invalidateQueries({ queryKey: ['course-review-stats', courseId] })
    queryClient.invalidateQueries({ queryKey: ['course-reviews', courseId] })
    queryClient.invalidateQueries({ queryKey: ['my-course-review'] })
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
            className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
    )
  }

  return (
    <section>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">수강 후기</h2>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              {renderStars(Math.round(avgRating))}
              <span className="text-sm text-gray-500">
                {avgRating.toFixed(1)} ({totalCount}개)
              </span>
            </div>
          )}
        </div>

        {user && purchased && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            disabled={alreadyReviewed}
            className={`rounded-lg px-4 py-2 text-sm font-medium cursor-pointer ${
              alreadyReviewed
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#2ED573] text-white hover:bg-[#25B866]'
            }`}
          >
            {alreadyReviewed ? '이미 후기를 작성했습니다' : '후기 작성'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          후기를 불러오는 중...
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          아직 작성된 후기가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    {review.author_name}
                  </span>
                  {renderStars(review.rating)}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(review.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-gray-800 mb-1">
                {review.title}
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {review.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          current={page}
          total={totalPages}
          onPageChange={setPage}
        />
      )}

      <ReviewForm
        courseId={courseId}
        courseName={courseName}
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={handleSuccess}
      />
    </section>
  )
}
