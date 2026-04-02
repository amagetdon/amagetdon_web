import type { Banner } from '../types'

function BottomLinks({ links }: { links: Banner[] }) {
  if (links.length === 0) return null

  return (
    <section className="w-full bg-white pt-10 pb-20 max-sm:pt-8 max-sm:pb-14">
      <div className="max-w-[1080px] mx-auto px-5">
        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.link_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block rounded-2xl overflow-hidden aspect-[16/9] bg-gray-100 no-underline"
            >
              {link.image_url ? (
                <img
                  src={link.image_url}
                  alt={link.title || ''}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                  <p className="text-sm text-gray-500 font-medium">{link.title}</p>
                  {link.subtitle && <p className="text-xs text-gray-400 mt-1">{link.subtitle}</p>}
                </div>
              )}
              {/* 검은색 오버레이 - subtitle 값을 투명도로 사용 (0~100) */}
              {link.image_url && link.subtitle && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ backgroundColor: `rgba(0,0,0,${Number(link.subtitle) / 100 || 0})` }}
                />
              )}
              {link.image_url && link.title && (
                <div className="absolute inset-0 flex items-end p-5">
                  <p className="text-white font-bold text-sm drop-shadow-lg">{link.title}</p>
                </div>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

export default BottomLinks
