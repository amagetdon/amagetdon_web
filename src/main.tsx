import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

// 전역 쿼리 클라이언트 — 동일 queryKey 는 자동 dedup + 캐싱으로 중복 API 호출 제거
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30초간 stale 로 간주 안 함 → 중복 컴포넌트 렌더 중 재요청 방지
      gcTime: 5 * 60_000,       // 5분간 메모리 캐시 유지
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
})

const splash = document.getElementById('splash')

function hideSplash() {
  if (!splash) return
  splash.classList.add('hide')
  setTimeout(() => splash.remove(), 400)
}

// skeleton 완전 제거 후 즉시 스플래시 제거 (첫 진입만)
const dataReady = new Promise<void>((resolve) => {
  const check = () => {
    const main = document.querySelector('main')
    if (!main) { requestAnimationFrame(check); return }
    const sections = main.querySelectorAll('section')
    if (sections.length > 0 && !Array.from(sections).some((s) => s.querySelector('.animate-pulse'))) {
      resolve()
    } else {
      requestAnimationFrame(check)
    }
  }
  check()
})

dataReady.then(() => setTimeout(hideSplash, 350))

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
)
