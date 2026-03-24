import { useEbooks } from '../hooks/useEbooks'

function SecretBooks() {
  const { ebooks, loading } = useEbooks({ isFree: false, limit: 3 })

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
        {loading ? (
          <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-800 rounded-xl h-[235px] mb-3" />
                <div className="bg-gray-700 h-4 rounded w-3/4 mb-2" />
                <div className="bg-gray-700 h-3 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-5">
            {ebooks.map((book) => (
              <div key={book.id} className="cursor-pointer group">
                <div className="bg-gray-800 rounded-xl h-[235px] flex items-center justify-center mb-3 overflow-hidden">
                  {book.thumbnail_url ? (
                    <img src={book.thumbnail_url} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm text-gray-500">썸네일<br />380*235px</span>
                  )}
                </div>
                <p className="text-sm font-bold text-white whitespace-pre-line leading-snug mb-2">
                  {book.title}
                </p>
                {book.original_price && (
                  <p className="text-xs text-gray-500 line-through">
                    {book.original_price.toLocaleString()}원
                  </p>
                )}
                <p className="text-base font-bold text-white">
                  {book.sale_price ? `${book.sale_price.toLocaleString()}원` : '무료'}
                </p>
                {book.is_hot && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-[#04F87F] text-white text-xs font-bold rounded">
                    HOT
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default SecretBooks
