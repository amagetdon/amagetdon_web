// 관리자 목록 하단 페이지 번호 (1부터 시작).
// 예전엔 페이지 번호를 전부 한 줄에 그려서, 수강생이 수천 명인 강의는 버튼 수백 개가 찌그러져 겹치고
// 눌러도 엉뚱한 버튼이 눌리거나 이동이 안 됐다(10/15). 이제 처음·이전·현재 주변 몇 개·다음·끝만 보인다.
interface Props {
  page: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
}

const NEAR = 2

function pageItems(page: number, total: number): (number | 'gap')[] {
  const items: (number | 'gap')[] = []
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - page) <= NEAR) {
      if (items.length && typeof items[items.length - 1] === 'number' && (items[items.length - 1] as number) < p - 1) items.push('gap')
      items.push(p)
    }
  }
  return items
}

export default function AdminPagination({ page, totalPages, onChange, className = 'mt-6' }: Props) {
  if (totalPages <= 1) return null
  const current = Math.min(Math.max(1, page), totalPages)
  const go = (p: number) => onChange(Math.min(Math.max(1, p), totalPages))
  const navBtn = 'w-8 h-8 shrink-0 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed'
  return (
    <div className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      <button type="button" onClick={() => go(1)} disabled={current <= 1} className={navBtn} aria-label="처음 페이지">
        <i className="ti ti-chevrons-left" />
      </button>
      <button type="button" onClick={() => go(current - 1)} disabled={current <= 1} className={navBtn} aria-label="이전 페이지">
        <i className="ti ti-chevron-left" />
      </button>
      {pageItems(current, totalPages).map((it, idx) =>
        it === 'gap' ? (
          <span key={`gap-${idx}`} className="w-5 shrink-0 text-center text-sm text-gray-300">…</span>
        ) : (
          <button
            key={it}
            type="button"
            onClick={() => go(it)}
            aria-current={it === current ? 'page' : undefined}
            className={`min-w-8 h-8 px-2 shrink-0 flex items-center justify-center rounded-full text-sm cursor-pointer tabular-nums ${
              it === current ? 'bg-[#2ED573] text-white border-none font-bold' : 'bg-white text-gray-500 border border-gray-300'
            }`}
          >
            {it}
          </button>
        ),
      )}
      <button type="button" onClick={() => go(current + 1)} disabled={current >= totalPages} className={navBtn} aria-label="다음 페이지">
        <i className="ti ti-chevron-right" />
      </button>
      <button type="button" onClick={() => go(totalPages)} disabled={current >= totalPages} className={navBtn} aria-label="끝 페이지">
        <i className="ti ti-chevrons-right" />
      </button>
      <span className="w-full text-center text-xs text-gray-400 tabular-nums">{current} / {totalPages} 페이지</span>
    </div>
  )
}
