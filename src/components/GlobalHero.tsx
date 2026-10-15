import { memo, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import HeroSection from './HeroSection'
import { prefetchHeroBanners } from '../lib/heroBannerCache'

const UNIQUE_KEYS = ['hero', 'academy_hero', 'reviews', 'results', 'faq']

function matchKey(pathname: string, key: string): boolean {
  if (key === 'hero') return pathname === '/'
  if (key === 'academy_hero') return pathname === '/academy'
  if (key === 'reviews') return pathname === '/reviews'
  if (key === 'results') return pathname === '/results'
  if (key === 'faq') return pathname === '/faq'
  return false
}

// 예전엔 5개 페이지 히어로를 모두 그려 두고 안 보이는 것만 숨겼다 → 어느 페이지로 들어오든
// 5개 히어로의 이미지·영상을 전부 받았다 (강의 상세처럼 히어로가 없는 페이지도).
// 지금은 현재 페이지 히어로만 그리고, 나머지는 첫 화면이 뜬 뒤 배너 목록만 미리 받아 둔다.
function GlobalHero() {
  const location = useLocation()
  const pageKey = UNIQUE_KEYS.find((key) => matchKey(location.pathname, key))

  useEffect(() => {
    const t = window.setTimeout(() => UNIQUE_KEYS.forEach(prefetchHeroBanners), 3000)
    return () => window.clearTimeout(t)
  }, [])

  if (!pageKey) return null
  return <HeroSection key={pageKey} pageKey={pageKey} />
}

export default memo(GlobalHero)
