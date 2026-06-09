import { useState, useCallback } from 'react'
import { openExternalBrowser, buildUrlWithStoredUtm } from '../lib/inAppBrowser'

// 인앱 브라우저(인스타/페북)에서 외부 브라우저로 유도하는 동작을 캡슐화한 훅.
// Android 는 intent:// 로 즉시 리다이렉트, iOS 는 안내 모달(InAppBrowserGuideModal)을 띄운다.
// UTM 은 buildUrlWithStoredUtm 으로 URL 에 다시 실어 외부 브라우저로 전달·보존된다.
export function useInAppEscape() {
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideUrl, setGuideUrl] = useState('')

  const escapeToExternalBrowser = useCallback(() => {
    if (openExternalBrowser()) return
    // iOS — 강제 리다이렉트 불가 → 안내 모달
    setGuideUrl(buildUrlWithStoredUtm())
    setGuideOpen(true)
  }, [])

  const closeGuide = useCallback(() => setGuideOpen(false), [])

  return { escapeToExternalBrowser, guideOpen, guideUrl, closeGuide }
}
