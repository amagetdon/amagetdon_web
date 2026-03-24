import { useState } from 'react'
import ResultModal from '../components/ResultModal'
import Pagination from '../components/Pagination'
import { useResults } from '../hooks/useResults'
import type { Result } from '../types'

function ReviewResultsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const { results, totalCount, loading } = useResults({ page: currentPage, perPage: 4 })
  const [selectedResult, setSelectedResult] = useState<Result | null>(null)

  const totalPages = Math.ceil(totalCount / 4)

  return (
    <section className="w-full bg-white">
      <div className="w-full h-[200px] bg-black flex items-center justify-center">
        <span className="text-white/40 text-sm">배너 이미지 1920*424px</span>
      </div>

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

        {loading ? (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 rounded-xl h-[280px] mb-3" />
                <div className="h-3 bg-gray-200 rounded w-32 mb-2" />
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
            {results.map((result) => (
              <div
                key={result.id}
                className="cursor-pointer group"
                onClick={() => setSelectedResult(result)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedResult(result) }}
              >
                <div className="bg-gray-100 rounded-xl h-[280px] flex items-center justify-center overflow-hidden mb-3">
                  {result.image_url ? (
                    <img src={result.image_url} alt={result.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm text-gray-400">이미지</span>
                  )}
                </div>
                <span className="text-xs text-[#04F87F]">
                  {result.author_name} | {new Date(result.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <h3 className="text-base font-bold text-gray-900 mt-1 mb-1">{result.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{result.preview}</p>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
        )}
      </div>

      {selectedResult && (
        <ResultModal
          isOpen={true}
          onClose={() => setSelectedResult(null)}
          result={{
            author: selectedResult.author_name,
            date: new Date(selectedResult.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
            title: selectedResult.title,
            content: selectedResult.content,
            image: selectedResult.image_url || '',
          }}
        />
      )}
    </section>
  )
}

export default ReviewResultsPage
