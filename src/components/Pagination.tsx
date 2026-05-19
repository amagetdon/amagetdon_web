function Pagination({
  current,
  total,
  onPageChange,
  windowed = false,
}: {
  current: number
  total: number
  onPageChange: (page: number) => void
  /** true 면 마지막 페이지 바로가기(...) 없이 현재 페이지 주변 창만 노출 — 끝 페이지로 점프 불가 */
  windowed?: boolean
}) {
  if (total <= 1) return null

  const pages: (number | string)[] = []
  if (windowed) {
    // 현재 페이지 기준 최대 5개 창만 — 마지막 페이지로 직접 점프하는 경로를 제공하지 않는다.
    const WINDOW = 5
    const end = Math.min(total, Math.max(current + 2, WINDOW))
    const start = Math.max(1, end - WINDOW + 1)
    for (let i = start; i <= end; i++) pages.push(i)
  } else if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    if (current <= 3) {
      pages.push(1, 2, 3, '...', total)
    } else if (current >= total - 2) {
      pages.push(1, '...', total - 2, total - 1, total)
    } else {
      pages.push(1, '...', current, '...', total)
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-10">
      <button
        onClick={() => current > 1 && onPageChange(current - 1)}
        disabled={current <= 1}
        className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <i className="ti ti-chevron-left" />
      </button>
      {pages.map((page, idx) =>
        typeof page === 'string' ? (
          <span key={idx} className="w-8 h-8 flex items-center justify-center text-sm text-gray-500">{page}</span>
        ) : (
          <button
            key={idx}
            onClick={() => onPageChange(page)}
            className={`w-8 h-8 flex items-center justify-center rounded-full text-sm border-none cursor-pointer ${
              page === current ? 'bg-[#2ED573] text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
            }`}
          >
            {page}
          </button>
        )
      )}
      <button
        onClick={() => current < total && onPageChange(current + 1)}
        disabled={current >= total}
        className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <i className="ti ti-chevron-right" />
      </button>
    </div>
  )
}

export default Pagination
