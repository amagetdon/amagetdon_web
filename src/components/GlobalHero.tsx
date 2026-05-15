import { memo, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import HeroSection from './HeroSection'
import { landingCategoryService } from '../services/landingCategoryService'

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

  // 현재 경로가 랜딩 페이지면 슬러그를 추출 — 해당 카테고리의 show_hero 설정에 따라 히어로 노출 제어
  const landingSlug = useMemo(() => {
    const m = location.pathname.match(/^\/landing\/([^/]+)/)
    return m ? decodeURIComponent(m[1]) : null
  }, [location.pathname])

  // 슬러그별 히어로 노출 여부 (미해결 슬러그는 키 없음 → 깜빡임 방지를 위해 해결 전엔 숨김)
  const [heroBySlug, setHeroBySlug] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!landingSlug || landingSlug in heroBySlug) return
    let cancelled = false
    landingCategoryService
      .getBySlug(landingSlug)
      .then((cat) => {
        if (!cancelled) setHeroBySlug((prev) => ({ ...prev, [landingSlug]: cat?.show_hero !== false }))
      })
      .catch(() => {
        if (!cancelled) setHeroBySlug((prev) => ({ ...prev, [landingSlug]: true }))
      })
    return () => { cancelled = true }
  }, [landingSlug, heroBySlug])

  const landingHeroVisible = landingSlug ? heroBySlug[landingSlug] === true : true

  return (
    <>
      {UNIQUE_KEYS.map((pageKey) => {
        const matched = matchKey(location.pathname, pageKey)
        const visible = matched && !(pageKey === 'landing_hero' && !landingHeroVisible)
        return (
          <div key={pageKey} style={{ display: visible ? 'block' : 'none' }}>
            <HeroSection pageKey={pageKey} />
          </div>
        )
      })}
    </>
  )
}

export default memo(GlobalHero)
