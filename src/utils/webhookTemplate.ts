// shoong-api 등 알림톡 제공사 cURL 생성기가 버튼 링크 변수 키를
// `variables.{링크명5` 형태로 내려줄 때 Kakao 표준 문법 `variables.#{{링크명5}}` 로 자동 보정한다.
//
// 제공사 응답 예: `미치환 변수가 있습니다: #{{링크명5}, #{{링크명6}` 처럼 `#{{...}}` 이중 중괄호
// placeholder 를 기대하지만, cURL 생성기는 바깥 `#{` 와 바깥 `}` 를 빼먹고 `variables.{링크명5`
// 만 내려줌. 키 정규화로 `variables.#{{링크명5}}` 로 복원.
//
// 매칭 케이스:
//   variables.{링크명5     → variables.#{{링크명5}}
//   variables.{링크명5}    → variables.#{{링크명5}}
// 이미 정상인 variables.#{...} / variables.#{{...}} / variables.평문키 는 건드리지 않음.
export function normalizeAlimtalkKeys(body: string): string {
  if (!body) return body
  return body.replace(/"variables\.\{([^"{}]+)\}?":/g, '"variables.#{{$1}}":')
}
