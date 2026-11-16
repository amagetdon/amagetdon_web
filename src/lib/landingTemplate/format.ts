// 글자·날짜·주소 처리. 모두 순수 함수.
import type { Rec } from './types'

/* ───────── 느슨한 자료 읽기 ───────── */

export function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
/** 객체가 아니면 빈 객체 */
export function rec(v: unknown): Rec {
  return isRec(v) ? v : {}
}
/** 배열이 아니면 빈 배열 */
export function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
/** 문자열·숫자만 글자로, 나머지는 빈 문자열 */
export function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}
/** 값이 채워져 있는지: 빈 문자열·빈 배열·빈 객체는 없는 것으로 본다 */
export function has(v: unknown): boolean {
  if (v == null || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v).length > 0
  return true
}

/* ───────── 글자 ───────── */

export function esc(v: unknown): string {
  return str(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 이스케이프한 뒤 작은 표시만 살린다: ==강조== · **굵게** · 줄바꿈 */
export function rich(v: unknown): string {
  return esc(v)
    .replace(/==([\s\S]+?)==/g, '<em class="hl">$1</em>')
    .replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>')
}

/** 표시를 뺀 한 줄 글자(검사·대체 글자용) */
export function plain(v: unknown): string {
  return str(v).replace(/==|\*\*/g, '').replace(/\n/g, ' ')
}

/** 받침에 따라 을/를 고르기 */
export function objectParticle(word: string): string {
  const last = plain(word).trim().slice(-1)
  const code = last.charCodeAt(0)
  if (!(code >= 0xac00 && code <= 0xd7a3)) return '을(를)'
  return (code - 0xac00) % 28 === 0 ? '를' : '을'
}

/* ───────── 날짜·시각 ───────── */

const WEEKDAYS = '일월화수목금토'
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{1,2}):(\d{2})$/

export function isDateString(v: unknown): v is string {
  return typeof v === 'string' && DATE_RE.test(v)
}
export function isTimeString(v: unknown): v is string {
  return typeof v === 'string' && TIME_RE.test(v)
}

export function parseDate(v: unknown): Date | null {
  const m = DATE_RE.exec(str(v))
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null
}

export function weekdayOf(v: unknown): string {
  const d = parseDate(v)
  return d ? WEEKDAYS[d.getUTCDay()] : ''
}

/** 2026-09-17 → "9월 17일(목)" · 형식 'M/D' → "9/17" · '월일' → "9월 17일". 날짜가 아니면 그대로 */
export function formatDate(v: unknown, format?: string): string {
  const d = parseDate(v)
  if (!d) return str(v)
  const month = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  if (format === 'M/D') return `${month}/${day}`
  if (format === '월일') return `${month}월 ${day}일`
  return `${month}월 ${day}일(${weekdayOf(v)})`
}

/** 19:30 → "저녁 7시 30분". 시각이 아니면 그대로 */
export function formatTime(v: unknown): string {
  const m = TIME_RE.exec(str(v))
  if (!m) return str(v)
  const hour = +m[1]
  const minute = +m[2]
  const tail = minute ? ` ${minute}분` : ''
  if (hour >= 22 || hour === 0) return `${hour}시${tail}`
  if (hour >= 18) return `저녁 ${hour - 12}시${tail}`
  if (hour >= 12) return `오후 ${hour === 12 ? 12 : hour - 12}시${tail}`
  return `오전 ${hour}시${tail}`
}

/* ───────── 주소 ───────── */

// 공백·따옴표·꺾쇠·역슬래시가 없는 https 주소, 또는 사이트 안 경로(/… , // 는 제외)
const HTTPS_URL = /^https:\/\/[^\s"'<>\x5c`]+$/i
const SITE_PATH = /^\/(?!\/)[^\s"'<>\x5c`]*$/
const ANCHOR = /^#[^\s"'<>\x5c`]*$/

export function isSafeImageUrl(v: unknown): boolean {
  return typeof v === 'string' && (HTTPS_URL.test(v) || SITE_PATH.test(v))
}
export function isSafeLinkUrl(v: unknown): boolean {
  return isSafeImageUrl(v) || (typeof v === 'string' && ANCHOR.test(v))
}
/** 글이 아니라 주소처럼 보이는 값(글 검사에서 뺀다) */
export function looksLikeUrl(v: string): boolean {
  return /^(https?:)?\/\S*$/i.test(v) || /^#\S*$/.test(v)
}
