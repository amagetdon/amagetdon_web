import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeaturedResults } from '../hooks/useResults'
import { useFeaturedReviews } from '../hooks/useReviews'
import VideoEmbed from './VideoEmbed'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`text-base ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}>
          ★
        </span>
      ))}
    </div>
  )
}

function ReviewCard({ review }: { review: { author_name: string; title: string; content: string; rating: number } }) {
  return (
    <div className="relative flex-shrink-0 w-[200px]">
      <div className="review-flare" style={{ left: '80%' }}>
        <span className="review-flare-outer" />
        <span className="review-flare-line-a" />
        <span className="review-flare-line-b" />
        <span className="review-flare-line-c" />
      </div>
      <Link
        to="/reviews"
        className="relative flex h-[250px] bg-white rounded-2xl p-5 cursor-pointer no-underline flex-col border-2 border-[#04F87F]/40 shadow-[0_0_20px_rgba(4,248,127,0.15)] overflow-hidden"
      >
        <StarRating rating={review.rating} />
        <h3 className="text-[13px] font-bold text-gray-900 mt-2.5 mb-2 leading-snug line-clamp-2">{review.title}</h3>
        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-5 flex-1">
          {review.content}
        </p>
        <div className="mt-3 pt-2.5 border-t border-gray-100">
          <span className="text-[11px] text-gray-400">{review.author_name}</span>
        </div>
      </Link>
    </div>
  )
}

function RealResults() {
  const { results } = useFeaturedResults(4)
  const { reviews } = useFeaturedReviews(5)
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)

  const duplicatedReviews = [...reviews, ...reviews, ...reviews, ...reviews]

  return (
    <section className="relative w-full bg-[#0a0a0a] py-20 max-sm:py-12 overflow-hidden">
      <div
        className="absolute inset-x-0 bottom-0 h-[500px] pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,200,150,0.35) 0%, rgba(0,200,150,0.1) 40%, transparent 100%)' }}
      />
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="text-center mb-14">
          <p className="text-2xl max-sm:text-xl text-white font-medium mb-2">
            아마겟돈 수강생들이 직접 만들어낸
          </p>
          <h2 className="text-3xl max-sm:text-2xl text-white font-bold">리얼 성과 공개</h2>
        </div>

        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-x-8 gap-y-10">
          {results.map((card, idx) => (
            <div key={card.id} className="flex flex-col items-center">
              <span className="inline-block bg-[#04F87F] text-black text-xs font-bold px-4 py-1.5 rounded-full mb-3">
                {card.author_name}
              </span>
              <p className="text-sm text-gray-300 mb-4 text-center">{card.preview || card.title}</p>
              {card.video_url ? (
                <button
                  type="button"
                  onClick={() => setActiveVideoUrl(card.video_url)}
                  className="relative rounded-xl overflow-hidden cursor-pointer group aspect-video w-full bg-gray-800 block border-0 p-0 text-left"
                >
                  <img
                    src={card.image_url || `https://placehold.co/580x360/${['1a2a1a', '1a1a2a', '2a1a1a', '1a2a2a'][idx % 4]}/333333`}
                    alt={card.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 bg-white/80 rounded-full flex items-center justify-center">
                      <i className="ti ti-player-play-filled text-xl text-gray-900 ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-sm text-white font-bold leading-snug drop-shadow-lg">{card.title}</p>
                  </div>
                </button>
              ) : (
                <Link
                  to="/reviews/results"
                  className="relative rounded-xl overflow-hidden cursor-pointer group aspect-video w-full bg-gray-800 no-underline block"
                >
                  <img
                    src={card.image_url || `https://placehold.co/580x360/${['1a2a1a', '1a1a2a', '2a1a1a', '1a2a2a'][idx % 4]}/333333`}
                    alt={card.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 bg-white/80 rounded-full flex items-center justify-center">
                      <i className="ti ti-player-play-filled text-xl text-gray-900 ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-sm text-white font-bold leading-snug drop-shadow-lg">{card.title}</p>
                  </div>
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 동영상 재생 모달 */}
      {activeVideoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setActiveVideoUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="동영상 재생"
        >
          <div
            className="relative w-full max-w-[900px] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveVideoUrl(null)}
              className="absolute -top-10 right-0 text-white text-2xl cursor-pointer bg-transparent border-0 p-1"
              aria-label="닫기"
            >
              <i className="ti ti-x" />
            </button>
            <VideoEmbed url={activeVideoUrl} className="w-full" />
          </div>
        </div>
      )}

      {/* 수강생 후기 마키 */}
      {reviews.length > 0 && (
        <div className="relative mt-24">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-white mb-2">실제 강의 수강생 후기</h3>
            <p className="text-sm text-gray-400">조작된 후기는 절대 사용하지 않습니다.</p>
          </div>

          <div className="max-w-[1200px] mx-auto px-5 marquee-container">
            <div className="flex gap-5 animate-marquee w-fit py-10">
              {duplicatedReviews.map((review, idx) => (
                <ReviewCard key={idx} review={review} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default RealResults
