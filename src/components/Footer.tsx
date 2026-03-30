import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="w-full bg-white border-t border-gray-200 py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex items-start justify-between mb-8 max-md:flex-col max-md:gap-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Link to="/notice" className="text-sm font-medium text-gray-700 cursor-pointer no-underline hover:text-gray-900">
              회사소개
            </Link>
            <span className="text-gray-300">|</span>
            <span className="text-sm font-medium text-gray-700 cursor-pointer">인재채용</span>
            <span className="text-gray-300">|</span>
            <Link to="/privacy" className="text-sm font-bold text-gray-900 cursor-pointer no-underline hover:text-gray-900">개인정보 처리방침</Link>
            <span className="text-gray-300">|</span>
            <Link to="/terms" className="text-sm font-medium text-gray-700 cursor-pointer no-underline hover:text-gray-900">이용약관</Link>
          </div>
          <Link to="/" className="no-underline">
            <img src="/logo.webp" alt="아마겟돈 클래스" className="h-12" />
          </Link>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-400 leading-relaxed">
            사업자등록번호: 231-88-03443 | 대표자: 민태훈
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            통신판매업신고번호: 제 2025-서울금천-1122호
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            원격학원 신고번호: 제6235호
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            소재지: 서울특별시 금천구 가산디지털2로 169-16, O706호
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            이메일: info@amag-class.kr 전화번호: 02-2088-2650
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
