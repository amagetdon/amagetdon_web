import { useState, useEffect } from 'react'
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

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ instructors: 0, courses: 0, ebooks: 0, reviews: 0, results: 0, faqs: 0 })

  useEffect(() => {
    const fetchStats = async () => {
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
    }
    fetchStats()
  }, [])

  const cards = [
    { label: '강사', count: stats.instructors, icon: 'ti-users', color: 'bg-blue-500' },
    { label: '강의', count: stats.courses, icon: 'ti-book', color: 'bg-green-500' },
    { label: '전자책', count: stats.ebooks, icon: 'ti-notebook', color: 'bg-purple-500' },
    { label: '후기', count: stats.reviews, icon: 'ti-star', color: 'bg-yellow-500' },
    { label: '성과', count: stats.results, icon: 'ti-trophy', color: 'bg-red-500' },
    { label: 'FAQ', count: stats.faqs, icon: 'ti-help', color: 'bg-cyan-500' },
  ]

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h1>
      <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center`}>
                <i className={`ti ${card.icon} text-white text-lg`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.count}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}
