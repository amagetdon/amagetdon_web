import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/admin/AdminLayout'

interface Stats {
  instructors: number
  courses: number
  ebooks: number
  reviews: number
  results: number
  faqs: number
}

const PIE_COLORS = ['#04F87F', '#3B82F6', '#A855F7', '#F59E0B']

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ instructors: 0, courses: 0, ebooks: 0, reviews: 0, results: 0, faqs: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [instructors, courses, ebooks, reviews, results, faqs] = await Promise.all([
          supabase.from('instructors').select('id', { count: 'exact', head: true }),
          supabase.from('courses').select('id', { count: 'exact', head: true }),
          supabase.from('ebooks').select('id', { count: 'exact', head: true }),
          supabase.from('reviews').select('id', { count: 'exact', head: true }),
          supabase.from('results').select('id', { count: 'exact', head: true }),
          supabase.from('faqs').select('id', { count: 'exact', head: true }),
        ])
        setStats({
          instructors: instructors.count ?? 0,
          courses: courses.count ?? 0,
          ebooks: ebooks.count ?? 0,
          reviews: reviews.count ?? 0,
          results: results.count ?? 0,
          faqs: faqs.count ?? 0,
        })
      } catch { toast.error('통계를 불러오는데 실패했습니다.') } finally { setLoading(false) }
    }
    fetchStats()
  }, [])

  const statCards = [
    { label: '강사', count: stats.instructors, icon: 'ti-users', color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', text: 'text-blue-600' },
    { label: '강의', count: stats.courses, icon: 'ti-book-2', color: 'from-[#04F87F] to-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { label: '전자책', count: stats.ebooks, icon: 'ti-notebook', color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50', text: 'text-purple-600' },
    { label: '후기', count: stats.reviews, icon: 'ti-message-star', color: 'from-amber-400 to-amber-500', bg: 'bg-amber-50', text: 'text-amber-600' },
    { label: '성과', count: stats.results, icon: 'ti-trophy', color: 'from-rose-400 to-rose-500', bg: 'bg-rose-50', text: 'text-rose-600' },
    { label: 'FAQ', count: stats.faqs, icon: 'ti-help-circle', color: 'from-cyan-400 to-cyan-500', bg: 'bg-cyan-50', text: 'text-cyan-600' },
  ]

  const barData = [
    { name: '강사', value: stats.instructors },
    { name: '강의', value: stats.courses },
    { name: '전자책', value: stats.ebooks },
    { name: '후기', value: stats.reviews },
    { name: '성과', value: stats.results },
    { name: 'FAQ', value: stats.faqs },
  ]

  const pieData = [
    { name: '강의', value: stats.courses || 1 },
    { name: '전자책', value: stats.ebooks || 1 },
    { name: '후기', value: stats.reviews || 1 },
    { name: '성과', value: stats.results || 1 },
  ]

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">아마겟돈 클래스 운영 현황</p>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-2xl p-5 h-[100px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4 mb-8">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-1">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{card.count}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <i className={`ti ${card.icon} text-xl ${card.text}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {!loading && (
        <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-4">
          {/* Bar Chart */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4">콘텐츠 현황</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 13 }}
                />
                <Bar dataKey="value" fill="#04F87F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4">콘텐츠 비율</h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 13 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {pieData.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }} />
                  <span className="text-xs text-gray-500">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
