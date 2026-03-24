import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInstructors } from '../hooks/useInstructors'

function InstructorSection() {
  const { instructors, loading } = useInstructors({ featured: true, limit: 4 })
  const [activeIndex, setActiveIndex] = useState(0)

  if (loading || instructors.length === 0) {
    return (
      <section className="w-full bg-white py-16 max-sm:py-10">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">아마겟돈 클래스 강사를 소개합니다.</h2>
            <p className="text-sm text-gray-500">현장에서 이미 검증된 셀러와 전문가들로 구성된 최고의 강의진</p>
          </div>
          <div className="animate-pulse bg-gray-200 rounded-2xl h-[400px]" />
        </div>
      </section>
    )
  }

  const instructor = instructors[activeIndex]

  return (
    <section className="w-full bg-white py-16 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            아마겟돈 클래스 강사를 소개합니다.
          </h2>
          <p className="text-sm text-gray-500">
            현장에서 이미 검증된 셀러와 전문가들로 구성된 최고의 강의진
          </p>
        </div>

        <div className="relative bg-white rounded-2xl overflow-hidden">
          <button
            onClick={() => setActiveIndex((prev) => (prev - 1 + instructors.length) % instructors.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center cursor-pointer border-none"
            aria-label="이전 강사"
          >
            <i className="ti ti-chevron-left text-xl text-gray-500" />
          </button>
          <button
            onClick={() => setActiveIndex((prev) => (prev + 1) % instructors.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center cursor-pointer border-none"
            aria-label="다음 강사"
          >
            <i className="ti ti-chevron-right text-xl text-gray-500" />
          </button>

          <div className="bg-[#024d2a] rounded-2xl p-10 max-sm:p-6 flex items-center gap-10 max-md:flex-col">
            <div className="shrink-0">
              <img
                src={instructor.image_url || `https://placehold.co/280x360/e5e7eb/999999?text=${instructor.name}`}
                alt={instructor.name}
                className="rounded-xl w-[280px] max-md:w-full"
              />
            </div>
            <div className="flex-1 text-white">
              <h3 className="text-xl font-bold mb-4 whitespace-pre-line">
                {instructor.headline || instructor.title}
              </h3>
              {(instructor.bio_bullets || [instructor.bio || '']).map((text, idx) => (
                <p key={idx} className="text-sm leading-relaxed mb-3 text-white/80">
                  {text}
                </p>
              ))}
              <p className="text-sm mt-4 text-white/60">- {instructor.name} -</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8 mt-8">
            {instructors.map((inst, idx) => (
              <button
                key={inst.id}
                onClick={() => setActiveIndex(idx)}
                className={`flex flex-col items-center gap-2 bg-transparent border-none cursor-pointer transition-opacity ${
                  activeIndex === idx ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                }`}
              >
                <img
                  src={inst.thumbnail_url || inst.image_url || `https://placehold.co/48x48/e5e7eb/999999?text=${inst.name[0]}`}
                  alt={inst.name}
                  className={`w-12 h-12 rounded-full object-cover ${
                    activeIndex === idx ? 'ring-2 ring-[#04F87F]' : ''
                  }`}
                />
                <span className={`text-xs ${activeIndex === idx ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                  {inst.name}
                </span>
              </button>
            ))}
          </div>

          <div className="text-center mt-6">
            <Link
              to="/instructors"
              className="text-sm text-[#04F87F] font-medium no-underline hover:underline"
            >
              전체 강사 보기 →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default InstructorSection
