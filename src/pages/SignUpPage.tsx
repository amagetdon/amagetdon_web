import { useState, useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '../services/authService'
import { webhookService } from '../services/webhookService'
import { supabase } from '../lib/supabase'

declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: { zonecode: string; roadAddress: string; jibunAddress: string }) => void
      }) => { open: () => void }
    }
  }
}

interface SignUpForm {
  name: string
  email: string
  password: string
  passwordConfirm: string
  gender: 'male' | 'female' | ''
  phone1: string
  phone2: string
  phone3: string
  zonecode: string
  address: string
  addressDetail: string
  birthYear: string
  birthMonth: string
  birthDay: string
}

interface FormErrors {
  name?: string
  email?: string
  password?: string
  passwordConfirm?: string
  gender?: string
  phone?: string
  address?: string
  birth?: string
}

function SignUpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const utmParams = useMemo(() => ({
    utm_source: searchParams.get('utm_source') || sessionStorage.getItem('utm_source') || undefined,
    utm_medium: searchParams.get('utm_medium') || sessionStorage.getItem('utm_medium') || undefined,
    utm_campaign: searchParams.get('utm_campaign') || sessionStorage.getItem('utm_campaign') || undefined,
    utm_content: searchParams.get('utm_content') || sessionStorage.getItem('utm_content') || undefined,
    utm_term: searchParams.get('utm_term') || sessionStorage.getItem('utm_term') || undefined,
    signup_referrer: sessionStorage.getItem('signup_referrer') || undefined,
  }), [searchParams])
  const [form, setForm] = useState<SignUpForm>({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    gender: '',
    phone1: '010',
    phone2: '',
    phone3: '',
    zonecode: '',
    address: '',
    addressDetail: '',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleChange = (field: keyof SignUpForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const years = Array.from({ length: 80 }, (_, i) => 2006 - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!form.name.trim()) newErrors.name = '이름을 입력해주세요.'

    if (!form.email.trim()) {
      newErrors.email = '이메일을 입력해주세요.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다.'
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,18}$/
    if (!form.password) {
      newErrors.password = '비밀번호를 입력해주세요.'
    } else if (!passwordRegex.test(form.password)) {
      newErrors.password = '8~18자의 영문/숫자/특수문자를 함께 입력해주세요.'
    }

    if (form.password !== form.passwordConfirm) {
      newErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.'
    }

    if (!form.gender) {
      newErrors.gender = '성별을 선택해주세요.'
    }

    if (!form.phone2 || !form.phone3) {
      newErrors.phone = '휴대폰 번호를 입력해주세요.'
    } else {
      const phoneRegex = /^\d{3,4}$/
      if (!phoneRegex.test(form.phone2) || !phoneRegex.test(form.phone3)) {
        newErrors.phone = '올바른 휴대폰 번호를 입력해주세요.'
      }
    }

    if (!form.address) {
      newErrors.address = '주소를 검색해주세요.'
    }

    if (!form.birthYear || !form.birthMonth || !form.birthDay) {
      newErrors.birth = '생년월일을 선택해주세요.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [form])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')

    if (!validate()) return

    const phone = form.phone2 ? `${form.phone1}-${form.phone2}-${form.phone3}` : undefined
    const birthDate = form.birthYear && form.birthMonth && form.birthDay
      ? `${form.birthYear}-${form.birthMonth.padStart(2, '0')}-${form.birthDay.padStart(2, '0')}`
      : undefined

    try {
      setLoading(true)
      await authService.signUp(form.email, form.password, {
        name: form.name,
        gender: form.gender || undefined,
        phone,
        address: form.address ? `${form.zonecode}|${form.address}|${form.addressDetail}` : undefined,
        birth_date: birthDate,
        ...utmParams,
      })
      setSuccess(true)
      // 트리거가 UTM을 안 넣으므로 직접 업데이트
      const { data: { user: newUser } } = await supabase.auth.getUser()
      if (newUser) {
        const utmUpdate: Record<string, string> = {}
        if (utmParams.utm_source) utmUpdate.utm_source = utmParams.utm_source
        if (utmParams.utm_medium) utmUpdate.utm_medium = utmParams.utm_medium
        if (utmParams.utm_campaign) utmUpdate.utm_campaign = utmParams.utm_campaign
        if (utmParams.utm_content) utmUpdate.utm_content = utmParams.utm_content
        if (utmParams.utm_term) utmUpdate.utm_term = utmParams.utm_term
        if (utmParams.signup_referrer) utmUpdate.signup_referrer = utmParams.signup_referrer
        if (Object.keys(utmUpdate).length > 0) {
          supabase.from('profiles').update(utmUpdate as never).eq('id', newUser.id).then(() => {})
        }
      }
      // 웹훅 전송 (비동기, 실패해도 무시)
      webhookService.fireSignup({
        name: form.name,
        email: form.email,
        phone,
        gender: form.gender || null,
        address: form.address ? `${form.zonecode}|${form.address}|${form.addressDetail}` : null,
        birth_date: birthDate || null,
        ...utmParams,
      }).catch(() => {})
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('already registered')) {
          setServerError('이미 가입된 이메일입니다.')
        } else if (err.message.includes('Email not confirmed')) {
          setServerError('이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.')
        } else if (err.message.includes('password')) {
          setServerError('비밀번호는 6자 이상이어야 합니다.')
        } else if (err.message.includes('Too many requests')) {
          setServerError('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.')
        } else {
          setServerError(err.message)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    try {
      await authService.signInWithOAuth(provider)
    } catch (err) {
      if (err instanceof Error) setServerError(err.message)
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
          <h1 className="text-2xl font-bold mb-4">회원가입 완료</h1>
          <p className="text-sm font-medium text-gray-900 mb-2">{form.email}</p>
          <p className="text-gray-500 mb-4">
            가입하신 이메일로 인증 메일이 발송되었습니다.<br />
            이메일 인증을 완료하신 후 로그인해주세요.
          </p>
          <p className="text-xs text-gray-400 mb-8">
            메일이 오지 않는 경우 스팸함을 확인해주세요.
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
      <div className="max-w-[520px] mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-center mb-8">회원가입</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 이름 */}
          <div>
            <label className="text-sm font-bold block mb-1">이름 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="이름을 입력해주세요."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#2ED573] transition-colors"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* 이메일 */}
          <div>
            <label className="text-sm font-bold block mb-1">이메일 *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="이메일 주소를 입력해주세요."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#2ED573] transition-colors"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="text-sm font-bold block mb-1">비밀번호 *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder="8~18자 영문/숫자/특수문자"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#2ED573] transition-colors"
            />
            {errors.password ? (
              <p className="text-xs text-red-500 mt-1">{errors.password}</p>
            ) : (
              <p className="text-xs text-[#2ED573] mt-1">8~18자의 영문/숫자/특수문자를 함께 입력해주세요.</p>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="text-sm font-bold block mb-1">비밀번호 확인 *</label>
            <input
              type="password"
              value={form.passwordConfirm}
              onChange={(e) => handleChange('passwordConfirm', e.target.value)}
              placeholder="비밀번호를 다시 입력해주세요."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#2ED573] transition-colors"
            />
            {errors.passwordConfirm && (
              <p className="text-xs text-red-500 mt-1">{errors.passwordConfirm}</p>
            )}
          </div>

          {/* 성별 */}
          <div>
            <label className="text-sm font-bold block mb-2">성별 *</label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  checked={form.gender === 'male'}
                  onChange={() => handleChange('gender', 'male')}
                  className="accent-[#2ED573]"
                />
                <span className="text-sm">남성</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  checked={form.gender === 'female'}
                  onChange={() => handleChange('gender', 'female')}
                  className="accent-[#2ED573]"
                />
                <span className="text-sm">여성</span>
              </label>
            </div>
            {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
          </div>

          {/* 휴대폰 번호 */}
          <div>
            <label className="text-sm font-bold block mb-1">휴대폰 번호 *</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={form.phone1}
                onChange={(e) => handleChange('phone1', e.target.value)}
                maxLength={3}
                className="w-[80px] border border-gray-300 rounded-lg px-3 py-3 text-sm text-center outline-none focus:border-[#2ED573]"
              />
              <span className="text-gray-400">-</span>
              <input
                type="text"
                value={form.phone2}
                onChange={(e) => handleChange('phone2', e.target.value.replace(/\D/g, ''))}
                maxLength={4}
                className="w-[80px] border border-gray-300 rounded-lg px-3 py-3 text-sm text-center outline-none focus:border-[#2ED573]"
              />
              <span className="text-gray-400">-</span>
              <input
                type="text"
                value={form.phone3}
                onChange={(e) => handleChange('phone3', e.target.value.replace(/\D/g, ''))}
                maxLength={4}
                className="w-[80px] border border-gray-300 rounded-lg px-3 py-3 text-sm text-center outline-none focus:border-[#2ED573]"
              />
            </div>
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>

          {/* 주소 */}
          <div>
            <label className="text-sm font-bold block mb-1">주소 *</label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={form.zonecode}
                readOnly
                placeholder="우편번호"
                className="border border-gray-300 rounded-lg px-4 py-3 text-sm w-[120px] outline-none bg-gray-50 text-gray-500"
              />
              <button
                type="button"
                onClick={() => {
                  new window.daum.Postcode({
                    oncomplete: (data) => {
                      setForm((prev) => ({
                        ...prev,
                        zonecode: data.zonecode,
                        address: data.roadAddress || data.jibunAddress,
                      }))
                    },
                  }).open()
                }}
                className="bg-gray-800 text-white text-sm px-4 py-3 rounded-lg cursor-pointer border-none whitespace-nowrap"
              >
                우편번호 검색
              </button>
            </div>
            <input
              type="text"
              value={form.address}
              readOnly
              placeholder="도로명 주소"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none bg-gray-50 text-gray-500 mb-2"
            />
            <input
              type="text"
              value={form.addressDetail}
              onChange={(e) => handleChange('addressDetail', e.target.value)}
              placeholder="상세주소를 입력해주세요."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#2ED573] transition-colors"
            />
            {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
          </div>

          {/* 생년월일 */}
          <div>
            <label className="text-sm font-bold block mb-1">생년월일 *</label>
            <div className="flex items-center gap-2">
              <select
                value={form.birthYear}
                onChange={(e) => handleChange('birthYear', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-3 text-sm outline-none focus:border-[#2ED573]"
              >
                <option value="">년도</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={form.birthMonth}
                onChange={(e) => handleChange('birthMonth', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-3 text-sm outline-none focus:border-[#2ED573]"
              >
                <option value="">월</option>
                {months.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select
                value={form.birthDay}
                onChange={(e) => handleChange('birthDay', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-3 text-sm outline-none focus:border-[#2ED573]"
              >
                <option value="">일</option>
                {days.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {errors.birth && <p className="text-xs text-red-500 mt-1">{errors.birth}</p>}
          </div>

          {serverError && (
            <p className="text-red-500 text-sm">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2ED573] text-white font-bold py-3 rounded-lg cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-gray-400 text-xs">
            <div className="flex-1 h-px bg-gray-200" />
            <span>또는</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <button
            onClick={() => handleOAuth('kakao')}
            className="w-full bg-[#FEE500] text-[#391B1B] font-bold py-3 rounded-lg cursor-pointer flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 1C4.58 1 1 3.79 1 7.21c0 2.17 1.45 4.08 3.64 5.18l-.93 3.44c-.08.3.26.54.52.37l4.11-2.72c.22.01.44.03.66.03 4.42 0 8-2.79 8-6.21S13.42 1 9 1z" fill="#391B1B"/>
            </svg>
            카카오로 가입
          </button>

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
            Google로 가입
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          이미 회원이신가요?{' '}
          <Link to="/login" className="text-[#2ED573] font-bold no-underline">
            로그인
          </Link>
        </div>
      </div>
    </>
  )
}

export default SignUpPage
