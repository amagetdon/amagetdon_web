import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { CourseWithInstructor, Instructor, EbookWithInstructor } from '../types'

function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''

  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [ebooks, setEbooks] = useState<EbookWithInstructor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!query.trim()) {
      setCourses([])
      setInstructors([])
      setEbooks([])
      setLoading(false)
      return
    }

    let cancelled = false
    const search = async () => {
      try {
        setLoading(true)
        const keyword = `%${query}%`

        const [coursesRes, instructorsRes, ebooksRes] = await Promise.all([
          supabase.from('courses').select('*, instructor:instructors(id, name)').or(`title.ilike.${keyword},description.ilike.${keyword}`),
          supabase.from('instructors').select('*').or(`name.ilike.${keyword},title.ilike.${keyword},bio.ilike.${keyword}`),
          supabase.from('ebooks').select('*, instructor:instructors(id, name)').or(`title.ilike.${keyword}`),
        ])

        if (cancelled) return
        setCourses((coursesRes.data || []) as CourseWithInstructor[])
        setInstructors((instructorsRes.data || []) as Instructor[])
        setEbooks((ebooksRes.data || []) as EbookWithInstructor[])
      } catch {
        if (!cancelled) {
          setCourses([])
          setInstructors([])
          setEbooks([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    search()
    return () => { cancelled = true }
  }, [query])

  const totalResults = courses.length + instructors.length + ebooks.length

  return (
    <>
      <div className="bg-black h-[200px] w-full" />
      <div className="max-w-[1200px] mx-auto px-5 py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          &ldquo;{query}&rdquo; 검색 결과
        </h1>
        <p className="text-sm text-gray-500 mb-10">
          {loading ? '검색 중...' : `총 ${totalResults}개의 결과`}
        </p>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="bg-gray-200 rounded-xl w-[200px] h-[130px] shrink-0" />
                <div className="flex-1 space-y-2 py-2">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : totalResults === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <i className="ti ti-search text-4xl block mb-3" />
            <p className="text-lg">검색 결과가 없습니다.</p>
            <p className="text-sm mt-1">다른 키워드로 검색해보세요.</p>
          </div>
        ) : (
          <>
            {instructors.length > 0 && (
              <div className="mb-12">
                <h2 className="text-lg font-bold text-gray-900 mb-4">강사</h2>
                <div className="space-y-4">
                  {instructors.map((inst) => (
                    <Link key={inst.id} to={`/instructors/${inst.id}`} className="no-underline flex items-start gap-10 max-sm:flex-col max-sm:items-center max-sm:gap-4 max-sm:text-center border border-gray-200 rounded-2xl p-6 max-sm:p-5 hover:shadow-md transition-shadow">
                      <div className="w-52 h-52 max-sm:w-24 max-sm:h-24 rounded-full bg-gray-200 shrink-0 overflow-hidden self-center">
                        {inst.image_url && <img src={inst.image_url} alt={inst.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1 max-sm:w-full">
                        <div className="flex items-center gap-2 mb-1 max-sm:justify-center">
                          <p className="text-lg max-sm:text-base font-bold text-gray-900">{inst.name}</p>
                          <span className="text-sm text-gray-400">{inst.title}</span>
                        </div>
                        {inst.headline && <p className="text-sm text-gray-600 mb-2">{inst.headline}</p>}
                        {inst.bio && <p className="text-sm text-gray-400 line-clamp-6 leading-relaxed mb-2 whitespace-pre-line">{inst.bio}</p>}
                        {inst.bio_bullets && inst.bio_bullets.length > 0 && (
                          <ul className="text-sm text-gray-500 space-y-0.5 mb-2 list-none p-0">
                            {inst.bio_bullets.slice(0, 3).map((b, i) => (
                              <li key={i} className="flex items-start gap-1.5 max-sm:justify-center">
                                <span className="text-[#2ED573] shrink-0 mt-0.5">•</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {inst.careers && inst.careers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 max-sm:justify-center">
                            {inst.careers.slice(0, 5).map((c, i) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{c}</span>
                            ))}
                            {inst.careers.length > 5 && <span className="text-xs text-gray-400">+{inst.careers.length - 5}</span>}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {courses.length > 0 && (
              <div className="mb-12">
                <h2 className="text-lg font-bold text-gray-900 mb-4">강의</h2>
                <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-5">
                  {courses.map((course) => (
                    <Link key={course.id} to={`/course/${course.id}`} className="no-underline">
                      <div className="bg-gray-100 rounded-xl aspect-video flex items-center justify-center mb-3 overflow-hidden">
                        {course.thumbnail_url ? (
                          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm text-gray-400">썸네일</span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-gray-900 mb-1">{course.title}</p>
                      <p className="text-xs text-gray-400">{course.instructor?.name}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {ebooks.length > 0 && (
              <div className="mb-12">
                <h2 className="text-lg font-bold text-gray-900 mb-4">전자책</h2>
                <div className="grid grid-cols-5 max-lg:grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2 gap-5">
                  {ebooks.map((ebook) => (
                    <Link key={ebook.id} to={`/ebook/${ebook.id}`} className="no-underline">
                      <div className="bg-gray-100 rounded-xl aspect-[3/4] flex items-center justify-center mb-3 overflow-hidden">
                        {ebook.thumbnail_url ? (
                          <img src={ebook.thumbnail_url} alt={ebook.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm text-gray-400">썸네일</span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-gray-900 mb-1">{ebook.title}</p>
                      <p className="text-xs text-gray-400">{ebook.instructor?.name}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

export default SearchPage
