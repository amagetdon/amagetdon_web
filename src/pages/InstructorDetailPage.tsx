import { useState } from 'react'
import { Link } from 'react-router-dom'

interface Review {
  author: string
  date: string
  title: string
  rating: number
  content: string
}

interface Course {
  id: number
  title: string
  instructor: string
  image: string
}

interface Ebook {
  id: number
  title: string
  instructor: string
  image: string
  originalPrice: string
  price: string
  isHot: boolean
}

const CAREERS = [
  '- 올라이프 자산관리 대표',
  '- MDRT 8년 연속·COT 5년 연속·TOT 달성(전 세계 상위 0.1%)',
  '- 한국FPSB 재무설계사 / 보험연수원 ICM 컨설턴트',
  '- 미래에셋 금융서비스 수석 컨설턴트 및 사내 신입강사 출신',
  '- 여러 GA·보험사·기관에서 공식 출강 중',
]

const BIO_TEXT = `20대 초반, 특별한 스펙 없이 보험 업계에 들어왔습니다.
영업보다 구조·원리·기준을 먼저 배우는 데 집중했고,
그 선택이 TOT(전 세계 상위 0.1%)로 이어졌습니다.

저는 '잘 파는 법'이 아니라,
'고객이 스스로 선택하게 만드는 구조'를 만드는 사람입니다.

지금은 그 구조와 기준을,
현장에서 바로 쓸 수 있는 언어로 전달하고 있습니다.`

const COURSES: Course[] = [
  { id: 1, title: '보험 세일즈 마스터 클래스', instructor: '김나영', image: 'https://placehold.co/380x235/e5e7eb/999999?text=강의1' },
  { id: 2, title: 'MDRT 달성을 위한 실전 전략', instructor: '김나영', image: 'https://placehold.co/380x235/e5e7eb/999999?text=강의2' },
]

const EBOOKS: Ebook[] = [
  { id: 1, title: '보험 세일즈 입문 가이드', instructor: '김나영', image: 'https://placehold.co/380x235/e5e7eb/999999?text=전자책1', originalPrice: '', price: '무료', isHot: false },
  { id: 2, title: 'TOT 달성 비법 전자책', instructor: '김나영', image: 'https://placehold.co/380x235/e5e7eb/999999?text=전자책2', originalPrice: '89,000원', price: '49,000원', isHot: true },
]

const REVIEWS: Review[] = [
  { author: 'Kiya', date: '2025년 9월 6일', title: '후회없는 선택', rating: 5, content: '진짜 아낌없이 주시는 강의였습니다. 제가 듣고 싶었고 이런 게 있었으면 좋겠다 했던 정보들을 하나부터 열까지 고심해서 정리한 커리큘럼이었습니다.' },
  { author: '이정은', date: '2025년 9월 6일', title: '어디서도 볼 수 없는 미친 퀄리티에요!!', rating: 5, content: '요즘 200만원대 비싼 강의 많잖아요. 근데도 강사님이 준비를 안해오시고 실망을 많이 했는데 김나영 대표님 강의는 퀄리티가 정말 놀랍습니다.' },
  { author: '박호진', date: '2025년 9월 6일', title: '강사님을 복사하고 싶어요..ㅎ', rating: 5, content: '실전 노하우를 아낌없이 공유해주시는 모습이 인상적이었습니다. 바로 적용 가능한 팁들이 가득했습니다.' },
  { author: 'supersonic', date: '2025년 9월 6일', title: '미쳤다 미쳤어', rating: 5, content: '이 가격에 이 퀄리티라니... 정말 미친 가성비입니다. 다른 고가 강의보다 훨씬 알차고 실전적입니다.' },
]

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`text-sm ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}>
          ★
        </span>
      ))}
      <span className="text-xs text-gray-900 font-bold ml-1">{rating.toFixed(1)}</span>
    </div>
  )
}

function Pagination({
  current,
  total,
  onPageChange,
}: {
  current: number
  total: number
  onPageChange: (page: number) => void
}) {
  const pages: (number | string)[] = [1, 2, 3, '...', total]

  const handlePrev = () => {
    if (current > 1) onPageChange(current - 1)
  }

  const handleNext = () => {
    if (current < total) onPageChange(current + 1)
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-10">
      <button
        onClick={handlePrev}
        disabled={current <= 1}
        className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <i className="ti ti-chevron-left" />
      </button>
      {pages.map((page, idx) =>
        typeof page === 'string' ? (
          <span key={idx} className="w-8 h-8 flex items-center justify-center text-sm text-gray-500">
            {page}
          </span>
        ) : (
          <button
            key={idx}
            onClick={() => onPageChange(page)}
            className={`w-8 h-8 flex items-center justify-center rounded-full text-sm border-none cursor-pointer ${
              page === current
                ? 'bg-[#04F87F] text-white'
                : 'bg-white text-gray-500 hover:bg-gray-100'
            }`}
          >
            {page}
          </button>
        )
      )}
      <button
        onClick={handleNext}
        disabled={current >= total}
        className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <i className="ti ti-chevron-right" />
      </button>
    </div>
  )
}

function InstructorDetailPage() {
  const [currentPage, setCurrentPage] = useState(1)

  return (
    <section className="w-full bg-white py-16 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        {/* Header */}
        <h1 className="text-3xl font-bold text-gray-900 mb-10">김나영 강사</h1>

        {/* Profile Section */}
        <div className="flex gap-10 mb-16 max-md:flex-col">
          <div className="shrink-0">
            <img
              src="https://placehold.co/300x400/e5e7eb/999999?text=김나영"
              alt="김나영 강사"
              className="rounded-xl w-[300px] max-md:w-full"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              전 세계 상위 0.1%, MDRT·COT·TOT를 모두 달성
            </h2>
            <ul className="list-none p-0 mb-6">
              {CAREERS.map((career, idx) => (
                <li key={idx} className="text-sm text-gray-700 mb-1.5">{career}</li>
              ))}
            </ul>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {BIO_TEXT}
            </p>
          </div>
        </div>

        {/* Related Courses */}
        <div className="mb-16">
          <h2 className="text-xl font-bold text-gray-900 mb-6">관련 강의 신청하기</h2>
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
            {COURSES.map((course) => (
              <Link
                key={course.id}
                to={`/course/${course.id}`}
                className="no-underline cursor-pointer group"
              >
                <img
                  src={course.image}
                  alt={course.title}
                  className="w-full rounded-xl mb-3"
                />
                <h3 className="text-base font-bold text-gray-900 mb-1">{course.title}</h3>
                <p className="text-sm text-gray-500">{course.instructor}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Related Ebooks */}
        <div className="mb-16">
          <h2 className="text-xl font-bold text-gray-900 mb-6">관련 전자책 받기</h2>
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
            {EBOOKS.map((ebook) => (
              <Link
                key={ebook.id}
                to={`/course/${ebook.id}`}
                className="no-underline cursor-pointer group"
              >
                <img
                  src={ebook.image}
                  alt={ebook.title}
                  className="w-full rounded-xl mb-3"
                />
                <h3 className="text-base font-bold text-gray-900 mb-1">{ebook.title}</h3>
                <p className="text-sm text-gray-500 mb-1">{ebook.instructor}</p>
                <div className="flex items-center gap-2">
                  {ebook.originalPrice && (
                    <span className="text-sm text-gray-400 line-through">{ebook.originalPrice}</span>
                  )}
                  <span className="text-sm font-bold text-gray-900">{ebook.price}</span>
                  {ebook.isHot && (
                    <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">HOT</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Reviews */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">수강생이 직접 말합니다.</h2>
          <p className="text-sm text-gray-500 mb-6">이 강사의 강의를 수강한 수강생들의 실제 후기입니다.</p>

          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
            {REVIEWS.map((review, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl p-5">
                <span className="text-xs text-gray-400">{review.author} | {review.date}</span>
                <h3 className="text-base font-bold text-gray-900 mt-2 mb-2">{review.title}</h3>
                <StarRating rating={review.rating} />
                <p className="text-sm text-gray-500 mt-3 leading-relaxed">{review.content}</p>
              </div>
            ))}
          </div>

          <Pagination current={currentPage} total={30} onPageChange={setCurrentPage} />
        </div>
      </div>
    </section>
  )
}

export default InstructorDetailPage
