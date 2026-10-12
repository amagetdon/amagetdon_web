import { useEffect } from 'react'
import { useExternalServices } from '../hooks/useExternalServices'

const MARK_ATTR = 'data-external-service'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; callMethod?: (...a: unknown[]) => void; push?: unknown; loaded?: boolean; version?: string }
    _fbq?: unknown
    Kakao?: { init: (key: string) => void; isInitialized: () => boolean }
    ChannelIO?: ((...args: unknown[]) => void) & { q?: unknown[]; c?: (...args: unknown[]) => void }
    ChannelIOInitialized?: boolean
  }
}

function removeByMark(mark: string) {
  document.querySelectorAll(`[${MARK_ATTR}="${mark}"]`).forEach((el) => el.remove())
}

function upsertMeta(mark: string, name: string, raw: string) {
  // 관리자 칸에 태그 전체(<meta name=".." content="코드" />)나 "이름=코드" 를 붙여 넣어도 코드만 쓴다
  const content = (raw.match(/content\s*=\s*["']([^"']+)["']/i)?.[1] ?? raw.replace(new RegExp(`^${name}=`), '')).trim()
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[${MARK_ATTR}="${mark}"]`)
  if (!content) {
    if (existing) existing.remove()
    return
  }
  if (existing) {
    existing.setAttribute('content', content)
    return
  }
  const meta = document.createElement('meta')
  meta.setAttribute('name', name)
  meta.setAttribute('content', content)
  meta.setAttribute(MARK_ATTR, mark)
  document.head.appendChild(meta)
}

function injectChannelTalk(pluginKey: string) {
  removeByMark('channel-talk')
  const inline = `(function(){var w=window;if(w.ChannelIO){return;}var ch=function(){ch.c(arguments);};ch.q=[];ch.c=function(args){ch.q.push(args);};w.ChannelIO=ch;function l(){if(w.ChannelIOInitialized){return;}w.ChannelIOInitialized=true;var s=document.createElement('script');s.type='text/javascript';s.async=true;s.src='https://cdn.channel.io/plugin/ch-plugin-web.js';var x=document.getElementsByTagName('script')[0];if(x.parentNode){x.parentNode.insertBefore(s,x);}}if(document.readyState==='complete'){l();}else{w.addEventListener('DOMContentLoaded',l);w.addEventListener('load',l);}})();ChannelIO('boot',{pluginKey:'${pluginKey}'});`
  const script = document.createElement('script')
  script.text = inline
  script.setAttribute(MARK_ATTR, 'channel-talk')
  document.head.appendChild(script)
}

function shutdownChannelTalk() {
  removeByMark('channel-talk')
  try {
    if (window.ChannelIO) window.ChannelIO('shutdown')
  } catch {
    // ignore
  }
  window.ChannelIOInitialized = false
}

function injectKakaoSdk(key: string) {
  const alreadyInitialized = !!window.Kakao && typeof window.Kakao.isInitialized === 'function' && window.Kakao.isInitialized()
  if (alreadyInitialized) return

  const run = () => {
    try {
      if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(key)
    } catch {
      // ignore
    }
  }

  if (window.Kakao) {
    run()
    return
  }

  removeByMark('kakao-sdk')
  const script = document.createElement('script')
  script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js'
  script.async = true
  script.setAttribute(MARK_ATTR, 'kakao-sdk')
  script.addEventListener('load', run)
  document.head.appendChild(script)
}

// GTM · GA4 · 메타 픽셀 · 네이버 전환추적은 '픽셀 관리'(PixelInjector / lib/pixels)로 이전 — 여기서는 주입하지 않음(중복 방지)
export default function ExternalServicesInjector() {
  const settings = useExternalServices()

  useEffect(() => {
    const naver = settings.NAVER_SEARCH_ADVISOR
    upsertMeta('naver-verification', 'naver-site-verification', naver?.enabled ? (naver.code || '') : '')
  }, [settings.NAVER_SEARCH_ADVISOR?.enabled, settings.NAVER_SEARCH_ADVISOR?.code])

  useEffect(() => {
    const meta = settings.META_DOMAIN_VERIFICATION
    upsertMeta('facebook-domain-verification', 'facebook-domain-verification', meta?.enabled ? (meta.code || '') : '')
  }, [settings.META_DOMAIN_VERIFICATION?.enabled, settings.META_DOMAIN_VERIFICATION?.code])

  useEffect(() => {
    const google = settings.GOOGLE_SEARCH_CONSOLE
    upsertMeta('google-verification', 'google-site-verification', google?.enabled ? (google.code || '') : '')
  }, [settings.GOOGLE_SEARCH_CONSOLE?.enabled, settings.GOOGLE_SEARCH_CONSOLE?.code])

  useEffect(() => {
    const channel = settings.CHANNEL_TALK
    if (channel?.enabled && channel.code) injectChannelTalk(channel.code)
    else shutdownChannelTalk()
  }, [settings.CHANNEL_TALK?.enabled, settings.CHANNEL_TALK?.code])

  useEffect(() => {
    const login = settings.KAKAO_LOGIN
    const share = settings.KAKAO_SHARE
    const key = (login?.enabled && login.code) || (share?.enabled && share.code) || ''
    if (key) injectKakaoSdk(key)
  }, [
    settings.KAKAO_LOGIN?.enabled,
    settings.KAKAO_LOGIN?.code,
    settings.KAKAO_SHARE?.enabled,
    settings.KAKAO_SHARE?.code,
  ])

  return null
}
