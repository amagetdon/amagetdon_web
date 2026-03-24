import { useState, useCallback } from 'react'

interface FormData {
  name: string
  email: string
  password: string
  passwordConfirm: string
  phone1: string
  phone2: string
  phone3: string
  birthYear: string
  birthMonth: string
  birthDay: string
}

interface FormErrors {
  name?: string
  email?: string
  password?: string
  passwordConfirm?: string
  phone?: string
}

interface Purchase {
  title: string
  date: string
}

const PURCHASES: Purchase[] = [
  { title: '한번 배워서 평생 써먹는, TOT설계사의 하이엔드 세일즈 비법', date: '25-12-23' },
  { title: '한번 배워서 평생 써먹는, TOT설계사의 하이엔드 세일즈 비법', date: '25-09-23' },
]

const INITIAL_FORM: FormData = {
  name: '',
  email: '',
  password: '',
  passwordConfirm: '',
  phone1: '010',
  phone2: '',
  phone3: '',
  birthYear: '',
  birthMonth: '',
  birthDay: '',
}

function MyPage() {
  const [form, setForm] = useState<FormData>({ ...INITIAL_FORM })
  const [errors, setErrors] = useState<FormErrors>({})

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!form.name.trim()) {
      newErrors.name = '이름을 입력해주세요.'
    }

    if (!form.email.trim()) {
      newErrors.email = '이메일을 입력해주세요.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다.'
    }

    if (form.password) {
      const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,15}$/
      if (!passwordRegex.test(form.password)) {
        newErrors.password = '8~15자의 영문/숫자/특수문자를 함께 입력해주세요.'
      }
      if (form.password !== form.passwordConfirm) {
        newErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.'
      }
    }

    const phoneRegex = /^\d{3,4}$/
    if (form.phone2 || form.phone3) {
      if (!phoneRegex.test(form.phone2) || !phoneRegex.test(form.phone3)) {
        newErrors.phone = '올바른 휴대폰 번호를 입력해주세요.'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [form])

  const handleSave = () => {
    if (validate()) {
      // Save logic
    }
  }

  const handleCancel = () => {
    setForm({ ...INITIAL_FORM })
    setErrors({})
  }

  const years = Array.from({ length: 80 }, (_, i) => 2006 - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <>
      {/* 히어로 배너 */}
      <div className="bg-black h-[200px] w-full" />

      <div className="max-w-[800px] mx-auto px-6">
        {/* 인사 영역 */}
        <div className="mt-16 mb-10">
          <p className="text-2xl font-bold text-[#04F87F]">심지원님</p>
          <p className="text-2xl font-bold">안녕하세요 아마겟돈 클래스입니다 :)</p>
        </div>

        {/* 회원정보입력 섹션 */}
        <div>
          <h2 className="font-bold border-b-2 border-[#04F87F] pb-2">회원정보입력</h2>

          {/* 이름 */}
          <div className="flex items-center gap-8 py-4 border-b max-sm:flex-col max-sm:items-start max-sm:gap-2">
            <label className="w-[100px] font-bold text-sm shrink-0">이름</label>
            <div className="flex-1 max-sm:w-full">
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="한글 또는 영문으로 입력해주세요."
                className="border-b px-2 py-1 text-sm w-full outline-none"
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name}</p>
              )}
            </div>
          </div>

          {/* 이메일주소 */}
          <div className="flex items-center gap-8 py-4 border-b max-sm:flex-col max-sm:items-start max-sm:gap-2">
            <label className="w-[100px] font-bold text-sm shrink-0">이메일주소</label>
            <div className="flex-1 max-sm:w-full">
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="이메일 주소를 입력해주세요."
                className="border-b px-2 py-1 text-sm w-full outline-none"
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email}</p>
              )}
            </div>
          </div>

          {/* 비밀번호 */}
          <div className="flex items-start gap-8 py-4 border-b max-sm:flex-col max-sm:items-start max-sm:gap-2">
            <label className="w-[100px] font-bold text-sm shrink-0 pt-1">비밀번호</label>
            <div className="flex-1 max-sm:w-full">
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="한글 또는 영문으로 기재해주세요."
                className="border-b px-2 py-1 text-sm w-full outline-none"
              />
              <p className={`text-xs mt-1 ${errors.password ? 'text-red-500' : 'text-[#04F87F]'}`}>
                {errors.password || '8~15자의 영문/숫자/특수문자를 함께 입력해주세요.'}
              </p>
              <input
                type="password"
                value={form.passwordConfirm}
                onChange={(e) => handleChange('passwordConfirm', e.target.value)}
                placeholder="비밀번호를 다시 입력해주세요."
                className="border-b px-2 py-1 text-sm w-full outline-none mt-3"
              />
              {errors.passwordConfirm && (
                <p className="text-xs text-red-500 mt-1">{errors.passwordConfirm}</p>
              )}
            </div>
          </div>

          {/* 휴대폰 번호 */}
          <div className="flex items-center gap-8 py-4 border-b max-sm:flex-col max-sm:items-start max-sm:gap-2">
            <label className="w-[100px] font-bold text-sm shrink-0">휴대폰 번호</label>
            <div className="max-sm:w-full">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.phone1}
                  onChange={(e) => handleChange('phone1', e.target.value)}
                  maxLength={3}
                  className="w-[80px] border px-2 py-1 text-sm text-center outline-none"
                />
                <span>-</span>
                <input
                  type="text"
                  value={form.phone2}
                  onChange={(e) => handleChange('phone2', e.target.value.replace(/\D/g, ''))}
                  maxLength={4}
                  className="w-[80px] border px-2 py-1 text-sm text-center outline-none"
                />
                <span>-</span>
                <input
                  type="text"
                  value={form.phone3}
                  onChange={(e) => handleChange('phone3', e.target.value.replace(/\D/g, ''))}
                  maxLength={4}
                  className="w-[80px] border px-2 py-1 text-sm text-center outline-none"
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
              )}
            </div>
          </div>

          {/* 생년월일 */}
          <div className="flex items-center gap-8 py-4 border-b max-sm:flex-col max-sm:items-start max-sm:gap-2">
            <label className="w-[100px] font-bold text-sm shrink-0">생년월일</label>
            <div className="flex items-center gap-2">
              <select
                value={form.birthYear}
                onChange={(e) => handleChange('birthYear', e.target.value)}
                className="border px-2 py-1 rounded text-sm outline-none"
              >
                <option value="">년도</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                value={form.birthMonth}
                onChange={(e) => handleChange('birthMonth', e.target.value)}
                className="border px-2 py-1 rounded text-sm outline-none"
              >
                <option value="">월</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={form.birthDay}
                onChange={(e) => handleChange('birthDay', e.target.value)}
                className="border px-2 py-1 rounded text-sm outline-none"
              >
                <option value="">일</option>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 버튼 영역 */}
          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={handleCancel}
              className="bg-gray-800 text-white px-8 py-3 rounded-lg cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="bg-[#04F87F] text-white px-8 py-3 rounded-lg cursor-pointer"
            >
              저장
            </button>
          </div>
        </div>

        {/* 내 포인트 섹션 */}
        <div className="mt-12">
          <h2 className="font-bold border-b-2 border-[#04F87F] pb-2">내 포인트</h2>
          <div className="flex items-center gap-4 py-4">
            <span className="font-bold text-sm">포인트</span>
            <span className="text-[#04F87F] font-bold">50,000포인트</span>
          </div>
        </div>

        {/* 내 구매내역 섹션 */}
        <div className="mt-12 mb-16">
          <h2 className="font-bold border-b-2 border-[#04F87F] pb-2">내 구매내역</h2>
          <div className="divide-y">
            {PURCHASES.map((item, idx) => (
              <div key={idx} className="py-4">
                <p className="text-sm font-bold text-gray-900">구매내역</p>
                <p className="text-sm text-gray-500 mt-1">
                  {item.title}
                </p>
                <p className="text-sm text-gray-400">{item.date} 결제</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default MyPage
