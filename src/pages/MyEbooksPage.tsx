interface EbookCard {
  dDay: number
  title: string
  instructor: string
}

const EBOOKS: EbookCard[] = [
  {
    dDay: 31,
    title: '한번 배워서 평생 써먹는,\nTOT설계사의 하이엔드 세일즈 비법',
    instructor: '김나영 강사',
  },
  {
    dDay: 31,
    title: '한번 배워서 평생 써먹는,\nTOT설계사의 하이엔드 세일즈 비법',
    instructor: '김나영 강사',
  },
]

function MyEbooksPage() {
  return (
    <>
      {/* 히어로 배너 */}
      <div className="bg-black h-[200px] w-full" />

      <div className="max-w-[800px] mx-auto px-6">
        <h1 className="text-3xl font-bold mt-16 mb-8">수강중인 전자책</h1>

        {EBOOKS.map((ebook, idx) => (
          <div key={idx} className="flex items-start gap-6 mb-12 max-sm:flex-col">
            <div className="bg-black rounded-xl w-[300px] h-[200px] border-2 border-[#04F87F] shrink-0 max-sm:w-full" />
            <div>
              <span className="bg-[#04F87F] text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-2">
                남은 수강기간 D-{ebook.dDay}
              </span>
              <h2 className="text-xl font-bold whitespace-pre-line">{ebook.title}</h2>
              <p className="text-sm text-gray-400 mt-1">{ebook.instructor}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default MyEbooksPage
