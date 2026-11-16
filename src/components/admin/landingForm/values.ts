// 입력 화면에서 자료 값을 다루는 작은 도구들.

export type Rec = Record<string, unknown>

export const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v)

/** 비어 있는 값인지 — 빈 글자, 빈 목록, 칸이 하나도 없는 묶음 */
export function isEmptyValue(v: unknown): boolean {
  if (v == null || v === '' || v === false) return true
  if (Array.isArray(v)) return v.length === 0
  if (isRec(v)) return Object.keys(v).length === 0
  return false
}

/** 묶음에서 한 칸을 바꾼 새 묶음. 비운 칸은 키를 지운다. */
export function setKey(obj: Rec, key: string, value: unknown): Rec {
  const next = { ...obj }
  if (isEmptyValue(value)) delete next[key]
  else next[key] = value
  return next
}
