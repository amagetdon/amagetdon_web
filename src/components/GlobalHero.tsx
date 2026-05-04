import { memo } from 'react'
import { useLocation } from 'react-router-dom'
import HeroSection from './HeroSection'

const UNIQUE_KEYS = ['hero', 'reviews', 'results', 'faq']
const KEY_PATHS: Record<string, string[]> = {
  hero: ['/', '/academy'],
  reviews: ['/reviews'],
  results: ['/results'],
  faq: ['/faq'],
}

function GlobalHero() {
  const location = useLocation()

  return (
    <>
      {UNIQUE_KEYS.map((pageKey) => (
        <div key={pageKey} style={{ display: KEY_PATHS[pageKey].includes(location.pathname) ? 'block' : 'none' }}>
          <HeroSection pageKey={pageKey} />
        </div>
      ))}
    </>
  )
}

export default memo(GlobalHero)
