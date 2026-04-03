import type { Banner } from '../types'

interface EventBannerProps {
  banner: Banner
}

function EventBanner({ banner }: EventBannerProps) {
  const handleClick = () => {
    if (banner.link_url) {
      if (banner.link_url.startsWith('http')) window.open(banner.link_url, '_blank')
      else window.location.href = banner.link_url
    }
  }

  return (
    <section
      className={`relative w-full bg-black h-[690px] max-sm:h-[400px] flex items-center justify-center overflow-hidden ${banner.link_url ? 'cursor-pointer' : ''}`}
      onClick={banner.link_url ? handleClick : undefined}
    >
      {banner.image_url && (
        <img
          src={banner.image_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: (banner.overlay_opacity ?? 30) / 100 }}
        />
      )}
      <div className="relative text-center px-5 max-w-[800px]">
        {banner.title && (
          <h2 className="text-3xl max-sm:text-xl text-white font-bold leading-snug whitespace-pre-line">
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p className="text-base max-sm:text-sm text-gray-300 mt-4 leading-relaxed whitespace-pre-line">
            {banner.subtitle}
          </p>
        )}
      </div>
    </section>
  )
}

export default EventBanner
