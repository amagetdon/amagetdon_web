interface CurriculumItem {
  week: number
  title: string
}

interface CourseCard {
  dDay: number
  title: string
  instructor: string
  curriculum: CurriculumItem[]
}

const COURSES: CourseCard[] = [
  {
    dDay: 31,
    title: '한번 배워서 평생 써먹는,\nTOT설계사의 하이엔드 세일즈 비법',
    instructor: '김나영 강사',
    curriculum: [
      { week: 1, title: '한번 배워서 평생 써먹는, TOT설계사의 하이엔드 세일즈 비법' },
      { week: 2, title: '한번 배워서 평생 써먹는, TOT설계사의 하이엔드 세일즈 비법' },
      { week: 3, title: '한번 배워서 평생 써먹는, TOT설계사의 하이엔드 세일즈 비법' },
    ],
  },
  {
    dDay: 40,
    title: '한번 배워서 평생 써먹는,\nTOT설계사의 하이엔드 세일즈 비법',
    instructor: '김나영 강사',
    curriculum: [
      { week: 1, title: '한번 배워서 평생 써먹는, TOT설계사의 하이엔드 세일즈 비법' },
      { week: 2, title: '한번 배워서 평생 써먹는, TOT설계사의 하이엔드 세일즈 비법' },
      { week: 3, title: '한번 배워서 평생 써먹는, TOT설계사의 하이엔드 세일즈 비법' },
    ],
  },
]

function MyClassroomPage() {
  return (
    <>
      {/* 히어로 배너 */}
      <div className="bg-black h-[200px] w-full" />

      <div className="max-w-[800px] mx-auto px-6">
        <h1 className="text-3xl font-bold mt-16 mb-8">수강중인 클래스</h1>

        {COURSES.map((course, idx) => (
          <div key={idx} className="mb-16">
            {/* 상단 정보 */}
            <div className="flex items-start gap-6 max-sm:flex-col">
              <div className="bg-black rounded-xl w-[300px] h-[200px] shrink-0 max-sm:w-full border-2 border-[#04F87F]" />
              <div>
                <span className="bg-[#04F87F] text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-2">
                  남은 수강기간 D-{course.dDay}
                </span>
                <h2 className="text-xl font-bold whitespace-pre-line">{course.title}</h2>
                <p className="text-sm text-gray-400 mt-1">{course.instructor}</p>
              </div>
            </div>

            {/* 커리큘럼 리스트 */}
            <div className="border border-gray-200 rounded-xl mt-4 divide-y divide-gray-200">
              {course.curriculum.map((item) => (
                <div key={item.week} className="flex items-center justify-between px-6 py-4">
                  <p className="text-sm font-bold whitespace-pre-line">
                    {`[${item.week}주차]\n${item.title}`}
                  </p>
                  <button className="border border-gray-300 rounded-lg w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer bg-white">
                    <i className="ti ti-player-play text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default MyClassroomPage
