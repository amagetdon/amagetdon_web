import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFeaturedReviews } from '../hooks/useReviews'
import { supabase } from '../lib/supabase'
import VideoEmbed from './VideoEmbed'

function VideoPromo() {
  const { reviews } = useFeaturedReviews(3)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'promo_video').maybeSingle()
      .then(({ data }) => {
        if (data) setVideoUrl(((data as Record<string, unknown>).value as Record<string, string>)?.url || null)
      })
  }, [])

  return (
    <section className="w-full bg-white py-14 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex max-md:flex-col max-md:gap-5">
          {/* 영상 - 왼쪽 */}
          <div className="w-[60%] max-md:w-full shrink-0 pr-5 max-md:pr-0">
            <div className="bg-gray-100 rounded-2xl overflow-hidden h-full flex items-center justify-center">
              {videoUrl ? (
                <VideoEmbed url={videoUrl} className="w-full" aspectRatio="aspect-[16/10]" />
              ) : (
                <div className="aspect-video flex items-center justify-center w-full">
                  <span className="text-sm text-gray-400">아마겟돈 인트로 홍보 영상</span>
                </div>
              )}
            </div>
          </div>

          {/* 후기 - 오른쪽, 영상 높이에 맞춤 */}
          <div className="flex-1 flex flex-col">
            {reviews.map((review, idx) => (
              <Link
                key={review.id}
                to="/reviews"
                className={`flex-1 no-underline bg-white border border-gray-200 px-6 flex flex-col justify-center hover:bg-gray-50 transition-colors ${
                  idx === 0 ? 'rounded-t-2xl pt-5 pb-4 border-b-0' : idx === reviews.length - 1 ? 'rounded-b-2xl pt-4 pb-5' : 'py-4 border-b-0'
                }`}
              >
                <p className="text-sm text-[#2ED573] font-bold mb-1.5">
                  {review.course?.title || '수강 후기'}
                </p>
                <p className="text-[17px] font-bold text-gray-900 leading-relaxed line-clamp-2">
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
