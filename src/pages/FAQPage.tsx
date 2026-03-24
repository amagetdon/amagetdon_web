import { useState, useEffect } from 'react'
import { useFaqs } from '../hooks/useFaqs'
import Pagination from '../components/Pagination'

function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const { faqs, totalCount, loading } = useFaqs({
    search: debouncedSearch || undefined,
    page: currentPage,
    perPage: 3,
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / 3))

  return (
    <>
      <section className="w-full bg-black h-[424px] flex items-center justify-center">
        <span className="text-sm text-gray-500">배너 이미지 1920*424px</span>
      </section>

      <section className="w-full bg-white py-16 max-sm:py-10">
        <div className="max-w-[800px] mx-auto px-5">
          <h2 className="text-2xl font-bold text-center text-gray-900">자주 묻는 질문 Q&A</h2>

          <div className="max-w-[500px] mx-auto mt-8">
            <div className="relative">
              <input
                type="text"
                placeholder="키워드를 입력하세요"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-10 text-sm outline-none focus:border-[#04F87F]"
              />
              <i className="ti ti-search absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="divide-y divide-gray-200 mt-10">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="py-8 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-2/3 mt-2" />
                </div>
              ))
            ) : (
              faqs.map((item) => (
                <div key={item.id} className="py-8">
                  <p className="text-lg font-bold text-gray-900">
                    <span className="text-xl font-extrabold">Q.</span> {item.question}
                  </p>
                  <p className="text-sm text-gray-600 mt-3 whitespace-pre-line leading-relaxed">
                    {item.answer}
                  </p>

                  {item.video_url && (
                    <div className="bg-gray-800 rounded-lg h-[200px] w-[300px] mt-4 flex items-center justify-center overflow-hidden">
                      <video src={item.video_url} controls className="w-full h-full object-cover" />
                    </div>
                  )}

                  {item.file_url && (
                    <a
                      href={item.file_url}
                      download={item.file_name || '첨부파일'}
                      className="border border-gray-200 rounded-lg p-3 flex items-center gap-3 mt-4 max-w-[400px] no-underline"
                    >
                      <i className="ti ti-file-spreadsheet text-[#04F87F] text-2xl shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.file_name || '첨부파일'}
                        </p>
                      </div>
                      <i className="ti ti-download text-gray-400 text-xl shrink-0 cursor-pointer" />
                    </a>
                  )}
                </div>
              ))
            )}

            {!loading && faqs.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm">
                검색 결과가 없습니다.
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
          )}
        </div>
      </section>
    </>
  )
}

export default FAQPage
