// shoong-api 의 버튼 링크 변수는 변수명 자체가 `{링크명5` 형태(여는 `{` 포함, 닫는 `}` 없음).
// 에러 포맷 `미치환 변수: #{{링크명5}` 는 `#{<변수명>}` 감싸기라 변수명=`{링크명5`.
// 따라서 API 키는 `variables.{링크명5` 가 정답. 제공사 cURL 원본 그대로가 맞는 형태.
//
// 과거 과도 보정 결과(`variables.{링크명5}` 또는 `variables.#{{링크명5}}`) 를 원본으로 되돌린다.
//
// 변환 케이스:
//   variables.#{{링크명5}}   → variables.{링크명5   (과거 과도 변환 원복)
//   variables.{링크명5}      → variables.{링크명5   (닫는 } 제거)
//   variables.{링크명5       → variables.{링크명5   (그대로)
//   variables.모임명 / variables.고객명 등 평문 키 → 그대로
export function normalizeAlimtalkKeys(body: string): string {
  if (!body) return body
  return body
    // 과거 과도 변환 원복: variables.#{{X}} → variables.{X
    .replace(/"variables\.#\{\{([^"{}]+)\}\}":/g, '"variables.{$1":')
    // 닫는 `}` 가 붙어있으면 제거 (shoong 원본 포맷으로 정규화)
    .replace(/"variables\.(\{[^"{}]+)\}":/g, '"variables.$1":')
}
