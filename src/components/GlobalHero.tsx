import { memo } from 'react'
import { useLocation } from 'react-router-dom'
import HeroSection from './HeroSection'

const UNIQUE_KEYS = ['hero', 'academy_hero', 'landing_hero', 'reviews', 'results', 'faq']

function matchKey(pathname: string, key: string): boolean {
  if (key === 'hero') return pathname === '/'
  if (key === 'academy_hero') return pathname === '/academy'
  if (key === 'landing_hero') return pathname.startsWith('/landing/')
  if (key === 'reviews') return pathname === '/reviews'
  if (key === 'results') return pathname === '/results'
  if (key === 'faq') return pathname === '/faq'
  return false
}

function GlobalHero() {
  const location = useLocation()

  return (
    <>
      {UNIQUE_KEYS.map((pageKey) => (
        <div key={pageKey} style={{ display: matchKey(location.pathname, pageKey) ? 'block' : 'none' }}>
          <HeroSection pageKey={pageKey} />
        </div>
      ))}
    </>
  )
}

export default memo(GlobalHero)
