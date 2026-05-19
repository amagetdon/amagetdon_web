import { Link } from 'react-router-dom'
import { useEbooks } from '../hooks/useEbooks'
import { isEbookClosed } from '../utils/courseStatus'
import { useAcademySettings } from '../hooks/useAcademySettings'
import { useSectionConfig, type SectionKey } from '../hooks/useSectionSettings'
import EditableSectionTitle from './admin/EditableSectionTitle'
import { imgUrl } from '../lib/image'
import type { EbookWithInstructor } from '../types'

// 홈 화면 전자책 — 무료 전자책 / 유료 전자책을 한 줄에 좌우 반반으로 배치.
// (좁은 화면에서는 위아래로 쌓임)
function HomeEbooks({ ebooks: freeEbooks, loading: freeLoading }: { ebooks?: EbookWithInstructor[]; loading?: boolean } = {}) {
  const { closedVisualEffect } = useAcademySettings()
  const { ebooks: paidEbooks, loading: paidLoading } = useEbooks({ isFree: false })

  const renderColumn = (opts: {
    sectionKey: SectionKey
    to: string
    books: EbookWithInstructor[]
    loading: boolean
    paid: boolean
  }) => {
    const { sectionKey, to, books, loading, paid } = opts
    return (
      <EbookColumn
        sectionKey={sectionKey}
        to={to}
        books={books}
        loading={loading}
        paid={paid}
        closedVisualEffect={closedVisualEffect}
      />
    )
  }

  return (
    <section className="w-full bg-white py-14 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="grid md:grid-cols-2 gap-x-10 gap-y-12">
          {renderColumn({ sectionKey: 'free_ebooks', to: '/ebooks/free', books: freeEbooks ?? [], loading: !!freeLoading, paid: false })}
          {renderColumn({ sectionKey: 'secret_books', to: '/ebooks/secret', books: paidEbooks, loading: paidLoading, paid: true })}
        </div>
      </div>
    </section>
  )
}

function EbookColumn({
  sectionKey,
  to,
  books,
  loading,
  paid,
  closedVisualEffect,
}: {
  sectionKey: SectionKey
  to: string
  books: EbookWithInstructor[]
  loading: boolean
  paid: boolean
  closedVisualEffect: boolean | undefined
}) {
  const section = useSectionConfig(sectionKey)
  const count = section.count ?? 4

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-6 gap-4">
        <EditableSectionTitle
          sectionKey={sectionKey}
          config={section}
          className="text-2xl font-bold text-gray-900 min-w-0"
          editableCount
          maxCount={8}
        />
        <Link
          to={to}
          className="flex items-center gap-2 px-5 py-2 border border-gray-300 rounded-full text-sm text-gray-600 bg-white cursor-pointer hover:bg-gray-50 no-underline whitespace-nowrap"
        >
          전체 보기 <span className="text-lg">→</span>
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-xl aspect-[3/4] mb-3" />
              <div className="bg-gray-200 h-4 rounded w-3/4 mb-2" />
              <div className="bg-gray-200 h-3 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">등록된 전자책이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {books.slice(0, count).map((book) => {
            const closed = closedVisualEffect !== false && isEbookClosed(book.close_date)
            const discounted = paid && book.original_price != null && book.sale_price != null && book.sale_price < book.original_price
            return (
              <Link key={book.id} to={`/ebook/${book.id}`} className="no-underline group">
                <div className={`bg-gray-100 rounded-xl aspect-[3/4] flex items-center justify-center mb-3 overflow-hidden ${closed ? 'opacity-60' : ''}`}>
                  {book.thumbnail_url ? (
                    <img src={imgUrl(book.thumbnail_url, 'thumb')} alt={book.title} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm text-gray-400">썸네일</span>
                  )}
                </div>
                <p className={`text-sm font-bold whitespace-pre-line leading-snug mb-1 ${closed ? 'text-gray-400' : 'text-gray-900'}`}>
                  <span className={closed ? 'line-through' : ''}>{book.title}</span>
                  {closed && <span className="ml-1 text-xs font-medium">(마감)</span>}
                </p>
                {discounted && (
                  <p className="text-xs text-gray-400 line-through">{book.original_price!.toLocaleString()}원</p>
                )}
                {paid ? (
                  <p className={`text-sm font-bold ${closed ? 'text-gray-400' : 'text-gray-900'}`}>
                    {book.sale_price
                      ? `${book.sale_price.toLocaleString()}원`
                      : book.original_price
                        ? `${book.original_price.toLocaleString()}원`
                        : '무료'}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">무료</p>
                )}
                {paid && book.is_hot && (
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
  )
}

export default HomeEbooks
