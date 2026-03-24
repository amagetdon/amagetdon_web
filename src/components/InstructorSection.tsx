import { useState } from 'react'
import { Link } from 'react-router-dom'

interface InstructorData {
  id: number
  name: string
  role: string
  headline: string
  bio: string[]
  image: string
}

const INSTRUCTORS: InstructorData[] = [
  {
    id: 1,
    name: '최형기 대표',
    role: '병원마케팅 대행사 대표',
    headline: '직장인에서 시작해 월매출 3억\n병원 마케팅 대행사 대표로',
    bio: [
      '저는 평범한 직장인이었습니다.',
      '하지만 아마겟돈 클래스를 통해 보험 비즈니스를 시작했고, 단 3개월 만에 매출 3억 원을 달성했습니다.',
      '지금은 제 사업을 운영하며 많은 사람들에게 기회를 제공하고 있습니다.',
      '여러분도 할 수 있습니다. 저와 함께 시작해보세요!',
    ],
    image: 'https://placehold.co/280x360/e5e7eb/999999?text=최형기',
  },
  {
    id: 2,
    name: '김나영 강사',
    role: '전 세계 0.1% TOT, 자산관리 대표',
    headline: '전 세계 상위 0.1%\nMDRT·COT·TOT를 모두 달성',
    bio: [
      '20대 초반, 특별한 스펙 없이 보험 업계에 들어왔습니다.',
      '영업보다 구조·원리·기준을 먼저 배우는 데 집중했고, 그 선택이 TOT(전 세계 상위 0.1%)로 이어졌습니다.',
      '보험은 말 잘하는 사람이 아니라 정확한 기준으로 설계할 줄 아는 사람이 오래갑니다.',
    ],
    image: 'https://placehold.co/280x360/e5e7eb/999999?text=김나영',
  },
  {
    id: 3,
    name: '은우',
    role: '인스타 알고리즘 전문가',
    headline: '인스타 하나로\n억대 매출을 만드는 비법',
    bio: [
      '인스타그램 알고리즘을 분석하고 활용하는 전문가입니다.',
      '수많은 사업자들이 인스타를 통해 매출을 올리는 방법을 알려드리고 있습니다.',
    ],
    image: 'https://placehold.co/280x360/e5e7eb/999999?text=은우',
  },
  {
    id: 4,
    name: '코코',
    role: '공유 숙박업, 월 천만원 수익',
    headline: '월 300 자동 수익 프로세스\n에이비앤비 & 단기임대',
    bio: [
      '공유 숙박업으로 월 천만 원 이상의 수익을 만들고 있습니다.',
      '누구나 시작할 수 있는 단기임대 비즈니스의 A to Z를 알려드립니다.',
    ],
    image: 'https://placehold.co/280x360/e5e7eb/999999?text=코코',
  },
]

function InstructorSection() {
  const [activeIndex, setActiveIndex] = useState(0)
  const instructor = INSTRUCTORS[activeIndex]

  return (
    <section className="w-full bg-white py-16 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            아마겟돈 클래스 강사를 소개합니다.
          </h2>
          <p className="text-sm text-gray-500">
            현장에서 이미 검증된 셀러와 전문가들로 구성된 최고의 강의진
          </p>
        </div>

        <div className="relative bg-white rounded-2xl overflow-hidden">
          {/* Carousel navigation */}
          <button
            onClick={() => setActiveIndex((prev) => (prev - 1 + INSTRUCTORS.length) % INSTRUCTORS.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center cursor-pointer border-none"
            aria-label="이전 강사"
          >
            <i className="ti ti-chevron-left text-xl text-gray-500" />
          </button>
          <button
            onClick={() => setActiveIndex((prev) => (prev + 1) % INSTRUCTORS.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center cursor-pointer border-none"
            aria-label="다음 강사"
          >
            <i className="ti ti-chevron-right text-xl text-gray-500" />
          </button>

          {/* Instructor card */}
          <div className="bg-[#024d2a] rounded-2xl p-10 max-sm:p-6 flex items-center gap-10 max-md:flex-col">
            <div className="shrink-0">
              <img
                src={instructor.image}
                alt={instructor.name}
                className="rounded-xl w-[280px] max-md:w-full"
              />
            </div>
            <div className="flex-1 text-white">
              <h3 className="text-xl font-bold mb-4 whitespace-pre-line">
                {instructor.headline}
              </h3>
              {instructor.bio.map((text, idx) => (
                <p key={idx} className="text-sm leading-relaxed mb-3 text-white/80">
                  {text}
                </p>
              ))}
              <p className="text-sm mt-4 text-white/60">- {instructor.name} -</p>
            </div>
          </div>

          {/* Instructor thumbnails / indicators */}
          <div className="flex items-center justify-center gap-8 mt-8">
            {INSTRUCTORS.map((inst, idx) => (
              <button
                key={inst.id}
                onClick={() => setActiveIndex(idx)}
                className={`flex flex-col items-center gap-2 bg-transparent border-none cursor-pointer transition-opacity ${
                  activeIndex === idx ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                }`}
              >
                <img
                  src={inst.image}
                  alt={inst.name}
                  className={`w-12 h-12 rounded-full object-cover ${
                    activeIndex === idx ? 'ring-2 ring-[#04F87F]' : ''
                  }`}
                />
                <span className={`text-xs ${activeIndex === idx ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                  {inst.name}
                </span>
              </button>
            ))}
          </div>

          {/* Link to full list */}
          <div className="text-center mt-6">
            <Link
              to="/instructors"
              className="text-sm text-[#04F87F] font-medium no-underline hover:underline"
            >
              전체 강사 보기 →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default InstructorSection
