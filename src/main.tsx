import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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
  <App />,
)
