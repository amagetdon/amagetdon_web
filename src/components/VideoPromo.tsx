import { useFeaturedReviews } from '../hooks/useReviews'

function VideoPromo() {
  const { reviews } = useFeaturedReviews(3)

  return (
    <section className="w-full bg-white py-14 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex gap-6 max-md:flex-col">
          <div className="flex-1 bg-gray-100 rounded-xl min-h-[300px] flex items-center justify-center">
            <span className="text-sm text-gray-400">이마겟돈 인트로 홍보 영상</span>
          </div>
          <div className="w-[360px] max-md:w-full flex flex-col divide-y divide-gray-200">
            {reviews.map((review) => (
              <div key={review.id} className="py-4 first:pt-0 last:pb-0 cursor-pointer">
                <p className="text-xs text-[#04F87F] font-bold mb-1">
                  {review.course?.title || '수강 후기'}
                </p>
                <p className="text-sm font-bold text-gray-900 whitespace-pre-line leading-snug mb-1">
                  {review.title}
                </p>
                <p className="text-xs text-gray-400">
                  {review.author_name} | {new Date(review.created_at).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default VideoPromo
