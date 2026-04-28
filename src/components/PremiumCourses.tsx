import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { courseService } from '../services/courseService'
import { isCourseClosed } from '../utils/courseStatus'
import { useAcademySettings } from '../hooks/useAcademySettings'
import { imgUrl } from '../lib/image'
import type { CourseWithInstructor } from '../types'

function PremiumCourses({ courses: propCourses, loading: propLoading }: { courses?: CourseWithInstructor[]; loading?: boolean } = {}) {
  const [selfCourses, setSelfCourses] = useState<CourseWithInstructor[]>([])
  const [selfLoading, setSelfLoading] = useState(!propCourses)
  const courses = propCourses ?? selfCourses
  const loading = propLoading ?? selfLoading
  const { closedVisualEffect } = useAcademySettings()

  useEffect(() => {
    if (propCourses) return
    courseService.getAllPublic('premium').then(setSelfCourses).catch(() => {}).finally(() => setSelfLoading(false))
  }, [propCourses])

  if (!loading && courses.length === 0) return null

  return (
    <section className="w-full bg-white py-14 max-sm:py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex items-center justify-between mb-6 gap-4">
          <h2 className="text-2xl font-bold text-gray-900 min-w-0">유료 강의</h2>
          <Link
            to="/academy/premium"
            className="flex items-center gap-2 px-5 py-2 border border-gray-300 rounded-full text-sm text-gray-600 bg-white cursor-pointer no-underline hover:bg-gray-50 whitespace-nowrap"
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
            {courses.map((course) => {
              const closed = closedVisualEffect !== false && isCourseClosed(course.enrollment_deadline)
              return (
                <Link key={course.id} to={`/course/${course.id}`} className="no-underline group">
                  <div className={`bg-gray-100 rounded-xl aspect-video flex items-center justify-center mb-3 overflow-hidden ${closed ? 'opacity-60' : ''}`}>
                    {course.thumbnail_url ? (
                      <img src={imgUrl(course.thumbnail_url, 'thumb')} alt={course.title} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm text-gray-400">썸네일<br />16:9</span>
                    )}
                  </div>
                  <p className={`text-sm font-bold whitespace-pre-line leading-snug mb-1 ${closed ? 'text-gray-400' : 'text-gray-900'}`}>
                    <span className={closed ? 'line-through' : ''}>{course.title}</span>
                    {closed && <span className="ml-1 text-xs font-medium">(마감)</span>}
                  </p>
                  <p className="text-xs text-gray-400">{course.instructor?.name ? `강사 ${course.instructor.name}` : ''}</p>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default PremiumCourses
