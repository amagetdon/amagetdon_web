import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

interface CurriculumItem {
  label: string
}

const CURRICULUM: CurriculumItem[] = [
  { label: '챕터 1: 1명 만나면, 최소 100만원 계약하는 TOT식 영업 비법' },
  { label: '챕터 2: 1명 만나면, 최소 3명 소개나오는 TOT식 고객 관리 시스템' },
  { label: '챕터 3: 1명 만나도 내가 원하는 고객만 끌어들이는 TOT식 고액 자산가 블랙홀 설계법' },
  { label: '챕터 4: 1명 만나도 내가 원하는 고객만 끌어들이는 TOT식 고액 자산가 블랙홀 설계법' },
  { label: '챕터 5: 1명 만나도 내가 원하는 고객만 끌어들이는 TOT식 고액 자산가 블랙홀 설계법' },
  { label: 'Q&A(마우리)' },
]

function CourseDetailPage() {
  const [searchParams] = useSearchParams()
  const isClosed = searchParams.get('closed') === 'true'

  const [timeLeft, setTimeLeft] = useState({ hours: 7, minutes: 11, seconds: 34, centiseconds: 99 })

  useEffect(() => {
    if (isClosed) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        let { hours, minutes, seconds, centiseconds } = prev
        centiseconds -= 1
        if (centiseconds < 0) {
          centiseconds = 99
          seconds -= 1
        }
        if (seconds < 0) {
          seconds = 59
          minutes -= 1
        }
        if (minutes < 0) {
          minutes = 59
          hours -= 1
        }
        if (hours < 0) {
          return { hours: 0, minutes: 0, seconds: 0, centiseconds: 0 }
        }
        return { hours, minutes, seconds, centiseconds }
      })
    }, 10)

    return () => clearInterval(interval)
  }, [isClosed])

  const pad = (n: number) => String(n).padStart(2, '0')

  const isExpired =
    isClosed || (timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0 && timeLeft.centiseconds === 0)

  const countdownText = isExpired
    ? '00:00:00'
    : `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)}:${pad(timeLeft.centiseconds)}`

  return (
    <section className="w-full bg-white py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex gap-8 max-md:flex-col">
          {/* Left */}
          <div className="flex-1">
            <div className="bg-gray-100 rounded-xl h-[300px] flex items-center justify-center">
              <span className="text-sm text-gray-400">O.T 및 광고 영상</span>
            </div>
            <div className="bg-gray-100 rounded-xl min-h-[600px] flex items-center justify-center mt-6">
              <span className="text-sm text-gray-400">숏랜딩 및 상세페이지 jpg 가로 800px</span>
            </div>
          </div>

          {/* Right */}
          <div className="w-[340px] max-md:w-full shrink-0">
            <div className="sticky top-4">
              <p className="text-sm text-[#04F87F] font-medium">김나영 강사</p>
              <h1 className="text-xl font-bold text-gray-900 mt-1">
                TOT 설계사의 하이엔드 세일즈 비법(강의명)
              </h1>

              <h3 className="font-bold mt-6 mb-3 text-gray-900">커리큘럼</h3>
              <ul className="space-y-2">
                {CURRICULUM.map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-600">
                    - {item.label}
                  </li>
                ))}
              </ul>

              <div className="border-t border-gray-200 my-6" />

              <p className="font-bold text-gray-900">결제 예상 금액</p>
              <p className="text-sm text-gray-400 line-through mt-2">정가 139,900원</p>
              <p className="text-4xl font-extrabold text-gray-900 mt-1">32,500원</p>

              <div className="text-center mt-6">
                <p className="text-sm text-gray-600">강의 모집 마감까지</p>
                <p className={`text-2xl font-bold mt-1 ${isExpired ? 'text-gray-400' : 'text-[#04F87F]'}`}>
                  {countdownText}
                </p>
              </div>

              {isExpired ? (
                <button className="w-full py-4 bg-gray-900 text-white font-bold text-center rounded-xl mt-4 cursor-pointer">
                  모집 마감
                </button>
              ) : (
                <button className="w-full py-4 bg-[#04F87F] text-white font-bold text-center rounded-xl mt-4 cursor-pointer">
                  선착순 마감 전에 신청하기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CourseDetailPage
