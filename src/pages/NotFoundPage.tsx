import { useEffect } from 'react'
import { Link } from 'react-router-dom'

// 없는 주소 — 검색엔진이 색인하지 않도록 noindex. (진짜 404 상태 코드는 2단계 서버 HTML 에서 처리)
export default function NotFoundPage() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    meta.setAttribute('data-not-found', '')
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  return (
    <section className="w-full bg-white py-10">
      <div className="max-w-[1200px] mx-auto px-5 text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-gray-500 mb-8">주소가 바뀌었거나 삭제된 페이지입니다.</p>
        <Link to="/" className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold no-underline hover:bg-gray-200 transition-colors">
          홈으로 돌아가기
        </Link>
      </div>
    </section>
  )
}
