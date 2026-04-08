import { useState, useEffect, Fragment } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useCourse } from '../hooks/useCourses'
import { useAuth } from '../contexts/AuthContext'
import { purchaseService } from '../services/purchaseService'
import { Dialog, Transition } from '@headlessui/react'
import VideoEmbed from '../components/VideoEmbed'
import CourseReviewSection from '../components/CourseReviewSection'
import toast from 'react-hot-toast'

function CourseDetailPage() {
  const { id } = useParams()
  const courseId = id ? Number(id) : null
  const { course, loading } = useCourse(courseId)
  const [searchParams] = useSearchParams()
  const isClosed = searchParams.get('closed') === 'true'
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()

  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [owned, setOwned] = useState(false)
  const [ownershipLoading, setOwnershipLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => {
    if (!course?.enrollment_deadline || isClosed) return

    const deadline = new Date(course.enrollment_deadline).getTime()

    const updateTimer = () => {
      const now = Date.now()
      const diff = deadline - now
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 })
        return
      }
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setTimeLeft({ hours, minutes, seconds })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [course?.enrollment_deadline, isClosed])

  useEffect(() => {
    setOwned(false)
    setOwnershipLoading(true)
    if (!user || !courseId) {
      setOwnershipLoading(false)
      return
    }
    const checkOwned = async () => {
      try {
        const result = await purchaseService.checkOwnership(user.id, courseId)
        setOwned(result)
      } catch {
        setOwned(false)
      } finally {
        setOwnershipLoading(false)
      }
    }
    checkOwned()
  }, [user, courseId])

  const pad = (n: number) => String(n).padStart(2, '0')
  const hasDeadline = !!course?.enrollment_deadline
  const isExpired = isClosed || (hasDeadline && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0)
  const countdownText = isExpired ? '00:00:00' : `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)}`

  const isFree = course?.course_type === 'free'
  const price = isFree ? 0 : (course?.sale_price ?? 0)

  const handlePurchaseClick = () => {
    if (!user) {
      navigate('/login')
      return
    }

    if (owned) {
      navigate('/my-classroom')
      return
    }

    if (isFree) {
      handleEnrollFree()
      return
    }

    setConfirmOpen(true)
  }

  const handleEnrollFree = async () => {
    if (!user || !course || !courseId) return
    setPurchasing(true)
    try {
      await purchaseService.enrollFree(
        user.id,
        { courseId },
        course.title,
        course.duration_days
      )
      toast.success('강의가 등록되었습니다!')
      setOwned(true)
      await refreshProfile()
    } catch (err) {
      const message = err instanceof Error ? err.message : '등록에 실패했습니다.'
      toast.error(message)
    } finally {
      setPurchasing(false)
    }
  }

  const handleConfirmPurchase = async () => {
    if (!user || !course || !courseId || !profile) return
    setPurchasing(true)
    try {
      await purchaseService.purchaseWithPoints(
        user.id,
        { courseId },
        course.title,
        price,
        course.duration_days
      )
      toast.success('강의를 구매했습니다!')
      setOwned(true)
      setConfirmOpen(false)
      await refreshProfile()
    } catch (err) {
      const message = err instanceof Error ? err.message : '구매에 실패했습니다.'
      toast.error(message)
    } finally {
      setPurchasing(false)
    }
  }

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

  const renderActionButton = () => {
    if (isExpired && !owned) {
      return (
        <button className="w-full py-4 bg-gray-900 text-white font-bold text-center rounded-xl mt-4 cursor-pointer">
          모집 마감
        </button>
      )
    }

    if (ownershipLoading) {
      return (
        <button disabled className="w-full py-4 bg-gray-300 text-white font-bold text-center rounded-xl mt-4 cursor-not-allowed">
          확인 중...
        </button>
      )
    }

    if (owned) {
      return (
        <button
          onClick={() => navigate('/my-classroom')}
          className="w-full py-4 bg-gray-900 text-white font-bold text-center rounded-xl mt-4 cursor-pointer"
        >
          내 강의실로 이동
        </button>
      )
    }

    return (
      <button
        onClick={handlePurchaseClick}
        disabled={purchasing}
        className="w-full py-4 bg-[#2ED573] text-white font-bold text-center rounded-xl mt-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {purchasing ? '처리 중...' : isFree ? '무료로 신청하기' : '선착순 마감 전에 신청하기'}
      </button>
    )
  }

  return (
    <>
      <section className="w-full bg-white py-10">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="flex gap-8 max-md:flex-col">
            <div className="flex-1">
              <div className="bg-gray-100 rounded-xl h-[300px] flex items-center justify-center overflow-hidden">
                {course.video_url ? (
                  <VideoEmbed url={course.video_url} className="w-full" />
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
                <p className="text-sm text-[#2ED573] font-medium">{course.instructor?.name} 강사</p>
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
                {course.original_price != null && course.original_price > 0 && (
                  <p className="text-sm text-gray-400 line-through mt-2">정가 {course.original_price.toLocaleString()}원</p>
                )}
                <p className="text-4xl font-extrabold text-gray-900 mt-1">
                  {course.course_type === 'free' || (!course.sale_price && !course.original_price) ? '무료' : course.sale_price ? `${course.sale_price.toLocaleString()}원` : '가격 미정'}
                </p>

                {user && profile && !isFree && (
                  <p className="text-sm text-gray-500 mt-2">
                    보유 포인트: <span className="font-bold text-gray-900">{profile.points.toLocaleString()}P</span>
                  </p>
                )}

                {course.enrollment_deadline && (
                  <div className="text-center mt-6">
                    <p className="text-sm text-gray-600">강의 모집 마감까지</p>
                    <p className={`text-2xl font-bold mt-1 ${isExpired ? 'text-gray-400' : 'text-[#2ED573]'}`}>
                      {countdownText}
                    </p>
                  </div>
                )}

                {renderActionButton()}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 리뷰 섹션 */}
      <section className="w-full bg-gray-50 py-10">
        <div className="max-w-[1200px] mx-auto px-5">
          <CourseReviewSection courseId={course.id} courseName={course.title} />
        </div>
      </section>

      {/* 구매 확인 모달 */}
      <Transition appear show={confirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setConfirmOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                  <Dialog.Title className="text-lg font-bold text-gray-900">
                    구매 확인
                  </Dialog.Title>
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    <p>강의명: <span className="font-medium text-gray-900">{course.title}</span></p>
                    <p>결제 금액: <span className="font-bold text-gray-900">{price.toLocaleString()}P</span></p>
                    <p>보유 포인트: <span className="font-bold text-gray-900">{(profile?.points ?? 0).toLocaleString()}P</span></p>
                    <p>결제 후 잔액: <span className="font-bold text-[#2ED573]">{((profile?.points ?? 0) - price).toLocaleString()}P</span></p>
                  </div>

                  {(profile?.points ?? 0) < price ? (
                    <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                      포인트가 부족합니다. 충전 후 다시 시도해 주세요.
                    </div>
                  ) : null}

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => setConfirmOpen(false)}
                      className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-700 cursor-pointer bg-white"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleConfirmPurchase}
                      disabled={purchasing || (profile?.points ?? 0) < price}
                      className="flex-1 rounded-xl bg-[#2ED573] py-3 text-sm font-bold text-white cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {purchasing ? '처리 중...' : '구매하기'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}

export default CourseDetailPage
