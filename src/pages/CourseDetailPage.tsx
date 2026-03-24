import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useCourse } from '../hooks/useCourses'

function CourseDetailPage() {
  const { id } = useParams()
  const courseId = id ? Number(id) : null
  const { course, loading } = useCourse(courseId)
  const [searchParams] = useSearchParams()
  const isClosed = searchParams.get('closed') === 'true'

  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, centiseconds: 0 })

  useEffect(() => {
    if (!course?.enrollment_deadline || isClosed) return

    const deadline = new Date(course.enrollment_deadline).getTime()

    const updateTimer = () => {
      const now = Date.now()
      const diff = deadline - now
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, centiseconds: 0 })
        return
      }
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      const centiseconds = Math.floor((diff % 1000) / 10)
      setTimeLeft({ hours, minutes, seconds, centiseconds })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 10)
    return () => clearInterval(interval)
  }, [course?.enrollment_deadline, isClosed])

  const pad = (n: number) => String(n).padStart(2, '0')
  const isExpired = isClosed || (timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0 && timeLeft.centiseconds === 0)
  const countdownText = isExpired ? '00:00:00' : `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)}:${pad(timeLeft.centiseconds)}`

  if (loading) {
    return (
      <section className="w-full bg-white py-10">
        <div className="max-w-[1200px] mx-auto px-5 animate-pulse">
          <div className="flex gap-8 max-md:flex-col">
            <div className="flex-1">
              <div className="bg-gray-200 rounded-xl h-[300px]" />
              <div className="bg-gray-200 rounded-xl h-[600px] mt-6" />
            </div>
            <div className="w-[340px] space-y-4">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-6 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-full" />
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (!course) {
    return (
      <section className="w-full bg-white py-10">
        <div className="max-w-[1200px] mx-auto px-5 text-center text-gray-500 py-20">
          강의 정보를 찾을 수 없습니다.
        </div>
      </section>
    )
  }

  return (
    <section className="w-full bg-white py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex gap-8 max-md:flex-col">
          <div className="flex-1">
            <div className="bg-gray-100 rounded-xl h-[300px] flex items-center justify-center overflow-hidden">
              {course.video_url ? (
                <video src={course.video_url} controls className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm text-gray-400">O.T 및 광고 영상</span>
              )}
            </div>
            <div className="bg-gray-100 rounded-xl min-h-[600px] flex items-center justify-center mt-6 overflow-hidden">
              {course.landing_image_url ? (
                <img src={course.landing_image_url} alt={course.title} className="w-full" />
              ) : (
                <span className="text-sm text-gray-400">숏랜딩 및 상세페이지 jpg 가로 800px</span>
              )}
            </div>
          </div>

          <div className="w-[340px] max-md:w-full shrink-0">
            <div className="sticky top-4">
              <p className="text-sm text-[#04F87F] font-medium">{course.instructor?.name} 강사</p>
              <h1 className="text-xl font-bold text-gray-900 mt-1">{course.title}</h1>

              {course.curriculum_items.length > 0 && (
                <>
                  <h3 className="font-bold mt-6 mb-3 text-gray-900">커리큘럼</h3>
                  <ul className="space-y-2">
                    {course.curriculum_items.map((item) => (
                      <li key={item.id} className="text-sm text-gray-600">- {item.label}</li>
                    ))}
                  </ul>
                </>
              )}

              <div className="border-t border-gray-200 my-6" />

              <p className="font-bold text-gray-900">결제 예상 금액</p>
              {course.original_price && (
                <p className="text-sm text-gray-400 line-through mt-2">정가 {course.original_price.toLocaleString()}원</p>
              )}
              <p className="text-4xl font-extrabold text-gray-900 mt-1">
                {course.sale_price ? `${course.sale_price.toLocaleString()}원` : course.course_type === 'free' ? '무료' : '가격 미정'}
              </p>

              {course.enrollment_deadline && (
                <div className="text-center mt-6">
                  <p className="text-sm text-gray-600">강의 모집 마감까지</p>
                  <p className={`text-2xl font-bold mt-1 ${isExpired ? 'text-gray-400' : 'text-[#04F87F]'}`}>
                    {countdownText}
                  </p>
                </div>
              )}

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
