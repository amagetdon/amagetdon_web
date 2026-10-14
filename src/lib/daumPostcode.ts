// 다음(카카오) 우편번호 검색 스크립트를 필요한 페이지(가입·온보딩·마이페이지)에서만 불러온다.
// 예전엔 index.html 에서 모든 페이지가 열릴 때마다 먼저 받고 나서야 화면을 그렸다(렌더 차단).
// 뒤에서 넣는 방식이라 autoload=false 로 받고 daum.postcode.load() 로 본체를 마저 받는다 (다음 공식 안내 방식).
const SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js?autoload=false'

type DaumGlobal = { daum?: { Postcode?: unknown; postcode?: { load: (cb: () => void) => void } } }

let loading: Promise<void> | null = null

export function isDaumPostcodeReady(): boolean {
  return !!(window as unknown as DaumGlobal).daum?.Postcode
}

export function loadDaumPostcode(): Promise<void> {
  if (isDaumPostcodeReady()) return Promise.resolve()
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    const fail = () => { loading = null; script.remove(); reject(new Error('postcode load failed')) }
    const script = document.createElement('script')
    script.src = SRC
    script.async = true
    script.onload = () => {
      const w = window as unknown as DaumGlobal
      if (!w.daum?.postcode?.load) { fail(); return }
      w.daum.postcode.load(() => resolve())
    }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return loading
}
