import { useState } from 'react'
import { Link } from 'react-router-dom'
import Pagination from '../components/Pagination'
import HeroSection from '../components/HeroSection'
import { useEbooks } from '../hooks/useEbooks'
import { isEbookClosed } from '../utils/courseStatus'
import { useAcademySettings } from '../hooks/useAcademySettings'
import { useSectionConfig } from '../hooks/useSectionSettings'
import EditableSectionTitle from '../components/admin/EditableSectionTitle'

function EbooksFreePage() {
  const { ebooks, loading } = useEbooks({ isFree: true })
  const { closedVisualEffect } = useAcademySettings()
  const section = useSectionConfig('academy_free_ebooks')
  const perPage = section.count ?? 10
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(ebooks.length / perPage))
  const pagedEbooks = ebooks.slice((currentPage - 1) * perPage, currentPage * perPage)

  return (
    <>
      <HeroSection pageKey="ebooks_free_hero" />

      <section className="w-full bg-white py-14 max-sm:py-10">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="flex items-center justify-between mb-6">
            <EditableSectionTitle
              sectionKey="academy_free_ebooks"
              config={section}
              className="text-2xl font-bold text-gray-900 min-w-0"
              editableCount
              minCount={5}
              maxCount={50}
            />
          </div>
          {loading ? (
            <div className="grid grid-cols-5 max-lg:grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2 gap-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 rounded-xl aspect-[3/4] mb-3" />
                  <div className="bg-gray-200 h-4 rounded w-3/4 mb-2" />
                  <div className="bg-gray-200 h-3 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : ebooks.length === 0 ? (
            <p className="text-sm text-gray-400 py-16 text-center">등록된 무료 전자책이 없습니다.</p>
          ) : (
            <>
              <div className="grid grid-cols-5 max-lg:grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2 gap-5">
                {pagedEbooks.map((book) => {
                  const closed = closedVisualEffect !== false && isEbookClosed(book.close_date)
                  return (
                    <Link key={book.id} to={`/ebook/${book.id}`} className="no-underline group">
                      <div className={`bg-gray-100 rounded-xl aspect-[3/4] flex items-center justify-center mb-3 overflow-hidden ${closed ? 'opacity-60' : ''}`}>
                        {book.thumbnail_url ? (
                          <img src={book.thumbnail_url} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <span className="text-sm text-gray-400">썸네일</span>
                        )}
                      </div>
                      <p className={`text-sm font-bold whitespace-pre-line leading-snug mb-1 ${closed ? 'text-gray-400' : 'text-gray-900'}`}>
                        <span className={closed ? 'line-through' : ''}>{book.title}</span>
                        {closed && <span className="ml-1 text-xs font-medium">(마감)</span>}
                      </p>
                      <p className="text-sm text-gray-500">무료</p>
                    </Link>
                  )
                })}
              </div>
              {totalPages > 1 && (
                <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
              )}
            </>
          )}
        </div>
      </section>
    </>
  )
}

export default EbooksFreePage
