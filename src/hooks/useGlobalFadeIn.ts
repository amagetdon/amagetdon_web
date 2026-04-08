import { useEffect } from 'react'

export function useGlobalFadeIn() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            el.classList.add('visible')
            observer.unobserve(el)
            // transition 완료 후 transform/opacity 속성 완전 제거
            el.addEventListener('transitionend', () => {
              el.style.transform = ''
              el.style.opacity = ''
              el.classList.remove('fade-in-up', 'visible')
            }, { once: true })
          }
        }
      },
      { threshold: 0.08 }
    )

    const applyObserver = () => {
      const sections = document.querySelectorAll('main > * > section:not([data-no-fade]), main > * > div > section:not([data-no-fade]), main section:not([data-no-fade]), main > * > div.max-w-\\[1200px\\]')
      sections.forEach((el) => {
        if (el.closest('[data-no-fade]')) return
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
