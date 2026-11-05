import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import SeoHead from '../components/SeoHead'
import NotFoundPage from './NotFoundPage'
import { setChromeHidden } from '../lib/chrome'
import { STATIC_LANDINGS } from '../lib/staticLandings'

// 받은 HTML 랜딩 /lp/:slug — 사이트 헤더·푸터 없이 꽉 찬 화면으로 띄운다. 설정은 lib/staticLandings.ts
export default function StaticLandingPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const cfg = STATIC_LANDINGS[slug]

  useEffect(() => {
    if (!cfg) return
    setChromeHidden(true)
    return () => setChromeHidden(false)
  }, [cfg])

  if (!cfg) return <NotFoundPage />
  return (
    <div className="fixed inset-0 bg-[#050506]">
      {/* 제목·설명은 서버(api/_lib/render-page.ts)가 noindex 와 함께 넣는다 — 앱 안에서도 같은 제목 유지 */}
      <SeoHead override={{ title: cfg.title, description: cfg.description }} />
      <iframe src={cfg.src} title={cfg.title} className="w-full h-full border-0 block" />
    </div>
  )
}
