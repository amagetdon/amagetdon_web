import { supabase } from './supabase'

// 마지막 유입 경로(last touch) — 구매 1건마다 '이번 구매 경로'를 남기기 위한 기록.
//
// - 가입 시점 경로(최초)는 profiles.utm_* / signup_referrer 에 1회 저장되고 이후 바뀌지 않는다.
// - 여기서는 UTM·네이버 광고(NaPm)·외부 사이트로 들어올 때마다 최신 경로를 localStorage 에 덮어쓰고(30일 유지),
//   무료 신청/결제 완료 시 해당 purchases 행의 purchase_touch 에 기록한다.
// - 직접 방문, 결제(PG)·소셜 로그인에서 되돌아오는 방문은 덮어쓰지 않는다(결제 완료 페이지가 토스 경로로 바뀌는 것 방지).

const STORAGE_KEY = 'amag_last_touch'
const TTL_MS = 30 * 24 * 60 * 60 * 1000
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

/** 경로로 보지 않는 referrer — 자기 도메인, PG, 소셜 로그인, 백엔드, 프리뷰 배포 */
const IGNORED_REFERRER = /(^|\.)(amag-class\.com|tosspayments\.com|toss\.im|supabase\.co|vercel\.app)$|^(kauth|accounts|logins)\.kakao\.com$|^accounts\.google\.com$|^nid\.naver\.com$|^logins\.daum\.net$/

export interface PurchaseTouch {
  source: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
  referrer?: string
  landing?: string
  at?: string
}

function externalReferrerHost(): string | null {
  try {
    if (!document.referrer) return null
    const host = new URL(document.referrer).hostname.toLowerCase()
    return host && !IGNORED_REFERRER.test(host) ? host : null
  } catch {
    return null
  }
}

/** 앱 첫 로드 시 1회 호출 — 이번 방문이 '경로'가 있는 방문이면 마지막 경로를 갱신. */
export function captureLastTouch(): void {
  try {
    const params = new URLSearchParams(window.location.search)
    const referrer = externalReferrerHost()
    const utm: Partial<Record<(typeof UTM_KEYS)[number], string>> = {}
    for (const k of UTM_KEYS) {
      const v = params.get(k)
      if (v) utm[k] = v.slice(0, 200)
    }

    let touch: PurchaseTouch | null = null
    if (utm.utm_source) {
      touch = { source: utm.utm_source, medium: utm.utm_medium, campaign: utm.utm_campaign, content: utm.utm_content, term: utm.utm_term }
    } else if (params.get('NaPm')) {
      touch = { source: 'naver', medium: 'ad' }
    } else if (referrer) {
      touch = { source: referrer, medium: 'referral' }
    }
    if (!touch) return

    touch.referrer = referrer ?? undefined
    touch.landing = window.location.pathname.slice(0, 200)
    touch.at = new Date().toISOString()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(touch))
  } catch {
    // 스토리지 접근 불가(프라이빗 모드 등) — 무시
  }
}

function readLastTouch(): PurchaseTouch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as PurchaseTouch
    if (!t?.source || !t.at || Date.now() - new Date(t.at).getTime() > TTL_MS) return null
    return t
  } catch {
    return null
  }
}

/**
 * 구매(무료 신청 포함) 완료 직후 호출 — 본인 purchases 행에 이번 구매 경로를 1회 기록.
 * contentId 는 tracking 규약(course_{id} / ebook_{id}). 30일 내 경로가 없으면 '(direct)' 로 남긴다.
 */
export function stampPurchaseTouch(contentId: string): void {
  const m = contentId.match(/^(course|ebook)_(\d+)$/)
  if (!m) return
  const touch: PurchaseTouch = readLastTouch() ?? { source: '(direct)' }
  supabase
    .rpc('set_purchase_touch', { p_kind: m[1], p_id: Number(m[2]), p_touch: touch } as never)
    .then(() => {}, () => {})
}

/** 관리자 표시용 — "source / medium · campaign" */
export function formatTouch(t: { source?: string | null; medium?: string | null; campaign?: string | null } | null | undefined): string {
  if (!t?.source) return ''
  const head = t.medium ? `${t.source} / ${t.medium}` : t.source
  return t.campaign ? `${head} · ${t.campaign}` : head
}

// ── 상품 페이지 방문 기록 (관리자 상품 대시보드의 '유입' 단계) ─────────────────────────
// 브라우저마다 익명 방문자 ID 1개(localStorage). 강의·전자책 상세를 볼 때 1건(서버에서 방문자·상품·하루 1행으로 합침),
// 로그인하면 이 브라우저의 지난 방문을 회원에 연결해 '방문 → 가입 → 신청 → 결제'를 한 사람 단위로 잇는다.
const VISITOR_KEY = 'amag_visitor_id'

function visitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

/** contentId = course_{id} / ebook_{id} */
export function logProductVisit(contentId: string): void {
  const m = contentId.match(/^(course|ebook)_(\d+)$/)
  const vid = visitorId()
  if (!m || !vid) return
  supabase
    .rpc('log_product_visit', { p_visitor: vid, p_kind: m[1], p_id: Number(m[2]), p_touch: readLastTouch() } as never)
    .then(() => {}, () => {})
}

/** 로그인 직후 1회 — 이 브라우저의 비로그인 방문을 회원에 연결 */
export function linkProductVisitor(): void {
  const vid = visitorId()
  if (!vid) return
  supabase.rpc('link_product_visitor', { p_visitor: vid } as never).then(() => {}, () => {})
}
