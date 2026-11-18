import { useEffect, useRef, useState } from 'react'

// 받은 HTML 랜딩을 강의 상세 화면 안에 넣는다(landing_doc = { static: '<slug>' }).
// 같은 사이트의 파일이라 안쪽 문서를 직접 다룬다:
//  - 높이를 내용에 맞춰 늘려 안쪽 스크롤 없이 한 화면처럼 보이게 한다
//  - 랜딩 자체의 하단 고정 바는 숨긴다(강의 화면의 신청 버튼이 그 역할)
//  - 랜딩 안의 신청 버튼(a.cta, #apply)은 사이트의 신청 흐름을 탄다

const EMBED_CSS = 'html,body{overflow:hidden!important}.sticky,.y-sticky,.editbar{display:none!important}'

export default function StaticLandingEmbed({ src, title, onApply }: {
  src: string
  title: string
  onApply: () => void
}) {
  const ref = useRef<HTMLIFrameElement>(null)
  const applyRef = useRef(onApply)
  const [height, setHeight] = useState(1200)

  useEffect(() => { applyRef.current = onApply }, [onApply])

  useEffect(() => {
    const frame = ref.current
    if (!frame) return
    let off: (() => void) | undefined

    const mount = () => {
      off?.()
      const doc = frame.contentDocument
      if (!doc?.body) return
      const style = doc.createElement('style')
      style.textContent = EMBED_CSS
      doc.head.appendChild(style)

      const fit = () => {
        const h = Math.ceil(doc.body.getBoundingClientRect().height)
        if (h > 0) setHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev))
      }
      const ro = new ResizeObserver(fit)
      ro.observe(doc.body)
      fit()

      const onClick = (e: MouseEvent) => {
        const target = e.target as Element | null
        const a = target?.closest?.('a')
        if (!a) return
        if (a.classList.contains('cta') || a.getAttribute('href') === '#apply') {
          e.preventDefault()
          applyRef.current()
        }
      }
      doc.addEventListener('click', onClick, true)
      off = () => { ro.disconnect(); doc.removeEventListener('click', onClick, true) }
    }

    frame.addEventListener('load', mount)
    if (frame.contentDocument?.readyState === 'complete' && frame.contentDocument.body?.childElementCount) mount()
    return () => { frame.removeEventListener('load', mount); off?.() }
  }, [src])

  return (
    <iframe ref={ref} src={`${src}?embed=1`} title={title} data-lp-embed="1" scrolling="no"
      className="w-full border-0 block" style={{ height }} />
  )
}
