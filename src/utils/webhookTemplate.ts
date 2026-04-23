// shoong-api 등 알림톡 제공사 cURL 생성기가 버튼 링크 변수 키의 닫는 `}` 를 빠뜨리고
// `variables.{링크명5` 로 내려주는 버그를 `variables.{링크명5}` 로 자동 보정한다.
// shoong 표준 API 키 포맷은 `variables.<변수명>` 평문. 변수명에 중괄호가 포함된 버튼 링크 변수는
// `variables.{링크명5}` 그대로가 맞는 형태.
//
// 변환 케이스:
//   variables.{링크명5         → variables.{링크명5}   (닫는 } 보장)
//   variables.#{{링크명5}}     → variables.{링크명5}   (과거 과도 변환 원복)
// 이미 정상인 variables.{링크명5} / variables.모임명 / variables.고객명 등은 건드리지 않음.
export function normalizeAlimtalkKeys(body: string): string {
  if (!body) return body
  return body
    // 과거에 잘못 저장된 #{{링크명5}} 형태를 평문 {링크명5} 로 원복
    .replace(/"variables\.#\{\{([^"{}]+)\}\}":/g, '"variables.{$1}":')
    // 닫는 } 가 빠진 `variables.{변수명` 에 } 보충. 이미 닫힌 건 그대로.
    .replace(/"variables\.\{([^"{}]+)\}?":/g, '"variables.{$1}":')
}
