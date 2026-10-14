import { bannerService } from '../services/bannerService'
import type { Banner } from '../types'

// 페이지별 히어로 배너 목록 캐시 (HeroSection 이 사용)
export const bannerCache = new Map<string, Banner[]>()

// 다른 페이지 히어로의 배너 목록(글자 데이터)만 미리 받아 둔다 — 이미지/영상은 받지 않음.
// 페이지를 옮겼을 때 회색 로딩 없이 바로 뜨게 하기 위함 (GlobalHero 에서 첫 화면이 뜬 뒤 호출)
export function prefetchHeroBanners(pageKey: string) {
  if (bannerCache.has(pageKey)) return
  bannerService.getByPage(pageKey).then((data) => { bannerCache.set(pageKey, data) }).catch(() => {})
}
