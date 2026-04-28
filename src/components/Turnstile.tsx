import { useEffect, useRef } from 'react'

// Cloudflare Turnstile 공식 스크립트는 index.html 에서 로드됩니다.
// VITE_TURNSTILE_SITE_KEY 환경 변수가 비어 있으면 위젯을 표시하지 않고 onVerify 를 즉시 호출 (개발/미설정 환경).

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string
          callback?: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'compact' | 'flexible' | 'invisible'
          appearance?: 'always' | 'execute' | 'interaction-only'
        },
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

interface Props {
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: () => void
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact' | 'flexible'
  className?: string
}

export default function Turnstile({ onVerify, onExpire, onError, theme = 'auto', size = 'flexible', className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)
  const onErrorRef = useRef(onError)
  onVerifyRef.current = onVerify
  onExpireRef.current = onExpire
  onErrorRef.current = onError

  useEffect(() => {
    // 키 미설정 시 — 검증 우회 (개발 환경 / 키 발급 전)
    if (!SITE_KEY) {
      onVerifyRef.current('')
      return
    }

    let cancelled = false
    const tryRender = () => {
      if (cancelled) return
      if (!window.turnstile || !ref.current) {
        setTimeout(tryRender, 200)
        return
      }
      // 동일 ref 에 중복 render 방지
      if (widgetIdRef.current) return

      try {
        widgetIdRef.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          theme,
          size,
          callback: (token) => onVerifyRef.current(token),
          'expired-callback': () => onExpireRef.current?.(),
          'error-callback': () => onErrorRef.current?.(),
        })
      } catch {
        // 이미 다른 곳에서 render 됐거나 일시 오류 — 무시
      }
    }
    tryRender()

    return () => {
      cancelled = true
      const id = widgetIdRef.current
      widgetIdRef.current = null
      if (id && window.turnstile) {
        try { window.turnstile.remove(id) } catch { /* noop */ }
      }
    }
  }, [theme, size])

  if (!SITE_KEY) return null
  return <div ref={ref} className={className} />
}
