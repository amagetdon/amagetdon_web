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

/** 3일 22시간 41분 29초 / 00:10:28 두 가지 모양 */
export function formatLong(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${d > 0 ? `${d}일 ` : ''}${h}시간 ${m}분 ${sec}초`
}
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
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
