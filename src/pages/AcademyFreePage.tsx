import { useState } from 'react'
import { Link } from 'react-router-dom'
import ScheduleCalendar from '../components/ScheduleCalendar'
import Pagination from '../components/Pagination'
import HeroSection from '../components/HeroSection'
import { useCourses } from '../hooks/useCourses'
import { isCourseClosed } from '../utils/courseStatus'
import { useAcademySettings } from '../hooks/useAcademySettings'
import { useSectionConfig } from '../hooks/useSectionSettings'
import EditableSectionTitle from '../components/admin/EditableSectionTitle'

function AcademyFreePage() {
  const { courses, loading } = useCourses('free')
  const { closedVisualEffect } = useAcademySettings()
  const section = useSectionConfig('academy_free_courses')
  const perPage = section.count ?? 9
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(courses.length / perPage))
  const pagedCourses = courses.slice((currentPage - 1) * perPage, currentPage * perPage)

  return (
    <>
      <HeroSection pageKey="academy_free_hero" />

      <ScheduleCalendar title="이달의 무료강의를 확인하세요" linkTo="/academy/free" />

      <section className="w-full bg-white py-14 max-sm:py-10">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="flex items-center justify-between mb-6">
            <EditableSectionTitle
              sectionKey="academy_free_courses"
              config={section}
              className="text-2xl font-bold text-gray-900 min-w-0"
              editableCount
              minCount={3}
              maxCount={30}
            />
          </div>
          {loading ? (
            <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-x-5 gap-y-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 rounded-xl aspect-video mb-3" />
                  <div className="bg-gray-200 h-4 rounded w-3/4 mb-2" />
                  <div className="bg-gray-200 h-3 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-x-5 gap-y-8">
                {pagedCourses.map((course) => {
                  const closed = closedVisualEffect !== false && isCourseClosed(course.enrollment_deadline)
                  return (
                    <Link key={course.id} to={`/course/${course.id}`} className="no-underline group">
                      <div className={`bg-gray-100 rounded-xl aspect-video flex items-center justify-center mb-3 overflow-hidden ${closed ? 'opacity-60' : ''}`}>
                        {course.thumbnail_url ? (
                          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
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
              {totalPages > 1 && (
                <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
              )}
            </>
          )}
        </div>
      </section>
    </>
  )
}

export default AcademyFreePage
