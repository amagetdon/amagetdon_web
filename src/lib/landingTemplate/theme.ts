// 강조색 하나에서 페이지에 쓰는 색 변수들을 만든다. 결과는 루트(.lpt)의 style 속성에 들어간다.
import type { LandingTheme } from './types'

const DEFAULT_ACCENT = '#2B33E6'
const DEFAULT_TOP = '#FFD83A'
const DARK_INK = '#15131a'

// #RGB · #RRGGBB 만 받는다(스타일 속성에 다른 글자가 섞이지 않게). 아니면 기본값.
function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const v = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) return v
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return fallback
}

interface Hsl {
  h: number
  s: number
  l: number
  /** 밝기(0~1) — 강조색 위 글자를 검정/흰색 중 무엇으로 할지 정한다 */
  luminance: number
}

function hexToHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b,
  }
}

/** 루트 요소의 style 속성 값 (--ac:…;--ac-ink:…;…) */
export function themeVariables(theme: LandingTheme | undefined | null): string {
  const accent = normalizeHex(theme?.accent, DEFAULT_ACCENT)
  const top = normalizeHex(theme?.top, DEFAULT_TOP)
  const { h, s, l, luminance } = hexToHsl(accent)
  return [
    `--ac:${accent}`,
    `--ac-ink:${luminance > 0.6 ? DARK_INK : '#fff'}`,
    `--ac-deep:hsl(${h} ${s}% ${Math.round(l * 0.68)}%)`,
    `--ac-lite:hsl(${h} 96% 78%)`,
    `--ac-soft:hsl(${h} 90% 94%)`,
    `--ac-pop:${top}`,
    `--top:${top}`,
    `--l1:hsl(${h} 75% 97%)`,
    `--d0:hsl(${h} 46% 6%)`,
    `--d1:hsl(${h} 40% 10%)`,
  ].join(';')
}
