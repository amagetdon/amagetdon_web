// 그려진 랜딩에 동작을 붙인다: 스크롤 등장, 선물 슬라이더 점, 질문 접기.
// 동작을 붙이지 않아도 내용은 모두 보인다(숨김 상태는 여기서 붙이는 lpt-js 클래스가 있어야만 생긴다).

const REVEAL_CLASS = 'lpt-js'
const SHOWN_CLASS = 'in'

/** html 을 넣은 뒤 호출. 해제 함수를 돌려준다. 요소가 없어도 안전하다. */
export function mountLandingBehaviors(root: HTMLElement): () => void {
  if (typeof window === 'undefined' || !root) return () => {}

  // 루트(.lpt)를 직접 받거나, 그것을 감싼 요소를 받아도 된다
  const page = root.matches('.lpt') ? root : root.querySelector<HTMLElement>('.lpt') ?? root
  const cleanups: Array<() => void> = []

  /* ── 스크롤 등장 ── */
  const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const revealTargets = Array.from(page.querySelectorAll<HTMLElement>('.rv'))
  if (!reduceMotion && revealTargets.length && typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add(SHOWN_CLASS)
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -6% 0px' })
    // 이미 화면 안(또는 위쪽)에 있는 요소는 숨기지 않는다 — 첫 화면이 보였다 사라졌다 다시 나타나지 않게
    const viewportBottom = window.innerHeight
    const pending = revealTargets.filter(el => {
      if (el.getBoundingClientRect().top >= viewportBottom) return true
      el.classList.add(SHOWN_CLASS)
      return false
    })
    page.classList.add(REVEAL_CLASS)
    pending.forEach(el => observer.observe(el))

    // 안전장치: 관찰자가 늦거나 안 불리는 환경(일부 앱 안 브라우저 등)에서도 내용이 숨은 채 남지 않게,
    // 스크롤할 때 화면 위로 올라온 요소를 직접 확인해 보여 준다.
    let lastCheck = 0
    const revealPassed = () => {
      const now = Date.now()
      if (now - lastCheck < 120) return
      lastCheck = now
      const limit = window.innerHeight * 0.94
      for (let i = pending.length - 1; i >= 0; i--) {
        const el = pending[i]
        if (el.classList.contains(SHOWN_CLASS)) { pending.splice(i, 1); continue }
        if (el.getBoundingClientRect().top < limit) {
          el.classList.add(SHOWN_CLASS)
          observer.unobserve(el)
          pending.splice(i, 1)
        }
      }
      if (!pending.length) window.removeEventListener('scroll', revealPassed)
    }
    window.addEventListener('scroll', revealPassed, { passive: true })

    cleanups.push(() => {
      window.removeEventListener('scroll', revealPassed)
      observer.disconnect()
      page.classList.remove(REVEAL_CLASS)
      revealTargets.forEach(el => el.classList.remove(SHOWN_CLASS))
    })
  }

  /* ── 슬라이더: 넘긴 위치에 맞춰 아래 점을 켠다 ── */
  page.querySelectorAll<HTMLElement>('[data-lpt-slider]').forEach(slider => {
    const dots = slider.nextElementSibling?.children
    if (!dots || !dots.length) return
    const onScroll = () => {
      const active = Math.round(slider.scrollLeft / (slider.scrollWidth / dots.length))
      for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i === active)
    }
    slider.addEventListener('scroll', onScroll, { passive: true })
    cleanups.push(() => slider.removeEventListener('scroll', onScroll))
  })

  /* ── 질문 접기: 하나를 열면 나머지는 닫는다 ── */
  const questions = Array.from(page.querySelectorAll<HTMLDetailsElement>('.faq details'))
  questions.forEach(item => {
    const onToggle = () => {
      if (!item.open) return
      questions.forEach(other => { if (other !== item) other.open = false })
    }
    item.addEventListener('toggle', onToggle)
    cleanups.push(() => item.removeEventListener('toggle', onToggle))
  })

  let released = false
  return () => {
    if (released) return
    released = true
    cleanups.forEach(fn => fn())
  }
}
