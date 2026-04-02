import { Link } from 'react-router-dom'
import type { CourseWithInstructor } from '../types'

function FreeCourses({ courses, loading }: { courses: CourseWithInstructor[]; loading: boolean }) {
  return (
    <section className="w-full bg-white py-14 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">무료 강의</h2>
          <Link
            to="/academy/free"
            className="flex items-center gap-2 px-5 py-2 border border-gray-300 rounded-full text-sm text-gray-600 bg-white cursor-pointer no-underline hover:bg-gray-50"
          >
            전체 보기 <span className="text-lg">→</span>
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-x-5 gap-y-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 rounded-xl aspect-video mb-3" />
                <div className="bg-gray-200 h-4 rounded w-3/4 mb-2" />
                <div className="bg-gray-200 h-3 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-x-5 gap-y-8">
            {courses.map((course) => (
              <Link key={course.id} to={`/course/${course.id}`} className="no-underline group">
                <div className="bg-gray-100 rounded-xl aspect-video flex items-center justify-center mb-3 overflow-hidden">
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm text-gray-400">썸네일<br />16:9</span>
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
  )
}

export default FreeCourses
