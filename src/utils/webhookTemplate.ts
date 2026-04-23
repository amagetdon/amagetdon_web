// shoong-api 등 알림톡 제공사 cURL 생성기가 버튼 링크 변수 키를
// `variables.{링크명5` 처럼 닫는 `}` 없이 내려주는 버그를 보정한다.
// 누락된 `}` 가 제공사 측 부분 매칭을 만들어 실제 버튼 URL 뒤에 `%7D` 가 붙고
// 없는 페이지로 연결되는 이슈를 사전에 차단.
export function normalizeAlimtalkKeys(body: string): string {
  if (!body) return body
  return body.replace(/"(variables\.#?\{[^"{}]*)":/g, '"$1}":')
}
