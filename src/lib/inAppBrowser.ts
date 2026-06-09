// 인스타/페북 등 인앱 브라우저(WebView) 감지 + 외부 브라우저 유도 유틸.
//
// 카카오 OAuth 의 "카카오톡으로 로그인" 버튼은 인앱 WebView 에서 카카오가 의도적으로 숨긴다.
// (앱-투-앱 로그인 후 호출한 WebView 로 복귀가 불가능하기 때문 — 카카오 측 의도된 동작)
// 구글 OAuth 는 아예 WebView 접근 자체를 차단한다(disallowed_useragent).
// 따라서 인앱 브라우저에서는 외부 브라우저로 내보내야 정상적으로 소셜 로그인이 가능하다.
//
// UTM 은 UtmCapture(App.tsx) 가 sessionStorage 에 저장하는데, sessionStorage 는
// 인앱↔외부 브라우저 간 공유되지 않으므로, 외부 브라우저로 넘길 때 URL 쿼리에 다시 실어 보존한다.

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

export type InAppInfo = {
  isInApp: boolean
  isAndroid: boolean
  isIOS: boolean
  app: 'instagram' | 'facebook' | 'line' | null
}

// 카카오 로그인이 깨지는 것으로 알려진 인앱 브라우저만 타깃팅한다.
// 카카오톡 자체 인앱 브라우저(KAKAOTALK)는 카카오 로그인이 정상 동작하므로 제외.
export function detectInAppBrowser(ua: string = navigator.userAgent): InAppInfo {
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)

  let app: InAppInfo['app'] = null
  if (/Instagram/i.test(ua)) app = 'instagram'
  else if (/FBAN|FBAV|FB_IAB|FB4A/i.test(ua)) app = 'facebook'
  else if (/Line\//i.test(ua)) app = 'line'

  const isKakaoBrowser = /KAKAOTALK/i.test(ua)
  const isInApp = !isKakaoBrowser && app !== null

  return { isInApp, isAndroid, isIOS, app }
}

// sessionStorage 에 저장된 UTM 을 현재 URL 에 다시 붙여, 외부 브라우저로 그대로 넘길 URL 을 만든다.
// 이미 URL 에 있는 값은 건드리지 않고, 빠진 키만 sessionStorage 에서 복원한다.
export function buildUrlWithStoredUtm(): string {
  const url = new URL(window.location.href)
  for (const key of UTM_KEYS) {
    if (url.searchParams.get(key)) continue
    try {
      const stored = sessionStorage.getItem(key)
      if (stored) url.searchParams.set(key, stored)
    } catch {
      // sessionStorage 접근 불가(프라이빗 모드 등) — 무시
    }
  }
  return url.toString()
}

// 외부 브라우저로 유도한다.
// - Android: intent:// 스킴으로 크롬을 강제로 연다(URL=UTM 포함 → 보존). 성공 시 true.
// - iOS: WebView 에서 사파리로의 강제 리다이렉트는 애플이 차단 → false 를 반환해
//        호출부가 "외부 브라우저로 열기" 안내 UI 를 띄우도록 한다.
export function openExternalBrowser(): boolean {
  const { isAndroid } = detectInAppBrowser()
  const target = buildUrlWithStoredUtm()

  if (isAndroid) {
    const withoutScheme = target.replace(/^https?:\/\//, '')
    const fallback = encodeURIComponent(target)
    // package=com.android.chrome 로 크롬 지정, 미설치 시 browser_fallback_url 로 안전하게 폴백.
    window.location.href =
      `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;` +
      `S.browser_fallback_url=${fallback};end`
    return true
  }

  return false
}
