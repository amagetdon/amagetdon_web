import { useState } from 'react'
import ResultModal from '../components/ResultModal'

interface ResultItem {
  id: number
  author: string
  date: string
  title: string
  preview: string
  image: string
}

const RESULTS: ResultItem[] = [
  { id: 1, author: '강보경', date: '2025년 9월 6일', title: '상담만 많고 계약이 안 되던 구조가 바뀌었습니다.', preview: '기존에는 상담 건수만 많고 실제 계약으로 이어지는 비율이 낮았는데, 강의에서 배운 구조를 적용한 이후 계약 전환율이 눈에 띄게 올랐습니다.', image: 'https://placehold.co/560x280/f3f4f6/999999?text=성과1' },
  { id: 2, author: '심지원', date: '2025년 9월 6일', title: '병원 원장과의 미팅이 훨씬 수월해졌습니다.', preview: '이전에는 원장님과의 미팅에서 어떤 이야기를 해야 할지 막막했는데, 강의에서 배운 포인트들을 활용하니 대화가 훨씬 자연스러워졌습니다.', image: 'https://placehold.co/560x280/f3f4f6/999999?text=성과2' },
  { id: 3, author: '강보경', date: '2025년 9월 6일', title: '병원 쪽에서 먼저 문의가 오기 시작했습니다.', preview: '마케팅 전략을 체계적으로 세운 후, 병원에서 먼저 연락이 오기 시작했습니다. 영업 방식이 완전히 달라졌습니다.', image: 'https://placehold.co/560x280/f3f4f6/999999?text=성과3' },
  { id: 4, author: '심지원', date: '2025년 9월 6일', title: '매번 감으로 하던 마케팅이 정리됐습니다.', preview: '감으로만 진행하던 마케팅에 체계가 잡히니, 어디에 집중해야 하는지 명확해졌고 결과도 따라오기 시작했습니다.', image: 'https://placehold.co/560x280/f3f4f6/999999?text=성과4' },
]

function Pagination({
  current,
  total,
  onPageChange,
}: {
  current: number
  total: number
  onPageChange: (page: number) => void
}) {
  const pages: (number | string)[] = [1, 2, 3, '...', total]

  const handlePrev = () => {
    if (current > 1) onPageChange(current - 1)
  }

  const handleNext = () => {
    if (current < total) onPageChange(current + 1)
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-10">
      <button
        onClick={handlePrev}
        disabled={current <= 1}
        className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <i className="ti ti-chevron-left" />
      </button>
      {pages.map((page, idx) =>
        typeof page === 'string' ? (
          <span key={idx} className="w-8 h-8 flex items-center justify-center text-sm text-gray-500">
            {page}
          </span>
        ) : (
          <button
            key={idx}
            onClick={() => onPageChange(page)}
            className={`w-8 h-8 flex items-center justify-center rounded-full text-sm border-none cursor-pointer ${
              page === current
                ? 'bg-[#04F87F] text-white'
                : 'bg-white text-gray-500 hover:bg-gray-100'
            }`}
          >
            {page}
          </button>
        )
      )}
      <button
        onClick={handleNext}
        disabled={current >= total}
        className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <i className="ti ti-chevron-right" />
      </button>
    </div>
  )
}

function ReviewResultsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedResult, setSelectedResult] = useState<ResultItem | null>(null)

  return (
    <section className="w-full bg-white">
      {/* Hero Banner */}
      <div className="w-full h-[200px] bg-black flex items-center justify-center">
        <span className="text-white/40 text-sm">배너 이미지 1920*424px</span>
      </div>

      {/* Event Info Area */}
      <div className="w-full bg-black flex items-center justify-center py-20">
        <span className="text-white/40 text-sm">성과 이벤트 안내 페이지 1920*690px</span>
      </div>

      <div className="max-w-[1200px] mx-auto px-5 pb-16">
        <div className="flex items-center justify-between mt-16 mb-8">
          <h1 className="text-2xl font-bold text-gray-900">어떤 성과가 나왔는지 확인해보세요</h1>
          <button className="bg-[#04F87F] text-white rounded-full px-5 py-2.5 text-sm font-medium border-none cursor-pointer hover:bg-[#03d46d] transition-colors flex items-center gap-1">
            <i className="ti ti-plus text-sm" />
            성과 작성하기
          </button>
        </div>

        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
          {RESULTS.map((result) => (
            <div
              key={result.id}
              className="cursor-pointer group"
              onClick={() => setSelectedResult(result)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedResult(result)
              }}
            >
              <img
                src={result.image}
                alt={result.title}
                className="w-full rounded-xl mb-3"
              />
              <span className="text-xs text-[#04F87F]">{result.author} | {result.date}</span>
              <h3 className="text-base font-bold text-gray-900 mt-1 mb-1">{result.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{result.preview}</p>
            </div>
          ))}
        </div>

        <Pagination current={currentPage} total={30} onPageChange={setCurrentPage} />
      </div>

      {selectedResult && (
        <ResultModal
          isOpen={true}
          onClose={() => setSelectedResult(null)}
          result={{
            author: selectedResult.author,
            date: selectedResult.date,
            title: selectedResult.title,
            content: selectedResult.preview,
            image: selectedResult.image,
          }}
        />
      )}
    </section>
  )
}

export default ReviewResultsPage
