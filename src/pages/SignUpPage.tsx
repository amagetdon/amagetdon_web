import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '../services/authService'
import { webhookService } from '../services/webhookService'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Turnstile from '../components/Turnstile'
import TypeformQuestion, { TYPEFORM_SCALE_IN } from '../components/auth/TypeformQuestion'

declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: { zonecode: string; roadAddress: string; jibunAddress: string }) => void
      }) => { open: () => void }
    }
  }
}

type StepKey =
  | 'email'
  | 'password'
  | 'name'
  | 'gender'
  | 'phone'
  | 'birth'
  | 'address'
  | 'submit'

interface StepDef {
  key: StepKey
  title: string
  description?: string
  optional?: boolean
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

const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,18}$/

const STEPS: StepDef[] = [
  { key: 'email', title: '이메일 주소를 알려주세요 :)', description: '로그인 ID 로 사용되며, 인증 메일이 발송됩니다.' },
  { key: 'password', title: '비밀번호를 설정해주세요 :)', description: '8~18자 영문/숫자/특수문자를 조합해주세요.' },
  { key: 'name', title: '성함을 알려주세요 :)' },
  { key: 'gender', title: '성별을 선택해주세요 :)' },
  { key: 'phone', title: '연락 가능한 휴대폰 번호를 입력해주세요 :)' },
  { key: 'birth', title: '생년월일을 입력해주세요 :)' },
  { key: 'address', title: '주소를 알려주세요 :)', description: '선택 입력 — 강의자료 발송에 활용됩니다.', optional: true },
  { key: 'submit', title: '거의 다 왔어요! 마지막으로 확인해주세요 :)', description: '약관에 동의하고 가입을 완료해주세요.' },
]

function SignUpPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()

  useEffect(() => { webhookService.markLandingEntry() }, [])

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
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [animKey, setAnimKey] = useState(0)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [success, setSuccess] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  // 이미 로그인된 사용자는 회원가입 불필요
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true })
    }
  }, [authLoading, user, navigate])

  const total = STEPS.length
  const current = STEPS[stepIndex]

  useEffect(() => {
    setError('')
    setAnimKey((k) => k + 1)
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 60)
    return () => window.clearTimeout(t)
  }, [stepIndex])

  const handleChange = (field: keyof SignUpForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const validateStep = useCallback((): string | null => {
    switch (current.key) {
      case 'email':
        if (!form.email.trim()) return '이메일을 입력해주세요.'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return '올바른 이메일 형식이 아닙니다.'
        return null
      case 'password':
        if (!form.password) return '비밀번호를 입력해주세요.'
        if (!PASSWORD_REGEX.test(form.password)) return '8~18자의 영문/숫자/특수문자를 함께 입력해주세요.'
        if (form.password !== form.passwordConfirm) return '비밀번호가 일치하지 않습니다.'
        return null
      case 'name':
        if (!form.name.trim()) return '이름을 입력해주세요.'
        return null
      case 'gender':
        if (!form.gender) return '성별을 선택해주세요.'
        return null
      case 'phone': {
        if (!form.phone2 || !form.phone3) return '휴대폰 번호를 입력해주세요.'
        const phoneRegex = /^\d{3,4}$/
        if (!phoneRegex.test(form.phone2) || !phoneRegex.test(form.phone3)) return '올바른 휴대폰 번호를 입력해주세요.'
        return null
      }
      case 'birth':
        if (!form.birthYear || !form.birthMonth || !form.birthDay) return '생년월일을 모두 선택해주세요.'
        return null
      case 'address':
        if ((form.zonecode || form.address) && !form.addressDetail.trim()) {
          return '상세주소를 입력해주세요. (또는 건너뛰기)'
        }
        return null
      case 'submit':
        if (!agreeTerms) return '이용약관 및 개인정보 처리방침에 동의해주세요.'
        if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken) {
          return '잠시만 기다려주세요. 봇 방지 확인이 진행 중입니다.'
        }
        return null
      default:
        return null
    }
  }, [current.key, form, agreeTerms, captchaToken])

  const submitSignUp = useCallback(async () => {
    setSubmitting(true)
    setError('')
    try {
      const phone = form.phone2 ? `${form.phone1}-${form.phone2}-${form.phone3}` : undefined
      const birthDate = form.birthYear && form.birthMonth && form.birthDay
        ? `${form.birthYear}-${form.birthMonth.padStart(2, '0')}-${form.birthDay.padStart(2, '0')}`
        : undefined
      const addressCombined = form.zonecode || form.address
        ? `${form.zonecode}|${form.address}|${form.addressDetail}`
        : undefined

      await authService.signUp(form.email.trim(), form.password, {
        name: form.name.trim(),
        gender: form.gender || undefined,
        phone,
        address: addressCombined,
        birth_date: birthDate,
        ...utmParams,
      }, captchaToken)

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

      // 웹훅 전송 (실패해도 무시)
      webhookService.fireSignup({
        userId: newUser?.id || null,
        name: form.name.trim(),
        email: form.email.trim(),
        phone,
        gender: form.gender || null,
        address: addressCombined || null,
        birth_date: birthDate || null,
        ...utmParams,
      }, webhookService.captureContext()).catch(() => {})

      setSuccess(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '가입에 실패했습니다.'
      if (msg.includes('already registered')) {
        setError('이미 가입된 이메일입니다.')
      } else if (msg.includes('Email not confirmed')) {
        setError('이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.')
      } else if (msg.includes('password')) {
        setError('비밀번호는 6자 이상이어야 합니다.')
      } else if (msg.includes('Too many requests')) {
        setError('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.')
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }, [form, utmParams, captchaToken])

  const goNext = useCallback(async (opts: { skip?: boolean } = {}) => {
    if (submitting) return
    if (!opts.skip) {
      const err = validateStep()
      if (err) {
        setError(err)
        return
      }
    }

    // 이메일 단계에서는 중복 가입 여부를 먼저 확인 — 마지막에 가서야 실패하지 않도록
    if (current.key === 'email' && !opts.skip) {
      try {
        setCheckingEmail(true)
        const exists = await authService.checkEmailExists(form.email.trim())
        if (exists) {
          setError('이미 가입된 이메일입니다. 로그인 페이지에서 로그인해주세요.')
          return
        }
      } finally {
        setCheckingEmail(false)
      }
    }

    if (stepIndex >= total - 1) {
      await submitSignUp()
      return
    }
    setDirection('forward')
    setStepIndex((i) => i + 1)
  }, [stepIndex, total, validateStep, submitting, submitSignUp, current.key, form.email])

  const goPrev = useCallback(() => {
    if (stepIndex === 0 || submitting) return
    setError('')
    setDirection('backward')
    setStepIndex((i) => i - 1)
  }, [stepIndex, submitting])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      goNext()
    }
  }

  const openPostcode = () => {
    if (!window.daum?.Postcode) {
      setError('우편번호 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
      return
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        setForm((prev) => ({
          ...prev,
          zonecode: data.zonecode,
          address: data.roadAddress || data.jibunAddress,
        }))
        setError('')
      },
    }).open()
  }

  const years = useMemo(() => Array.from({ length: 80 }, (_, i) => 2006 - i), [])
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), [])

  if (success) {
    return (
      <div className="max-w-[440px] mx-auto px-6 py-16 text-center">
          <div className={`w-16 h-16 bg-[#2ED573] rounded-full flex items-center justify-center mx-auto mb-6 ${TYPEFORM_SCALE_IN}`}>
            <i className="ti ti-mail-check text-white text-3xl" />
          </div>
          <h1 className="text-2xl font-bold mb-4">회원가입 신청 완료</h1>
          <p className="text-sm font-medium text-gray-900 mb-2">{form.email}</p>
          <p className="text-gray-500 mb-4">
            가입하신 이메일로 인증 메일이 발송되었습니다.<br />
            이메일 인증을 완료하신 후 로그인해주세요.
          </p>
          <p className="text-xs text-gray-400 mb-8">메일이 오지 않는 경우 스팸함을 확인해주세요.</p>
          <div className="flex flex-col gap-2 max-w-[280px] mx-auto">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="bg-[#2ED573] text-white font-bold px-8 py-3 rounded-lg cursor-pointer border-none hover:bg-[#25B866] transition-colors"
            >
              로그인 하러가기
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="bg-transparent text-gray-500 text-sm py-2 cursor-pointer border-none hover:text-gray-800"
            >
              홈으로
            </button>
          </div>
        </div>
    )
  }

  // 마지막 단계 — 약관 + 캡차
  const isSubmitStep = current.key === 'submit'
  const bottomSlot = isSubmitStep ? (
    <div className="space-y-4 max-w-[480px]">
      <Turnstile
        onVerify={setCaptchaToken}
        onExpire={() => setCaptchaToken('')}
        className="flex"
      />
    </div>
  ) : null

  return (
    <TypeformQuestion
      stepIndex={stepIndex}
      totalSteps={total}
      title={current.title}
      description={current.description}
      optional={current.optional}
      direction={direction}
      animKey={animKey}
      error={error}
      submitting={submitting || checkingEmail}
      isLast={stepIndex === total - 1}
      submitLabel="가입하기"
      onNext={() => goNext()}
      onPrev={goPrev}
      onSkip={current.optional ? () => goNext({ skip: true }) : undefined}
      bottomSlot={bottomSlot}
    >
      {current.key === 'email' && (
        <div>
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="email@example.com"
            autoComplete="email"
            disabled={checkingEmail}
            className="w-full text-2xl max-md:text-lg py-3 border-b-2 border-gray-200 focus:border-[#2ED573] outline-none transition-colors placeholder:text-gray-300 disabled:bg-gray-50/50"
          />
          {checkingEmail && (
            <p className="mt-3 text-sm text-[#2ED573] flex items-center gap-2 animate-pulse">
              <span className="w-3.5 h-3.5 border-2 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
              이메일 중복 확인 중...
            </p>
          )}
        </div>
      )}

      {current.key === 'password' && (
        <div className="space-y-4 max-w-[480px]">
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="password"
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="비밀번호"
            autoComplete="new-password"
            className="w-full border-b-2 border-gray-200 focus:border-[#2ED573] py-3 text-lg outline-none transition-colors placeholder:text-gray-300"
          />
          {form.password && (() => {
            const pw = form.password
            const checks = [
              { label: '8~18자', ok: pw.length >= 8 && pw.length <= 18 },
              { label: '영문', ok: /[a-zA-Z]/.test(pw) },
              { label: '숫자', ok: /\d/.test(pw) },
              { label: '특수문자', ok: /[!@#$%^&*]/.test(pw) },
            ]
            return (
              <div className="text-xs flex flex-wrap gap-x-3 gap-y-1">
                {checks.map((c) => (
                  <span key={c.label} className={`inline-flex items-center gap-0.5 ${c.ok ? 'text-[#2ED573]' : 'text-gray-400'}`}>
                    <i className={`ti ${c.ok ? 'ti-check' : 'ti-x'}`} />
                    {c.label}
                  </span>
                ))}
              </div>
            )
          })()}
          <input
            type="password"
            value={form.passwordConfirm}
            onChange={(e) => handleChange('passwordConfirm', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="비밀번호 확인"
            autoComplete="new-password"
            className="w-full border-b-2 border-gray-200 focus:border-[#2ED573] py-3 text-lg outline-none transition-colors placeholder:text-gray-300"
          />
          {form.passwordConfirm && (
            <p className={`text-xs ${form.password === form.passwordConfirm ? 'text-[#2ED573]' : 'text-red-500'}`}>
              <i className={`ti ${form.password === form.passwordConfirm ? 'ti-check' : 'ti-x'} mr-0.5`} />
              {form.password === form.passwordConfirm ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
            </p>
          )}
        </div>
      )}

      {current.key === 'name' && (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="이름을 입력해주세요."
          className="w-full text-2xl max-md:text-lg py-3 border-b-2 border-gray-200 focus:border-[#2ED573] outline-none transition-colors placeholder:text-gray-300"
        />
      )}

      {current.key === 'gender' && (
        <div>
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value=""
            onChange={() => { /* readonly capture */ }}
            onKeyDown={(e) => {
              const key = e.key.toLowerCase()
              // 영문 m/f, 한글 자모 ㅡ/ㄹ, 그리고 IME 무관한 e.code 모두 매핑
              if (key === 'm' || key === 'ㅡ' || e.code === 'KeyM') { e.preventDefault(); handleChange('gender', 'male') }
              else if (key === 'f' || key === 'ㄹ' || e.code === 'KeyF') { e.preventDefault(); handleChange('gender', 'female') }
              else if (e.key === 'Enter') { e.preventDefault(); goNext() }
            }}
            aria-label="성별 선택 — M 또는 F 키를 누르세요"
            className="sr-only"
          />
          <div className="flex flex-wrap gap-3">
            {(['male', 'female'] as const).map((g) => {
              const active = form.gender === g
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => handleChange('gender', g)}
                  className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 text-base font-medium cursor-pointer transition-all min-w-[180px] ${
                    active
                      ? 'border-[#2ED573] bg-[#2ED573]/5 text-gray-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-md inline-flex items-center justify-center text-xs font-bold ${active ? 'bg-[#2ED573] text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {g === 'male' ? 'M' : 'F'}
                  </span>
                  <span>{g === 'male' ? '남성' : '여성'}</span>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            <span className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 font-mono text-[10px] mr-1">M</span>
            <span className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 font-mono text-[10px] mr-1">F</span>
            키로도 선택할 수 있어요.
          </p>
        </div>
      )}

      {current.key === 'phone' && (
        <div className="flex items-center gap-2 max-w-[420px]">
          <input
            type="text"
            value={form.phone1}
            onChange={(e) => handleChange('phone1', e.target.value.replace(/\D/g, '').slice(0, 3))}
            maxLength={3}
            className="w-[90px] border-b-2 border-gray-200 focus:border-[#2ED573] py-3 text-xl text-center outline-none transition-colors"
          />
          <span className="text-gray-300">-</span>
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            inputMode="numeric"
            value={form.phone2}
            onChange={(e) => handleChange('phone2', e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={handleKeyDown}
            maxLength={4}
            placeholder="0000"
            className="flex-1 border-b-2 border-gray-200 focus:border-[#2ED573] py-3 text-xl text-center outline-none transition-colors placeholder:text-gray-300"
          />
          <span className="text-gray-300">-</span>
          <input
            type="text"
            inputMode="numeric"
            value={form.phone3}
            onChange={(e) => handleChange('phone3', e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={handleKeyDown}
            maxLength={4}
            placeholder="0000"
            className="flex-1 border-b-2 border-gray-200 focus:border-[#2ED573] py-3 text-xl text-center outline-none transition-colors placeholder:text-gray-300"
          />
        </div>
      )}

      {current.key === 'birth' && (
        <div className="flex items-center gap-3 flex-wrap">
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={form.birthYear}
            onChange={(e) => handleChange('birthYear', e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-2 border-gray-200 focus:border-[#2ED573] rounded-lg px-4 py-3 text-base outline-none cursor-pointer"
          >
            <option value="">년도</option>
            {years.map((y) => (<option key={y} value={y}>{y}년</option>))}
          </select>
          <select
            value={form.birthMonth}
            onChange={(e) => handleChange('birthMonth', e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-2 border-gray-200 focus:border-[#2ED573] rounded-lg px-4 py-3 text-base outline-none cursor-pointer"
          >
            <option value="">월</option>
            {months.map((m) => (<option key={m} value={m}>{m}월</option>))}
          </select>
          <select
            value={form.birthDay}
            onChange={(e) => handleChange('birthDay', e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-2 border-gray-200 focus:border-[#2ED573] rounded-lg px-4 py-3 text-base outline-none cursor-pointer"
          >
            <option value="">일</option>
            {days.map((d) => (<option key={d} value={d}>{d}일</option>))}
          </select>
        </div>
      )}

      {current.key === 'address' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={form.zonecode}
              readOnly
              placeholder="우편번호"
              className="border-b-2 border-gray-200 py-3 text-base outline-none bg-transparent w-[140px] text-gray-700"
            />
            <button
              type="button"
              onClick={openPostcode}
              className="bg-gray-900 text-white text-sm font-bold px-4 py-3 rounded-lg cursor-pointer border-none whitespace-nowrap hover:bg-gray-800 transition-colors"
            >
              <i className="ti ti-search mr-1" />
              우편번호 검색
            </button>
          </div>
          <input
            type="text"
            value={form.address}
            readOnly
            placeholder="도로명/지번 주소"
            className="w-full border-b-2 border-gray-200 py-3 text-base outline-none bg-transparent text-gray-700"
          />
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={form.addressDetail}
            onChange={(e) => handleChange('addressDetail', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="상세주소 (동/호수 등)"
            className="w-full border-b-2 border-gray-200 focus:border-[#2ED573] py-3 text-base outline-none transition-colors placeholder:text-gray-300"
          />
        </div>
      )}

      {current.key === 'submit' && (
        <div className="space-y-4 max-w-[520px]">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-1.5">
            <div className="flex justify-between"><span className="text-gray-500">이메일</span><span className="font-medium">{form.email}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">이름</span><span className="font-medium">{form.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">성별</span><span className="font-medium">{form.gender === 'male' ? '남성' : form.gender === 'female' ? '여성' : '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">휴대폰</span><span className="font-medium">{form.phone2 ? `${form.phone1}-${form.phone2}-${form.phone3}` : '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">생년월일</span><span className="font-medium">{form.birthYear ? `${form.birthYear}.${form.birthMonth}.${form.birthDay}` : '-'}</span></div>
            {(form.zonecode || form.address) && (
              <div className="flex justify-between gap-3"><span className="text-gray-500 shrink-0">주소</span><span className="font-medium text-right">[{form.zonecode}] {form.address} {form.addressDetail}</span></div>
            )}
          </div>

          <label className="flex items-start gap-2 cursor-pointer text-sm py-1">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => { setAgreeTerms(e.target.checked); setError('') }}
              className="accent-[#2ED573] mt-0.5"
            />
            <span className="text-gray-700">
              <Link to="/terms" target="_blank" className="text-[#2ED573] underline">서비스 이용약관</Link>
              {' 및 '}
              <Link to="/privacy" target="_blank" className="text-[#2ED573] underline">개인정보 처리방침</Link>
              에 동의합니다.
            </span>
          </label>
        </div>
      )}
    </TypeformQuestion>
  )
}

export default SignUpPage
