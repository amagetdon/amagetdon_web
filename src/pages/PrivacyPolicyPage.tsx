import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useBusinessInfo } from '../hooks/useBusinessInfo'

function PrivacyPolicyPage() {
  const [html, setHtml] = useState<string | null>(null)
  const biz = useBusinessInfo()

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'privacy_html').maybeSingle()
      .then(({ data }) => {
        const val = (data as unknown as Record<string, unknown>)?.value as Record<string, string> | undefined
        setHtml(val?.html || '')
      })
  }, [])

  const companyName = biz.companyName || '주식회사 아마겟돈 컴퍼니 (아마겟돈 원격학원)'
  const bizNumber = biz.bizNumber || '231-88-03443'
  const ceoName = biz.ceoName || '민태훈'
  const ecommerceNumber = biz.ecommerceNumber || '제 2025-서울금천-1122호'
  const remoteAcademyNumber = biz.remoteAcademyNumber || '제6235호'
  const address = biz.address || '서울특별시 금천구 가산디지털2로 169-16, O706호'
  const email = biz.email || 'info@amag-class.kr'
  const phone = biz.phone || '02-2088-2650'

  return (
    <>
      <section className="w-full bg-black py-20 flex items-center justify-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">개인정보처리방침</h1>
      </section>

      <section className="w-full bg-white py-16 max-sm:py-10">
        <div className="max-w-[800px] mx-auto px-5">
          {html === null ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-3 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : html ? (
            <div
              className="legal-content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <DefaultPrivacy />
          )}

          <div className="border-t border-gray-200 pt-8 mt-12 text-sm text-gray-500 leading-relaxed">
            <p className="font-semibold text-gray-700 mb-2">{companyName}</p>
            <p>사업자등록번호: {bizNumber} | 대표자: {ceoName}</p>
            {ecommerceNumber && <p>통신판매업신고번호: {ecommerceNumber}</p>}
            {remoteAcademyNumber && <p>원격학원 신고번호: {remoteAcademyNumber}</p>}
            <p>소재지: {address}</p>
            <p>이메일: <a href={`mailto:${email}`} className="text-[#2ED573] hover:underline">{email}</a> | 전화번호: {phone}</p>
          </div>
        </div>
      </section>
    </>
  )
}

function DefaultPrivacy() {
  return (
    <>
      <p className="text-sm text-gray-500 mb-12 text-center">
        주식회사 아마겟돈 컴퍼니(이하 &quot;회사&quot;)는 개인정보 보호법 등
        관련 법령에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을
        신속하고 원활하게 처리하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.
      </p>

      <article className="mb-10">
        <h3 className="text-lg font-bold text-gray-900 mb-3">제1조 (개인정보의 처리 목적)</h3>
        <p className="text-gray-700 leading-relaxed mb-3">
          회사는 다음의 목적을 위하여 개인정보를 처리합니다.
        </p>
        <ul className="list-disc pl-5 text-gray-700 leading-relaxed space-y-1">
          <li><strong>회원가입 및 관리:</strong> 회원제 서비스 이용에 따른 본인 확인, 회원자격 유지·관리 등</li>
          <li><strong>서비스 제공:</strong> 온라인 강의 제공, 전자책 판매, 콘텐츠 제공 등</li>
          <li><strong>결제 및 환불:</strong> 재화·서비스의 결제, 환불 처리 등</li>
        </ul>
      </article>

      <article className="mb-10">
        <h3 className="text-lg font-bold text-gray-900 mb-3">부칙</h3>
        <p className="text-gray-700 leading-relaxed">
          이 개인정보처리방침은 <strong>2025년 1월 1일</strong>부터 시행합니다.
        </p>
      </article>
    </>
  )
}

export default PrivacyPolicyPage
