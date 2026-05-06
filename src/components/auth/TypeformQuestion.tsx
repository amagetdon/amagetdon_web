import type { ReactNode } from 'react'

interface TypeformQuestionProps {
  stepIndex: number
  totalSteps: number
  title: string
  description?: string
  optional?: boolean
  direction: 'forward' | 'backward'
  animKey: number
  error?: string
  submitting?: boolean
  isLast?: boolean
  submitLabel?: string
  okLabel?: string
  onNext: () => void
  onPrev?: () => void
  onSkip?: () => void
  topSlot?: ReactNode
  bottomSlot?: ReactNode
  children: ReactNode
}


export default function TypeformQuestion({
  stepIndex,
  totalSteps,
  title,
  description,
  optional,
  direction,
  animKey,
  error,
  submitting,
  isLast,
  submitLabel,
  okLabel = 'OK',
  onNext,
  onPrev,
  onSkip,
  topSlot,
  bottomSlot,
  children,
}: TypeformQuestionProps) {
  const progress = Math.round(((stepIndex + 1) / Math.max(totalSteps, 1)) * 100)
  const enterClass = direction === 'forward'
    ? 'animate-[typeformStepInForward_.4s_cubic-bezier(.22,1,.36,1)_both]'
    : 'animate-[typeformStepInBackward_.4s_cubic-bezier(.22,1,.36,1)_both]'

  const canPrev = !!onPrev && stepIndex > 0 && !submitting
  const canNext = !submitting

  return (
    <>
      <div className="max-w-[760px] mx-auto px-6 pt-32 max-md:pt-20 pb-40 max-md:pb-24 min-h-[720px]">
        {/* 진행률 바 — 본문 영역 상단 */}
        <div className="flex items-center gap-3 text-gray-500 text-xs font-bold mb-16 max-md:mb-10 tabular-nums">
          <span><span className="text-[#2ED573]">{stepIndex + 1}</span><span className="mx-1 text-gray-300">/</span><span>{totalSteps}</span></span>
          <span className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <span
              className="block h-full bg-[#2ED573] transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </span>
        </div>

        {topSlot}

        <div key={animKey} className={enterClass}>
          <div className="flex items-start gap-2 mb-6">
            <span
              aria-label={`Question ${stepIndex + 1}`}
              className="inline-flex items-center justify-center bg-[#2ED573] text-white text-xs font-bold rounded-md px-2 py-0.5 mt-2 shrink-0 gap-1"
            >
              {stepIndex + 1}
              <i className="ti ti-chevron-down text-[10px]" />
            </span>
            <legend className="text-3xl max-md:text-xl font-bold leading-snug text-gray-900">
              {title}
              {optional && <span className="text-gray-400 text-sm font-medium ml-2 align-middle">(선택)</span>}
            </legend>
          </div>

          {description && (
            <p className="text-sm md:text-base text-gray-500 mb-8 ml-9 max-md:ml-7">{description}</p>
          )}

          <div className="ml-9 max-md:ml-7 mb-8">{children}</div>

          {error && (
            <p className="ml-9 max-md:ml-7 text-red-500 text-sm mb-3 flex items-center gap-1">
              <i className="ti ti-alert-circle" />
              {error}
            </p>
          )}

          <div className="ml-9 max-md:ml-7 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={onNext}
              disabled={!!submitting}
              className="bg-[#2ED573] text-white font-bold px-7 py-3 rounded-lg cursor-pointer border-none flex items-center gap-2 hover:bg-[#25B866] active:scale-[0.98] transition disabled:opacity-50"
            >
              {submitting ? '처리 중...' : isLast ? (submitLabel ?? '완료') : okLabel}
              {!submitting && <i className="ti ti-corner-down-left text-xs" />}
            </button>
            <span className="text-xs text-gray-400 hidden md:inline-flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 font-mono text-[10px]">Enter</span>
              눌러 다음으로
            </span>

            {onSkip && optional && (
              <button
                type="button"
                onClick={onSkip}
                disabled={!!submitting}
                className="bg-transparent border-none text-sm text-gray-500 cursor-pointer hover:text-gray-800 disabled:opacity-50"
              >
                건너뛰기 →
              </button>
            )}

            {/* ↑↓ 네비게이션 — 우측 정렬 */}
            <div className="flex ml-auto">
              <button
                type="button"
                onClick={onPrev}
                disabled={!canPrev}
                aria-label="이전 질문"
                className="w-10 h-10 rounded-l-md bg-[#2ED573] hover:bg-[#25B866] text-white border-none cursor-pointer flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="ti ti-chevron-up text-lg" />
              </button>
              <div className="w-px bg-white/30" />
              <button
                type="button"
                onClick={onNext}
                disabled={!canNext}
                aria-label="다음 질문"
                className="w-10 h-10 rounded-r-md bg-[#2ED573] hover:bg-[#25B866] text-white border-none cursor-pointer flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="ti ti-chevron-down text-lg" />
              </button>
            </div>
          </div>

          {bottomSlot && <div className="ml-9 max-md:ml-7 mt-8">{bottomSlot}</div>}
        </div>
      </div>
    </>
  )
}

export const TYPEFORM_SCALE_IN = 'animate-[typeformScaleIn_.3s_ease-out]'
