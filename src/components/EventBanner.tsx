import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { imgUrl } from '../lib/image'
import { textToHtml } from '../utils/richText'
import type { Banner } from '../types'

type FitMode = 'cover' | 'width' | 'height'

function mediaClassName(fit: FitMode): string {
  const base = 'absolute transition-opacity duration-500'
  if (fit === 'width') return `${base} left-0 right-0 top-1/2 -translate-y-1/2 w-full h-auto max-h-none`
  if (fit === 'height') return `${base} top-0 bottom-0 left-1/2 -translate-x-1/2 h-full w-auto max-w-none`
  return `${base} inset-0 w-full h-full object-cover`
}

const settingsCache = { loaded: false, data: null as Record<string, { height?: string; heightMobile?: string; speed?: string; fit?: string; fitMobile?: string }> | null }

interface EventBannerProps {
  banners: Banner[]
  pageKey: string
}

function EventBanner({ banners, pageKey }: EventBannerProps) {
  const [current, setCurrent] = useState(0)
  const [height, setHeight] = useState<string>('auto')
  const [heightMobile, setHeightMobile] = useState<string>('auto')
  const [speed, setSpeed] = useState<number>(5)
  const [fit, setFit] = useState<FitMode>('cover')
  const [fitMobile, setFitMobile] = useState<FitMode>('cover')
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches)

  useEffect(() => {
    const apply = (s: { height?: string; heightMobile?: string; speed?: string; fit?: string; fitMobile?: string } | undefined) => {
      if (!s) return
      if (s.height) setHeight(s.height)
      if (s.heightMobile) setHeightMobile(s.heightMobile)
      if (s.speed) setSpeed(Number(s.speed) || 5)
      if (s.fit) setFit(s.fit as FitMode)
      if (s.fitMobile) setFitMobile(s.fitMobile as FitMode)
    }
    if (settingsCache.loaded && settingsCache.data) {
      apply(settingsCache.data[pageKey])
      return
    }
    supabase.from('site_settings').select('value').eq('key', 'banner_settings').maybeSingle()
      .then(({ data }) => {
        if (data) {
          const settings = (data as Record<string, unknown>).value as Record<string, { height?: string; heightMobile?: string; speed?: string; fit?: string; fitMobile?: string }>
          settingsCache.loaded = true
          settingsCache.data = settings
          apply(settings?.[pageKey])
        }
      })
  }, [pageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 639px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % banners.length)
  }, [banners.length])

  useEffect(() => {
    if (banners.length <= 1) return
    const timer = setInterval(next, speed * 1000)
    return () => clearInterval(timer)
  }, [banners.length, next, speed])

  if (banners.length === 0) return null

  const banner = banners[current]
  const eff = {
    title: isMobile && banner.title_mobile ? banner.title_mobile : banner.title,
    subtitle: isMobile && banner.subtitle_mobile ? banner.subtitle_mobile : banner.subtitle,
    image_url: isMobile && banner.image_url_mobile ? banner.image_url_mobile : banner.image_url,
    overlay_opacity: isMobile && banner.overlay_opacity_mobile != null ? banner.overlay_opacity_mobile : banner.overlay_opacity,
  }
  const activeHeight = isMobile ? heightMobile : height
  const activeFit = isMobile ? fitMobile : fit
  const hasFixedHeight = activeHeight !== 'auto'

  const handleClick = () => {
    if (banner.link_url) {
      if (banner.link_url.startsWith('http')) window.open(banner.link_url, '_blank')
      else window.location.href = banner.link_url
    }
  }

  return (
    <section
      className={`relative w-full bg-black overflow-hidden flex items-center justify-center ${banner.link_url ? 'cursor-pointer' : ''} ${hasFixedHeight ? '' : 'h-[690px] max-sm:h-[400px]'}`}
      style={hasFixedHeight ? { height: activeHeight } : undefined}
      onClick={banner.link_url ? handleClick : undefined}
    >
      {eff.image_url && (
        <img
          src={imgUrl(eff.image_url, 'wide')}
          alt=""
          loading="lazy"
          className={mediaClassName(activeFit)}
          style={{ opacity: (eff.overlay_opacity ?? 30) / 100 }}
        />
      )}
      <div className="relative text-center px-5 max-w-[800px]">
        {eff.title && (
          <div
            className="text-3xl max-sm:text-xl text-white font-medium leading-snug banner-rich"
            dangerouslySetInnerHTML={{ __html: textToHtml(eff.title) }}
          />
        )}
        {eff.subtitle && (
          <p className="text-base max-sm:text-sm text-gray-300 mt-4 leading-relaxed whitespace-pre-line">
            {eff.subtitle}
          </p>
        )}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`h-1.5 rounded-full border-none cursor-pointer transition-all ${idx === current ? 'w-6 bg-[#2ED573]' : 'w-1.5 bg-gray-600 hover:bg-gray-500'}`}
              aria-label={`배너 ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default EventBanner
