import { useState } from 'react'
import { Link } from 'react-router-dom'

interface Instructor {
  id: number
  name: string
  title: string
  image: string
  hasActiveCourse: boolean
}

const INSTRUCTORS: Instructor[] = [
  { id: 1, name: '김나영', title: '전 세계 0.1% TOT, 자산관리 대표', image: 'https://placehold.co/366x464/333/333?text=강사1', hasActiveCourse: true },
  { id: 2, name: '최형기', title: '월매출 3억, 병원마케팅 대행사 대표', image: 'https://placehold.co/366x464/333/333?text=강사2', hasActiveCourse: true },
  { id: 3, name: '은우', title: '인스타 알고리즘 전문가', image: 'https://placehold.co/366x464/333/333?text=강사3', hasActiveCourse: false },
  { id: 4, name: '민태훈', title: '연매출 80억, 광고대행사 대표', image: 'https://placehold.co/366x464/333/333?text=강사4', hasActiveCourse: true },
  { id: 5, name: '전상훈', title: '1인 E커머스 전문가', image: 'https://placehold.co/366x464/333/333?text=강사5', hasActiveCourse: false },
  { id: 6, name: '코코', title: '공유 숙박업으로, 월 천만원 수익', image: 'https://placehold.co/366x464/333/333?text=강사6', hasActiveCourse: true },
]

type FilterTab = 'all' | 'active'

function InstructorListPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const filteredInstructors = activeTab === 'all'
    ? INSTRUCTORS
    : INSTRUCTORS.filter((i) => i.hasActiveCourse)

  return (
    <section className="w-full bg-white py-16 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">강사소개</h1>

        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`rounded-full px-4 py-1 text-sm font-medium cursor-pointer transition-colors ${
              activeTab === 'all'
                ? 'bg-[#04F87F] text-white border-none'
                : 'border border-gray-300 text-gray-600 bg-white'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`rounded-full px-4 py-1 text-sm font-medium cursor-pointer transition-colors ${
              activeTab === 'active'
                ? 'bg-[#04F87F] text-white border-none'
                : 'border border-gray-300 text-gray-600 bg-white'
            }`}
          >
            진행중인 강의
          </button>
        </div>

        <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-5">
          {filteredInstructors.map((instructor) => (
            <Link
              key={instructor.id}
              to={`/instructors/${instructor.id}`}
              className="no-underline"
            >
              <div className="relative rounded-xl overflow-hidden h-[464px] cursor-pointer group">
                <img
                  src={instructor.image}
                  alt={instructor.name}
                  className="w-full h-full object-cover"
                />
                {/* Green gradient overlay from bottom and sides */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#04F87F]/80 via-[#04F87F]/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#04F87F]/30 via-transparent to-[#04F87F]/30" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="text-2xl font-bold text-white mb-1">{instructor.name}</h3>
                  <p className="text-sm text-white/80">{instructor.title}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default InstructorListPage
