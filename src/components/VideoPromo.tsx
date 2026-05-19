import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import VideoEmbed from './VideoEmbed'
import PurchaseFeed from './PurchaseFeed'

function VideoPromo() {
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
          {/* 영상 - 왼쪽 (16:9 컨테이너에 Vimeo 16:9 영상이 정확히 들어차서 위아래 여백 없음) */}
          <div className="w-[60%] max-md:w-full shrink-0 pr-5 max-md:pr-0 self-start">
            <div className="bg-gray-100 rounded-2xl overflow-hidden aspect-video">
              {videoUrl ? (
                <VideoEmbed url={videoUrl} className="w-full h-full" aspectRatio="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-sm text-gray-400">아마겟돈 인트로 홍보 영상</span>
                </div>
              )}
            </div>
          </div>

          {/* 실시간 구매 현황 - 오른쪽, 영상 높이에 맞춰 세로 자동 롤링 */}
          <PurchaseFeed />
        </div>
      </div>
    </section>
  )
}

export default VideoPromo
