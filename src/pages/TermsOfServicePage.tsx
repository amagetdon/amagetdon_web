import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useBusinessInfo } from '../hooks/useBusinessInfo'

function TermsOfServicePage() {
  const [html, setHtml] = useState<string | null>(null)
  const biz = useBusinessInfo()

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'terms_html').maybeSingle()
      .then(({ data }) => {
        const val = (data as unknown as Record<string, unknown>)?.value as Record<string, string> | undefined
        setHtml(val?.html || '')
      })
  }, [])

  const companyName = biz.companyName || '주식회사 아마겟돈 컴퍼니 (아마겟돈 원격학원)'
  const bizNumber = biz.bizNumber || '231-88-03443'
  const ceoName = biz.ceoName || '민태훈'
  const address = biz.address || '서울특별시 금천구 가산디지털2로 169-16, O706호'
  const email = biz.email || 'info@amag-class.kr'
  const phone = biz.phone || '02-2088-2650'

  return (
    <>
      <section className="w-full bg-black py-20 flex items-center justify-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">이용약관</h1>
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
            <DefaultTerms />
          )}

          <div className="border-t border-gray-200 pt-8 mt-12">
            <div className="space-y-1 text-xs text-gray-400">
              <p>{companyName}</p>
              <p>사업자등록번호: {bizNumber} | 대표자: {ceoName}</p>
              <p>소재지: {address}</p>
              <p>이메일: {email} | 전화번호: {phone}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function DefaultTerms() {
  return (
    <>
      <p className="text-sm text-gray-400 mb-12">시행일: 2025년 1월 1일</p>

      <article className="mb-10">
        <h3 className="text-lg font-bold text-gray-900 mb-3">제1조 (목적)</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          이 약관은 주식회사 아마겟돈 컴퍼니(이하 "회사")가 운영하는 아마겟돈 원격학원 온라인
          교육 플랫폼(이하 "서비스")의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항,
          기타 필요한 사항을 규정함을 목적으로 합니다.
        </p>
      </article>

      <article className="mb-10">
        <h3 className="text-lg font-bold text-gray-900 mb-3">제2조 (정의)</h3>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">
          이 약관에서 사용하는 용어의 정의는 다음과 같습니다.
        </p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
          <li><strong>"회사"</strong>란 주식회사 아마겟돈 컴퍼니(사업자등록번호: 231-88-03443)를 말하며, 대표자는 민태훈입니다.</li>
          <li><strong>"서비스"</strong>란 회사가 제공하는 온라인 강의, 전자책 판매 및 관련 부가 서비스를 말합니다.</li>
          <li><strong>"회원"</strong>이란 회사에 개인정보를 제공하고 회원등록을 한 자로서, 서비스를 계속적으로 이용할 수 있는 자를 말합니다.</li>
          <li><strong>"콘텐츠"</strong>란 회사가 서비스를 통해 제공하는 강의 영상, 전자책, 학습 자료 등 일체의 디지털 저작물을 말합니다.</li>
          <li><strong>"이용계약"</strong>이란 서비스 이용과 관련하여 회사와 회원 간에 체결하는 계약을 말합니다.</li>
        </ul>
      </article>

      <article className="mb-10">
        <h3 className="text-lg font-bold text-gray-900 mb-3">부칙</h3>
        <p className="text-sm text-gray-700 leading-relaxed">이 약관은 2025년 1월 1일부터 시행합니다.</p>
      </article>
    </>
  )
}

export default TermsOfServicePage
