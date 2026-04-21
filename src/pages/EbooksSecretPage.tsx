import { Link } from 'react-router-dom'
import { useEbooks } from '../hooks/useEbooks'
import { isEbookClosed } from '../utils/courseStatus'
import { useAcademySettings } from '../hooks/useAcademySettings'

function EbooksSecretPage() {
  const { ebooks, loading } = useEbooks({ isFree: false })
  const { closedVisualEffect } = useAcademySettings()

  return (
    <>
      <section className="w-full bg-black py-20 max-sm:py-14">
        <div className="max-w-[1200px] mx-auto px-5">
          <span className="inline-block bg-white/10 text-white text-xs font-medium px-4 py-1.5 rounded-full mb-4">
            시크릿 북
          </span>
          <h1 className="text-3xl max-sm:text-2xl font-bold text-white leading-snug">
            더 깊이 배우는 아마겟돈 시크릿 북
          </h1>
          <p className="text-sm text-gray-400 mt-3">무료 전자책에서 더 깊게 배우고 싶다면?</p>
        </div>
      </section>

      <section className="w-full bg-black py-14 max-sm:py-10">
        <div className="max-w-[1200px] mx-auto px-5">
          {loading ? (
            <div className="grid grid-cols-5 max-lg:grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2 gap-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-800 rounded-xl aspect-[3/4] mb-3" />
                  <div className="bg-gray-700 h-4 rounded w-3/4 mb-2" />
                  <div className="bg-gray-700 h-3 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : ebooks.length === 0 ? (
            <p className="text-sm text-gray-500 py-16 text-center">등록된 시크릿 북이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-5 max-lg:grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2 gap-5">
              {ebooks.map((book) => {
                const closed = closedVisualEffect !== false && isEbookClosed(book.close_date)
                return (
                  <Link key={book.id} to={`/ebook/${book.id}`} className="cursor-pointer group no-underline">
                    <div className={`bg-gray-800 rounded-xl aspect-[3/4] flex items-center justify-center mb-3 overflow-hidden ${closed ? 'opacity-60' : ''}`}>
                      {book.thumbnail_url ? (
                        <img src={book.thumbnail_url} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <span className="text-sm text-gray-500">썸네일</span>
                      )}
                    </div>
                    <p className={`text-sm font-bold whitespace-pre-line leading-snug mb-2 ${closed ? 'text-gray-500' : 'text-white'}`}>
                      <span className={closed ? 'line-through' : ''}>{book.title}</span>
                      {closed && <span className="ml-1 text-xs font-medium">(마감)</span>}
                    </p>
                    {book.original_price && (
                      <p className="text-xs text-gray-500 line-through">{book.original_price.toLocaleString()}원</p>
                    )}
                    <p className={`text-base font-bold ${closed ? 'text-gray-500' : 'text-white'}`}>
                      {book.sale_price ? `${book.sale_price.toLocaleString()}원` : '무료'}
                    </p>
                    {book.is_hot && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-[#2ED573] text-white text-xs font-bold rounded">HOT</span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default EbooksSecretPage
