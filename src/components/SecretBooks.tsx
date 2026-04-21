import { Link } from 'react-router-dom'
import { useEbooks } from '../hooks/useEbooks'
import { isEbookClosed } from '../utils/courseStatus'
import { useAcademySettings } from '../hooks/useAcademySettings'

function SecretBooks() {
  const { ebooks, loading } = useEbooks({ isFree: false })
  const { closedVisualEffect } = useAcademySettings()

  return (
    <section className="w-full bg-black py-14 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex items-center justify-between mb-2 gap-4">
          <h2 className="text-2xl font-bold text-white min-w-0">시크릿 북</h2>
          <Link
            to="/ebooks/secret"
            className="flex items-center gap-2 px-5 py-2 border border-gray-500 rounded-full text-sm text-gray-300 bg-transparent cursor-pointer hover:bg-white/5 no-underline whitespace-nowrap"
          >
            전체 보기 <span className="text-lg">→</span>
          </Link>
        </div>
        <p className="text-sm text-gray-400 mb-6">무료 전자책에서 더 깊게 배우고 싶다면?</p>
        {loading ? (
          <div className="grid grid-cols-5 max-lg:grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-800 rounded-xl aspect-[3/4] mb-3" />
                <div className="bg-gray-700 h-4 rounded w-3/4 mb-2" />
                <div className="bg-gray-700 h-3 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-5 max-lg:grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2 gap-5">
            {ebooks.map((book) => {
              const closed = closedVisualEffect !== false && isEbookClosed(book.close_date)
              return (
                <Link key={book.id} to={`/ebook/${book.id}`} className="cursor-pointer group no-underline">
                  <div className={`bg-gray-800 rounded-xl aspect-[3/4] flex items-center justify-center mb-3 overflow-hidden ${closed ? 'opacity-60' : ''}`}>
                    {book.thumbnail_url ? (
                      <img src={book.thumbnail_url} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm text-gray-500">썸네일<br />16:9</span>
                    )}
                  </div>
                  <p className={`text-sm font-bold whitespace-pre-line leading-snug mb-2 ${closed ? 'text-gray-500' : 'text-white'}`}>
                    <span className={closed ? 'line-through' : ''}>{book.title}</span>
                    {closed && <span className="ml-1 text-xs font-medium">(마감)</span>}
                  </p>
                  {book.original_price && (
                    <p className="text-xs text-gray-500 line-through">
                      {book.original_price.toLocaleString()}원
                    </p>
                  )}
                  <p className={`text-base font-bold ${closed ? 'text-gray-500' : 'text-white'}`}>
                    {book.sale_price ? `${book.sale_price.toLocaleString()}원` : '무료'}
                  </p>
                  {book.is_hot && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-[#2ED573] text-white text-xs font-bold rounded">
                      HOT
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default SecretBooks
