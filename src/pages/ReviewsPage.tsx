import { useState } from 'react'
import ReviewModal from '../components/ReviewModal'

interface Review {
  author: string
  date: string
  title: string
  rating: number
  content: string
  courseName: string
}

const REVIEWS: Review[] = [
  { author: '이정은', date: '2025년 9월 6일', title: '병원마케팅 무료 강의를 방황하다가 여기로 정착했습니다', rating: 5, content: '여러 강의를 들어봤지만 이곳만큼 체계적이고 실전적인 곳은 없었습니다. 진짜 현장에서 바로 적용할 수 있는 내용들로 가득합니다. 특히 마케팅 전략을 세우는 부분에서 많은 인사이트를 얻었고, 실제 업무에 바로 적용하니 눈에 띄는 성과가 나타났습니다. 강의 구성이 체계적이어서 초보자도 쉽게 따라갈 수 있었고, 고급 내용까지 다뤄주셔서 경력자에게도 도움이 됩니다.', courseName: '병원마케팅 마스터 클래스' },
  { author: '이정은', date: '2025년 9월 6일', title: '어디서도 볼 수 없는 미친 퀄리티에요!!', rating: 5, content: '요즘 200만원대 비싼 강의 많잖아요. 근데도 강사님이 준비를 안해오시고 실망을 많이 했는데 여기는 퀄리티가 정말 놀랍습니다. 하나하나 꼼꼼하게 준비된 자료와 실전 사례들이 가득해서, 강의를 듣는 내내 감탄이 나왔습니다. 이 가격에 이런 퀄리티의 강의를 들을 수 있다는 것 자체가 행운이라고 생각합니다.', courseName: '병원마케팅 마스터 클래스' },
  { author: '박호진', date: '2025년 9월 6일', title: '강사님을 복사하고 싶어요..ㅎ', rating: 5, content: '실전 노하우를 아낌없이 공유해주시는 모습이 인상적이었습니다. 바로 적용 가능한 팁들이 가득했습니다. 강의에서 배운 내용을 실제 업무에 적용해보니, 상담 전환율이 크게 올라갔고 고객들의 반응도 달라졌습니다. 강사님의 경험에서 우러나오는 실전 팁들이 정말 값진 내용이었습니다.', courseName: '병원마케팅 마스터 클래스' },
  { author: 'supersonic', date: '2025년 9월 6일', title: '미쳤다 미쳤어', rating: 5, content: '이 가격에 이 퀄리티라니... 정말 미친 가성비입니다. 다른 고가 강의보다 훨씬 알차고 실전적입니다. 특히 실습 위주의 커리큘럼이 좋았고, 강의 후에도 커뮤니티에서 지속적인 피드백을 받을 수 있어서 혼자 공부하는 것보다 훨씬 효율적이었습니다.', courseName: '병원마케팅 마스터 클래스' },
  { author: 'Kiya', date: '2025년 9월 6일', title: '후회없는 선택', rating: 5, content: '진짜 아낌없이 주시는 강의였습니다. 제가 듣고 싶었고 이런 게 있었으면 좋겠다 했던 정보들을 하나부터 열까지 고심해서 정리한 커리큘럼이었습니다. 강의를 듣고 나서 업무 방향이 명확해졌고, 자신감도 생겼습니다. 주변 동료들에게도 적극 추천하고 있습니다.', courseName: '병원마케팅 마스터 클래스' },
  { author: '이정은', date: '2025년 9월 6일', title: '어디서도 볼 수 없는 미친 퀄리티에요!!', rating: 5, content: '요즘 200만원대 비싼 강의 많잖아요. 근데도 강사님이 준비를 안해오시고 실망을 많이 했는데 여기는 퀄리티가 정말 놀랍습니다. 매 강의마다 새로운 인사이트를 얻을 수 있어서 정말 만족스러웠습니다. 실무에서 바로 활용할 수 있는 템플릿과 도구들도 제공해주셔서 더욱 좋았습니다.', courseName: '병원마케팅 마스터 클래스' },
  { author: '이정은', date: '2025년 9월 6일', title: '병원마케팅 무료 강의를 방황하다가 여기로 정착했습니다', rating: 5, content: '여러 강의를 들어봤지만 이곳만큼 체계적이고 실전적인 곳은 없었습니다. 진짜 현장에서 바로 적용할 수 있는 내용들로 가득합니다. 강의 내용뿐만 아니라 수강생들과의 네트워킹도 큰 자산이 되었습니다.', courseName: '병원마케팅 마스터 클래스' },
  { author: '강보경', date: '2025년 9월 6일', title: '병원마케팅대행사 꼼꼼한 강의', rating: 5, content: '하나하나 꼼꼼하게 알려주시는 강의 덕분에 마케팅의 기초부터 실전까지 체계적으로 배울 수 있었습니다. 특히 병원 특화 마케팅 전략은 다른 곳에서는 배울 수 없는 귀중한 내용이었습니다. 강의를 듣고 실제로 매출이 30% 이상 증가했습니다.', courseName: '병원마케팅 마스터 클래스' },
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

function ReviewsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)

  return (
    <section className="w-full bg-white">
      {/* Hero Banner - gray bg */}
      <div className="w-full h-[424px] bg-gray-200 flex items-center justify-center">
        <span className="text-gray-500 text-sm">배너 이미지 1920*424px</span>
      </div>

      <div className="max-w-[1200px] mx-auto px-5 pb-16">
        <h1 className="text-3xl font-bold text-gray-900 mt-16 mb-8">조작없는 100% 수강생 후기</h1>

        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
          {REVIEWS.map((review, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-xl p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedReview(review)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedReview(review)
              }}
            >
              <span className="text-xs text-gray-400">{review.author} | {review.date}</span>
              <h3 className="text-base font-bold text-gray-900 mt-2 mb-2">{review.title}</h3>
              <StarRating rating={review.rating} />
              <p className="text-sm text-gray-500 mt-3 leading-relaxed">
                {review.content}
              </p>
            </div>
          ))}
        </div>

        <Pagination current={currentPage} total={30} onPageChange={setCurrentPage} />
      </div>

      {selectedReview && (
        <ReviewModal
          isOpen={true}
          onClose={() => setSelectedReview(null)}
          review={selectedReview}
        />
      )}
    </section>
  )
}

export default ReviewsPage
