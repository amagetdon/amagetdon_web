// 로그인 전에 '신청·구매·로그인' 을 누른 사람을 로그인(회원가입·회원정보 입력 포함)이 끝난 뒤
// 원래 보던 화면으로 돌려보내고, 눌렀던 신청을 그 화면에서 이어서 실행하기 위한 저장소.
// 카카오/구글 로그인·이메일 인증·로그인 링크는 외부 리다이렉트나 새 탭을 거치므로 sessionStorage·라우터 state 로는
// 사라진다 → localStorage 에 1시간만 보관한다.
const KEY = 'amag_post_login'
const TTL_MS = 60 * 60 * 1000

/** 돌아가서 이어서 할 일 — purchase: 강의·전자책 신청/결제, checkout_*: 게시판 글 구매·뉴스레터 구독 */
export type PostLoginAction = 'purchase' | 'checkout_post' | 'checkout_subscription'

type Saved = { path: string; action?: PostLoginAction; at: number; redirected?: boolean }

const AUTH_PATHS = ['/login', '/signup', '/onboarding', '/mypage', '/reset-password']

function pathnameOf(path: string) {
  try { return new URL(path, window.location.origin).pathname.replace(/\/+$/, '') || '/' } catch { return path }
}

function read(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Saved
    if (!saved?.path || Date.now() - saved.at > TTL_MS) { localStorage.removeItem(KEY); return null }
    return saved
  } catch { return null }
}

function write(saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(KEY, JSON.stringify(saved))
    else localStorage.removeItem(KEY)
  } catch { /* 저장 불가(사파리 개인정보 보호 등) — 복귀만 안 될 뿐 로그인은 정상 */ }
}

/** 로그인 화면으로 보내기 직전에 호출 — 지금 화면(경로+쿼리, UTM 포함)과 이어서 할 일을 기억한다. */
export function rememberPostLogin(action?: PostLoginAction, path = window.location.pathname + window.location.search) {
  if (path === '/' || AUTH_PATHS.includes(pathnameOf(path))) return
  write({ path, action, at: Date.now() })
}

/**
 * 로그인이 끝난 곳(로그인·회원가입·온보딩 화면, OAuth 복귀 홈)에서 호출 — 돌아갈 경로를 돌려준다.
 * 이어서 할 일이 있으면 도착한 화면이 takePostLoginAction 으로 가져가도록 남겨두고(한 번만 이동), 없으면 지운다.
 */
export function takeReturnPath(): string | null {
  const saved = read()
  if (!saved || saved.redirected) return null
  write(saved.action ? { ...saved, redirected: true } : null)
  return saved.path
}

/** 강의·전자책·게시판 화면에서 호출 — 이 화면에서 이어서 할 일이 있으면 꺼내고 지운다. */
export function takePostLoginAction(pathname = window.location.pathname): PostLoginAction | null {
  const saved = read()
  if (!saved?.action || pathnameOf(saved.path) !== pathnameOf(pathname)) return null
  write(null)
  return saved.action
}

/** 지우지 않고 보기만 — 앱 안 브라우저에서 크롬·Safari 로 넘길 때 '돌아갈 곳'을 주소에 실어 보내기 위함 */
export function peekPostLogin(): { path: string; action?: PostLoginAction } | null {
  const saved = read()
  return saved && !saved.redirected ? { path: saved.path, action: saved.action } : null
}
