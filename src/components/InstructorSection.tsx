import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react'
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
  // hidden-left: 좌측 밖, hidden-right: 우측 밖 — 방향을 유지해야 left→hidden 전환 시 중앙으로 점프하지 않음
  'hidden-left': { transform: 'translateX(-200%) scale(0.7)', opacity: 0, zIndex: 0, pointerEvents: 'none' },
  'hidden-right': { transform: 'translateX(100%) scale(0.7)', opacity: 0, zIndex: 0, pointerEvents: 'none' },
}

// 원형 배열 기준 가까운 쪽에 숨김 — center 오른쪽 쪽(diff 작음)은 hidden-right,
// 왼쪽 쪽(diff 큼)은 hidden-left. 이 규칙이면 새 right 카드는 항상 오른쪽 밖(hidden-right)에서,
// 새 left 카드는 항상 왼쪽 밖(hidden-left)에서 자연스럽게 들어옴.
function getSlidePosition(slideIndex: number, activeIndex: number, total: number): string {
  if (total <= 1) return 'center'
  const diff = ((slideIndex - activeIndex) % total + total) % total
  if (diff === 0) return 'center'
  if (diff === 1) return 'right'
  if (diff === total - 1) return 'left'
  if (diff <= total / 2) return 'hidden-right'
  return 'hidden-left'
}

// 두 position 간 전환이 화면을 가로지르는 점프인지 (left↔right, hidden-left↔hidden-right/right 등) 판정
function isCrossJumpTransition(prev: string | undefined, curr: string): boolean {
  if (!prev || prev === curr) return false
  const leftSide = new Set(['left', 'hidden-left'])
  const rightSide = new Set(['right', 'hidden-right'])
  return (leftSide.has(prev) && rightSide.has(curr)) || (rightSide.has(prev) && leftSide.has(curr))
}

function isVisible(pos: string): boolean {
  return pos === 'center' || pos === 'left' || pos === 'right'
}

// `**볼드**` 문법 → <strong>. < > & 는 이스케이프 후 변환하여 XSS 방지.
function formatBoldMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
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
        {/* 왼쪽 텍스트 — 누끼(z-10) 위에 겹치도록 z-20
            데스크탑: 좌측 텍스트 + 우측 누끼 (max-w-[68%] 로 폭 제한)
            모바일: 세로배치 — 텍스트 전체폭 사용, 하단에 누끼 영역(약 130px) 확보 */}
        <div className="relative z-20 h-full flex flex-col items-start text-left px-10 pt-11 pb-9 max-sm:px-6 max-sm:pt-7 max-sm:pb-[180px] max-w-[68%] max-sm:max-w-full">
          <h3
            className="text-[26px] max-sm:text-[19px] font-bold leading-[1.25] whitespace-pre-line"
            style={{ color: inst.hero_title_color }}
          >
            {inst.hero_title || `${inst.name} 강사입니다.`}
          </h3>

          <p className="text-white/90 mt-5 max-sm:mt-3">
            <span className="text-[18px] max-sm:text-[16px] font-bold">{inst.name}</span>
            {inst.title && (
              <span className="ml-1.5 text-[15px] max-sm:text-[14px] font-medium text-white/75">{inst.title}</span>
            )}
          </p>

          {bullets.length > 0 && (
            <ul className="mt-3 max-sm:mt-2 space-y-1.5 max-sm:space-y-1">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="text-white/85 text-[14px] max-sm:text-[12.5px] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: `- ${formatBoldMarkdown(b)}` }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 누끼 인물
          데스크탑: 우측 전체 높이(115%) 를 차지하며 위로 살짝 튀어나옴
          모바일: 세로배치로 변경 — 우하단에 작게(높이 ~170px) */}
      {inst.hero_portrait_url && (
        <img
          src={inst.hero_portrait_url}
          alt={inst.name}
          className="absolute right-0 bottom-0 h-[115%] max-sm:h-[220px] w-auto max-w-[55%] max-sm:max-w-[60%] object-contain object-bottom rounded-br-[32px] max-sm:rounded-br-[24px] pointer-events-none z-10"
          draggable={false}
        />
      )}

      {/* 카드 전체 클릭 영역 (interactive 일 때만) */}
      {interactive && (
        <Link
          to={`/instructors/${inst.id}`}
          className="absolute inset-0 z-30 rounded-[32px] max-sm:rounded-[24px]"
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
  const prevPositionsRef = useRef<Record<number, string>>({})

  const next = useCallback(() => {
    if (instructors.length === 0) return
    setActiveIndex((p) => (p + 1) % instructors.length)
  }, [instructors.length])

  const prev = useCallback(() => {
    if (instructors.length === 0) return
    setActiveIndex((p) => (p - 1 + instructors.length) % instructors.length)
  }, [instructors.length])

  useEffect(() => {
    if (instructors.length <= 1) return
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [instructors.length, next])

  // 렌더 후 각 slide 의 현재 position 을 저장 → 다음 render 의 cross-jump 판정 기준
  useLayoutEffect(() => {
    const total = instructors.length
    instructors.forEach((inst, idx) => {
      prevPositionsRef.current[inst.id] = getSlidePosition(idx, activeIndex, total)
    })
  })

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
        <div className="text-center mb-20 max-sm:mb-14">
          <h2 className="text-3xl max-sm:text-2xl font-bold text-gray-900 mb-2.5">
            아마겟돈 클래스 강사를 소개합니다.
          </h2>
          <p className="text-base max-sm:text-sm text-gray-500">
            현장에서 이미 결과로 증명된 강사진입니다.
          </p>
        </div>

        {/* 캐러셀 */}
        <div className="relative h-[320px] max-sm:h-[430px]">
          {instructors.map((inst, idx) => {
            const pos = getSlidePosition(idx, activeIndex, instructors.length)
            const style = SLIDE_STYLES[pos]
            const prevPos = prevPositionsRef.current[inst.id]
            // 좌↔우 반대편 점프 처리 (잔상 방지)
            //  - visible(left/right) → hidden: opacity 먼저 페이드아웃 후 transform 점프
            //  - hidden → visible(left/right): transform 즉시 새 위치로 이동 후 opacity 페이드인
            let transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease'
            if (isCrossJumpTransition(prevPos, pos)) {
              const prevVisible = prevPos && isVisible(prevPos)
              const currVisible = isVisible(pos)
              if (prevVisible && !currVisible) {
                // 사라짐: 원래 위치에서 페이드아웃 → 완료 후 반대편으로 순간이동 (invisible)
                transition = 'opacity 0.3s ease, transform 0s ease 0.3s'
              } else if (!prevVisible && currVisible) {
                // 등장: 반대편(invisible)에서 새 위치로 순간이동 → 새 위치에서 페이드인
                transition = 'opacity 0.3s ease, transform 0s ease'
              } else {
                // hidden↔hidden: 둘 다 invisible 이므로 순간이동 OK
                transition = 'none'
              }
            }

            return (
              <div
                key={inst.id}
                className="absolute left-1/2 top-0 h-[320px] max-sm:h-[430px] w-[620px] max-sm:w-[300px]"
                style={{
                  transform: style.transform,
                  opacity: style.opacity,
                  zIndex: style.zIndex,
                  pointerEvents: style.pointerEvents,
                  transition,
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
