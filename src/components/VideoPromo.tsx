import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFeaturedReviews } from '../hooks/useReviews'
import { supabase } from '../lib/supabase'
import VideoEmbed from './VideoEmbed'

function VideoPromo() {
  const { reviews } = useFeaturedReviews(3)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'promo_video').single()
      .then(({ data }) => {
        if (data) setVideoUrl((data.value as Record<string, string>)?.url || null)
      })
  }, [])

  return (
    <section className="w-full bg-white py-14 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex gap-6 max-md:flex-col items-stretch">
          {/* 영상 */}
          <div className="flex-1 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center min-h-[280px]">
            {videoUrl ? (
              <VideoEmbed url={videoUrl} className="w-full" />
            ) : (
              <span className="text-sm text-gray-400">아마겟돈 인트로 홍보 영상</span>
            )}
          </div>

          {/* 후기 리스트 */}
          <div className="w-[400px] max-md:w-full shrink-0 flex flex-col justify-center">
            {reviews.map((review, idx) => (
              <Link
                key={review.id}
                to="/reviews"
                className={`block no-underline py-5 hover:bg-gray-50 transition-colors ${
                  idx < reviews.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <p className="text-sm text-[#04F87F] font-bold mb-1.5">
                  {review.course?.title || '수강 후기'}
                </p>
                <p className="text-base font-bold text-gray-900 leading-snug whitespace-pre-line line-clamp-2">
                  {review.content}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {review.author_name} | {new Date(review.created_at).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '')}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default VideoPromo
