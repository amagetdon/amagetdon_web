import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { profileService } from '../services/profileService'
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

type StepKey = 'name' | 'gender' | 'phone' | 'birth' | 'address' | 'password'

interface StepDef {
  key: StepKey
  title: string
  description?: string
  optional?: boolean
}

interface OnboardingForm {
  name: string
  gender: 'male' | 'female' | ''
  phone1: string
  phone2: string
  phone3: string
  birthYear: string
  birthMonth: string
  birthDay: string
  zonecode: string
  address: string
  addressDetail: string
  password: string
  passwordConfirm: string
}

const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,18}$/

function OnboardingPage() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile, loading: authLoading } = useAuth()

  const isGuest = profile?.provider === 'guest'

  const initialForm = useMemo<OnboardingForm>(() => {
    const phone = profile?.phone?.split('-') || ['010', '', '']
    const birth = profile?.birth_date ? new Date(profile.birth_date) : null
    const addrParts = profile?.address?.split('|') || ['', '', '']
    return {
      name: profile?.name || '',
      gender: profile?.gender || '',
      phone1: phone[0] || '010',
      phone2: phone[1] || '',
      phone3: phone[2] || '',
      birthYear: birth ? String(birth.getFullYear()) : '',
      birthMonth: birth ? String(birth.getMonth() + 1) : '',
      birthDay: birth ? String(birth.getDate()) : '',
      zonecode: addrParts[0] || '',
      address: addrParts[1] || '',
      addressDetail: addrParts[2] || '',
      password: '',
      passwordConfirm: '',
    }
  }, [profile])

  const [form, setForm] = useState<OnboardingForm>(initialForm)

  useEffect(() => {
    setForm(initialForm)
  }, [initialForm])

  const steps = useMemo<StepDef[]>(() => {
    // 프로필에 이미 있는 항목은 묻지 않음 — 빈 필드만 단계로 추가.
    const list: StepDef[] = []
    if (!profile?.name) list.push({ key: 'name', title: '성함을 알려주세요 :)' })
    if (!profile?.gender) list.push({ key: 'gender', title: '성별을 선택해주세요 :)' })
    if (!profile?.phone) list.push({ key: 'phone', title: '연락 가능한 휴대폰 번호를 입력해주세요 :)' })
    if (!profile?.birth_date) list.push({ key: 'birth', title: '생년월일을 입력해주세요 :)' })
    if (!profile?.address) list.push({ key: 'address', title: '주소를 알려주세요 :)', description: '선택 입력 — 강의자료 발송에 활용됩니다.', optional: true })
    // 비회원(guest) 만 정규 승격을 위해 비밀번호 단계 추가 (이미 있어도 변경 가능하도록 항상 노출)
    if (isGuest) {
      list.push({
        key: 'password',
        title: '비밀번호를 설정해주세요 :)',
        description: '비밀번호로 직접 로그인할 수 있도록 정규 회원으로 전환됩니다.',
      })
    }
    return list
  }, [profile, isGuest])

  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [animKey, setAnimKey] = useState(0)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  const total = steps.length
  const current = steps[stepIndex]

  // steps 길이가 줄어들면 stepIndex 가 범위를 벗어날 수 있어 마지막 단계로 클램프
  useEffect(() => {
    if (total > 0 && stepIndex >= total) setStepIndex(total - 1)
  }, [stepIndex, total])

  useEffect(() => {
    setError('')
    setAnimKey((k) => k + 1)
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 60)
    return () => window.clearTimeout(t)
  }, [stepIndex])

  // 미로그인 또는 정보가 이미 모두 있는 경우 진입 차단
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    const isComplete = !!profile?.name && !!profile?.phone && !!profile?.gender && !!profile?.birth_date
    if (isComplete && !isGuest) {
      navigate('/my-classroom', { replace: true })
    }
  }, [authLoading, user, profile, isGuest, navigate])

  const handleChange = (field: keyof OnboardingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const validateStep = useCallback((): string | null => {
    switch (current?.key) {
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
      case 'password': {
        if (!form.password) return '비밀번호를 입력해주세요.'
        if (!PASSWORD_REGEX.test(form.password)) return '8~18자의 영문/숫자/특수문자를 함께 입력해주세요.'
        if (form.password !== form.passwordConfirm) return '비밀번호가 일치하지 않습니다.'
        return null
      }
      default:
        return null
    }
  }, [current?.key, form])

  const persistAndFinish = useCallback(async () => {
    if (!user) return
    setSubmitting(true)
    setError('')
    try {
      const phone = form.phone2 ? `${form.phone1}-${form.phone2}-${form.phone3}` : null
      const birthDate = form.birthYear && form.birthMonth && form.birthDay
        ? `${form.birthYear}-${form.birthMonth.padStart(2, '0')}-${form.birthDay.padStart(2, '0')}`
        : null
      const addressCombined = form.zonecode || form.address
        ? `${form.zonecode}|${form.address}|${form.addressDetail}`
        : null

      await profileService.updateProfile(user.id, {
        name: form.name,
        gender: form.gender || null,
        phone,
        birth_date: birthDate,
        address: addressCombined,
      })

      if (form.password) {
        try {
          await profileService.updatePassword(form.password)
          if (isGuest) {
            try { await profileService.promoteGuestToMember(user.id) } catch { /* 승격 실패해도 저장은 성공 */ }
          }
        } catch (err) {
          if (err instanceof Error && /same|different from the old/.test(err.message)) {
            // 기존과 같은 비밀번호 — 저장은 진행
          } else {
            throw err
          }
        }
      }

      await refreshProfile()
      setDone(true)
      window.setTimeout(() => {
        navigate('/my-classroom', { replace: true })
      }, 900)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '저장에 실패했습니다. 잠시 후 다시 시도해주세요.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }, [user, form, isGuest, refreshProfile, navigate])

  const goNext = useCallback(async (opts: { skip?: boolean } = {}) => {
    if (submitting) return
    if (!opts.skip) {
      const err = validateStep()
      if (err) {
        setError(err)
        return
      }
    }
    if (stepIndex >= total - 1) {
      await persistAndFinish()
      return
    }
    setDirection('forward')
    setStepIndex((i) => i + 1)
  }, [stepIndex, total, validateStep, submitting, persistAndFinish])

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

  if (authLoading || !current) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="max-w-[640px] mx-auto px-6 py-24 text-center">
        <div className={`w-20 h-20 bg-[#2ED573] rounded-full flex items-center justify-center mx-auto mb-6 ${TYPEFORM_SCALE_IN}`}>
          <i className="ti ti-check text-white text-4xl" />
        </div>
        <h1 className="text-2xl font-bold mb-3">정보 입력 완료</h1>
        <p className="text-gray-500">잠시만 기다려주세요. 내 강의실로 이동합니다.</p>
      </div>
    )
  }

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
      submitting={submitting}
      isLast={stepIndex === total - 1}
      onNext={() => goNext()}
      onPrev={goPrev}
      onSkip={current.optional ? () => goNext({ skip: true }) : undefined}
    >
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

      {current.key === 'password' && (
        <div className="space-y-4 max-w-[480px]">
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="password"
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="새 비밀번호"
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
    </TypeformQuestion>
  )
}

export default OnboardingPage
