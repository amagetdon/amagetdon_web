interface Review {
  category: string
  title: string
  author: string
  date: string
}

const SIDE_REVIEWS: Review[] = [
  {
    category: '보험 비즈니스 시크릿북',
    title: '무작정 따라 하기보다,\n스스로 판단할 수 있게 됐습니다.',
    author: '남**',
    date: '25-12-16',
  },
  {
    category: '보험 비즈니스 시크릿북',
    title: '그동안 감으로 하던 걸 정리해준 느낌이라\n만족합니다.',
    author: '심**',
    date: '25-12-16',
  },
  {
    category: '보험 비즈니스 시크릿북',
    title: '왜 계속 해맸는지 이유를 알게 된 느낌입니다',
    author: '남**',
    date: '25-12-16',
  },
]

function VideoPromo() {
  return (
    <section className="w-full bg-white py-14 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex gap-6 max-md:flex-col">
          {/* Video area */}
          <div className="flex-1 bg-gray-100 rounded-xl min-h-[300px] flex items-center justify-center">
            <span className="text-sm text-gray-400">이마겟돈 인트로 홍보 영상</span>
          </div>
          {/* Side reviews */}
          <div className="w-[360px] max-md:w-full flex flex-col divide-y divide-gray-200">
            {SIDE_REVIEWS.map((review, idx) => (
              <div key={idx} className="py-4 first:pt-0 last:pb-0 cursor-pointer">
                <p className="text-xs text-[#04F87F] font-bold mb-1">{review.category}</p>
                <p className="text-sm font-bold text-gray-900 whitespace-pre-line leading-snug mb-1">
                  {review.title}
                </p>
                <p className="text-xs text-gray-400">{review.author} | {review.date}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default VideoPromo
