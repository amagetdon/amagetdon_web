import { useState, useEffect, memo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authService } from '../services/authService'
import { supabase } from '../lib/supabase'

function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, isAdmin } = useAuth()
  const currentPath = location.pathname
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [kakaoLink, setKakaoLink] = useState('')

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'kakao_link').maybeSingle()
      .then(({ data }) => {
        if (data) setKakaoLink(((data as Record<string, unknown>).value as Record<string, string>)?.url || '')
      })
  }, [])


  const handleLogout = async () => {
    try {
      await authService.signOut()
      navigate('/')
    } catch {
      // 무시
    }
  }

  const navItems = [
    { label: '아마겟돈', path: '/' },
    { label: '아카데미', path: '/academy' },
    { label: '강사소개', path: '/instructors' },
    { label: '수강 후기', path: '/reviews' },
    { label: '수강 성과', path: '/results' },
    { label: 'FAQ', path: '/faq' },
    { label: '카카오채널', path: kakaoLink || '#', external: true },
  ]

  const isActiveNav = (itemPath: string) => {
    if (itemPath === '/') return currentPath === '/'
    if (itemPath === '/academy') return currentPath.startsWith('/academy')
    if (itemPath === '/instructors') return currentPath.startsWith('/instructors')
    if (itemPath === '/results') return currentPath === '/results'
    if (itemPath === '/reviews') return currentPath === '/reviews'
    if (itemPath === '/faq') return currentPath === '/faq'
    return currentPath === itemPath
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <header className="w-full bg-white relative">
      {/* Top bar */}
      <div className="max-w-[1200px] mx-auto px-5 py-4 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-1 no-underline">
          <img src="/logo.webp" alt="아마겟돈 클래스" className="h-12 max-md:h-8" />
        </Link>
        <div className="flex-1 max-w-[320px] relative max-md:hidden">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            placeholder="찾으시는 강의 있으신가요?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-full text-sm border-none outline-none"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link to="/academy" className="no-underline">
            <span className="bg-[#2ED573] text-white text-xs font-bold px-4 py-1.5 max-md:px-2.5 max-md:py-1 max-md:text-[10px] max-md:relative max-md:-top-[2px] rounded-full cursor-pointer whitespace-nowrap">
              혜택 가득!
            </span>
          </Link>
          {user ? (
            <div className="flex items-center gap-3 max-md:hidden">
              {isAdmin && (
                <Link to="/admin" className="no-underline">
                  <span className="text-xs text-white bg-gray-800 px-3 py-1 rounded-full cursor-pointer">관리자 모드</span>
                </Link>
              )}
              <Link to="/my-classroom" className="no-underline">
                <span className="text-sm text-gray-900 cursor-pointer font-medium">내 강의실</span>
              </Link>
              <Link to="/mypage" className="no-underline">
                <span className="text-sm text-gray-900 cursor-pointer">
                  {profile?.name || '마이페이지'}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-400 cursor-pointer bg-transparent border-none"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <Link to="/login" className="no-underline max-md:hidden">
              <span className="text-sm text-gray-900 cursor-pointer">로그인/회원가입</span>
            </Link>
          )}
          {/* Hamburger button - mobile only */}
          <button
            className="hidden max-md:block border-none bg-transparent cursor-pointer p-1 relative top-[1px]"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="메뉴 열기"
          >
            <i className={`ti ${isMenuOpen ? 'ti-x' : 'ti-menu-2'} text-xl text-gray-900`} />
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white shadow-lg z-50 p-4 md:hidden">
          <div className="relative mb-4">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="찾으시는 강의 있으신가요?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-full text-sm border-none outline-none"
            />
          </div>
          <div className="flex flex-col gap-3">
            {navItems.map((item) => (
              'external' in item && item.external ? (
                <a
                  key={item.path}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="text-sm no-underline py-2 text-gray-500"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`text-sm no-underline py-2 ${
                    isActiveNav(item.path) ? 'text-gray-900 font-bold' : 'text-gray-500'
                  }`}
                >
                  {item.label}
                </Link>
              )
            ))}
            <hr className="border-gray-100 my-1" />
            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="text-sm text-gray-900 no-underline py-2 font-medium">
                    관리자 모드
                  </Link>
                )}
                <Link to="/my-classroom" onClick={() => setIsMenuOpen(false)} className="text-sm text-gray-900 no-underline py-2 font-medium">
                  내 강의실
                </Link>
                <Link to="/mypage" onClick={() => setIsMenuOpen(false)} className="text-sm text-gray-900 no-underline py-2">
                  {profile?.name || '마이페이지'}
                </Link>
                <button
                  onClick={() => { handleLogout(); setIsMenuOpen(false) }}
                  className="text-sm text-gray-400 cursor-pointer bg-transparent border-none text-left py-2"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setIsMenuOpen(false)} className="block text-center text-sm font-bold text-white bg-[#2ED573] no-underline py-2.5 rounded-lg">
                로그인 / 회원가입
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="border-b border-gray-200 max-md:hidden">
        <nav className="max-w-[1200px] mx-auto px-5 flex items-center gap-8">
          {navItems.map((item) => {
            if ('external' in item && item.external) {
              return (
                <a
                  key={item.path}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 text-sm no-underline border-b-2 border-transparent text-gray-400 font-normal hover:text-gray-600 transition-colors"
                >
                  {item.label}
                </a>
              )
            }
            const isActive = isActiveNav(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`py-3 text-sm no-underline border-b-2 transition-colors ${
                  isActive
                    ? 'text-gray-900 font-bold border-gray-900'
                    : 'text-gray-400 font-normal border-transparent hover:text-gray-600'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

export default memo(Header)
