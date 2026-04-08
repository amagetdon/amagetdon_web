import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const splash = document.getElementById('splash')

function hideSplash() {
  if (!splash) return
  splash.classList.add('hide')
  setTimeout(() => splash.remove(), 400)
}

// 최소 1초 + DOM 로딩 완료 후 제거
const minDelay = new Promise((r) => setTimeout(r, 1000))
const domReady = new Promise<void>((resolve) => {
  const check = () => {
    const main = document.querySelector('main')
    if (main && main.querySelector('section')) {
      resolve()
    } else {
      requestAnimationFrame(check)
    }
  }
  check()
})

Promise.all([minDelay, domReady]).then(hideSplash)

createRoot(document.getElementById('root')!).render(
  <App />,
)
