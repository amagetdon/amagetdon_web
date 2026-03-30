import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useInstructors } from '../hooks/useInstructors'

type FilterTab = 'all' | 'active'

function InstructorListPage() {
  const { instructors, loading } = useInstructors()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const filteredInstructors = useMemo(() =>
    activeTab === 'all' ? instructors : instructors.filter((i) => i.has_active_course),
    [activeTab, instructors]
  )

  return (
    <section className="w-full bg-white py-16 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">강사소개</h1>

        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`rounded-full px-5 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
              activeTab === 'all'
                ? 'bg-[#04F87F] text-white border-none'
                : 'border border-gray-300 text-gray-600 bg-white'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`rounded-full px-5 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
              activeTab === 'active'
                ? 'bg-[#04F87F] text-white border-none'
                : 'border border-gray-300 text-gray-600 bg-white'
            }`}
          >
            진행중인 강의
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded-2xl h-[464px]" />
            ))}
          </div>
        ) : filteredInstructors.length === 0 ? (
          <div className="text-center py-20 text-gray-400">등록된 강사가 없습니다.</div>
        ) : (
          <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-5">
            {filteredInstructors.map((instructor) => (
              <Link key={instructor.id} to={`/instructors/${instructor.id}`} className="no-underline">
                <div className="relative rounded-2xl overflow-hidden h-[464px] cursor-pointer group bg-gray-100">
                  <img
                    src={instructor.image_url || `/introduce/${instructor.name}.png`}
                    alt={instructor.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#04F87F]/80 via-[#04F87F]/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h3 className="text-2xl font-bold text-white mb-1">{instructor.name}</h3>
                    <p className="text-sm text-white/80 leading-snug">{instructor.title}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default InstructorListPage
