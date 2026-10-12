import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isProductionHost, type AdPixelRow } from '../lib/pixels/media'
import { dispatchPageView, setActivePixels } from '../lib/pixels/engine'

/**
 * 관리자 '픽셀 관리'(ad_pixels) 설정을 읽어 활성 매체만 로드.
 * - 캐시 없이 페이지 로드마다 조회 → 관리자에서 저장하면 다음 방문부터 바로 반영.
 * - scope='preview' 매체는 운영 도메인(amag-class.com)이 아닌 곳(Vercel 미리보기 등)에서만 로드.
 * - <Routes> 보다 앞에 렌더되어, 라우트 이동 시 페이지뷰가 페이지 전환 이벤트보다 먼저 나간다.
 */
export default function PixelInjector() {
  useEffect(() => {
    const prod = isProductionHost()
    supabase
      .from('ad_pixels' as never)
      .select('id, media, enabled, scope, pixel_id, events, extra, memo, sort_order, updated_at')
      .eq('enabled', true)
      .order('sort_order')
      .then(({ data, error }) => {
        // 조회 실패 시에도 빈 목록으로 확정해 대기 이벤트가 무한히 쌓이지 않게 함
        const rows = error ? [] : ((data ?? []) as unknown as AdPixelRow[])
        setActivePixels(rows.filter((r) => r.scope === 'all' || !prod))
      })
  }, [])

  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    dispatchPageView()
  }, [pathname])

  return null
}
