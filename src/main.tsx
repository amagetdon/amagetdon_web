import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const splash = document.getElementById('splash')
if (splash) {
  splash.classList.add('hide')
  setTimeout(() => splash.remove(), 400)
}

createRoot(document.getElementById('root')!).render(
  <App />,
)
