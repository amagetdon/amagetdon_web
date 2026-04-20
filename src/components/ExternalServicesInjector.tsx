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

function upsertMeta(mark: string, name: string, content: string) {
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

function injectScript(mark: string, src: string | null, inline: string | null, parent: 'head' | 'body' = 'head', async = true) {
  removeByMark(mark)
  const script = document.createElement('script')
  if (src) {
    script.src = src
    script.async = async
  }
  if (inline) script.text = inline
  script.setAttribute(MARK_ATTR, mark)
  ;(parent === 'head' ? document.head : document.body).appendChild(script)
}

function injectGtm(id: string) {
  removeByMark('gtm-inline')
  removeByMark('gtm-noscript')
  const inline = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`
  const script = document.createElement('script')
  script.text = inline
  script.setAttribute(MARK_ATTR, 'gtm-inline')
  document.head.appendChild(script)

  const noscript = document.createElement('noscript')
  noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`
  noscript.setAttribute(MARK_ATTR, 'gtm-noscript')
  document.body.insertBefore(noscript, document.body.firstChild)
}

function injectGa4(id: string) {
  removeByMark('ga4-src')
  removeByMark('ga4-inline')
  injectScript('ga4-src', `https://www.googletagmanager.com/gtag/js?id=${id}`, null)
  const inline = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`
  const script = document.createElement('script')
  script.text = inline
  script.setAttribute(MARK_ATTR, 'ga4-inline')
  document.head.appendChild(script)
  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function gtag(...args: unknown[]) { (window.dataLayer as unknown[]).push(args) }
}

function injectMetaPixel(id: string) {
  removeByMark('meta-pixel')
  const inline = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`
  const script = document.createElement('script')
  script.text = inline
  script.setAttribute(MARK_ATTR, 'meta-pixel')
  document.head.appendChild(script)
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

export default function ExternalServicesInjector() {
  const settings = useExternalServices()

  useEffect(() => {
    const gtm = settings.GOOGLE_TAG_MANAGER
    if (gtm?.enabled && gtm.code) injectGtm(gtm.code)
    else {
      removeByMark('gtm-inline')
      removeByMark('gtm-noscript')
    }
  }, [settings.GOOGLE_TAG_MANAGER?.enabled, settings.GOOGLE_TAG_MANAGER?.code])

  useEffect(() => {
    const ga = settings.GOOGLE_ANALYTICS
    if (ga?.enabled && ga.code) injectGa4(ga.code)
    else {
      removeByMark('ga4-src')
      removeByMark('ga4-inline')
    }
  }, [settings.GOOGLE_ANALYTICS?.enabled, settings.GOOGLE_ANALYTICS?.code])

  useEffect(() => {
    const pixel = settings.META_PIXEL
    if (pixel?.enabled && pixel.code) injectMetaPixel(pixel.code)
    else removeByMark('meta-pixel')
  }, [settings.META_PIXEL?.enabled, settings.META_PIXEL?.code])

  useEffect(() => {
    const naver = settings.NAVER_SEARCH_ADVISOR
    upsertMeta('naver-verification', 'naver-site-verification', naver?.enabled ? (naver.code || '') : '')
  }, [settings.NAVER_SEARCH_ADVISOR?.enabled, settings.NAVER_SEARCH_ADVISOR?.code])

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
