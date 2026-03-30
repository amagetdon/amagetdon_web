import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useInstructors } from '../hooks/useInstructors'

function InstructorSection() {
  const { instructors: allInstructors, loading } = useInstructors({ featured: true, limit: 6 })
  const instructors = allInstructors.filter((i) => i.thumbnail_url)
  const [activeIndex, setActiveIndex] = useState(0)

  const next = useCallback(() => {
    if (instructors.length === 0) return
    setActiveIndex((prev) => (prev + 1) % instructors.length)
  }, [instructors.length])

  const prev = useCallback(() => {
    if (instructors.length === 0) return
    setActiveIndex((prev) => (prev - 1 + instructors.length) % instructors.length)
  }, [instructors.length])

  useEffect(() => {
    if (instructors.length <= 1) return
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [instructors.length, next])

  const getIndex = (offset: number) => {
    if (instructors.length === 0) return 0
    return (activeIndex + offset + instructors.length) % instructors.length
  }

  const getImage = (idx: number) => {
    const inst = instructors[idx]
    return inst.thumbnail_url || inst.image_url || `/introduce/${inst.name}.png`
  }

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
  const prevIdx = getIndex(-1)
  const nextIdx = getIndex(1)
  const hasMultiple = instructors.length > 1

  return (
    <section className="w-full bg-white py-16 max-sm:py-10 overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="text-center mb-0">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            아마겟돈 클래스 강사를 소개합니다.
          </h2>
          <p className="text-sm text-gray-500">
            현장에서 이미 결과로 증명된 강사진입니다.
          </p>
        </div>

        {/* 3D 캐러셀 */}
        <div className="relative flex items-center justify-center h-[480px] max-sm:h-[340px]">

          {/* 이전 슬라이드 */}
          {hasMultiple && (
            <button
              onClick={prev}
              className="absolute left-[2%] max-sm:left-0 z-0 h-[420px] max-sm:h-[280px] w-[360px] max-sm:w-[180px] rounded-2xl overflow-hidden bg-transparent border-none cursor-pointer p-0 transition-all duration-500"
              style={{ transform: 'scale(0.85)', opacity: 0.5 }}
              aria-label="이전 강사"
            >
              <img
                src={getImage(prevIdx)}
                alt={instructors[prevIdx].name}
                className="w-full h-full object-contain object-center"
              />
            </button>
          )}

          {/* 현재 슬라이드 (메인) */}
          <Link
            to={`/instructors/${instructor.id}`}
            className="relative z-10 block no-underline"
          >
            <div className="relative h-[480px] max-sm:h-[320px] w-[600px] max-sm:w-[260px] overflow-hidden rounded-2xl cursor-pointer transition-all duration-500">
              <img
                src={getImage(activeIndex)}
                alt={instructor.name}
                className="w-full h-full object-contain object-center"
              />
            </div>
          </Link>

          {/* 다음 슬라이드 */}
          {hasMultiple && (
            <button
              onClick={next}
              className="absolute right-[2%] max-sm:right-0 z-0 h-[420px] max-sm:h-[280px] w-[360px] max-sm:w-[180px] rounded-2xl overflow-hidden bg-transparent border-none cursor-pointer p-0 transition-all duration-500"
              style={{ transform: 'scale(0.85)', opacity: 0.5 }}
              aria-label="다음 강사"
            >
              <img
                src={getImage(nextIdx)}
                alt={instructors[nextIdx].name}
                className="w-full h-full object-contain object-center"
              />
            </button>
          )}

          {/* 좌우 화살표 */}
          {hasMultiple && (
            <>
              <button
                onClick={prev}
                className="absolute left-0 max-sm:-left-1 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/90 rounded-full shadow-lg flex items-center justify-center cursor-pointer border-none hover:bg-white transition-colors"
                aria-label="이전"
              >
                <i className="ti ti-chevron-left text-xl text-gray-600" />
              </button>
              <button
                onClick={next}
                className="absolute right-0 max-sm:-right-1 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/90 rounded-full shadow-lg flex items-center justify-center cursor-pointer border-none hover:bg-white transition-colors"
                aria-label="다음"
              >
                <i className="ti ti-chevron-right text-xl text-gray-600" />
              </button>
            </>
          )}
        </div>

        {/* 인디케이터 */}
        {hasMultiple && (
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {instructors.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`h-1.5 rounded-full border-none cursor-pointer transition-all ${
                  idx === activeIndex ? 'w-6 bg-[#04F87F]' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`강사 ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default InstructorSection
