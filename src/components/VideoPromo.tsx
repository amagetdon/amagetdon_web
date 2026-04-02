import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFeaturedReviews } from '../hooks/useReviews'
import { supabase } from '../lib/supabase'
import VideoEmbed from './VideoEmbed'

function VideoPromo() {
  const { reviews } = useFeaturedReviews(5)
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
        <div className="flex gap-8 max-md:flex-col">
          {/* 영상 */}
          <div className="w-[420px] max-md:w-full shrink-0">
            <div className="bg-gray-100 rounded-xl overflow-hidden">
              {videoUrl ? (
                <VideoEmbed url={videoUrl} className="w-full" />
              ) : (
                <div className="aspect-video flex items-center justify-center">
                  <span className="text-sm text-gray-400">프로모 영상이 등록되지 않았습니다</span>
                </div>
              )}
            </div>
          </div>

          {/* 후기 리스트 */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">수강생 후기</h3>
              <Link to="/reviews" className="text-sm text-[#04F87F] font-medium no-underline hover:underline">
                전체보기 →
              </Link>
            </div>
            <div className="flex flex-col divide-y divide-gray-100 flex-1">
              {reviews.map((review) => (
                <Link key={review.id} to="/reviews" className="py-3 first:pt-0 last:pb-0 no-underline hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 mb-1 truncate">{review.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{review.content}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-0.5 text-yellow-400 text-xs mb-0.5">
                        {Array.from({ length: review.rating }).map((_, i) => <span key={i}>★</span>)}
                      </div>
                      <p className="text-xs text-gray-400">{review.author_name}</p>
                    </div>
                  </div>
                  {review.course?.title && (
                    <p className="text-[11px] text-[#04F87F] font-medium mt-1">{review.course.title}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default VideoPromo
