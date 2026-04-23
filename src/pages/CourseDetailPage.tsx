import { useState, useEffect, Fragment } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useCourse } from '../hooks/useCourses'
import { useAuth } from '../contexts/AuthContext'
import { purchaseService } from '../services/purchaseService'
import { Dialog, Transition } from '@headlessui/react'
import VideoEmbed from '../components/VideoEmbed'
import CourseReviewSection from '../components/CourseReviewSection'
import SeoHead from '../components/SeoHead'
import toast from 'react-hot-toast'
import { couponService } from '../services/couponService'
import { webhookService } from '../services/webhookService'
import CouponSelector from '../components/CouponSelector'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { paymentService } from '../services/paymentService'
import { supabase } from '../lib/supabase'
import type { Coupon } from '../types'
import { textToHtml } from '../utils/richText'
import { isCourseClosed } from '../utils/courseStatus'
import { useAcademySettings } from '../hooks/useAcademySettings'

function CourseDetailPage() {
  const { id } = useParams()
  const courseId = id ? Number(id) : null
  const { course, loading } = useCourse(courseId)
  const [searchParams] = useSearchParams()
  const isClosed = searchParams.get('closed') === 'true'
  const navigate = useNavigate()
  const { user, profile, refreshProfile, isAdmin } = useAuth()
  const { closedVisualEffect } = useAcademySettings()

  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [owned, setOwned] = useState(false)
  const [ownershipLoading, setOwnershipLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [enrollmentCount, setEnrollmentCount] = useState(0)
  const [relatedCourses, setRelatedCourses] = useState<Array<{ id: number; title: string; thumbnail_url: string | null; sale_price: number | null; course_type: string; enrollment_deadline: string | null }>>([])
  const [myCoupons, setMyCoupons] = useState<Coupon[]>([])
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)
  const [payMethod, setPayMethod] = useState<'points' | 'toss'>('toss')
  const [tossLoading, setTossLoading] = useState(false)

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

  useEffect(() => {
    if (!user) return
    couponService.getUsableCoupons(user.id).then(setMyCoupons).catch(() => {})
  }, [user])

  // 정원 확인 (현재 구매자 수)
  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    Promise.resolve(supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('course_id', courseId))
      .then(({ count }) => { if (!cancelled) setEnrollmentCount(count ?? 0) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [courseId])

  // 관련 강의 로드
  useEffect(() => {
    if (!course?.related_course_ids || course.related_course_ids.length === 0) {
      setRelatedCourses([])
      return
    }
    let cancelled = false
    const nowIso = new Date().toISOString()
    Promise.resolve(
      supabase
        .from('courses')
        .select('id, title, thumbnail_url, sale_price, course_type, enrollment_deadline')
        .in('id', course.related_course_ids)
        .eq('is_published', true)
        .or(`enrollment_start.is.null,enrollment_start.lte.${nowIso}`)
    ).then(({ data }) => {
      if (!cancelled) setRelatedCourses((data ?? []) as typeof relatedCourses)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [course?.related_course_ids])

  const pad = (n: number) => String(n).padStart(2, '0')
  const hasDeadline = !!course?.enrollment_deadline
  const isExpired = isClosed || (hasDeadline && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0)
  const countdownText = isExpired ? '00:00:00' : `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)}`

  const isFree = course?.course_type === 'free'
  const now = Date.now()
  const discountActive = !!course && !isFree && (
    !course.discount_start && !course.discount_end ? true :
    (!course.discount_start || new Date(course.discount_start).getTime() <= now) &&
    (!course.discount_end || new Date(course.discount_end).getTime() > now)
  )
  const displayedPrice = isFree ? 0
    : discountActive && course?.sale_price != null ? course.sale_price
    : course?.original_price ?? course?.sale_price ?? 0
  const price = displayedPrice
  const couponDiscount = selectedCoupon && price >= (selectedCoupon.min_purchase || 0)
    ? selectedCoupon.discount_type === 'percent'
      ? Math.min(
          Math.floor(price * selectedCoupon.discount_value / 100),
          selectedCoupon.max_discount || Infinity,
          price
        )
      : Math.min(selectedCoupon.discount_value, price)
    : 0
  const finalPrice = Math.max(0, price - couponDiscount)

  const handlePurchaseClick = () => {
    if (!user) {
      navigate('/login')
      return
    }

    if (profile && (!profile.phone || !profile.address || !profile.name || !profile.gender || !profile.birth_date)) {
      toast.error('회원정보를 먼저 입력해주세요.')
      navigate('/mypage')
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
        course.enrollment_deadline ? (course.duration_days || null) : null,
        course.enrollment_deadline || null,
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
        finalPrice,
        course.enrollment_deadline ? (course.duration_days || null) : null,
        selectedCoupon?.id,
        selectedCoupon ? price : undefined,
        course.enrollment_deadline || null,
      )
      if (selectedCoupon) await couponService.useCoupon(selectedCoupon.id, user.id)
      webhookService.firePurchase({ user_email: profile.email || '', user_name: profile.name || '', user_phone: profile.phone || '', title: course.title, price: finalPrice, type: 'course' }).catch(() => {})
      toast.success('강의를 구매했습니다!')
      setOwned(true)
      setConfirmOpen(false)
      setSelectedCoupon(null)
      await refreshProfile()
    } catch (err) {
      const message = err instanceof Error ? err.message : '구매에 실패했습니다.'
      toast.error(message)
    } finally {
      setPurchasing(false)
    }
  }

  const handleTossPayment = async (courseIdVal: number, title: string, price: number) => {
    try {
      setTossLoading(true)
      const clientKey = await paymentService.getClientKey()
      if (!clientKey) {
        toast.error('결제 설정이 완료되지 않았습니다.')
        return
      }
      const tossPayments = await loadTossPayments(clientKey)
      const payment = tossPayments.payment({ customerKey: user!.id })
      const orderId = paymentService.generateOrderId() + `_course_${courseIdVal}`

      setConfirmOpen(false)
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: price },
        orderId,
        orderName: title,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: profile?.email || undefined,
        customerName: profile?.name || undefined,
        customerMobilePhone: profile?.phone?.replace(/-/g, '') || undefined,
      })
    } catch (err) {
      if (err instanceof Error && err.message.includes('사용자가')) return
      toast.error('결제 요청에 실패했습니다.')
    } finally {
      setTossLoading(false)
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

  const notYetOpen = course.enrollment_start ? new Date(course.enrollment_start).getTime() > Date.now() : false
  if (notYetOpen && !isAdmin) {
    return (
      <section className="w-full bg-white py-10">
        <div className="max-w-[1200px] mx-auto px-5 text-center py-20">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">아직 오픈되지 않은 강의입니다</h1>
          <p className="text-sm text-gray-500">
            오픈일시: {new Date(course.enrollment_start as string).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
          </p>
        </div>
      </section>
    )
  }

  const renderActionButton = () => {
    if (course && course.is_on_sale === false && !owned) {
      return (
        <button disabled className="w-full py-4 bg-gray-300 text-white font-bold text-center rounded-xl mt-4 cursor-not-allowed">
          판매 준비 중
        </button>
      )
    }

    if (course && course.max_enrollments != null && course.max_enrollments > 0 && enrollmentCount >= course.max_enrollments && !owned) {
      return (
        <button disabled className="w-full py-4 bg-gray-900 text-white font-bold text-center rounded-xl mt-4 cursor-not-allowed">
          정원 마감
        </button>
      )
    }

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
        {purchasing ? '처리 중...' : isFree ? '무료로 구매하기' : '선착순 마감 전에 신청하기'}
      </button>
    )
  }

  return (
    <>
      <SeoHead override={{
        title: course.seo?.title || course.title,
        description: course.seo?.description || undefined,
        keywords: course.seo?.keywords || undefined,
        author: course.seo?.author || undefined,
        ogTitle: course.seo?.ogTitle,
        ogDescription: course.seo?.ogDescription,
        ogImage: course.seo?.ogImage || course.thumbnail_url || undefined,
        twitterTitle: course.seo?.twitterTitle,
        twitterDescription: course.seo?.twitterDescription,
        twitterImage: course.seo?.twitterImage || course.thumbnail_url || undefined,
      }} />
      <section className="w-full bg-white py-10">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="flex gap-8 max-md:flex-col">
            <div className="flex-1">
              {course.video_url ? (
                <VideoEmbed url={course.video_url} className="w-full" />
              ) : (
                <div className="bg-gray-100 rounded-xl aspect-video flex items-center justify-center overflow-hidden">
                  <span className="text-sm text-gray-400">O.T 및 광고 영상</span>
                </div>
              )}
              <div className="bg-gray-100 rounded-xl min-h-[600px] flex items-center justify-center mt-6 overflow-hidden">
                {course.landing_image_url ? (
                  <img src={course.landing_image_url} alt={course.title} className="w-full" />
                ) : (
                  <span className="text-sm text-gray-400">숏랜딩 및 상세페이지 jpg 가로 800px</span>
                )}
              </div>

              {course.description && course.description.trim() && (
                <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6">
                  <div
                    className="rich-text-content text-sm text-gray-700"
                    dangerouslySetInnerHTML={{ __html: textToHtml(course.description) }}
                  />
                </div>
              )}

              {(course.strengths && course.strengths.length > 0) || (course.features && course.features.length > 0) ? (
                <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-6 mt-6">
                  {course.strengths && course.strengths.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <i className="ti ti-bolt text-[#2ED573]" /> 강의 강점
                      </h3>
                      <ul className="space-y-2">
                        {course.strengths.map((s, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <i className="ti ti-check text-[#2ED573] mt-0.5 shrink-0" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {course.features && course.features.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <i className="ti ti-star text-[#2ED573]" /> 강의 특징
                      </h3>
                      <ul className="space-y-2">
                        {course.features.map((s, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <i className="ti ti-check text-[#2ED573] mt-0.5 shrink-0" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
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
                {discountActive && course.original_price != null && course.original_price > 0 && course.sale_price != null && course.sale_price < course.original_price && (
                  <p className="text-sm text-gray-400 line-through mt-2">정가 {course.original_price.toLocaleString()}원</p>
                )}
                <p className="text-4xl font-extrabold text-gray-900 mt-1">
                  {isFree || displayedPrice === 0 ? '무료' : `${displayedPrice.toLocaleString()}원`}
                </p>
                {discountActive && course.discount_end && (
                  <p className="text-xs text-[#2ED573] font-medium mt-1">
                    할인 종료: {new Date(course.discount_end).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                  </p>
                )}

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

      {/* 관련 강의 */}
      {relatedCourses.length > 0 && (
        <section className="w-full bg-white py-12 border-t border-gray-100">
          <div className="max-w-[1200px] mx-auto px-5">
            <h2 className="text-xl font-bold text-gray-900 mb-6">관련 강의</h2>
            <div className="grid grid-cols-4 max-md:grid-cols-2 max-sm:grid-cols-1 gap-5">
              {relatedCourses.map((rc) => {
                const closed = closedVisualEffect !== false && isCourseClosed(rc.enrollment_deadline)
                return (
                  <Link key={rc.id} to={`/course/${rc.id}`} className="no-underline group">
                    <div className={`bg-gray-100 rounded-xl aspect-video flex items-center justify-center mb-3 overflow-hidden ${closed ? 'opacity-60' : ''}`}>
                      {rc.thumbnail_url ? (
                        <img src={rc.thumbnail_url} alt={rc.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <span className="text-xs text-gray-400">썸네일</span>
                      )}
                    </div>
                    <p className={`text-sm font-bold whitespace-pre-line leading-snug mb-1 line-clamp-2 ${closed ? 'text-gray-400' : 'text-gray-900'}`}>
                      <span className={closed ? 'line-through' : ''}>{rc.title}</span>
                      {closed && <span className="ml-1 text-xs font-medium">(마감)</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {rc.course_type === 'free' ? '무료' : rc.sale_price ? `${rc.sale_price.toLocaleString()}원` : '-'}
                    </p>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* 리뷰 섹션 */}
      {course.reviews_enabled !== false && (
        <section className="w-full bg-gray-50 py-16">
          <div className="max-w-[1200px] mx-auto px-5">
            <CourseReviewSection courseId={course.id} courseName={course.title} />
          </div>
        </section>
      )}

      {/* 환불규정 */}
      {course.refund_policy && course.refund_policy.trim() && (
        <section className="w-full bg-white py-12 border-t border-gray-100">
          <div className="max-w-[1200px] mx-auto px-5">
            <details className="group" open>
              <summary className="list-none cursor-pointer flex items-center justify-between gap-3 py-2">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <i className="ti ti-receipt-refund text-[#2ED573]" /> 환불규정
                </h2>
                <i className="ti ti-chevron-down text-gray-400 text-lg transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4 p-5 bg-gray-50 border border-gray-100 rounded-xl">
                <div className="refund-policy-content" dangerouslySetInnerHTML={{ __html: course.refund_policy }} />
              </div>
            </details>
          </div>
        </section>
      )}

      {/* 구매 확인 모달 */}
      <Transition appear show={confirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => { if (!purchasing && !tossLoading) setConfirmOpen(false) }}>
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
                    <p>결제 금액: <span className="font-bold text-gray-900">{price.toLocaleString()}원</span></p>

                    {/* 쿠폰 선택 */}
                    <CouponSelector coupons={myCoupons} selected={selectedCoupon} onSelect={setSelectedCoupon} price={price} />

                    {selectedCoupon && <p>할인 적용: <span className="font-bold text-[#2ED573]">-{couponDiscount.toLocaleString()}원</span></p>}
                    <p>최종 결제: <span className="font-bold text-gray-900">{finalPrice.toLocaleString()}원</span></p>
                  </div>

                  {/* 결제 방식 선택 (0원이면 숨김) */}
                  {finalPrice > 0 && (
                  <div className="mb-4 mt-4">
                    <p className="text-xs font-bold text-gray-600 mb-2">결제 방식</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPayMethod('toss')}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${payMethod === 'toss' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}
                      >
                        <i className="ti ti-credit-card mr-1" />카드 결제
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayMethod('points')}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${payMethod === 'points' ? 'bg-[#2ED573] text-white border-[#2ED573]' : 'bg-white text-gray-500 border-gray-200'}`}
                      >
                        <i className="ti ti-coin mr-1" />포인트 ({profile?.points?.toLocaleString() || 0}P)
                      </button>
                    </div>
                  </div>
                  )}

                  {finalPrice > 0 && payMethod === 'points' && (
                    <div className="space-y-2 text-sm text-gray-600">
                      <hr className="border-gray-100 my-2" />
                      <p>보유 포인트: <span className="font-bold text-gray-900">{(profile?.points ?? 0).toLocaleString()}P</span></p>
                      <p>결제 후 잔액: <span className="font-bold text-[#2ED573]">{((profile?.points ?? 0) - finalPrice).toLocaleString()}P</span></p>
                    </div>
                  )}

                  {finalPrice > 0 && payMethod === 'points' && (profile?.points ?? 0) < finalPrice ? (
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
                    {finalPrice === 0 ? (
                      <button
                        onClick={handleConfirmPurchase}
                        disabled={purchasing}
                        className="flex-1 rounded-xl bg-[#2ED573] py-3 text-sm font-bold text-white cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {purchasing ? '처리 중...' : '무료로 구매하기'}
                      </button>
                    ) : payMethod === 'toss' ? (
                      <button
                        onClick={() => handleTossPayment(course.id, course.title, finalPrice)}
                        disabled={tossLoading}
                        className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {tossLoading ? '결제 준비 중...' : `${finalPrice.toLocaleString()}원 카드 결제`}
                      </button>
                    ) : (
                      <button
                        onClick={handleConfirmPurchase}
                        disabled={purchasing || (profile?.points ?? 0) < finalPrice}
                        className="flex-1 rounded-xl bg-[#2ED573] py-3 text-sm font-bold text-white cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {purchasing ? '처리 중...' : `${finalPrice.toLocaleString()}P 구매하기`}
                      </button>
                    )}
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
