import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/admin', label: '대시보드', icon: 'ti-dashboard' },
  { path: '/admin/instructors', label: '강사 관리', icon: 'ti-users' },
  { path: '/admin/courses', label: '강의 관리', icon: 'ti-book' },
  { path: '/admin/ebooks', label: '전자책 관리', icon: 'ti-notebook' },
  { path: '/admin/reviews', label: '후기 관리', icon: 'ti-star' },
  { path: '/admin/results', label: '성과 관리', icon: 'ti-trophy' },
  { path: '/admin/schedules', label: '일정 관리', icon: 'ti-calendar' },
  { path: '/admin/faqs', label: 'FAQ 관리', icon: 'ti-help' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div className="flex min-h-[calc(100vh-200px)]">
      <aside className="w-[220px] bg-gray-900 text-white shrink-0 max-md:hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-sm font-bold text-[#04F87F]">관리자 패널</h2>
        </div>
        <nav className="p-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm no-underline mb-0.5 transition-colors ${
                  isActive ? 'bg-[#04F87F]/20 text-[#04F87F] font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <i className={`ti ${item.icon}`} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile nav */}
      <div className="hidden max-md:block w-full bg-gray-900 px-4 py-2 overflow-x-auto">
        <div className="flex gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs no-underline ${
                  isActive ? 'bg-[#04F87F] text-white font-bold' : 'text-gray-400 bg-gray-800'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      <main className="flex-1 p-6 max-sm:p-4 bg-gray-50">
        {children}
      </main>
    </div>
  )
}
