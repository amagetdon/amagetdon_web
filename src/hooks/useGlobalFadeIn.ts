import { useEffect } from 'react'

export function useGlobalFadeIn() {
  useEffect(() => {
    const done = new WeakSet<Element>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !done.has(entry.target)) {
            const el = entry.target as HTMLElement
            done.add(el)
            el.classList.add('visible')
            observer.unobserve(el)
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
        if (done.has(el)) return
        if (el.classList.contains('fade-in-up')) return
        el.classList.add('fade-in-up')
        observer.observe(el)
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
