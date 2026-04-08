import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function useGlobalFadeIn() {
  const location = useLocation()

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.08 }
    )

    const applyObserver = () => {
      const sections = document.querySelectorAll('main > * > section, main > * > div > section, main section, main > * > div.max-w-\\[1200px\\]')
      sections.forEach((el) => {
        if (!el.classList.contains('fade-in-up') && !el.classList.contains('visible')) {
          el.classList.add('fade-in-up')
          observer.observe(el)
        }
      })
    }

    applyObserver()
    const mo = new MutationObserver(applyObserver)
    const main = document.querySelector('main')
    if (main) mo.observe(main, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mo.disconnect()
    }
  }, [])
}
