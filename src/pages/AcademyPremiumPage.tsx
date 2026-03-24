import { Link } from 'react-router-dom'
import ScheduleCalendar from '../components/ScheduleCalendar'
import { useCourses } from '../hooks/useCourses'

function AcademyPremiumPage() {
  const { courses, loading } = useCourses('premium')

  return (
    <>
      <section className="w-full bg-black py-20 max-sm:py-14">
        <div className="max-w-[1200px] mx-auto px-5">
          <span className="inline-block bg-white/10 text-white text-xs font-medium px-4 py-1.5 rounded-full mb-4">
            프리미엄 강의
          </span>
          <h1 className="text-3xl max-sm:text-2xl font-bold text-white leading-snug">
            프리미엄 아마겟돈 클래스
          </h1>
        </div>
      </section>

      <ScheduleCalendar title="이달의 프리미엄 강의를 확인하세요" linkTo="/academy/premium" />

      <section className="w-full bg-white py-14 max-sm:py-10">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">프리미엄 강의</h2>
          </div>
          {loading ? (
            <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-x-5 gap-y-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 rounded-xl h-[235px] mb-3" />
                  <div className="bg-gray-200 h-4 rounded w-3/4 mb-2" />
                  <div className="bg-gray-200 h-3 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-x-5 gap-y-8">
              {courses.map((course) => (
                <Link key={course.id} to={`/course/${course.id}`} className="no-underline group">
                  <div className="bg-gray-100 rounded-xl h-[235px] flex items-center justify-center mb-3 overflow-hidden">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm text-gray-400">썸네일<br />380*235px</span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-gray-900 whitespace-pre-line leading-snug mb-1">
                    {course.title}
                  </p>
                  <p className="text-xs text-gray-400">{course.instructor?.name ? `강사 ${course.instructor.name}` : ''}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default AcademyPremiumPage
