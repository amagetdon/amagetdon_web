import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import EventBanner from '../components/EventBanner'
import type { Banner } from '../types'
import ReviewModal from '../components/ReviewModal'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/admin/ConfirmDialog'
import { useReviews } from '../hooks/useReviews'
import { useStaleRefreshKey } from '../hooks/useVisibilityRefresh'
import { useAuth } from '../contexts/AuthContext'
import { reviewService } from '../services/reviewService'
import type { ReviewWithCourse } from '../types'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`text-sm ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
      ))}
      <span className="text-xs text-gray-900 font-bold ml-1">{rating.toFixed(1)}</span>
    </div>
  )
}


function ReviewsPage() {
  const { isAdmin } = useAuth()
  const [currentPage, setCurrentPage] = useState(1)
  const { reviews, totalCount, loading, refetch } = useReviews({ page: currentPage, perPage: 8 })
  const [selectedReview, setSelectedReview] = useState<ReviewWithCourse | null>(null)
  const [eventBanners, setEventBanners] = useState<Banner[]>([])
  const [deleteTarget, setDeleteTarget] = useState<ReviewWithCourse | null>(null)
  const [deleting, setDeleting] = useState(false)
  const refreshKey = useStaleRefreshKey()

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await reviewService.delete(deleteTarget.id)
      toast.success('후기가 삭제되었습니다.')
      setDeleteTarget(null)
      await refetch()
    } catch {
      toast.error('후기 삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    Promise.resolve(supabase.from('banners').select('*').eq('page_key', 'reviews_event').eq('is_published', true).order('sort_order'))
      .then((eventRes) => {
        setEventBanners((eventRes.data ?? []) as Banner[])
      }).catch(() => {
        setEventBanners([])
      })
  }, [refreshKey])

  const totalPages = Math.ceil(totalCount / 8)

  return (
    <section className="w-full bg-white">
      {eventBanners.length > 0 && <EventBanner banner={eventBanners[0]} />}

      <div className="max-w-[1200px] mx-auto px-5 pb-16">
        <h1 className="text-2xl font-bold text-gray-900 mt-10 mb-8">조작없는 100% 수강생 후기</h1>

        {loading ? (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse border border-gray-200 rounded-xl p-6">
                <div className="h-3 bg-gray-200 rounded w-32 mb-3" />
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-2/3 mt-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="relative border border-gray-200 rounded-xl p-6 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedReview(review)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedReview(review) }}
              >
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(review) }}
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 bg-white border border-gray-200 cursor-pointer transition-colors"
                    aria-label="후기 삭제"
                  >
                    <i className="ti ti-trash text-sm" />
                  </button>
                )}
                <span className="text-xs text-gray-400">
                  {review.author_name} | {new Date(review.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <h3 className="text-base font-bold text-gray-900 mt-2 mb-2 pr-10">{review.title}</h3>
                <StarRating rating={review.rating} />
                <p className="text-sm text-gray-500 mt-3 leading-relaxed line-clamp-3">{review.content}</p>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
        )}
      </div>

      {selectedReview && (
        <ReviewModal
          isOpen={true}
          onClose={() => setSelectedReview(null)}
          review={{
            author: selectedReview.author_name,
            date: new Date(selectedReview.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
            title: selectedReview.title,
            rating: selectedReview.rating,
            content: selectedReview.content,
            courseName: selectedReview.course?.title || '',
            courseId: selectedReview.course_id,
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        onConfirm={handleDelete}
        title="후기 삭제"
        message={deleteTarget ? `"${deleteTarget.title}" 후기를 삭제하시겠습니까?` : ''}
        loading={deleting}
      />
    </section>
  )
}

export default ReviewsPage
