import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { authService } from '../services/authService'
import { supabase } from '../lib/supabase'
import { useExternalServices } from '../hooks/useExternalServices'
import Turnstile from '../components/Turnstile'

function LoginPage() {
  const navigate = useNavigate()
  const externalServices = useExternalServices()
  const kakaoLoginEnabled = !!externalServices.KAKAO_LOGIN?.enabled
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/mypage'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')

  // 비밀번호 찾기 모달
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [resetSending, setResetSending] = useState(false)

  // 비회원 로그인 모달 — 이메일로 로그인 링크 발송
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [guestEmail, setGuestEmail] = useState('')
  const [guestSending, setGuestSending] = useState(false)
  const [guestMessage, setGuestMessage] = useState('')

  const handleSendLoginLink = async () => {
    if (!guestEmail.trim()) { setGuestMessage('이메일을 입력해주세요.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) { setGuestMessage('올바른 이메일 형식이 아닙니다.'); return }
    try {
      setGuestSending(true)
      setGuestMessage('')
      await authService.sendLoginLink(guestEmail, captchaToken)
      setGuestMessage('로그인 링크를 이메일로 보냈습니다. 메일함(스팸 포함)을 확인해주세요.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '발송에 실패했습니다.'
      if (/Signups not allowed|User not found|not found|registered/i.test(msg)) {
        setGuestMessage('해당 이메일로 가입된 계정이 없습니다.')
      } else if (/Too many requests/i.test(msg)) {
        setGuestMessage('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.')
      } else {
        setGuestMessage(msg)
      }
    } finally {
      setGuestSending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }

    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken) {
      setError('잠시만 기다려주세요. 봇 방지 확인이 진행 중입니다.')
      return
    }

    try {
      setLoading(true)
      sessionStorage.setItem('pendingSignIn', '1')
      const { user } = await authService.signIn(email, password, captchaToken)

      // 프로필 정보가 비어있으면 마이페이지로, 아니면 홈으로
      if (from !== '/mypage' && from !== '/') {
        navigate(from, { replace: true })
      } else if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, phone, address')
          .eq('id', user.id)
          .single<{ name: string | null; phone: string | null; address: string | null }>()
        const isIncomplete = !profile?.name || !profile?.phone || !profile?.address
        navigate(isIncomplete ? '/mypage' : '/', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Invalid login credentials')) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        } else if (err.message.includes('Email not confirmed')) {
          setError('이메일 인증이 완료되지 않았습니다.')
          setShowResend(true)
        } else if (err.message.includes('Too many requests')) {
          setError('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.')
        } else {
          setError(err.message)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email.trim()) {
      setResendMessage('이메일을 입력해주세요.')
      return
    }
    try {
      setResendMessage('발송 중...')
      await authService.resendConfirmation(email, captchaToken)
      setResendMessage('인증 메일이 재발송되었습니다. 이메일을 확인해주세요.')
      setShowResend(false)
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Too many requests')) {
          setResendMessage('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.')
        } else {
          setResendMessage('메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.')
        }
      }
    }
  }

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      setResetMessage('이메일을 입력해주세요.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      setResetMessage('올바른 이메일 형식이 아닙니다.')
      return
    }
    try {
      setResetSending(true)
      setResetMessage('')
      await authService.resetPassword(resetEmail, captchaToken)
      setResetMessage('비밀번호 재설정 링크가 이메일로 발송되었습니다. 메일함을 확인해주세요.')
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Too many requests')) {
          setResetMessage('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.')
        } else {
          setResetMessage('발송에 실패했습니다. 잠시 후 다시 시도해주세요.')
        }
      }
    } finally {
      setResetSending(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    try {
      sessionStorage.setItem('pendingSignIn', '1')
      await authService.signInWithOAuth(provider)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    }
  }

  return (
    <>
      <div className="bg-black h-[200px] w-full" />
      <div className="max-w-[440px] mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-center mb-8">로그인</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-bold block mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소를 입력해주세요."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#2ED573] transition-colors"
            />
          </div>

          <div>
            <label className="text-sm font-bold block mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력해주세요."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#2ED573] transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          {showResend && (
            <button
              type="button"
              onClick={handleResend}
              className="text-sm text-[#2ED573] font-bold cursor-pointer bg-transparent border-none underline"
            >
              인증 메일 재발송
            </button>
          )}

          {resendMessage && (
            <p className={`text-sm ${resendMessage.includes('재발송') ? 'text-[#2ED573]' : 'text-red-400'}`}>
              {resendMessage}
            </p>
          )}

          <Turnstile onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} className="flex justify-center" />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2ED573] text-white font-bold py-3 rounded-lg cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="text-center mt-3">
          <button
            onClick={() => { setShowResetModal(true); setResetEmail(email); setResetMessage('') }}
            className="text-sm text-gray-400 cursor-pointer bg-transparent border-none hover:text-gray-600"
          >
            비밀번호를 잊으셨나요?
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-gray-400 text-xs">
            <div className="flex-1 h-px bg-gray-200" />
            <span>또는</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {kakaoLoginEnabled && (
            <button
              onClick={() => handleOAuth('kakao')}
              className="w-full bg-[#FEE500] text-[#391B1B] font-bold py-3 rounded-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1C4.58 1 1 3.79 1 7.21c0 2.17 1.45 4.08 3.64 5.18l-.93 3.44c-.08.3.26.54.52.37l4.11-2.72c.22.01.44.03.66.03 4.42 0 8-2.79 8-6.21S13.42 1 9 1z" fill="#391B1B"/>
              </svg>
              카카오로 로그인
            </button>
          )}

          <button
            onClick={() => handleOAuth('google')}
            className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 rounded-lg cursor-pointer flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Google로 로그인
          </button>

          <button
            type="button"
            onClick={() => { setShowGuestModal(true); setGuestEmail(email); setGuestMessage('') }}
            className="w-full bg-gray-500 text-white font-bold py-3 rounded-lg cursor-pointer flex items-center justify-center gap-2 hover:bg-gray-600 transition-colors border-none"
          >
            <i className="ti ti-mail-opened text-white" />
            비회원 로그인
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          아직 회원이 아니신가요?{' '}
          <Link to="/signup" className="text-[#2ED573] font-bold no-underline">
            회원가입
          </Link>
        </div>
      </div>

      {/* 비밀번호 찾기 모달 */}
      {showResetModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowResetModal(false) }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl w-full max-w-[420px] overflow-hidden">
            <div className="bg-black px-6 py-5 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">비밀번호 찾기</h2>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-gray-400 hover:text-white bg-transparent border-none cursor-pointer text-xl"
                aria-label="닫기"
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                가입 시 사용한 이메일 주소를 입력해주세요.<br />
                비밀번호 재설정 링크를 보내드립니다.
              </p>

              <div className="mb-4">
                <label className="text-sm font-bold block mb-1">이메일</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => { setResetEmail(e.target.value); setResetMessage('') }}
                  placeholder="이메일 주소를 입력해주세요."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#2ED573] transition-colors"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleResetPassword() }}
                />
              </div>

              {resetMessage && (
                <p className={`text-sm mb-4 ${resetMessage.includes('발송되었습니다') ? 'text-[#2ED573]' : 'text-red-400'}`}>
                  {resetMessage}
                </p>
              )}

              <button
                onClick={handleResetPassword}
                disabled={resetSending}
                className="w-full bg-[#2ED573] text-white font-bold py-3 rounded-lg cursor-pointer border-none disabled:opacity-50"
              >
                {resetSending ? '발송 중...' : '재설정 링크 보내기'}
              </button>

              <button
                onClick={() => setShowResetModal(false)}
                className="w-full mt-2 bg-transparent text-gray-400 py-2 cursor-pointer border-none text-sm hover:text-gray-600"
              >
                돌아가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비회원 로그인 모달 — 이메일로 로그인 링크 발송 */}
      {showGuestModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !guestSending) setShowGuestModal(false) }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl w-full max-w-[420px] overflow-hidden">
            <div className="bg-black px-6 py-5 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <i className="ti ti-mail-opened text-[#2ED573]" />
                비회원 로그인
              </h2>
              <button
                onClick={() => setShowGuestModal(false)}
                disabled={guestSending}
                className="text-gray-400 hover:text-white bg-transparent border-none cursor-pointer text-xl disabled:opacity-50"
                aria-label="닫기"
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="text-sm font-bold block mb-1">이메일</label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => { setGuestEmail(e.target.value); setGuestMessage('') }}
                  placeholder="email@example.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#2ED573] transition-colors"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendLoginLink() }}
                  autoFocus
                />
              </div>

              <button
                onClick={handleSendLoginLink}
                disabled={guestSending}
                className="w-full bg-[#2ED573] text-white font-bold py-3 rounded-lg cursor-pointer border-none disabled:opacity-50"
              >
                {guestSending ? '발송 중...' : '로그인'}
              </button>

              {guestMessage && (
                <div className={`mt-4 rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${
                  guestMessage.includes('보냈습니다')
                    ? 'bg-emerald-50 border border-emerald-100 text-emerald-800'
                    : 'bg-red-50 border border-red-100 text-red-600'
                }`}>
                  <i className={`ti ${guestMessage.includes('보냈습니다') ? 'ti-mail-check' : 'ti-alert-circle'} mt-0.5 shrink-0`} />
                  <span className="leading-relaxed">
                    {guestMessage.includes('보냈습니다')
                      ? '메일을 보내드렸습니다. 메일함(스팸 포함)을 확인해주세요.'
                      : guestMessage}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default LoginPage
