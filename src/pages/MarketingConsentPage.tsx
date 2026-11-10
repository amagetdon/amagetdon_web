import { useBusinessInfo } from '../hooks/useBusinessInfo'

// 마케팅 정보 수신 동의(선택) 안내 — 카카오싱크 [간편가입] 서비스 약관 '마케팅' 의 URL 로 쓴다.
// ⚠️ 2026-10-19 초안: 법무 확인 전. 문구 확정 뒤 DRAFT 를 false 로.
const DRAFT = true

export default function MarketingConsentPage() {
  const biz = useBusinessInfo()
  const company = biz.companyName || '주식회사 아마겟돈 컴퍼니'
  const contact = [biz.phone, biz.email].filter(Boolean).join(' · ')
  return (
    <>
      <section className="w-full bg-black py-20 flex items-center justify-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">마케팅 정보 수신 동의 (선택)</h1>
      </section>
      <section className="w-full bg-white py-16 max-sm:py-10">
        <div className="max-w-[800px] mx-auto px-5 text-[15px] leading-relaxed text-gray-700 space-y-6">
          {DRAFT && (
            <p className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">초안입니다. 법무 확인 뒤 확정됩니다.</p>
          )}
          <p>{company}(이하 '회사')는 아래와 같이 광고성 정보를 보내기 위해 동의를 받습니다. 동의하지 않아도 회원가입과 강의 신청·수강은 그대로 이용할 수 있습니다.</p>
          <div>
            <h2 className="font-bold text-gray-900 mb-2">1. 보내는 내용</h2>
            <p>새 강의·무료 라이브 일정, 할인·이벤트·혜택 안내</p>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 mb-2">2. 보내는 방법</h2>
            <p>카카오 알림톡·친구톡, 문자(SMS·LMS), 이메일</p>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 mb-2">3. 이용하는 정보</h2>
            <p>이름, 휴대폰 번호, 이메일</p>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 mb-2">4. 보유·이용 기간</h2>
            <p>동의를 철회하거나 회원 탈퇴할 때까지</p>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 mb-2">5. 동의를 거부·철회할 권리</h2>
            <p>동의를 거부할 수 있으며, 거부해도 서비스 이용에 불이익이 없습니다. 동의한 뒤에도 언제든 받은 메시지의 수신 거부 안내나 고객센터{contact ? `(${contact})` : ''}로 철회할 수 있습니다.</p>
          </div>
          <p className="text-sm text-gray-500">신청한 강의의 일정·입장 안내처럼 거래와 관련된 정보는 이 동의와 관계없이 보내 드립니다.</p>
        </div>
      </section>
    </>
  )
}
