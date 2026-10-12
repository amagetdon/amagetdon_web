// 광고 매체 픽셀 엔진 — 기존 전환 이벤트(tracking.ts)를 활성화된 매체에만 매체별 형식으로 변환해 전달.
//
// - 매체 설정은 관리자 '픽셀 관리'(ad_pixels)에서 읽어 PixelInjector 가 setActivePixels 로 넘김.
// - OFF 매체·적용 범위 밖(미리보기 전용) 매체는 스크립트 자체를 불러오지 않음. 모든 스크립트는 async.
// - 매체 하나가 실패해도(잘못된 ID, 차단, 스크립트 오류) 다른 매체·결제 흐름에 영향 없게 호출마다 try/catch.
// - 설정 로딩 전에 발생한 이벤트(결제 완료 페이지 직접 진입 등)는 대기열에 쌓았다가 로딩 후 전송.
// - 개인정보(이메일·전화)는 어떤 매체로도 보내지 않음.

import { getMedia, type AdPixelRow, type MediaId, type StdEvent } from './media'

export interface PixelPayload {
  contentId?: string | null
  contentName?: string | null
  contentCategory?: string | null
  instructorName?: string | null
  value?: number | null
  orderId?: string | null
  eventId?: string | null
  /** CompleteRegistration */
  method?: string | null
  /** OpenChatJoin */
  campaignId?: string | null
}

type AnyFn = (...args: unknown[]) => unknown
interface PixelWindow {
  dataLayer?: unknown[]
  gtag?: AnyFn
  fbq?: AnyFn & { queue?: unknown[]; callMethod?: AnyFn; loaded?: boolean }
  _fbq?: unknown
  kakaoPixel?: (id: string) => Record<string, AnyFn>
  ttq?: AnyFn[] & Record<string, AnyFn> & { instance?: (id: string) => Record<string, AnyFn> }
  karrotPixel?: { init: AnyFn; track: AnyFn }
  dablena?: AnyFn & { q?: unknown[] }
  _tfa?: unknown[]
  wcs?: { inflow: AnyFn; trans: AnyFn }
  wcs_add?: Record<string, string>
  wcs_do?: AnyFn
}
const w = (): PixelWindow => window as unknown as PixelWindow

const CURRENCY = 'KRW'
const MARK_ATTR = 'data-ad-pixel'

function injectScript(mark: string, src: string, onload?: () => void, id?: string): void {
  if (document.querySelector(`script[${MARK_ATTR}="${mark}"]`)) { onload?.(); return }
  const s = document.createElement('script')
  s.src = src
  s.async = true
  if (id) s.id = id
  s.setAttribute(MARK_ATTR, mark)
  if (onload) s.addEventListener('load', onload)
  document.head.appendChild(s)
}

function injectInline(mark: string, code: string): void {
  if (document.querySelector(`script[${MARK_ATTR}="${mark}"]`)) return
  const s = document.createElement('script')
  s.text = code
  s.setAttribute(MARK_ATTR, mark)
  document.head.appendChild(s)
}

/** 스크립트가 로드될 때까지 기다림(스텁이 없는 매체용). 실패/차단 시 reject 대신 그냥 미해결 → 이벤트는 조용히 버려짐 */
function loadAndWait(mark: string, src: string, ready: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (ready()) { resolve(); return }
    injectScript(mark, src, () => { if (ready()) resolve() })
  })
}

const clean = <T extends Record<string, unknown>>(o: T): Partial<T> => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === '') continue
    if (typeof v === 'number' && !Number.isFinite(v)) continue
    out[k] = v
  }
  return out as Partial<T>
}

const num = (v: number | null | undefined): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

// ─────────────────────────────────────────────────────────────
// 매체 어댑터
// ─────────────────────────────────────────────────────────────
interface Adapter {
  /** 스크립트 로드 + 초기화. resolve 되면 fire 가능 */
  load(row: AdPixelRow): Promise<void>
  /** load 단계에서 첫 페이지뷰를 이미 보내는 매체(네이버 wcs_do, Google Ads config)는 true */
  initialPageViewInLoad?: boolean
  fire(row: AdPixelRow, event: StdEvent, p: PixelPayload): void
}

const meta: Adapter = {
  async load(row) {
    injectInline('meta-base', `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');`)
    w().fbq?.('init', row.pixel_id)
  },
  fire(row, event, p) {
    const fbq = w().fbq
    if (!fbq) return
    const ids = p.contentId ? [p.contentId] : undefined
    const opt = p.eventId ? { eventID: p.eventId } : undefined
    const send = (name: string, params: Record<string, unknown>, custom = false) =>
      opt ? fbq(custom ? 'trackSingleCustom' : 'trackSingle', row.pixel_id, name, clean(params), opt)
        : fbq(custom ? 'trackSingleCustom' : 'trackSingle', row.pixel_id, name, clean(params))
    switch (event) {
      case 'PageView': send('PageView', {}); break
      case 'ViewContent': send('ViewContent', { content_ids: ids, content_name: p.contentName, content_type: 'product', content_category: p.contentCategory, value: num(p.value), currency: CURRENCY }); break
      case 'Lead': send('Lead', { content_ids: ids, content_name: p.contentName, content_category: p.contentCategory, value: 0, currency: CURRENCY }); break
      case 'InitiateCheckout': send('InitiateCheckout', { content_ids: ids, content_name: p.contentName, content_category: p.contentCategory, value: num(p.value), currency: CURRENCY, num_items: 1 }); break
      case 'Purchase': send('Purchase', { content_ids: ids, content_name: p.contentName, content_type: 'product', content_category: p.contentCategory, value: num(p.value), currency: CURRENCY, contents: p.contentId ? [{ id: p.contentId, quantity: 1 }] : undefined }); break
      case 'CompleteRegistration': send('CompleteRegistration', { status: true, registration_method: p.method }); break
      case 'OpenChatJoin': send('OpenChatJoin', { content_ids: ids, content_name: p.contentName, instructor_name: p.instructorName, campaign_id: p.campaignId }, true); break
    }
  },
}

const gtm: Adapter = {
  async load(row) {
    if (document.querySelector(`script[${MARK_ATTR}="gtm-${row.pixel_id}"]`)) return
    injectInline(`gtm-${row.pixel_id}`, `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${row.pixel_id}');`)
  },
  fire() { /* 이벤트는 tracking.ts 의 dataLayer.push 로 GTM 이 직접 받음 */ },
}

function ensureGtag(): AnyFn {
  const win = w()
  win.dataLayer = win.dataLayer || []
  if (!win.gtag) {
    win.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      (win.dataLayer as unknown[]).push(arguments)
    }
    win.gtag('js', new Date())
  }
  return win.gtag
}

const ga4: Adapter = {
  async load(row) {
    injectScript(`gtag-${row.pixel_id}`, `https://www.googletagmanager.com/gtag/js?id=${row.pixel_id}`)
    ensureGtag()('config', row.pixel_id)
  },
  initialPageViewInLoad: true,
  fire() { /* GA4 이벤트는 기존대로 GTM 에서 */ },
}

const googleAds: Adapter = {
  async load(row) {
    injectScript(`gtag-${row.pixel_id}`, `https://www.googletagmanager.com/gtag/js?id=${row.pixel_id}`)
    ensureGtag()('config', row.pixel_id, row.events.PageView ? {} : { send_page_view: false })
  },
  initialPageViewInLoad: true,
  fire(row, event, p) {
    const gtag = w().gtag
    if (!gtag) return
    if (event === 'PageView') { gtag('event', 'page_view', { send_to: row.pixel_id }); return }
    const label = row.extra.labels?.[event]?.trim()
    if (!label) return
    gtag('event', 'conversion', clean({
      send_to: `${row.pixel_id}/${label}`,
      value: event === 'Purchase' ? num(p.value) : event === 'Lead' ? 0 : undefined,
      currency: CURRENCY,
      transaction_id: event === 'Purchase' || event === 'Lead' ? p.orderId : undefined,
    }))
  },
}

const kakao: Adapter = {
  load() { return loadAndWait('kakao', 'https://t1.daumcdn.net/kas/static/kp.js', () => typeof w().kakaoPixel === 'function') },
  fire(row, event, p) {
    const px = w().kakaoPixel?.(row.pixel_id)
    if (!px) return
    switch (event) {
      case 'PageView': px.pageView(); break
      case 'ViewContent': px.viewContent(clean({ id: p.contentId })); break
      case 'Lead': px.participation(); break
      case 'CompleteRegistration': px.completeRegistration(); break
      case 'Purchase': px.purchase(clean({
        total_quantity: 1,
        total_price: num(p.value),
        currency: CURRENCY,
        products: [clean({ id: p.contentId, name: p.contentName, quantity: 1, price: num(p.value) })],
      })); break
    }
  },
}

const tiktok: Adapter = {
  async load(row) {
    injectInline('tiktok-base', `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)}}(window,document,'ttq');`)
    w().ttq?.load(row.pixel_id)
  },
  fire(row, event, p) {
    const inst = w().ttq?.instance?.(row.pixel_id)
    if (!inst) return
    if (event === 'PageView') { inst.page(); return }
    const name = event === 'Lead' ? 'Lead' : event
    if (!['ViewContent', 'Lead', 'CompleteRegistration', 'InitiateCheckout', 'Purchase'].includes(name)) return
    const params = event === 'CompleteRegistration' || event === 'Lead'
      ? clean({ content_id: p.contentId, content_name: p.contentName, value: event === 'Lead' ? 0 : undefined, currency: event === 'Lead' ? CURRENCY : undefined })
      : clean({
        contents: p.contentId ? [clean({ content_id: p.contentId, content_type: 'product', content_name: p.contentName, quantity: 1, price: num(p.value) })] : undefined,
        content_type: 'product',
        value: num(p.value),
        currency: CURRENCY,
      })
    if (p.eventId) inst.track(name, params, { event_id: p.eventId })
    else inst.track(name, params)
  },
}

// 네이버: 공식 스펙 기준 item.quantity·payAmount 는 number, 0원 payAmount 는 어시스턴트 오류라 생략, value·id 는 string
const NAVER_TYPE: Partial<Record<StdEvent, string>> = {
  ViewContent: 'view_product', Lead: 'lead', OpenChatJoin: 'custom001', CompleteRegistration: 'sign_up', InitiateCheckout: 'begin_checkout', Purchase: 'purchase',
}
const naver: Adapter = {
  load(row) {
    const win = w()
    win.wcs_add = win.wcs_add || {}
    win.wcs_add['wa'] = row.pixel_id
    return loadAndWait('naver', 'https://wcs.naver.net/wcslog.js', () => !!(w().wcs && w().wcs_do)).then(() => {
      // 1차 도메인만 (www./m. 제거) — 서브도메인 간 NA_SA 쿠키 공유
      w().wcs?.inflow(window.location.hostname.replace(/^(www|m)\./, ''))
      if (row.events.PageView) w().wcs_do?.()
    })
  },
  initialPageViewInLoad: true,
  fire(row, event, p) {
    const win = w()
    if (!win.wcs) return
    if (event === 'PageView') { win.wcs_do?.(); return }
    const type = NAVER_TYPE[event]
    if (!type) return
    win.wcs_add = win.wcs_add || {}
    win.wcs_add['wa'] = row.pixel_id
    const conv: Record<string, unknown> = { type }
    if (event === 'Purchase' && num(p.value) !== undefined) {
      conv.value = String(p.value)
      conv.currency = CURRENCY
      if (p.orderId) conv.id = String(p.orderId)
    }
    if ((event === 'ViewContent' || event === 'InitiateCheckout' || event === 'Purchase') && p.contentId) {
      const item: Record<string, unknown> = { id: String(p.contentId), quantity: 1 }
      const name = p.contentName?.replace(/["']/g, '').trim()
      if (name) item.name = name
      if (p.contentCategory) item.category = p.contentCategory
      const v = num(p.value)
      if (v !== undefined && v > 0) item.payAmount = v
      conv.items = [item]
    }
    win.wcs.trans(conv)
  },
}

const karrot: Adapter = {
  load(row) {
    return loadAndWait('karrot', 'https://karrot-pixel.business.daangn.com/0.2/karrot-pixel.umd.js', () => !!w().karrotPixel)
      .then(() => { w().karrotPixel?.init(row.pixel_id) })
  },
  fire(_row, event, p) {
    const kp = w().karrotPixel
    if (!kp) return
    const product = clean({ id: p.contentId, name: p.contentName, quantity: 1, price: num(p.value) })
    switch (event) {
      case 'PageView': kp.track('ViewPage'); break
      case 'ViewContent': kp.track('ViewContent', product); break
      case 'Lead': kp.track('Lead'); break
      case 'CompleteRegistration': kp.track('CompleteRegistration'); break
      case 'Purchase': kp.track('Purchase', clean({ total_price: num(p.value), total_quantity: 1, products: [product] })); break
    }
  },
}

const dable: Adapter = {
  async load(row) {
    injectInline('dable-base', `(function(d,a,b,l,e,_){if(d[b]&&d[b].q)return;d[b]=function(){(d[b].q=d[b].q||[]).push(arguments)};e=a.createElement(l);e.async=1;e.charset='utf-8';e.src='//static.dable.io/dist/dablena.min.js';_=a.getElementsByTagName(l)[0];_.parentNode.insertBefore(e,_)})(window,document,'dablena','script');`)
    w().dablena?.('init', row.pixel_id)
  },
  fire(_row, event, p) {
    const d = w().dablena
    if (!d) return
    if (event === 'Purchase') d('track', 'Purchase', clean({ value: num(p.value), currency: CURRENCY }))
    else if (event === 'PageView' || event === 'ViewContent' || event === 'CompleteRegistration') d('track', event)
  },
}

const TABOOLA_DEFAULT: Partial<Record<StdEvent, string>> = {
  PageView: 'page_view', Lead: 'lead', CompleteRegistration: 'complete_registration', Purchase: 'make_purchase',
}
const taboola: Adapter = {
  async load(row) {
    const win = w()
    win._tfa = win._tfa || []
    injectScript(`taboola-${row.pixel_id}`, `//cdn.taboola.com/libtrc/unip/${row.pixel_id}/tfa.js`, undefined, 'tb_tfa_script')
  },
  fire(row, event, p) {
    const tfa = w()._tfa
    if (!tfa) return
    const name = row.extra.names?.[event]?.trim() || TABOOLA_DEFAULT[event]
    if (!name) return
    tfa.push(clean({
      notify: 'event',
      name,
      id: Number(row.pixel_id) || row.pixel_id,
      revenue: event === 'Purchase' ? num(p.value) : undefined,
      currency: event === 'Purchase' ? CURRENCY : undefined,
      orderid: event === 'Purchase' ? p.orderId : undefined,
    }))
  },
}

const ADAPTERS: Record<MediaId, Adapter> = {
  meta, gtm, ga4, google_ads: googleAds, kakao, tiktok, naver, karrot, dable, taboola,
}

// ─────────────────────────────────────────────────────────────
// 엔진
// ─────────────────────────────────────────────────────────────
let active: AdPixelRow[] | null = null
const loaded = new Map<number, Promise<void>>()
const pending: [StdEvent, PixelPayload][] = []

const safe = (fn: () => void) => { try { fn() } catch { /* 매체 장애 격리 */ } }

const wants = (row: AdPixelRow, event: StdEvent) =>
  !!row.events[event] && !!getMedia(row.media)?.supported.includes(event)

function send(row: AdPixelRow, event: StdEvent, p: PixelPayload) {
  const ready = loaded.get(row.id)
  if (!ready) return
  ready.then(() => safe(() => ADAPTERS[row.media].fire(row, event, p)), () => {})
}

/** PixelInjector 가 설정을 읽은 뒤 호출 — 새 매체만 로드하고, 대기 중 이벤트를 전송 */
export function setActivePixels(rows: AdPixelRow[]): void {
  active = rows
  for (const row of rows) {
    if (loaded.has(row.id) || !row.pixel_id.trim()) continue
    const adapter = ADAPTERS[row.media]
    if (!adapter) continue
    let p: Promise<void>
    try { p = Promise.resolve(adapter.load(row)) } catch { p = Promise.reject() }
    p = p.catch(() => {})
    loaded.set(row.id, p)
    if (!adapter.initialPageViewInLoad && wants(row, 'PageView')) send(row, 'PageView', {})
  }
  const queued = pending.splice(0)
  for (const [event, payload] of queued) dispatchPixelEvent(event, payload)
}

/** 전환 이벤트 전달 — tracking.ts 의 각 이벤트 함수(세션 중복 방지 안쪽)에서 호출 */
export function dispatchPixelEvent(event: StdEvent, payload: PixelPayload): void {
  if (typeof window === 'undefined') return
  if (!active) {
    if (pending.length < 30) pending.push([event, payload])
    return
  }
  for (const row of active) if (wants(row, event)) send(row, event, payload)
}

/** SPA 라우트 이동 시 페이지뷰 재전송 (첫 진입은 setActivePixels 에서) */
export function dispatchPageView(): void {
  if (!active) return
  for (const row of active) if (wants(row, 'PageView')) send(row, 'PageView', {})
}
