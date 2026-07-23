// 뉴스레터 글 URL 난독화 — /board/1 처럼 글 id 가 그대로 노출되지 않도록
// 숫자 id 를 짧은 해시 문자열로 가역 변환한다 (XOR 솔트 + base36 + 체크문자).
// 보안 수단이 아니라 URL 미관/추측 방지용 — 열람 잠금은 서버 RPC 가 담당한다.

const HASH_SALT = 0x8e2f15

export function encodePostId(id: number): string {
  const mixed = (id ^ HASH_SALT) >>> 0
  const check = (id * 7 + 13) % 36
  return mixed.toString(36) + check.toString(36)
}

export function decodePostId(hash: string | undefined): number | null {
  if (!hash || hash.length < 2 || !/^[0-9a-z]+$/.test(hash)) return null
  const mixed = parseInt(hash.slice(0, -1), 36)
  if (Number.isNaN(mixed)) return null
  const id = (mixed ^ HASH_SALT) >>> 0
  if (!Number.isInteger(id) || id <= 0) return null
  if (((id * 7 + 13) % 36).toString(36) !== hash.slice(-1)) return null
  return id
}
