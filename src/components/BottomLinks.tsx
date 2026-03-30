import { useEffect, useState } from 'react'
import { bannerService } from '../services/bannerService'
import type { Banner } from '../types'

function BottomLinks() {
  const [links, setLinks] = useState<Banner[]>([])

  useEffect(() => {
    bannerService.getByPage('bottom_links').then(setLinks).catch(() => {})
  }, [])

  if (links.length === 0) return null

  return (
    <section className="w-full bg-[#0a0a0a] py-16 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.link_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block rounded-2xl overflow-hidden aspect-[16/9] bg-gray-900 no-underline"
            >
              {link.image_url ? (
                <img
                  src={link.image_url}
                  alt={link.title || ''}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <p className="text-sm text-gray-400 font-medium">{link.title}</p>
                  {link.subtitle && <p className="text-xs text-gray-600 mt-1">{link.subtitle}</p>}
                </div>
              )}
              {link.image_url && link.title && (
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white font-bold text-sm">{link.title}</p>
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
