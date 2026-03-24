import { Link } from 'react-router-dom'

interface Review {
  name: string
  title: string
  content: string
  rating: number
}

const VIDEO_CARDS = [
  {
    badge: '수강생 김**',
    description: '어떻게 하루에 잠깐 일하고 월 4천을 벌까요?',
    title: '매출도 떡하지만 월급도 못 벌다가 결심에 딱 3개월 만에...',
    img: '1',
  },
  {
    badge: '수강생 빡**',
    description: '창업비 0원으로 월 2천찍는 방법은?',
    title: '인스타하나로 월 수천만원 번다는 것이 가능한 이유',
    img: '2',
  },
  {
    badge: '수강생 이**',
    description: '외주·출근 없이, 동일한 구조로 월 3천 만드는 법?',
    title: '매 달 3~5천 안정 궤도에 올려 놓는 비법 다 알려 드립니다',
    img: '3',
  },
  {
    badge: '수강생 김**',
    description: '퇴근후 3시간, 월 1억을 만든 구조의 차이는?',
    title: '사업이라 하기 쉬운건 아닌데 3시간만 투자한만에, 월 1억 찍는 방법',
    img: '4',
  },
]

const REVIEWS: Review[] = [
  {
    name: 'Kiya',
    title: 'SNS알고리즘 알고 싶다면 반드시 알아야 하는 수학의정석 같은 클래스',
    content: '사실 처음에는 반신반의하여 수업을 듣게되었습니다. 금액은 사실 어떻게보면 반 금액의 수업은 아니었지만 그만큼 가치는 있다고 생각합니다.',
    rating: 5,
  },
  {
    name: '(케이나LM).Just show up.',
    title: '머리 한대 맞은 기분',
    content: '이제 조금씩은 할 수 있을거 같아요. 편집기술 등 조금만 배우면 저도 잘할수 있을거 같아요. 열심히 할게에요~1년 뒤에 은우쌤 한번 만나 사고 싶네요~',
    rating: 5,
  },
  {
    name: '감유식',
    title: '어린데 나보다 멋진 분',
    content: '은우님의 강의를 듣고나면서, \'아 인스타는 이렇게 활용해야하는구나\' 라는 것을 배울 수 있었으며, 은우님의 추천 강의 자료와 강의는 자체에여 인연 것도 바꿀 수 있는 소중한 자산이 되었습니다.',
    rating: 5,
  },
  {
    name: '강은민',
    title: '환불까지 요청했던 수강생의 리얼 후기',
    content: '솔직히 2회차까지 강의를 들었을 때 이게 진짜 된다고? 싶었습니다. 내용이 생각보다 너무 간단하고 쉬워 보여서요. 그래서 영상을 금방 만들어 올렸는데 끼 시작했습니다...',
    rating: 5,
  },
  {
    name: '이정은',
    title: '어디서도 볼 수 없는 미친 퀄리티에요!!',
    content: '요즘 200만원대 비싼 강의 많잖아요 근데도 강사님이 준비를 안해오시고 실망을 많이 했는데 최형기대표님 강의는 퀄리티가 진짜 놀랍습니다.',
    rating: 5,
  },
]

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`text-base ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}>
          ★
        </span>
      ))}
    </div>
  )
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="relative flex-shrink-0 w-[200px]">
      <div className="review-flare" style={{ left: '80%' }}>
        <span className="review-flare-outer" />
        <span className="review-flare-line-a" />
        <span className="review-flare-line-b" />
        <span className="review-flare-line-c" />
      </div>
      <Link
        to="/reviews"
        className="relative flex h-[250px] bg-white rounded-2xl p-5 cursor-pointer no-underline flex-col border-2 border-[#04F87F]/40 shadow-[0_0_20px_rgba(4,248,127,0.15)] overflow-hidden"
      >
        <StarRating rating={review.rating} />
        <h3 className="text-[13px] font-bold text-gray-900 mt-2.5 mb-2 leading-snug line-clamp-2">{review.title}</h3>
        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-5 flex-1">
          {review.content}
        </p>
        <div className="mt-3 pt-2.5 border-t border-gray-100">
          <span className="text-[11px] text-gray-400">{review.name}</span>
        </div>
      </Link>
    </div>
  )
}

function RealResults() {
  const duplicatedReviews = [...REVIEWS, ...REVIEWS, ...REVIEWS, ...REVIEWS]

  return (
    <section className="relative w-full bg-[#0a0a0a] py-20 max-sm:py-12 overflow-hidden">
      <div
        className="absolute inset-x-0 bottom-0 h-[500px] pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,200,150,0.35) 0%, rgba(0,200,150,0.1) 40%, transparent 100%)' }}
      />
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="text-center mb-14">
          <p className="text-2xl max-sm:text-xl text-white font-medium mb-2">
            아마겟돈 수강생들이 직접 만들어낸
          </p>
          <h2 className="text-3xl max-sm:text-2xl text-white font-bold">리얼 성과 공개</h2>
        </div>

        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-x-8 gap-y-10">
          {VIDEO_CARDS.map((card, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <span className="inline-block bg-[#04F87F] text-black text-xs font-bold px-4 py-1.5 rounded-full mb-3">
                {card.badge}
              </span>
              <p className="text-sm text-gray-300 mb-4 text-center">{card.description}</p>
              <Link
                to="/reviews/results"
                className="relative rounded-xl overflow-hidden cursor-pointer group aspect-video w-full bg-gray-800 no-underline block"
              >
                <img
                  src={`https://placehold.co/580x360/${['1a2a1a', '1a1a2a', '2a1a1a', '1a2a2a'][idx]}/333333`}
                  alt="Video thumbnail"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 bg-white/80 rounded-full flex items-center justify-center">
                    <i className="ti ti-player-play-filled text-xl text-gray-900 ml-0.5" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-sm text-white font-bold leading-snug drop-shadow-lg">{card.title}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* 수강생 후기 마키 */}
      <div className="relative mt-24">
        <div className="text-center mb-10">
          <h3 className="text-2xl font-bold text-white mb-2">실제 강의 수강생 후기</h3>
          <p className="text-sm text-gray-400">조작된 후기는 절대 사용하지 않습니다.</p>
        </div>

        <div className="max-w-[1200px] mx-auto px-5 marquee-container">
          <div className="flex gap-5 animate-marquee w-fit py-10">
            {duplicatedReviews.map((review, idx) => (
              <ReviewCard key={idx} review={review} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default RealResults
