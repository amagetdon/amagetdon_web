// 의존성 없는 타입 가드 — 호스트 페이지가 이 파일만 가져와도 렌더러 전체가 딸려 오지 않는다.
import type { LandingDoc } from './types'

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 문서가 최소 형태를 갖췄는지(타입 가드). 잘못된 값은 false. */
export function isLandingDoc(v: unknown): v is LandingDoc {
  if (!isPlainObject(v)) return false
  if (v.version !== 1) return false
  if (v.type !== 'free' && v.type !== 'paid') return false
  if (!isPlainObject(v.facts) || !isPlainObject(v.sections)) return false

  if (v.theme !== undefined && v.theme !== null) {
    if (!isPlainObject(v.theme)) return false
    const { accent, base, top } = v.theme
    if (accent !== undefined && !(typeof accent === 'string' && HEX_COLOR.test(accent))) return false
    if (top !== undefined && !(typeof top === 'string' && HEX_COLOR.test(top))) return false
    if (base !== undefined && base !== 'light' && base !== 'dark') return false
  }
  return true
}
