import { useState, useEffect, useCallback } from 'react'
import { bannerService } from '../services/bannerService'
import type { Banner } from '../types'

function HeroSection() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    bannerService.getByPage('hero')
      .then(setBanners)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % banners.length)
  }, [banners.length])

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + banners.length) % banners.length)
  }, [banners.length])

  // 자동 슬라이드
  useEffect(() => {
    if (banners.length <= 1) return
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [banners.length, next])

  if (loading) {
    return (
      <section className="w-full bg-black py-20 max-sm:py-12">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="h-6 w-48 bg-gray-800 rounded animate-pulse mb-6" />
          <div className="h-12 w-96 max-sm:w-full bg-gray-800 rounded animate-pulse" />
        </div>
      </section>
    )
  }

  // 배너가 없으면 기본 텍스트
  if (banners.length === 0) {
    return (
      <section className="w-full bg-black py-20 max-sm:py-12">
        <div className="max-w-[1200px] mx-auto px-5">
          <h1 className="text-[40px] max-sm:text-2xl text-white font-bold leading-tight">
            아마겟돈 클래스
          </h1>
        </div>
      </section>
    )
  }

  const banner = banners[current]

  return (
    <section className="relative w-full bg-black py-20 max-sm:py-12 overflow-hidden">
      {/* 배경 이미지 */}
      {banner.image_url && (
        <img
          src={banner.image_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30 transition-opacity duration-500"
        />
      )}

      <div className="relative max-w-[1200px] mx-auto px-5">
        {/* 뱃지 */}
        {banner.subtitle && (
          <div className="inline-flex items-center px-5 py-2 border border-gray-500 rounded-full mb-6">
            <span className="text-xs leading-none text-gray-300">{banner.subtitle}</span>
          </div>
        )}

        {/* 타이틀 */}
        <h1 className="text-[40px] max-sm:text-2xl text-white font-bold leading-tight whitespace-pre-line">
          {banner.title}
        </h1>

        {/* 인디케이터 + 화살표 */}
        {banners.length > 1 && (
          <div className="flex items-center gap-3 mt-10">
            <button
              onClick={prev}
              className="w-8 h-8 rounded-full border border-gray-600 bg-transparent text-gray-400 hover:text-white hover:border-gray-400 flex items-center justify-center cursor-pointer transition-colors"
              aria-label="이전"
            >
              <i className="ti ti-chevron-left text-sm" />
            </button>
            <div className="flex gap-1.5">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrent(idx)}
                  className={`h-1.5 rounded-full border-none cursor-pointer transition-all ${
                    idx === current ? 'w-6 bg-[#04F87F]' : 'w-1.5 bg-gray-600 hover:bg-gray-500'
                  }`}
                  aria-label={`배너 ${idx + 1}`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="w-8 h-8 rounded-full border border-gray-600 bg-transparent text-gray-400 hover:text-white hover:border-gray-400 flex items-center justify-center cursor-pointer transition-colors"
              aria-label="다음"
            >
              <i className="ti ti-chevron-right text-sm" />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export default HeroSection
