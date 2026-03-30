import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useInstructors } from '../hooks/useInstructors'

interface SlideStyle {
  transform: string
  opacity: number
  zIndex: number
  pointerEvents: 'auto' | 'none'
}

const SLIDE_STYLES: Record<string, SlideStyle> = {
  center: { transform: 'translateX(-50%) scale(1)', opacity: 1, zIndex: 10, pointerEvents: 'auto' },
  left: { transform: 'translateX(-110%) scale(0.65)', opacity: 0.25, zIndex: 5, pointerEvents: 'auto' },
  right: { transform: 'translateX(10%) scale(0.65)', opacity: 0.25, zIndex: 5, pointerEvents: 'auto' },
  hidden: { transform: 'translateX(-50%) scale(0.5)', opacity: 0, zIndex: 0, pointerEvents: 'none' },
}

function getSlidePosition(slideIndex: number, activeIndex: number, total: number): string {
  if (total <= 1) return 'center'
  const diff = ((slideIndex - activeIndex) % total + total) % total
  if (diff === 0) return 'center'
  if (diff === 1) return 'right'
  if (diff === total - 1) return 'left'
  return 'hidden'
}

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

        {/* 캐러셀 */}
        <div className="relative h-[480px] max-sm:h-[340px]">
          {instructors.map((inst, idx) => {
            const pos = getSlidePosition(idx, activeIndex, instructors.length)
            const style = SLIDE_STYLES[pos]

            return (
              <div
                key={inst.id}
                className="absolute left-1/2 top-0 h-[480px] max-sm:h-[320px] w-[600px] max-sm:w-[260px] rounded-2xl overflow-hidden"
                style={{
                  transform: style.transform,
                  opacity: style.opacity,
                  zIndex: style.zIndex,
                  pointerEvents: style.pointerEvents,
                  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease',
                }}
              >
                {pos === 'center' ? (
                  <Link to={`/instructors/${inst.id}`} className="block w-full h-full no-underline">
                    <img src={getImage(idx)} alt={inst.name} className="w-full h-full object-contain object-center cursor-pointer" />
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      if (pos === 'left') prev()
                      if (pos === 'right') next()
                    }}
                    className="w-full h-full bg-transparent border-none cursor-pointer p-0"
                  >
                    <img src={getImage(idx)} alt={inst.name} className="w-full h-full object-contain object-center" />
                  </button>
                )}
              </div>
            )
          })}

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
                className={`h-1.5 rounded-full border-none cursor-pointer transition-all duration-300 ${
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
