interface SecretBook {
  id: number
  title: string
  originalPrice: string
  salePrice: string
}

const BOOKS: SecretBook[] = [
  { id: 1, title: '한번 배워서 평생 써먹는\n300 벌고 시작하는 보험 비즈니스', originalPrice: '89,000원', salePrice: '49,000원' },
  { id: 2, title: 'TOT 설계사의 하이엔드 세일즈 비법\n[설계사 플랜]', originalPrice: '89,000원', salePrice: '49,000원' },
  { id: 3, title: 'TOT 설계사의 하이엔드 세일즈 비법\n[설계사 플랜]', originalPrice: '89,000원', salePrice: '49,000원' },
]

function SecretBooks() {
  return (
    <section className="w-full bg-black py-14 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-white">시크릿 북</h2>
          <button className="flex items-center gap-2 px-5 py-2 border border-gray-500 rounded-full text-sm text-gray-300 bg-transparent cursor-pointer">
            전체 보기 <span className="text-lg">→</span>
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-6">무료 전자책에서 더 깊게 배우고 싶다면?</p>
        <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-5">
          {BOOKS.map((book) => (
            <div key={book.id} className="cursor-pointer group">
              <div className="bg-gray-800 rounded-xl h-[235px] flex items-center justify-center mb-3 overflow-hidden">
                <span className="text-sm text-gray-500">썸네일{book.id}<br />380*235px</span>
              </div>
              <p className="text-sm font-bold text-white whitespace-pre-line leading-snug mb-2">
                {book.title}
              </p>
              <p className="text-xs text-gray-500 line-through">{book.originalPrice}</p>
              <p className="text-base font-bold text-white">{book.salePrice}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-[#04F87F] text-white text-xs font-bold rounded">
                HOT
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default SecretBooks
