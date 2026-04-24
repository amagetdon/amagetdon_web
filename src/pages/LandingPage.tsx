import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { landingCategoryService } from '../services/landingCategoryService'
import SeoHead from '../components/SeoHead'
import { isCourseClosed } from '../utils/courseStatus'
import { useAcademySettings } from '../hooks/useAcademySettings'
import type { LandingCategory, CourseWithInstructor } from '../types'

function LandingPage() {
  const { slug } = useParams<{ slug: string }>()
  const [category, setCategory] = useState<LandingCategory | null>(null)
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [loading, setLoading] = useState(true)
  const { closedVisualEffect } = useAcademySettings()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    landingCategoryService
      .getBySlug(slug)
      .then(async (cat) => {
        if (cancelled) return
        if (!cat) {
          setNotFound(true)
          return
        }
        setCategory(cat)
        const { data } = await supabase
          .from('courses')
          .select('*, instructor:instructors(id, name)')
          .contains('landing_category_ids', [cat.id])
          .eq('is_published', true)
          .or(`enrollment_start.is.null,enrollment_start.lte.${new Date().toISOString()}`)
          .order('sort_order')
        if (!cancelled) setCourses((data as CourseWithInstructor[]) ?? [])
      })
      .catch(() => { if (!cancelled) setNotFound(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  if (notFound) {
    return (
      <section className="w-full bg-white py-20">
        <div className="max-w-[1200px] mx-auto px-5 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">페이지를 찾을 수 없습니다</h1>
          <p className="text-sm text-gray-500 mb-6">요청하신 랜딩 페이지가 존재하지 않거나 비공개 상태입니다.</p>
          <Link to="/" className="inline-block px-5 py-2.5 bg-[#2ED573] text-white rounded-lg no-underline text-sm font-bold">홈으로</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full bg-white py-14 max-sm:py-10">
      {category && <SeoHead override={category.seo ?? undefined} />}
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{category?.name || (loading ? '...' : '')}</h1>
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
        ) : courses.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">등록된 강의가 없습니다.</div>
        ) : (
          <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-x-5 gap-y-8">
            {courses.map((course) => {
              const closed = closedVisualEffect !== false && isCourseClosed(course.enrollment_deadline)
              return (
                <Link key={course.id} to={`/course/${course.id}?from=${slug}`} className="no-underline group">
                  <div className={`bg-gray-100 rounded-xl aspect-video flex items-center justify-center mb-3 overflow-hidden ${closed ? 'opacity-60' : ''}`}>
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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

export default LandingPage
