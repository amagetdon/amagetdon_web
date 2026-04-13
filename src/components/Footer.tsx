import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useBusinessInfo } from '../hooks/useBusinessInfo'

function normalizeUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('/') || url.startsWith('http')) return url
  return `https://${url}`
}

function Footer() {
  const biz = useBusinessInfo()
  const [companyLink, setCompanyLink] = useState('')
  const [companyLinkTarget, setCompanyLinkTarget] = useState<'_blank' | '_self'>('_blank')
  const [recruitLink, setRecruitLink] = useState('')
  const [recruitLinkTarget, setRecruitLinkTarget] = useState<'_blank' | '_self'>('_blank')

  useEffect(() => {
    supabase.from('site_settings').select('key, value').in('key', ['company_link', 'recruit_link'])
      .then(({ data }) => {
        if (data) {
          for (const s of data as { key: string; value: Record<string, string> }[]) {
            if (s.key === 'company_link') { setCompanyLink(s.value?.url || ''); if (s.value?.target) setCompanyLinkTarget(s.value.target as '_blank' | '_self') }
            if (s.key === 'recruit_link') { setRecruitLink(s.value?.url || ''); if (s.value?.target) setRecruitLinkTarget(s.value.target as '_blank' | '_self') }
          }
        }
      })
  }, [])

  const bizNumber = biz.bizNumber || '231-88-03443'
  const ceoName = biz.ceoName || '민태훈'
  const ecommerceNumber = biz.ecommerceNumber || '제 2025-서울금천-1122호'
  const remoteAcademyNumber = biz.remoteAcademyNumber || '제6235호'
  const address = biz.address || '서울특별시 금천구 가산디지털2로 169-16, O706호'
  const email = biz.email || 'info@amag-class.kr'
  const phone = biz.phone || '02-2088-2650'
  const logoUrl = biz.logoUrl || '/logo.webp'

  return (
    <footer className="w-full bg-white border-t border-gray-200 py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex items-start justify-between mb-8 max-md:flex-col max-md:gap-6">
          <div className="flex items-center gap-4 flex-wrap">
            <a href={normalizeUrl(companyLink) || '/notice'} {...(companyLinkTarget === '_blank' ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="text-sm font-medium text-gray-700 cursor-pointer no-underline hover:text-gray-900">
              회사소개
            </a>
            <span className="text-gray-300">|</span>
            <a href={normalizeUrl(recruitLink) || '#'} {...(recruitLinkTarget === '_blank' ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={`text-sm font-medium text-gray-700 no-underline hover:text-gray-900 ${recruitLink ? 'cursor-pointer' : 'cursor-default'}`}>
              인재채용
            </a>
            <span className="text-gray-300">|</span>
            <Link to="/privacy" className="text-sm font-bold text-gray-900 cursor-pointer no-underline hover:text-gray-900">개인정보 처리방침</Link>
            <span className="text-gray-300">|</span>
            <Link to="/terms" className="text-sm font-medium text-gray-700 cursor-pointer no-underline hover:text-gray-900">이용약관</Link>
          </div>
          <Link to="/" className="no-underline">
            <img src={logoUrl} alt={biz.mallName || '아마겟돈 클래스'} className="h-12" />
          </Link>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-400 leading-relaxed">
            사업자등록번호: {bizNumber} | 대표자: {ceoName}
          </p>
          {ecommerceNumber && (
            <p className="text-xs text-gray-400 leading-relaxed">
              통신판매업신고번호: {ecommerceNumber}
            </p>
          )}
          {remoteAcademyNumber && (
            <p className="text-xs text-gray-400 leading-relaxed">
              원격학원 신고번호: {remoteAcademyNumber}
            </p>
          )}
          <p className="text-xs text-gray-400 leading-relaxed">
            소재지: {address}
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            이메일: {email} 전화번호: {phone}
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
