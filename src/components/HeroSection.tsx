import { useState, useEffect, useCallback } from 'react'
import { bannerService } from '../services/bannerService'
import { supabase } from '../lib/supabase'
import type { Banner } from '../types'

function getEmbedUrl(url: string): { type: 'youtube' | 'raw'; src: string } | null {
  if (!url) return null
  // youtu.be/ID or youtube.com/watch?v=ID or youtube.com/embed/ID
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return { type: 'youtube', src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${ytMatch[1]}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1` }
  // vimeo.com/ID
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return { type: 'youtube', src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1&loop=1&background=1` }
  // direct mp4/webm
  return { type: 'raw', src: url }
}

const bannerCache = new Map<string, Banner[]>()
const settingsCache = { loaded: false, data: null as Record<string, { height?: string; speed?: string }> | null }

interface HeroSectionProps {
  banners?: Banner[]
  loading?: boolean
  height?: string
  speed?: number
  pageKey?: string
}

function HeroSection({ banners: propBanners, loading: propLoading, height: propHeight, speed: propSpeed, pageKey = 'hero' }: HeroSectionProps) {
  const cached = bannerCache.get(pageKey)
  const [selfBanners, setSelfBanners] = useState<Banner[]>(cached || [])
  const [selfLoading, setSelfLoading] = useState(!propBanners && !cached)
  const [current, setCurrent] = useState(0)
  const [heroHeight, setHeroHeight] = useState<string>(propHeight || 'auto')
  const [heroSpeed, setHeroSpeed] = useState<number>(propSpeed || 5)

  const banners = propBanners ?? selfBanners
  const loading = propLoading ?? selfLoading

  useEffect(() => {
    if (propBanners) return
    if (bannerCache.has(pageKey)) {
      setSelfBanners(bannerCache.get(pageKey)!)
      setSelfLoading(false)
      return
    }
    bannerService.getByPage(pageKey)
      .then((data) => {
        bannerCache.set(pageKey, data)
        setSelfBanners(data)
      })
      .catch(() => {})
      .finally(() => setSelfLoading(false))
  }, [propBanners, pageKey])

  useEffect(() => {
    if (propHeight && propSpeed) return
    if (settingsCache.loaded && settingsCache.data) {
      const s = settingsCache.data[pageKey]
      if (!propHeight && s?.height) setHeroHeight(s.height)
      if (!propSpeed && s?.speed) setHeroSpeed(Number(s.speed) || 5)
      return
    }
    supabase.from('site_settings').select('value').eq('key', 'banner_settings').maybeSingle()
      .then(({ data }) => {
        if (data) {
          const settings = (data as Record<string, unknown>).value as Record<string, { height?: string; speed?: string }>
          settingsCache.loaded = true
          settingsCache.data = settings
          const s = settings?.[pageKey]
          if (!propHeight && s?.height) setHeroHeight(s.height)
          if (!propSpeed && s?.speed) setHeroSpeed(Number(s.speed) || 5)
        }
      })
  }, [propHeight, propSpeed, pageKey])

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % banners.length)
  }, [banners.length])

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + banners.length) % banners.length)
  }, [banners.length])

  useEffect(() => {
    if (banners.length <= 1) return
    const timer = setInterval(next, heroSpeed * 1000)
    return () => clearInterval(timer)
  }, [banners.length, next, heroSpeed])

  const hasFixedHeight = heroHeight !== 'auto'

  if (loading) {
    return (
      <section data-no-fade className="w-full bg-black py-20 max-sm:py-12">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="h-5 w-40 bg-gray-800 rounded-full animate-pulse mb-6" />
          <div className="h-12 w-[420px] max-sm:w-full bg-gray-800 rounded animate-pulse mb-3" />
          <div className="h-12 w-72 max-sm:w-3/4 bg-gray-800 rounded animate-pulse" />
          <div className="flex items-center gap-3 mt-10">
            <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse" />
            <div className="flex gap-1.5">
              <div className="w-6 h-1.5 rounded-full bg-gray-800 animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-800 animate-pulse" />
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse" />
          </div>
        </div>
      </section>
    )
  }

  if (banners.length === 0) {
    return (
      <section data-no-fade className="w-full bg-black py-20 max-sm:py-12">
        <div className="max-w-[1200px] mx-auto px-5">
          <h1 className="text-[40px] max-sm:text-2xl text-white font-bold leading-tight">
            아마겟돈 클래스
          </h1>
        </div>
      </section>
    )
  }

  const banner = banners[current]
  const videoInfo = banner.video_url ? getEmbedUrl(banner.video_url) : null
  const isVideo = (banner.media_type === 'video' || banner.video_url) && videoInfo

  const handleBannerClick = () => {
    if (banner.link_url) {
      try {
        const url = new URL(banner.link_url, window.location.origin)
        if (['http:', 'https:'].includes(url.protocol)) {
          if (banner.link_url.startsWith('http')) window.open(banner.link_url, '_blank', 'noopener')
          else window.location.href = banner.link_url
        }
      } catch {
        if (banner.link_url.startsWith('/')) {
          window.location.href = banner.link_url
        }
      }
    }
  }

  return (
    <section
      data-no-fade
      className={`relative w-full bg-black overflow-hidden ${banner.link_url ? 'cursor-pointer' : ''} ${hasFixedHeight ? 'flex items-center justify-start' : 'py-20 max-sm:py-12'}`}
      style={hasFixedHeight ? { height: heroHeight } : undefined}
      onClick={banner.link_url ? handleBannerClick : undefined}
    >
      {isVideo && videoInfo ? (
        videoInfo.type === 'youtube' ? (
          <div className="absolute inset-0 overflow-hidden" style={{ opacity: (banner.overlay_opacity ?? 30) / 100 }}>
            <iframe
              key={videoInfo.src}
              src={videoInfo.src}
              className="absolute top-1/2 left-1/2 border-none pointer-events-none"
              style={{ width: '300%', height: '300%', transform: 'translate(-50%, -50%)' }}
              allow="autoplay; encrypted-media"
              tabIndex={-1}
            />
          </div>
        ) : (
          <video
            key={videoInfo.src}
            src={videoInfo.src}
            poster={banner.image_url || undefined}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
            style={{ opacity: (banner.overlay_opacity ?? 30) / 100 }}
            autoPlay
            loop
            muted
            playsInline
          />
        )
      ) : banner.image_url ? (
        <img src={banner.image_url} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500" style={{ opacity: (banner.overlay_opacity ?? 30) / 100 }} />
      ) : null}
      <div className="relative w-full max-w-[1200px] mx-auto px-5">
        {banner.subtitle && (
          <div className="inline-flex items-center px-5 py-2 border border-gray-500 rounded-full mb-6">
            <span className="text-xs leading-none text-gray-300">{banner.subtitle}</span>
          </div>
        )}
        <h1 className="text-[40px] max-sm:text-2xl text-white font-bold leading-tight whitespace-pre-line">
          {banner.title}
        </h1>
        {banners.length > 1 && (
          <div className="flex items-center gap-3 mt-10" onClick={(e) => e.stopPropagation()}>
            <button onClick={prev} className="w-8 h-8 rounded-full border border-gray-600 bg-transparent text-gray-400 hover:text-white hover:border-gray-400 flex items-center justify-center cursor-pointer transition-colors" aria-label="이전">
              <i className="ti ti-chevron-left text-sm" />
            </button>
            <div className="flex gap-1.5">
              {banners.map((_, idx) => (
                <button key={idx} onClick={() => setCurrent(idx)} className={`h-1.5 rounded-full border-none cursor-pointer transition-all ${idx === current ? 'w-6 bg-[#2ED573]' : 'w-1.5 bg-gray-600 hover:bg-gray-500'}`} aria-label={`배너 ${idx + 1}`} />
              ))}
            </div>
            <button onClick={next} className="w-8 h-8 rounded-full border border-gray-600 bg-transparent text-gray-400 hover:text-white hover:border-gray-400 flex items-center justify-center cursor-pointer transition-colors" aria-label="다음">
              <i className="ti ti-chevron-right text-sm" />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export default HeroSection
