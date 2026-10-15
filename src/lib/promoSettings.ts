import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// 상세 페이지 '신청 카드'·'상단 타이머 배너' 설정 (courses/ebooks.apply_card · top_banner, 10/16)
// 숫자(남은 자리·할인 수량)는 관리자가 직접 입력. 타이머는 종료 시각 + (선택) 반복 주기(분).

export interface PromoCountdown {
  label?: string | null
  end_at?: string | null // ISO
  loop_minutes?: number | null // 끝나면 이 주기로 다시 시작 (예: 10, 1440)
}

export interface ApplyCardSettings {
  enabled?: boolean
  show_schedule?: boolean
  discount_label?: string | null
  button_label?: string | null
  seats?: number | null
  // 남은 자리 표시 방식: manual=직접 숫자(seats) / range=최소~최대 범위 안에서 자동 / 없으면 표시 안 함
  seats_mode?: 'manual' | 'range' | null
  seats_min?: number | null
  seats_max?: number | null
  accent?: 'green' | 'blue' | null // 신청 카드 강조색(버튼·체크)
  countdown?: PromoCountdown | null
}

export interface TopBannerSettings {
  enabled?: boolean
  template?: string | null // "오늘 남은 할인 수량: {n}개"
  number?: number | null
  end_at?: string | null
  loop_minutes?: number | null
  end_text?: string | null // 타이머가 끝났을 때(반복 없음) 보일 문구. 비우면 배너 숨김
}

export interface PromoSettings {
  apply_card: ApplyCardSettings | null
  top_banner: TopBannerSettings | null
}

/**
 * 남은 시간(ms). 반복 주기가 있으면 종료 시각이 지나도 주기마다 다시 시작한다.
 * 종료 시각이 없거나(반복도 없음) 이미 끝났으면 0.
 */
export function remainingMs(endAt: string | null | undefined, loopMinutes: number | null | undefined, now = Date.now()): number {
  if (!endAt) return 0
  const end = new Date(endAt).getTime()
  if (Number.isNaN(end)) return 0
  if (now < end) return end - now
  const period = (loopMinutes ?? 0) * 60_000
  if (period <= 0) return 0
  return period - ((now - end) % period)
}

/**
 * 남은 시간 조각 — 하루 이상: N일 N시간 N분 / 하루 미만: N시간 N분 N초 / 1시간 미만: N분 N초
 * (대표님 요청 10/16: '189:29:53'처럼 시간이 100 넘게 나오는 표기 금지)
 */
export function timeParts(ms: number): { v: number; u: string }[] {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (d > 0) return [{ v: d, u: '일' }, { v: h, u: '시간' }, { v: m, u: '분' }]
  if (h > 0) return [{ v: h, u: '시간' }, { v: m, u: '분' }, { v: sec, u: '초' }]
  return [{ v: m, u: '분' }, { v: sec, u: '초' }]
}
export function formatLong(ms: number): string {
  return timeParts(ms).map((p) => `${p.v}${p.u}`).join(' ')
}

/**
 * 남은 자리 표시 숫자.
 * range: 같은 강의는 모든 방문자에게 같은 숫자 — 하루(한국 시간) 동안 최대→최소 쪽으로 천천히 줄고,
 *        30분마다 0~1 정도만 흔들려서 새로고침해도 크게 튀지 않는다. 범위를 바꾸면 바로 새 범위 안 숫자가 된다.
 */
export function displaySeats(card: ApplyCardSettings | null | undefined, seed: number, now = Date.now()): number | null {
  if (!card) return null
  const mode = card.seats_mode ?? (card.seats != null ? 'manual' : null)
  if (mode === 'manual') return card.seats ?? null
  if (mode !== 'range') return null
  const lo = Math.max(0, Math.min(card.seats_min ?? 0, card.seats_max ?? 0))
  const hi = Math.max(card.seats_min ?? 0, card.seats_max ?? 0)
  if (hi <= 0) return null
  const kstMin = Math.floor((now + 9 * 3600_000) / 60_000) % 1440
  const bucket = Math.floor((now + 9 * 3600_000) / (30 * 60_000))
  const jitter = ((bucket * 2654435761 + seed * 40503) >>> 0) % 2
  const v = Math.round(hi - (kstMin / 1440) * (hi - lo)) - jitter
  return Math.min(hi, Math.max(lo, v))
}
/** @deprecated 표기 통일(10/16) 이후 쓰지 않음 */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  // 하루가 넘으면 "7일 21:30:17" (예전엔 189:30:17 처럼 시간이 크게 보였다)
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d > 0 ? `${d}일 ` : ''}${pad(h)}:${pad(m)}:${pad(sec)}`
}

/** 1초마다 다시 그리기 */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [active])
  return now
}

/**
 * 설정은 캐시 없이 DB에서 바로 읽는다 — 관리자가 숫자를 바꾸면 새로고침·화면 복귀 때 바로 보이게.
 * (상세 페이지 본문 데이터는 잠깐 캐시되므로 이 두 칸만 따로 읽음)
 */
export function usePromoSettings(kind: 'course' | 'ebook', id: number | null | undefined): PromoSettings | null {
  const [data, setData] = useState<PromoSettings | null>(null)
  useEffect(() => {
    if (!id) return
    let alive = true
    const load = () => {
      supabase
        .from(kind === 'course' ? 'courses' : 'ebooks')
        .select('apply_card, top_banner')
        .eq('id', id)
        .maybeSingle()
        .then(({ data: row }) => {
          if (!alive || !row) return
          const r = row as unknown as PromoSettings
          setData({ apply_card: r.apply_card ?? null, top_banner: r.top_banner ?? null })
        })
    }
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible) }
  }, [kind, id])
  return data
}
