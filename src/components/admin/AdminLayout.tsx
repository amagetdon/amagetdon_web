import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const NAV_GROUPS = [
  {
    label: '메인',
    items: [
      { path: '/admin', label: '대시보드', icon: 'ti-layout-dashboard' },
    ],
  },
  {
    label: '콘텐츠 관리',
    items: [
      { path: '/admin/instructors', label: '강사', icon: 'ti-users' },
      { path: '/admin/courses', label: '강의', icon: 'ti-book-2' },
      { path: '/admin/ebooks', label: '전자책', icon: 'ti-notebook' },
      { path: '/admin/schedules', label: '일정', icon: 'ti-calendar-event' },
    ],
  },
  {
    label: '커뮤니티',
    items: [
      { path: '/admin/reviews', label: '후기', icon: 'ti-message-star' },
      { path: '/admin/results', label: '성과', icon: 'ti-trophy' },
    ],
  },
  {
    label: '설정',
    items: [
      { path: '/admin/faqs', label: 'FAQ', icon: 'ti-help-circle' },
    ],
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { profile } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebar = (
    <>
      {/* 로고/프로필 영역 */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[#04F87F] flex items-center justify-center">
            <i className="ti ti-bolt text-white text-lg" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">아마겟돈</p>
            <p className="text-[10px] text-gray-500 mt-0.5">관리자 패널</p>
          </div>
        </div>

        {/* 관리자 정보 */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-white/5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-[#04F87F]/20 flex items-center justify-center">
            <i className="ti ti-user text-[#04F87F] text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{profile?.name || '관리자'}</p>
            <p className="text-[10px] text-gray-500">Admin</p>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="px-3 pb-6 flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-3 mb-1.5 text-[10px] font-bold text-gray-600 uppercase tracking-wider">
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] no-underline mb-0.5 transition-all ${
                    isActive
                      ? 'bg-[#04F87F]/15 text-[#04F87F] font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <i className={`ti ${item.icon} text-base`} />
                  {item.label}
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#04F87F]" />}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* 하단 홈 링크 */}
      <div className="px-3 pb-4 border-t border-white/5 pt-3">
        <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-gray-500 no-underline hover:text-white hover:bg-white/5">
          <i className="ti ti-arrow-left text-base" />
          사이트로 돌아가기
        </Link>
      </div>
    </>
  )

  return (
    <div className="flex min-h-[calc(100vh-120px)]">
      {/* Desktop sidebar */}
      <aside className="w-[240px] bg-[#1e2330] shrink-0 flex flex-col max-lg:hidden">
        {sidebar}
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="hidden max-lg:fixed max-lg:block top-[76px] left-4 z-40 w-10 h-10 bg-[#1e2330] rounded-lg flex items-center justify-center border-none cursor-pointer shadow-lg"
        aria-label="메뉴"
      >
        <i className={`ti ${mobileOpen ? 'ti-x' : 'ti-menu-2'} text-white`} />
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-[#1e2330] z-40 flex flex-col lg:hidden">
            {sidebar}
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 bg-[#f8f9fb] p-6 max-sm:p-4 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
