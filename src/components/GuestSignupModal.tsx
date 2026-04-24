import { useState } from 'react'
import toast from 'react-hot-toast'
import { authService } from '../services/authService'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** 가입 완료 후 호출 — 이어서 구매 플로우 진행 */
  onSuccess: () => void
  /** 유입 출처(랜딩 slug 등) — profiles.signup_referrer 에 기록 */
  signupReferrer?: string
  /** 모달 상단 안내 문구 (강의명 등) */
  description?: string
}

function formatPhoneKR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length < 4) return digits
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export default function GuestSignupModal({ isOpen, onClose, onSuccess, signupReferrer, description }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const phoneDigits = phone.replace(/\D/g, '')
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedName) { toast.error('이름을 입력해주세요.'); return }
    if (phoneDigits.length < 10 || phoneDigits.length > 11) { toast.error('올바른 전화번호를 입력해주세요.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { toast.error('올바른 이메일을 입력해주세요.'); return }
    if (password.length < 6) { toast.error('비밀번호는 6자 이상으로 설정해주세요.'); return }
    if (!agree) { toast.error('이용약관에 동의해주세요.'); return }

    setSubmitting(true)
    try {
      await authService.guestSignUp({
        name: trimmedName,
        phone: formatPhoneKR(phone),
        email: trimmedEmail,
        password,
        signup_referrer: signupReferrer,
      })
      toast.success('가입 완료! 구매를 진행합니다.')
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '가입에 실패했습니다.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
              <i className="ti ti-bolt text-[#2ED573]" />
              비회원으로 바로 구매
            </h3>
            {description && (
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer disabled:opacity-50"
          >
            <i className="ti ti-x text-xl" />
          </button>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 mb-3 text-[11px] text-emerald-800 leading-relaxed">
          <i className="ti ti-info-circle mr-1" />
          주소·생년월일·성별 없이 아래 정보만으로 바로 구매할 수 있습니다.
          <br />
          이후에도 <strong>입력하신 이메일과 비밀번호</strong>로 로그인하여 구매한 강의를 시청하실 수 있습니다.
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">전화번호</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatPhoneKR(e.target.value))}
              placeholder="010-1234-5678"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
            />
            <p className="text-[11px] text-gray-400 mt-1">다음 접속 시 로그인 아이디로 사용됩니다.</p>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
            />
            <p className="text-[11px] text-gray-400 mt-1">다음 로그인 시 이 비밀번호를 사용합니다.</p>
          </div>

          <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer py-2">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="accent-[#2ED573] mt-0.5"
            />
            <span>
              <strong>서비스 이용약관</strong> 및 <strong>개인정보 처리방침</strong>에 동의합니다.
            </span>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-bold cursor-pointer hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#2ED573] text-white text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] disabled:opacity-50"
            >
              {submitting ? '처리 중...' : '바로 구매하기'}
            </button>
          </div>
        </form>

        <p className="text-[11px] text-gray-400 text-center mt-4">
          이미 회원이신가요? 취소 후 로그인해서 구매해주세요.
          <br />
          구매 후 마이페이지에서 언제든 <strong>정식 회원 전환</strong>이 가능합니다.
        </p>
      </div>
    </div>
  )
}
