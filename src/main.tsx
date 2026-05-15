import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

// 새 배포로 chunk 해시가 바뀐 직후, 옛 index.html 을 갖고 있는 클라이언트가 사라진 chunk 를
// 요청하면서 SPA fallback 으로 index.html (text/html) 이 반환됨 → "Expected a JavaScript module" 에러.
// 한 번만 자동 reload 해서 새 index.html + 새 chunk 해시로 복구. 무한 루프 방지를 위해 sessionStorage flag 사용.
const handleChunkLoadFailure = () => {
  const FLAG = '__chunk_reload_attempted__'
  if (sessionStorage.getItem(FLAG)) return
  sessionStorage.setItem(FLAG, '1')
  window.location.reload()
}
window.addEventListener('vite:preloadError', handleChunkLoadFailure)
window.addEventListener('error', (e) => {
  const msg = e?.message || ''
  if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
    handleChunkLoadFailure()
  }
})
window.addEventListener('unhandledrejection', (e) => {
  const reason = String(e?.reason?.message || e?.reason || '')
  if (/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \d+ failed/i.test(reason)) {
    handleChunkLoadFailure()
  }
})
// 정상 첫 로드(또는 reload 후) 일정 시간 뒤 flag 해제 — 이후 진짜 다음 배포 때 다시 reload 가능하도록
window.setTimeout(() => sessionStorage.removeItem('__chunk_reload_attempted__'), 30_000)

// 새 배포 감지 — SPA 라서 한 번 열린 세션은 index.html 을 다시 받지 않는다.
// 특히 모바일은 탭/세션을 백그라운드에 오래 살려두므로, 화면으로 돌아올 때
// version.json 을 비교해 새 배포면 자동 새로고침한다 (사용자가 직접 새로고침할 필요 없음).
let loadedVersion: string | null = null

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { id?: unknown }
    return typeof data.id === 'string' ? data.id : null
  } catch {
    return null
  }
}

async function checkForUpdate() {
  const latest = await fetchVersion()
  if (!latest) return
  // 최초 1회는 기준값만 저장
  if (loadedVersion == null) {
    loadedVersion = latest
    return
  }
  if (latest === loadedVersion) return
  // 무한 새로고침 방지 — 60초 내 재시도 차단
  const FLAG = '__version_reload_at__'
  const last = Number(sessionStorage.getItem(FLAG) || 0)
  if (Date.now() - last < 60_000) return
  sessionStorage.setItem(FLAG, String(Date.now()))
  window.location.reload()
}

checkForUpdate()
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForUpdate()
})
// 뒤로가기/앞으로가기 bfcache 복원 시에도 검사
window.addEventListener('pageshow', (e) => {
  if (e.persisted) checkForUpdate()
})

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
