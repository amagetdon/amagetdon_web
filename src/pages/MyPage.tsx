import { useState, useCallback, useEffect } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { profileService } from '../services/profileService'
import { purchaseService } from '../services/purchaseService'
import toast from 'react-hot-toast'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { paymentService } from '../services/paymentService'
import type { Purchase } from '../types'

declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: { zonecode: string; roadAddress: string; jibunAddress: string }) => void
      }) => { open: () => void }
    }
  }
}

interface FormData {
  name: string
  gender: 'male' | 'female' | ''
  zonecode: string
  address: string
  addressDetail: string
  phone1: string
  phone2: string
  phone3: string
  birthYear: string
  birthMonth: string
  birthDay: string
  password: string
  passwordConfirm: string
}

interface FormErrors {
  name?: string
  password?: string
  passwordConfirm?: string
  phone?: string
}

function MyPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [form, setForm] = useState<FormData>({
    name: '',
    gender: '',
    zonecode: '',
    address: '',
    addressDetail: '',
    phone1: '010',
    phone2: '',
    phone3: '',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    password: '',
    passwordConfirm: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [chargeOpen, setChargeOpen] = useState(false)
  const [chargeLoading, setChargeLoading] = useState(false)
  const [chargeAmount, setChargeAmount] = useState(10000)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    if (profile) {
      const phone = profile.phone?.split('-') || ['010', '', '']
      const birth = profile.birth_date ? new Date(profile.birth_date) : null
      const addrParts = profile.address?.split('|') || ['', '', '']
      setForm((prev) => ({
        ...prev,
        name: profile.name || '',
        gender: profile.gender || '',
        zonecode: addrParts[0] || '',
        address: addrParts[1] || '',
        addressDetail: addrParts[2] || '',
        phone1: phone[0] || '010',
        phone2: phone[1] || '',
        phone3: phone[2] || '',
        birthYear: birth ? String(birth.getFullYear()) : '',
        birthMonth: birth ? String(birth.getMonth() + 1) : '',
        birthDay: birth ? String(birth.getDate()) : '',
      }))
    }
  }, [profile])

  useEffect(() => {
    if (user) {
      purchaseService.getByUser(user.id).then(setPurchases).catch(() => {})
    }
  }, [user])

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setSaveMessage('')
  }

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!form.name.trim()) {
      newErrors.name = '이름을 입력해주세요.'
    }

    if (form.password || form.passwordConfirm) {
      if (!form.password && form.passwordConfirm) {
        newErrors.password = '비밀번호를 입력해주세요.'
      } else if (form.password) {
        const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,18}$/
        if (!passwordRegex.test(form.password)) {
          newErrors.password = '8~18자의 영문/숫자/특수문자를 함께 입력해주세요.'
        }
        if (form.password !== form.passwordConfirm) {
          newErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.'
        }
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

  const handleSave = async () => {
    if (!validate() || !user) return

    try {
      setSaving(true)
      const phone = form.phone2 ? `${form.phone1}-${form.phone2}-${form.phone3}` : null
      const birthDate = form.birthYear && form.birthMonth && form.birthDay
        ? `${form.birthYear}-${form.birthMonth.padStart(2, '0')}-${form.birthDay.padStart(2, '0')}`
        : null

      await profileService.updateProfile(user.id, {
        name: form.name,
        gender: form.gender || null,
        address: form.address ? `${form.zonecode}|${form.address}|${form.addressDetail}` : null,
        phone: phone,
        birth_date: birthDate,
      })

      if (form.password) {
        await profileService.updatePassword(form.password)
        setForm((prev) => ({ ...prev, password: '', passwordConfirm: '' }))
      }

      await refreshProfile()
      setSaveMessage('저장되었습니다.')
    } catch (err) {
      if (err instanceof Error) {
        const msg = err.message
        if (msg.includes('same') || msg.includes('different from the old')) {
          setSaveMessage('새 비밀번호는 기존 비밀번호와 달라야 합니다.')
        } else if (msg.includes('at least')) {
          setSaveMessage('비밀번호는 최소 6자 이상이어야 합니다.')
        } else if (msg.includes('Too many requests')) {
          setSaveMessage('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.')
        } else if (msg.includes('not authorized') || msg.includes('403')) {
          setSaveMessage('권한이 없습니다. 다시 로그인해주세요.')
        } else {
          setSaveMessage('저장에 실패했습니다.')
        }
      } else {
        setSaveMessage('저장에 실패했습니다.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      const phone = profile.phone?.split('-') || ['010', '', '']
      const birth = profile.birth_date ? new Date(profile.birth_date) : null
      const addrParts = profile.address?.split('|') || ['', '', '']
      setForm({
        name: profile.name || '',
        gender: profile.gender || '',
        zonecode: addrParts[0] || '',
        address: addrParts[1] || '',
        addressDetail: addrParts[2] || '',
        phone1: phone[0] || '010',
        phone2: phone[1] || '',
        phone3: phone[2] || '',
        birthYear: birth ? String(birth.getFullYear()) : '',
        birthMonth: birth ? String(birth.getMonth() + 1) : '',
        birthDay: birth ? String(birth.getDate()) : '',
        password: '',
        passwordConfirm: '',
      })
    }
    setErrors({})
    setSaveMessage('')
  }

  const handleChargePoints = async () => {
    if (!chargeAmount || chargeAmount < 1000 || !user) return
    try {
      setChargeLoading(true)
      const clientKey = await paymentService.getClientKey()
      if (!clientKey) {
        toast.error('결제 설정이 완료되지 않았습니다.')
        return
      }
      const tossPayments = await loadTossPayments(clientKey)
      const payment = tossPayments.payment({ customerKey: user.id })
      const orderId = paymentService.generateOrderId() + '_charge'

      setChargeOpen(false)
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: chargeAmount },
        orderId,
        orderName: `포인트 ${chargeAmount.toLocaleString()}P 충전`,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: profile?.email || undefined,
        customerName: profile?.name || undefined,
        customerMobilePhone: profile?.phone?.replace(/-/g, '') || undefined,
      })
    } catch (err) {
      if (err instanceof Error && err.message.includes('사용자가')) return
      toast.error('결제 요청에 실패했습니다.')
    } finally {
      setChargeLoading(false)
    }
  }

  const years = Array.from({ length: 80 }, (_, i) => 2006 - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  const displayName = profile?.name || user?.email?.split('@')[0] || ''
  const isIncomplete = !profile?.phone || !profile?.address || !profile?.name || !profile?.gender || !profile?.birth_date
  const isSocialLogin = user?.app_metadata?.provider && user.app_metadata.provider !== 'email'

  return (
    <>
      <div className="bg-black h-[200px] w-full" />

      <div className="max-w-[800px] mx-auto px-6">
        {isIncomplete && (
          <div className="mt-8 mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex items-start gap-3">
            <i className="ti ti-alert-triangle text-yellow-500 text-xl shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-yellow-800">회원정보를 입력해주세요</p>
              <p className="text-xs text-yellow-600 mt-1">서비스 이용을 위해 아래 필수 정보를 모두 입력해주세요. 정보 입력이 완료되어야 강의 수강, 전자책 열람 등 모든 기능을 이용할 수 있습니다.</p>
            </div>
          </div>
        )}
        <div className="mt-16 mb-10">
          <p className="text-2xl max-md:text-lg font-bold">
            <span className="text-[#2ED573]">{displayName}</span>님, 안녕하세요! 아마겟돈 클래스입니다 :)
          </p>
        </div>

        <div>
          <h2 className="font-bold border-b-2 border-[#2ED573] pb-2">회원정보입력</h2>

          {/* 이메일 (읽기 전용) */}
          <div className="flex items-center gap-8 py-4 border-b max-sm:flex-col max-sm:items-start max-sm:gap-2">
            <label className="w-[100px] font-bold text-sm shrink-0">이메일주소</label>
            <div className="flex-1 max-sm:w-full">
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="border-b px-2 py-1 text-sm w-full outline-none bg-gray-50 text-gray-500"
              />
            </div>
          </div>

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

          {/* 성별 */}
          <div className="flex items-center gap-8 py-4 border-b max-sm:flex-col max-sm:items-start max-sm:gap-2">
            <label className="w-[100px] font-bold text-sm shrink-0">성별</label>
            <div className="flex items-center gap-4">
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
          </div>

          {/* 주소 */}
          <div className="flex items-start gap-8 py-4 border-b max-sm:flex-col max-sm:items-start max-sm:gap-2">
            <label className="w-[100px] font-bold text-sm shrink-0 pt-1">주소</label>
            <div className="flex-1 max-sm:w-full">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={form.zonecode}
                  readOnly
                  placeholder="우편번호"
                  className="border px-2 py-1 text-sm w-[100px] outline-none bg-gray-50 text-gray-500"
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
                  className="bg-gray-800 text-white text-xs px-4 py-1.5 rounded cursor-pointer border-none"
                >
                  우편번호 검색
                </button>
              </div>
              <input
                type="text"
                value={form.address}
                readOnly
                placeholder="도로명 주소"
                className="border-b px-2 py-1 text-sm w-full outline-none bg-gray-50 text-gray-500 mb-2"
              />
              <input
                type="text"
                value={form.addressDetail}
                onChange={(e) => handleChange('addressDetail', e.target.value)}
                placeholder="상세주소를 입력해주세요."
                className="border-b px-2 py-1 text-sm w-full outline-none"
              />
            </div>
          </div>

          {/* 비밀번호 (소셜 로그인이 아닌 경우만) */}
          {!isSocialLogin && (
            <div className="flex items-start gap-8 py-4 border-b max-sm:flex-col max-sm:items-start max-sm:gap-2">
              <label className="w-[100px] font-bold text-sm shrink-0 pt-1">비밀번호 변경</label>
              <div className="flex-1 max-sm:w-full">
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="새 비밀번호 (변경 시에만 입력)"
                  className="border-b px-2 py-1 text-sm w-full outline-none"
                />
                <p className="text-xs mt-1 text-red-400">
                  {errors.password || '8~18자의 영문/숫자/특수문자를 함께 입력해주세요.'}
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
          )}

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
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={form.birthMonth}
                onChange={(e) => handleChange('birthMonth', e.target.value)}
                className="border px-2 py-1 rounded text-sm outline-none"
              >
                <option value="">월</option>
                {months.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={form.birthDay}
                onChange={(e) => handleChange('birthDay', e.target.value)}
                className="border px-2 py-1 rounded text-sm outline-none"
              >
                <option value="">일</option>
                {days.map((d) => (
                  <option key={d} value={d}>{d}</option>
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
              disabled={saving}
              className="bg-[#2ED573] text-white px-8 py-3 rounded-lg cursor-pointer disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
          {saveMessage && (
            <p className={`text-center text-sm mt-3 ${saveMessage === '저장되었습니다.' ? 'text-[#2ED573]' : 'text-red-400'}`}>
              {saveMessage}
            </p>
          )}
        </div>

        {/* 내 포인트 섹션 */}
        <div className="mt-12">
          <h2 className="font-bold border-b-2 border-[#2ED573] pb-2">내 포인트</h2>
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <span className="font-bold text-sm">포인트</span>
              <span className="text-[#2ED573] font-bold">
                {(profile?.points ?? 0).toLocaleString()}포인트
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChargeOpen(true)}
              className="px-4 py-2 bg-[#2ED573] text-white text-sm font-bold rounded-lg border-none cursor-pointer hover:bg-[#25B866] transition-colors"
            >
              포인트 충전
            </button>
          </div>
        </div>

        {/* 포인트 충전 모달 */}
        {chargeOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={(e) => { if (e.target === e.currentTarget) setChargeOpen(false) }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">포인트 충전</h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[5000, 10000, 30000, 50000, 100000, 200000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setChargeAmount(v)}
                    className={`py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${chargeAmount === v ? 'bg-[#2ED573] text-white border-[#2ED573]' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
                  >
                    {v.toLocaleString()}P
                  </button>
                ))}
              </div>
              <div className="mb-4">
                <label className="text-xs text-gray-500 mb-1 block">직접 입력</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={chargeAmount || ''}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setChargeAmount(v > 0 ? v : 0)
                  }}
                  onBlur={() => {
                    if (chargeAmount > 0 && chargeAmount < 1000) setChargeAmount(1000)
                  }}
                  placeholder="최소 1,000원 이상"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]"
                />
                {chargeAmount > 0 && chargeAmount < 1000 && (
                  <p className="text-xs text-red-500 mt-1">최소 1,000원 이상 충전 가능합니다.</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">충전 금액</span>
                  <span className="font-bold text-gray-900">{(chargeAmount || 0).toLocaleString()}원</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">충전 후 잔액</span>
                  <span className="font-bold text-[#2ED573]">{((profile?.points ?? 0) + (chargeAmount || 0)).toLocaleString()}P</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setChargeOpen(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-500 cursor-pointer hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleChargePoints}
                  disabled={!chargeAmount || chargeAmount < 1000 || chargeLoading}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold border-none bg-blue-600 text-white cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {chargeLoading ? '결제 준비 중...' : `${(chargeAmount || 0).toLocaleString()}원 결제`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 내 구매내역 섹션 */}
        <div className="mt-12 mb-16">
          <h2 className="font-bold border-b-2 border-[#2ED573] pb-2">내 구매내역</h2>
          <div className="divide-y">
            {purchases.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                구매내역이 없습니다.
              </div>
            ) : (
              purchases.map((item) => (
                <div key={item.id} className="py-4">
                  <p className="text-sm font-bold text-gray-900">구매내역</p>
                  <p className="text-sm text-gray-500 mt-1">{item.title}</p>
                  <p className="text-sm text-gray-400">
                    {new Date(item.purchased_at).toLocaleDateString('ko-KR')} 결제
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default MyPage
