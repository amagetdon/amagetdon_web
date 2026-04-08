import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export default function LoadingBar() {
  const location = useLocation()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isFirst = useRef(true)

  useEffect(() => {
    // 첫 마운트는 무시
    if (isFirst.current) {
      isFirst.current = false
      return
    }

    setProgress(20)
    setVisible(true)

    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p
        return p + Math.random() * 10
      })
    }, 200)

    const done = setTimeout(() => {
      if (timerRef.current) clearInterval(timerRef.current)
      setProgress(100)
      setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
    }, 400)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      clearTimeout(done)
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
