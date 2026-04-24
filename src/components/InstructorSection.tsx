import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Instructor } from '../types'

interface SlideStyle {
  transform: string
  opacity: number
  zIndex: number
  pointerEvents: 'auto' | 'none'
}

const SLIDE_STYLES: Record<string, SlideStyle> = {
  center: { transform: 'translateX(-50%) scale(1)', opacity: 1, zIndex: 10, pointerEvents: 'auto' },
  left: { transform: 'translateX(-110%) scale(0.88)', opacity: 0.35, zIndex: 5, pointerEvents: 'auto' },
  right: { transform: 'translateX(10%) scale(0.88)', opacity: 0.35, zIndex: 5, pointerEvents: 'auto' },
  hidden: { transform: 'translateX(-50%) scale(0.8)', opacity: 0, zIndex: 0, pointerEvents: 'none' },
}

function getSlidePosition(slideIndex: number, activeIndex: number, total: number): string {
  if (total <= 1) return 'center'
  const diff = ((slideIndex - activeIndex) % total + total) % total
  if (diff === 0) return 'center'
  if (diff === 1) return 'right'
  if (diff === total - 1) return 'left'
  return 'hidden'
}

function HeroCard({ inst, interactive }: { inst: Instructor; interactive: boolean }) {
  const bg = `linear-gradient(135deg, ${inst.hero_bg_from} 0%, ${inst.hero_bg_to} 100%)`
  const bullets = (inst.hero_bullets && inst.hero_bullets.length > 0)
    ? inst.hero_bullets
    : (inst.bio_bullets ?? [])

  return (
    // 바깥 wrapper: overflow-visible — 누끼가 카드 밖으로 살짝 튀어나오게
    <div className="relative w-full h-full">
      {/* 배경 카드 (둥근 모서리 + 그라데이션) */}
      <div
        className="absolute inset-0 rounded-[32px] max-sm:rounded-[24px] overflow-hidden shadow-2xl"
        style={{ background: bg }}
      >
        {/* 왼쪽 텍스트 */}
        <div className="relative z-10 h-full flex flex-col justify-between p-7 max-sm:p-4 max-w-[58%] max-sm:max-w-[68%]">
          <div>
            <h3
              className="text-[22px] max-sm:text-[15px] font-bold leading-tight mb-2 max-sm:mb-1.5 whitespace-pre-line"
              style={{ color: inst.hero_title_color }}
            >
              {inst.hero_title || `${inst.name} 강사입니다.`}
            </h3>
            <p className="text-white/80 text-xs max-sm:text-[10px] font-medium">
              {inst.name}
              {inst.title && <span className="ml-1.5">{inst.title}</span>}
            </p>
          </div>

          {bullets.length > 0 && (
            <ul className="mt-auto pt-4 max-sm:pt-2 space-y-1 max-sm:space-y-0.5">
              {bullets.map((b, i) => (
                <li key={i} className="text-white/85 text-[12px] max-sm:text-[10px] leading-relaxed">
                  - {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 오른쪽 누끼 인물 — 카드 밖으로 살짝 튀어나옴 */}
      {inst.hero_portrait_url && (
        <img
          src={inst.hero_portrait_url}
          alt={inst.name}
          className="absolute right-[-6%] bottom-0 h-[115%] max-sm:h-[108%] w-auto max-w-[60%] object-contain object-bottom pointer-events-none z-10"
          draggable={false}
        />
      )}

      {/* 카드 전체 클릭 영역 (interactive 일 때만) */}
      {interactive && (
        <Link
          to={`/instructors/${inst.id}`}
          className="absolute inset-0 z-20 rounded-[32px] max-sm:rounded-[24px]"
          aria-label={`${inst.name} 상세 보기`}
        />
      )}
    </div>
  )
}

function InstructorSection({ instructors: allInstructors, loading }: { instructors: Instructor[]; loading: boolean }) {
  // hero 카드가 켜진 강사만, hero_sort_order 순으로 정렬
  const instructors = useMemo(() => {
    return allInstructors
      .filter((i) => i.hero_enabled)
      .slice()
      .sort((a, b) => {
        const ha = a.hero_sort_order ?? 0
        const hb = b.hero_sort_order ?? 0
        if (ha !== hb) return ha - hb
        return (a.sort_order ?? 0) - (b.sort_order ?? 0)
      })
  }, [allInstructors])

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

  if (loading || instructors.length === 0) {
    if (loading) {
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
    return null
  }

  const hasMultiple = instructors.length > 1

  return (
    <section className="w-full bg-white py-16 max-sm:py-10 overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="text-center mb-8 max-sm:mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            아마겟돈 클래스 강사를 소개합니다.
          </h2>
          <p className="text-sm text-gray-500">
            현장에서 이미 결과로 증명된 강사진입니다.
          </p>
        </div>

        {/* 캐러셀 */}
        <div className="relative h-[320px] max-sm:h-[220px]">
          {instructors.map((inst, idx) => {
            const pos = getSlidePosition(idx, activeIndex, instructors.length)
            const style = SLIDE_STYLES[pos]

            return (
              <div
                key={inst.id}
                className="absolute left-1/2 top-0 h-[320px] max-sm:h-[220px] w-[720px] max-sm:w-[300px]"
                style={{
                  transform: style.transform,
                  opacity: style.opacity,
                  zIndex: style.zIndex,
                  pointerEvents: style.pointerEvents,
                  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease',
                }}
              >
                {pos === 'center' ? (
                  <HeroCard inst={inst} interactive />
                ) : (
                  <button
                    onClick={() => {
                      if (pos === 'left') prev()
                      if (pos === 'right') next()
                    }}
                    className="w-full h-full bg-transparent border-none cursor-pointer p-0"
                    aria-label={pos === 'left' ? '이전 강사' : '다음 강사'}
                  >
                    <HeroCard inst={inst} interactive={false} />
                  </button>
                )}
              </div>
            )
          })}

          {hasMultiple && (
            <>
              <button
                onClick={prev}
                className="absolute left-0 max-sm:-left-1 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-white/90 rounded-full shadow-lg flex items-center justify-center cursor-pointer border-none hover:bg-white transition-colors"
                aria-label="이전"
              >
                <i className="ti ti-chevron-left text-xl text-gray-600" />
              </button>
              <button
                onClick={next}
                className="absolute right-0 max-sm:-right-1 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-white/90 rounded-full shadow-lg flex items-center justify-center cursor-pointer border-none hover:bg-white transition-colors"
                aria-label="다음"
              >
                <i className="ti ti-chevron-right text-xl text-gray-600" />
              </button>
            </>
          )}
        </div>

        {hasMultiple && (
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {instructors.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`h-1.5 rounded-full border-none cursor-pointer transition-all duration-300 ${
                  idx === activeIndex ? 'w-6 bg-[#2ED573]' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
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
