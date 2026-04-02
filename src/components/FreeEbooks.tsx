import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ebookService } from '../services/ebookService'
import type { EbookWithInstructor } from '../types'

function FreeEbooks({ ebooks: propEbooks, loading: propLoading }: { ebooks?: EbookWithInstructor[]; loading?: boolean } = {}) {
  const [selfEbooks, setSelfEbooks] = useState<EbookWithInstructor[]>([])
  const [selfLoading, setSelfLoading] = useState(!propEbooks)
  const ebooks = propEbooks ?? selfEbooks
  const loading = propLoading ?? selfLoading

  useEffect(() => {
    if (propEbooks) return
    ebookService.getAll({ isFree: true, limit: 3 }).then(setSelfEbooks).catch(() => {}).finally(() => setSelfLoading(false))
  }, [propEbooks])
  return (
    <section className="w-full bg-white py-14 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">무료 전자책</h2>
          <Link
            to="/academy"
            className="flex items-center gap-2 px-5 py-2 border border-gray-300 rounded-full text-sm text-gray-600 bg-white cursor-pointer hover:bg-gray-50 no-underline"
          >
            전체 보기 <span className="text-lg">→</span>
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-5 max-lg:grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 rounded-xl aspect-[3/4] mb-3" />
                <div className="bg-gray-200 h-4 rounded w-3/4 mb-2" />
                <div className="bg-gray-200 h-3 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-5 max-lg:grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2 gap-5">
            {ebooks.map((book) => (
              <Link key={book.id} to={`/ebook/${book.id}`} className="no-underline group">
                <div className="bg-gray-100 rounded-xl aspect-[3/4] flex items-center justify-center mb-3 overflow-hidden">
                  {book.thumbnail_url ? (
                    <img src={book.thumbnail_url} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm text-gray-400">썸네일</span>
                  )}
                </div>
                <p className="text-sm font-bold text-gray-900 whitespace-pre-line leading-snug mb-1">
                  {book.title}
                </p>
                <p className="text-sm text-gray-500">무료</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default FreeEbooks
