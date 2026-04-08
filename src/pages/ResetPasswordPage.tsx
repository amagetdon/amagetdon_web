import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { profileService } from '../services/profileService'

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)
  const [expiredError, setExpiredError] = useState('')

  useEffect(() => {
    // URL hash에서 에러 확인 (만료된 링크 등)
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1))
      const errorDesc = params.get('error_description')
      if (errorDesc?.includes('expired')) {
        setExpiredError('비밀번호 재설정 링크가 만료되었습니다. 다시 시도해주세요.')
      } else {
        setExpiredError('유효하지 않은 링크입니다. 다시 시도해주세요.')
      }
      setChecking(false)
      return
    }

    let timeoutId: ReturnType<typeof setTimeout>

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setAuthorized(true)
        setChecking(false)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthorized(true)
        setChecking(false)
      } else {
        timeoutId = setTimeout(() => {
          setChecking(false)
        }, 5000)
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeoutId)
    }
  }, [])

  if (checking) {
    return (
      <>
        <div className="bg-black h-[200px] w-full" />
        <div className="max-w-[440px] mx-auto px-6 py-16 text-center">
          <div className="w-8 h-8 border-4 border-[#2ED573] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-4 text-sm">인증 확인 중...</p>
        </div>
      </>
    )
  }

  if (expiredError || !authorized) {
    return (
      <>
        <div className="bg-black h-[200px] w-full" />
        <div className="max-w-[440px] mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ti ti-clock text-red-500 text-3xl" />
          </div>
          <h1 className="text-2xl font-bold mb-4">
            {expiredError ? '링크가 만료되었습니다' : '접근 권한이 없습니다'}
          </h1>
          <p className="text-gray-500 mb-8">
            {expiredError || '비밀번호 재설정 링크가 유효하지 않습니다.'}<br />
            로그인 페이지에서 다시 비밀번호 찾기를 진행해주세요.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="bg-[#2ED573] text-white font-bold px-8 py-3 rounded-lg cursor-pointer"
          >
            로그인 페이지로
          </button>
        </div>
      </>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password) {
      setError('새 비밀번호를 입력해주세요.')
      return
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,18}$/
    if (!passwordRegex.test(password)) {
      setError('8~18자의 영문/숫자/특수문자를 함께 입력해주세요.')
      return
    }

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    try {
      setLoading(true)
      await profileService.updatePassword(password)
      setSuccess(true)
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('same') || err.message.includes('different from the old')) {
          setError('새 비밀번호는 기존 비밀번호와 달라야 합니다.')
        } else {
          setError('비밀번호 변경에 실패했습니다. 다시 시도해주세요.')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <>
        <div className="bg-black h-[200px] w-full" />
        <div className="max-w-[440px] mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 bg-[#2ED573] rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ti ti-check text-white text-3xl" />
          </div>
          <h1 className="text-2xl font-bold mb-4">비밀번호 변경 완료</h1>
          <p className="text-gray-500 mb-8">
            비밀번호가 성공적으로 변경되었습니다.<br />
            새 비밀번호로 로그인해주세요.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="bg-[#2ED573] text-white font-bold px-8 py-3 rounded-lg cursor-pointer"
          >
            로그인 하러가기
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="bg-black h-[200px] w-full" />
      <div className="max-w-[440px] mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-center mb-2">비밀번호 재설정</h1>
        <p className="text-sm text-gray-500 text-center mb-8">새로운 비밀번호를 입력해주세요.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-bold block mb-1">새 비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8~18자 영문/숫자/특수문자"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#2ED573] transition-colors"
            />
            <p className="text-xs text-red-400 mt-1">8~18자의 영문/숫자/특수문자를 함께 입력해주세요.</p>
          </div>

          <div>
            <label className="text-sm font-bold block mb-1">새 비밀번호 확인</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호를 다시 입력해주세요."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#2ED573] transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2ED573] text-white font-bold py-3 rounded-lg cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </>
  )
}

export default ResetPasswordPage
