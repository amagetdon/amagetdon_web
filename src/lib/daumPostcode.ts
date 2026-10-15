// 다음(카카오) 우편번호 검색 — 스크립트는 index.html 에서 원래 방식(파라미터 없는 일반 script 태그)으로 받는다.
// 10/15 '필요할 때 뒤에서 넣기(autoload=false)'로 바꿨더니 인스타그램 인앱 브라우저에서
// "[우편번호 서비스 로딩 오류] API 로딩시 허용되지 않는 파라미터" 알림창이 떠서 원래 방식으로 되돌렸다.
// 여기서는 스크립트를 직접 넣지 않고, 준비될 때까지(최대 8초) 기다리기만 한다.

type DaumGlobal = { daum?: { Postcode?: unknown } }

export function isDaumPostcodeReady(): boolean {
  return !!(window as unknown as DaumGlobal).daum?.Postcode
}

let waiting: Promise<void> | null = null

export function loadDaumPostcode(): Promise<void> {
  if (isDaumPostcodeReady()) return Promise.resolve()
  if (waiting) return waiting
  waiting = new Promise<void>((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (isDaumPostcodeReady()) { resolve(); return }
      if (Date.now() - started > 8000) { waiting = null; reject(new Error('postcode not ready')); return }
      setTimeout(tick, 200)
    }
    tick()
  })
  return waiting
}
