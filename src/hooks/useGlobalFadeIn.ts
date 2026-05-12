import { useEffect } from 'react'

export function useGlobalFadeIn() {
  useEffect(() => {
    const done = new WeakSet<Element>()

    // 한 element 의 cleanup 을 한 번만 실행 — transitionend 또는 fallback timeout 둘 중 먼저 오는 쪽.
    const cleanup = (el: HTMLElement) => {
      el.style.transform = ''
      el.style.opacity = ''
      el.classList.remove('fade-in-up', 'visible')
    }

    const markVisible = (el: HTMLElement) => {
      if (done.has(el)) return
      done.add(el)
      el.classList.add('visible')
      observer.unobserve(el)
      let cleaned = false
      const safeCleanup = () => {
        if (cleaned) return
        cleaned = true
        cleanup(el)
      }
      el.addEventListener('transitionend', safeCleanup, { once: true })
      // 안전망: transition (0.6s) 가 끝나도 transitionend 가 발화 안 되는 케이스 (탭 백그라운드, 비주얼 변화 없음 등) 대비.
      setTimeout(safeCleanup, 1000)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) markVisible(entry.target as HTMLElement)
        }
      },
      { threshold: 0.08 }
    )

    const applyObserver = () => {
      const sections = document.querySelectorAll('main > * > section:not([data-no-fade]), main > * > div > section:not([data-no-fade]), main section:not([data-no-fade]), main > * > div.max-w-\\[1200px\\]')
      sections.forEach((node) => {
        const el = node as HTMLElement
        if (el.closest('[data-no-fade]')) return
        if (done.has(el)) return
        if (el.classList.contains('fade-in-up')) return
        el.classList.add('fade-in-up')
        // mount 시점 이미 viewport 안에 있는 element 는 IntersectionObserver 첫 콜백이 안 오는 케이스가 있어
        // 직접 rect 체크 후 즉시 visible 처리. 그 외엔 observer 에 맡김.
        const rect = el.getBoundingClientRect()
        const vh = window.innerHeight || document.documentElement.clientHeight
        const inView = rect.top < vh && rect.bottom > 0
        if (inView) {
          // 다음 frame 에 visible 추가 → transition 발화 보장
          requestAnimationFrame(() => requestAnimationFrame(() => markVisible(el)))
        } else {
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
