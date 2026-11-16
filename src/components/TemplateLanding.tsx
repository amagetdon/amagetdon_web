import { useEffect, useLayoutEffect, useMemo, useRef, type MouseEvent } from 'react'
import { renderLanding, mountLandingBehaviors, type LandingDoc, type LandingReport } from '../lib/landingTemplate'

// 템플릿 방식 강의 상세 — 섹션 자료(landing_doc)를 표준 순서의 페이지로 그린다.
// 그리기·검사는 src/lib/landingTemplate 가 하고, 여기서는 화면에 넣고 신청 버튼만 사이트의 신청 흐름에 잇는다.
//  - 스타일은 .lpt 아래로만 적용되며, 문서에 한 번만 넣는다.
//  - 글꼴(Pretendard)은 템플릿 랜딩이 실제로 보일 때만 불러온다.

const STYLE_ID = 'lpt-style'
const FONT_ID = 'lpt-font'
const FONT_HREF = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css'

function ensureHeadAssets(css: string) {
  if (!document.getElementById(FONT_ID)) {
    const link = document.createElement('link')
    link.id = FONT_ID
    link.rel = 'stylesheet'
    link.href = FONT_HREF
    document.head.appendChild(link)
  }
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  if (style.textContent !== css) style.textContent = css
}

export default function TemplateLanding({ doc, onApply, onReport, className }: {
  doc: LandingDoc
  /** 랜딩 안의 신청 버튼을 눌렀을 때 — 사이트의 신청 흐름을 그대로 탄다 */
  onApply?: () => void
  /** 점검 결과(사용한 섹션·부족한 자료·걸린 검사) — 관리자 미리보기에서 쓴다 */
  onReport?: (report: LandingReport) => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { html, css, report } = useMemo(() => renderLanding(doc), [doc])

  useEffect(() => { onReport?.(report) }, [report, onReport])
  // 내용은 React 가 아니라 여기서 직접 넣는다 — 다시 그려질 때 React 가 내용을 갈아 끼워 등장 효과·슬라이더 상태가 풀리지 않게
  useLayoutEffect(() => {
    const host = ref.current
    if (!host) return
    ensureHeadAssets(css) // 스타일이 먼저 있어야 화면 안 요소를 바르게 가린다
    host.innerHTML = html
    const page = host.firstElementChild
    const off = page instanceof HTMLElement ? mountLandingBehaviors(page) : undefined
    return () => { off?.(); host.innerHTML = '' }
  }, [html, css])

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a')
    if (!a || !ref.current?.contains(a)) return
    const href = a.getAttribute('href') || ''
    if (a.hasAttribute('data-lpt-apply') || href === '#apply') {
      e.preventDefault()
      onApply?.()
    }
  }

  return <div ref={ref} className={className} onClick={handleClick} />
}
