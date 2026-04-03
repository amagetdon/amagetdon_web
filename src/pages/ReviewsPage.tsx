import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import HeroSection from '../components/HeroSection'
import EventBanner from '../components/EventBanner'
import type { Banner } from '../types'
import ReviewModal from '../components/ReviewModal'
import Pagination from '../components/Pagination'
import { useReviews } from '../hooks/useReviews'
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
  const [currentPage, setCurrentPage] = useState(1)
  const { reviews, totalCount, loading } = useReviews({ page: currentPage, perPage: 8 })
  const [selectedReview, setSelectedReview] = useState<ReviewWithCourse | null>(null)
  const [pageBanners, setPageBanners] = useState<Banner[]>([])
  const [eventBanners, setEventBanners] = useState<Banner[]>([])
  const [bannerLoading, setBannerLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('banners').select('*').eq('page_key', 'reviews').eq('is_published', true).order('sort_order'),
      supabase.from('banners').select('*').eq('page_key', 'reviews_event').eq('is_published', true).order('sort_order'),
    ]).then(([bannerRes, eventRes]) => {
      setPageBanners((bannerRes.data ?? []) as Banner[])
      setEventBanners((eventRes.data ?? []) as Banner[])
    }).catch(() => {
      setPageBanners([])
      setEventBanners([])
    }).finally(() => setBannerLoading(false))
  }, [])

  const totalPages = Math.ceil(totalCount / 8)

  return (
    <section className="w-full bg-white">
      <HeroSection banners={pageBanners} loading={bannerLoading} />
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
                className="border border-gray-200 rounded-xl p-6 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedReview(review)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedReview(review) }}
              >
                <span className="text-xs text-gray-400">
                  {review.author_name} | {new Date(review.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <h3 className="text-base font-bold text-gray-900 mt-2 mb-2">{review.title}</h3>
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
    </section>
  )
}

export default ReviewsPage
