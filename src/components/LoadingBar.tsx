import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export default function LoadingBar() {
  const location = useLocation()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }

    setProgress(20)
    setVisible(true)

    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p
        return p + Math.random() * 8
      })
    }, 300)

    // DOM에 콘텐츠가 렌더될 때까지 대기
    const checkDone = setInterval(() => {
      const main = document.querySelector('main')
      if (!main) return
      const sections = main.querySelectorAll('section')
      if (sections.length === 0) return
      // 모든 section에서 skeleton이 사라졌는지 확인
      const hasAnyLoading = Array.from(sections).some((s) => s.querySelector('.animate-pulse'))
      if (!hasAnyLoading) {
        clearInterval(checkDone)
        if (timerRef.current) clearInterval(timerRef.current)
        setProgress(100)
        setTimeout(() => {
          setVisible(false)
          setProgress(0)
        }, 300)
      }
    }, 100)

    // 최대 5초 후 강제 종료
    const maxTimeout = setTimeout(() => {
      clearInterval(checkDone)
      if (timerRef.current) clearInterval(timerRef.current)
      setProgress(100)
      setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
    }, 5000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      clearInterval(checkDone)
      clearTimeout(maxTimeout)
    }
  }, [location.pathname])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none">
      <div
        className="h-full bg-[#2ED573]"
        style={{
          width: `${progress}%`,
          transition: progress === 100 ? 'width 0.2s ease-out' : 'width 0.4s ease',
          boxShadow: '0 0 8px rgba(46,213,115,0.4)',
        }}
      />
    </div>
  )
}
