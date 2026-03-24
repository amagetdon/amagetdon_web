import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useInstructor } from '../hooks/useInstructors'
import { useCoursesByInstructor } from '../hooks/useCourses'
import { useEbooksByInstructor } from '../hooks/useEbooks'
import { useReviews } from '../hooks/useReviews'
import Pagination from '../components/Pagination'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`text-sm ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
      ))}
      <span className="text-xs text-gray-900 font-bold ml-1">{rating.toFixed(1)}</span>
    </div>
  )
}

function InstructorDetailPage() {
  const { id } = useParams()
  const instructorId = id ? Number(id) : null
  const { instructor, loading } = useInstructor(instructorId)
  const { courses } = useCoursesByInstructor(instructorId)
  const { ebooks } = useEbooksByInstructor(instructorId)
  const [currentPage, setCurrentPage] = useState(1)
  const { reviews, totalCount } = useReviews({ page: currentPage, perPage: 4, instructorId: instructorId ?? undefined })

  const totalPages = Math.ceil(totalCount / 4)

  if (loading) {
    return (
      <section className="w-full bg-white py-16">
        <div className="max-w-[1200px] mx-auto px-5 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-10" />
          <div className="flex gap-10 max-md:flex-col">
            <div className="bg-gray-200 rounded-xl w-[300px] h-[400px] shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (!instructor) {
    return (
      <section className="w-full bg-white py-16">
        <div className="max-w-[1200px] mx-auto px-5 text-center text-gray-500">
          강사 정보를 찾을 수 없습니다.
        </div>
      </section>
    )
  }

  return (
    <section className="w-full bg-white py-16 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <h1 className="text-3xl font-bold text-gray-900 mb-10">{instructor.name} 강사</h1>

        <div className="flex gap-10 mb-16 max-md:flex-col">
          <div className="shrink-0">
            <img
              src={instructor.image_url || `https://placehold.co/300x400/e5e7eb/999999?text=${instructor.name}`}
              alt={`${instructor.name} 강사`}
              className="rounded-xl w-[300px] max-md:w-full"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{instructor.title}</h2>
            {instructor.careers && instructor.careers.length > 0 && (
              <ul className="list-none p-0 mb-6">
                {instructor.careers.map((career, idx) => (
                  <li key={idx} className="text-sm text-gray-700 mb-1.5">{career}</li>
                ))}
              </ul>
            )}
            {instructor.bio && (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{instructor.bio}</p>
            )}
          </div>
        </div>

        {courses.length > 0 && (
          <div className="mb-16">
            <h2 className="text-xl font-bold text-gray-900 mb-6">관련 강의 신청하기</h2>
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
              {courses.map((course) => (
                <Link key={course.id} to={`/course/${course.id}`} className="no-underline cursor-pointer group">
                  <div className="bg-gray-100 rounded-xl h-[235px] flex items-center justify-center mb-3 overflow-hidden">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm text-gray-400">썸네일</span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-1">{course.title}</h3>
                  <p className="text-sm text-gray-500">{course.instructor?.name}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {ebooks.length > 0 && (
          <div className="mb-16">
            <h2 className="text-xl font-bold text-gray-900 mb-6">관련 전자책 받기</h2>
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
              {ebooks.map((ebook) => (
                <Link key={ebook.id} to={`/course/${ebook.id}`} className="no-underline cursor-pointer group">
                  <div className="bg-gray-100 rounded-xl h-[235px] flex items-center justify-center mb-3 overflow-hidden">
                    {ebook.thumbnail_url ? (
                      <img src={ebook.thumbnail_url} alt={ebook.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm text-gray-400">썸네일</span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-1">{ebook.title}</h3>
                  <p className="text-sm text-gray-500 mb-1">{ebook.instructor?.name}</p>
                  <div className="flex items-center gap-2">
                    {ebook.original_price && (
                      <span className="text-sm text-gray-400 line-through">{ebook.original_price.toLocaleString()}원</span>
                    )}
                    <span className="text-sm font-bold text-gray-900">
                      {ebook.is_free ? '무료' : ebook.sale_price ? `${ebook.sale_price.toLocaleString()}원` : ''}
                    </span>
                    {ebook.is_hot && (
                      <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">HOT</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">수강생이 직접 말합니다.</h2>
          <p className="text-sm text-gray-500 mb-6">이 강사의 강의를 수강한 수강생들의 실제 후기입니다.</p>

          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
            {reviews.map((review) => (
              <div key={review.id} className="border border-gray-200 rounded-xl p-5">
                <span className="text-xs text-gray-400">
                  {review.author_name} | {new Date(review.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <h3 className="text-base font-bold text-gray-900 mt-2 mb-2">{review.title}</h3>
                <StarRating rating={review.rating} />
                <p className="text-sm text-gray-500 mt-3 leading-relaxed">{review.content}</p>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
          )}
        </div>
      </div>
    </section>
  )
}

export default InstructorDetailPage
