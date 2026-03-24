import { useState, useMemo } from 'react'

interface FAQItem {
  question: string
  answer: string
  hasVideo?: boolean
  hasFile?: boolean
}

const FAQ_DATA: FAQItem[] = [
  {
    question: '다시보기는 어떻게 보나요?',
    answer:
      '결제 후 마이페이지에서 다시보기가 가능하며,\n자세한 이용 방법은 아래 예시 영상을 통해\n확인하실 수 있습니다.',
    hasVideo: true,
  },
  {
    question: '강의는 구매 후 바로 수강할 수 있나요?',
    answer: '네. 결제 완료 후 즉시 수강이 가능합니다.',
  },
  {
    question: '환불은 어떻게 진행되나요?',
    answer:
      '환불은 각 강의별 환불 기준에 따라 진행되며,\n자세한 조건은 결제 페이지에서 확인하실 수 있습니다.',
    hasFile: true,
  },
  {
    question: '수강 기간에 제한이 있나요?',
    answer: '강의마다 수강 기간이 다르며,\n일부 강의는 기간 제한 없이 수강이 가능합니다.',
  },
  {
    question: '문의 사항은 어디로 연락하면 되나요?',
    answer: '플랫폼 내 문의 채널을 통해 접수해 주시면\n순차적으로 안내드립니다.',
  },
  {
    question: '결제 후 강의 변경이나 교환이 가능한가요?',
    answer:
      '강의 변경 및 교환은 원칙적으로 어렵지만,\n상황에 따라 고객센터를 통해 문의하실 수 있습니다.',
  },
]

const ITEMS_PER_PAGE = 3

function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const filteredFAQ = useMemo(
    () =>
      FAQ_DATA.filter(
        (item) => item.question.includes(searchQuery) || item.answer.includes(searchQuery)
      ),
    [searchQuery]
  )

  const totalPages = Math.max(1, Math.ceil(filteredFAQ.length / ITEMS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedFAQ = filteredFAQ.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  )

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  return (
    <>
      {/* Hero Banner */}
      <section className="w-full bg-black h-[424px] flex items-center justify-center">
        <span className="text-sm text-gray-500">배너 이미지 1920*424px</span>
      </section>

      <section className="w-full bg-white py-16 max-sm:py-10">
        <div className="max-w-[800px] mx-auto px-5">
          <h2 className="text-2xl font-bold text-center text-gray-900">자주 묻는 질문 Q&A</h2>

          {/* Search */}
          <div className="max-w-[500px] mx-auto mt-8">
            <div className="relative">
              <input
                type="text"
                placeholder="키워드를 입력하세요"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-10 text-sm outline-none focus:border-[#04F87F]"
              />
              <i className="ti ti-search absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* FAQ List */}
          <div className="divide-y divide-gray-200 mt-10">
            {paginatedFAQ.map((item, idx) => (
              <div key={idx} className="py-8">
                <p className="text-lg font-bold text-gray-900">
                  <span className="text-xl font-extrabold">Q.</span> {item.question}
                </p>
                <p className="text-sm text-gray-600 mt-3 whitespace-pre-line leading-relaxed">
                  {item.answer}
                </p>

                {item.hasVideo && (
                  <div className="bg-gray-800 rounded-lg h-[200px] w-[300px] mt-4 flex items-center justify-center">
                    <i className="ti ti-player-play-filled text-white text-4xl" />
                  </div>
                )}

                {item.hasFile && (
                  <div className="border border-gray-200 rounded-lg p-3 flex items-center gap-3 mt-4 max-w-[400px]">
                    <i className="ti ti-file-spreadsheet text-[#04F87F] text-2xl shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        아마겟돈_강의 환불규정.xlsx
                      </p>
                      <p className="text-xs text-gray-400">100KB</p>
                    </div>
                    <i className="ti ti-download text-gray-400 text-xl shrink-0 cursor-pointer" />
                  </div>
                )}
              </div>
            ))}

            {paginatedFAQ.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm">
                검색 결과가 없습니다.
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 cursor-pointer disabled:opacity-30 disabled:cursor-default"
            >
              <i className="ti ti-chevron-left" />
            </button>
            {pageNumbers.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 flex items-center justify-center rounded-full text-sm cursor-pointer ${
                  safePage === page
                    ? 'bg-[#04F87F] text-white font-bold'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 cursor-pointer disabled:opacity-30 disabled:cursor-default"
            >
              <i className="ti ti-chevron-right" />
            </button>
          </div>
        </div>
      </section>
    </>
  )
}

export default FAQPage
