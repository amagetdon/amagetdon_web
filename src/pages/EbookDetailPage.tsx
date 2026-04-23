import { useState, useEffect, Fragment } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { purchaseService } from '../services/purchaseService'
import { Dialog, Transition } from '@headlessui/react'
import toast from 'react-hot-toast'
import { couponService } from '../services/couponService'
import { webhookService } from '../services/webhookService'
import CouponSelector from '../components/CouponSelector'
import SeoHead from '../components/SeoHead'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { paymentService } from '../services/paymentService'
import type { EbookWithInstructor, Coupon } from '../types'
import { isEbookClosed } from '../utils/courseStatus'
import { useAcademySettings } from '../hooks/useAcademySettings'

function EbookDetailPage() {
  const { id } = useParams()
  const ebookId = id ? Number(id) : null
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const { closedVisualEffect } = useAcademySettings()

  const [ebook, setEbook] = useState<EbookWithInstructor | null>(null)
  const [loading, setLoading] = useState(true)
  const [owned, setOwned] = useState(false)
  const [ownershipLoading, setOwnershipLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [myCoupons, setMyCoupons] = useState<Coupon[]>([])
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)
  const [payMethod, setPayMethod] = useState<'points' | 'toss'>('toss')
  const [tossLoading, setTossLoading] = useState(false)
  const [relatedEbooks, setRelatedEbooks] = useState<Array<{ id: number; title: string; thumbnail_url: string | null; sale_price: number | null; is_free: boolean; close_date: string | null }>>([])

  useEffect(() => {
    if (!ebook?.related_ebook_ids || ebook.related_ebook_ids.length === 0) {
      setRelatedEbooks([])
      return
    }
    let cancelled = false
    supabase
      .from('ebooks')
      .select('id, title, thumbnail_url, sale_price, is_free, close_date')
      .in('id', ebook.related_ebook_ids)
      .eq('is_published', true)
      .then(({ data }) => {
        if (!cancelled) setRelatedEbooks((data ?? []) as typeof relatedEbooks)
      })
    return () => { cancelled = true }
  }, [ebook?.related_ebook_ids])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setOwned(false)
    setOwnershipLoading(true)
    const fetchEbook = async () => {
      try {
        const { data, error } = await supabase
          .from('ebooks')
          .select('*, instructor:instructors(id, name)')
          .eq('id', Number(id))
          .single()
        if (error) throw error
        setEbook(data as EbookWithInstructor)
      } catch {
        setEbook(null)
      } finally {
        setLoading(false)
      }
    }
    fetchEbook()
  }, [id])

  useEffect(() => {
    if (!user || !ebookId) {
      setOwnershipLoading(false)
      return
    }
    const checkOwned = async () => {
      try {
        const result = await purchaseService.checkOwnership(user.id, null, ebookId)
        setOwned(result)
      } catch {
        setOwned(false)
      } finally {
        setOwnershipLoading(false)
      }
    }
    checkOwned()
  }, [user, ebookId])

  useEffect(() => {
    if (!user) return
    couponService.getUsableCoupons(user.id).then(setMyCoupons).catch(() => {})
  }, [user])

  const isFree = ebook?.is_free === true
  const now = Date.now()
  const discountActive = !!ebook && !isFree && (
    !ebook.discount_start && !ebook.discount_end ? true :
    (!ebook.discount_start || new Date(ebook.discount_start).getTime() <= now) &&
    (!ebook.discount_end || new Date(ebook.discount_end).getTime() > now)
  )
  const displayedPrice = isFree ? 0
    : discountActive && ebook?.sale_price != null ? ebook.sale_price
    : ebook?.original_price ?? ebook?.sale_price ?? 0
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

    if (ebook?.close_date && new Date(ebook.close_date).getTime() <= Date.now()) {
      toast.error('판매가 마감된 전자책입니다.')
      return
    }

    if (isFree) {
      handleEnrollFree()
      return
    }

    setConfirmOpen(true)
  }

  const handleEnrollFree = async () => {
    if (!user || !ebook || !ebookId) return
    setPurchasing(true)
    try {
      await purchaseService.enrollFree(
        user.id,
        { ebookId },
        ebook.title,
        ebook.duration_days
      )
      toast.success('전자책이 등록되었습니다!')
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
    if (!user || !ebook || !ebookId || !profile) return
    setPurchasing(true)
    try {
      await purchaseService.purchaseWithPoints(
        user.id,
        { ebookId },
        ebook.title,
        finalPrice,
        ebook.duration_days,
        selectedCoupon?.id,
        selectedCoupon ? price : undefined
      )
      if (selectedCoupon) await couponService.useCoupon(selectedCoupon.id, user.id)
      webhookService.firePurchase({ user_email: profile.email || '', user_name: profile.name || '', user_phone: profile.phone || '', title: ebook.title, price: finalPrice, type: 'ebook' }).catch(() => {})
      toast.success('전자책을 구매했습니다!')
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

  const handleTossPayment = async (ebookIdVal: number, title: string, price: number) => {
    try {
      setTossLoading(true)
      const clientKey = await paymentService.getClientKey()
      if (!clientKey) {
        toast.error('결제 설정이 완료되지 않았습니다.')
        return
      }
      const tossPayments = await loadTossPayments(clientKey)
      const payment = tossPayments.payment({ customerKey: user!.id })
      const orderId = paymentService.generateOrderId() + `_ebook_${ebookIdVal}`

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
            <div className="flex-1 bg-gray-200 rounded-xl h-[500px]" />
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

  if (!ebook) {
    return (
      <section className="w-full bg-white py-10">
        <div className="max-w-[1200px] mx-auto px-5 text-center text-gray-500 py-20">
          전자책 정보를 찾을 수 없습니다.
        </div>
      </section>
    )
  }

  const renderActionButton = () => {
    if (ebook && ebook.is_on_sale === false && !owned) {
      return (
        <button disabled className="w-full py-4 bg-gray-300 text-white font-bold text-center rounded-xl mt-6 cursor-not-allowed border-none">
          판매 준비 중
        </button>
      )
    }
    if (ownershipLoading) {
      return (
        <button disabled className="w-full py-4 bg-gray-300 text-white font-bold text-center rounded-xl mt-6 cursor-not-allowed border-none">
          확인 중...
        </button>
      )
    }

    if (ebook && ebook.close_date && new Date(ebook.close_date).getTime() <= Date.now() && !owned) {
      return (
        <button disabled className="w-full py-4 bg-gray-900 text-white font-bold text-center rounded-xl mt-6 cursor-not-allowed border-none">
          판매 마감
        </button>
      )
    }

    if (owned) {
      return (
        <button
          onClick={() => navigate('/my-classroom')}
          className="w-full py-4 bg-gray-900 text-white font-bold text-center rounded-xl mt-6 cursor-pointer border-none"
        >
          내 강의실로 이동
        </button>
      )
    }

    return (
      <button
        onClick={handlePurchaseClick}
        disabled={purchasing}
        className="w-full py-4 bg-[#2ED573] text-white font-bold text-center rounded-xl mt-6 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {purchasing ? '처리 중...' : isFree ? '무료로 받기' : '구매하기'}
      </button>
    )
  }

  return (
    <>
      <SeoHead override={{
        title: ebook.seo?.title || ebook.title,
        description: ebook.seo?.description || undefined,
        keywords: ebook.seo?.keywords || undefined,
        author: ebook.seo?.author || undefined,
        ogTitle: ebook.seo?.ogTitle,
        ogDescription: ebook.seo?.ogDescription,
        ogImage: ebook.seo?.ogImage || ebook.thumbnail_url || undefined,
        twitterTitle: ebook.seo?.twitterTitle,
        twitterDescription: ebook.seo?.twitterDescription,
        twitterImage: ebook.seo?.twitterImage || ebook.thumbnail_url || undefined,
      }} />
      <section className="w-full bg-white py-10">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="flex gap-8 max-md:flex-col">
            {/* 왼쪽: 표지 + 랜딩 이미지 */}
            <div className="flex-1">
              <div className="bg-gray-100 rounded-xl min-h-[500px] flex items-center justify-center overflow-hidden">
                {ebook.thumbnail_url ? (
                  <img src={ebook.thumbnail_url} alt={ebook.title} className="w-full h-auto" />
                ) : (
                  <span className="text-sm text-gray-400">전자책 표지 이미지</span>
                )}
              </div>
              {ebook.landing_image_url && (
                <div className="bg-gray-100 rounded-xl min-h-[600px] flex items-center justify-center mt-6 overflow-hidden">
                  <img src={ebook.landing_image_url} alt={ebook.title} className="w-full" />
                </div>
              )}

              {(ebook.strengths && ebook.strengths.length > 0) || (ebook.features && ebook.features.length > 0) ? (
                <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-6 mt-6">
                  {ebook.strengths && ebook.strengths.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <i className="ti ti-bolt text-[#2ED573]" /> 강점
                      </h3>
                      <ul className="space-y-2">
                        {ebook.strengths.map((s, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <i className="ti ti-check text-[#2ED573] mt-0.5 shrink-0" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {ebook.features && ebook.features.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <i className="ti ti-star text-[#2ED573]" /> 특징
                      </h3>
                      <ul className="space-y-2">
                        {ebook.features.map((s, idx) => (
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

            {/* 오른쪽: 정보 */}
            <div className="w-[340px] max-md:w-full shrink-0">
              <div className="sticky top-4">
                {ebook.instructor && (
                  <Link to={`/instructors/${ebook.instructor.id}`} className="text-sm text-[#2ED573] font-medium no-underline hover:underline">
                    {ebook.instructor.name} 강사
                  </Link>
                )}
                <h1 className="text-xl font-bold text-gray-900 mt-1">{ebook.title}</h1>

                {ebook.is_hot && (
                  <span className="inline-block mt-3 px-3 py-1 bg-[#2ED573] text-white text-xs font-bold rounded-full">
                    HOT
                  </span>
                )}

                <div className="border-t border-gray-200 my-6" />

                <p className="font-bold text-gray-900">가격</p>
                {discountActive && ebook.original_price != null && ebook.original_price > 0 && ebook.sale_price != null && ebook.sale_price < ebook.original_price && (
                  <p className="text-sm text-gray-400 line-through mt-2">
                    정가 {ebook.original_price.toLocaleString()}원
                  </p>
                )}
                <p className="text-4xl font-extrabold text-gray-900 mt-1">
                  {isFree || displayedPrice === 0 ? '무료' : `${displayedPrice.toLocaleString()}원`}
                </p>

                {user && profile && !isFree && (
                  <p className="text-sm text-gray-500 mt-2">
                    보유 포인트: <span className="font-bold text-gray-900">{profile.points.toLocaleString()}P</span>
                  </p>
                )}

                <div className="border-t border-gray-200 my-6" />

                <div className="text-sm text-gray-500 space-y-2">
                  <div className="flex items-center gap-2">
                    <i className="ti ti-clock text-[#2ED573]" />
                    <span>열람 기간: {ebook.duration_days && ebook.duration_days > 0 ? `${ebook.duration_days}일` : '무제한'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="ti ti-device-mobile text-[#2ED573]" />
                    <span>PC, 모바일 열람 가능</span>
                  </div>
                </div>

                {renderActionButton()}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 관련 전자책 */}
      {relatedEbooks.length > 0 && (
        <section className="w-full bg-white py-12 border-t border-gray-100">
          <div className="max-w-[1200px] mx-auto px-5">
            <h2 className="text-xl font-bold text-gray-900 mb-6">관련 전자책</h2>
            <div className="grid grid-cols-4 max-md:grid-cols-2 max-sm:grid-cols-1 gap-5">
              {relatedEbooks.map((re) => {
                const closed = closedVisualEffect !== false && isEbookClosed(re.close_date)
                return (
                  <Link key={re.id} to={`/ebook/${re.id}`} className="no-underline group">
                    <div className={`bg-gray-100 rounded-xl aspect-[3/4] flex items-center justify-center mb-3 overflow-hidden ${closed ? 'opacity-60' : ''}`}>
                      {re.thumbnail_url ? (
                        <img src={re.thumbnail_url} alt={re.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <span className="text-xs text-gray-400">표지</span>
                      )}
                    </div>
                    <p className={`text-sm font-bold whitespace-pre-line leading-snug mb-1 line-clamp-2 ${closed ? 'text-gray-400' : 'text-gray-900'}`}>
                      <span className={closed ? 'line-through' : ''}>{re.title}</span>
                      {closed && <span className="ml-1 text-xs font-medium">(마감)</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {re.is_free ? '무료' : re.sale_price ? `${re.sale_price.toLocaleString()}원` : '-'}
                    </p>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* 환불규정 */}
      {ebook.refund_policy && ebook.refund_policy.trim() && (
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
                <div className="refund-policy-content" dangerouslySetInnerHTML={{ __html: ebook.refund_policy }} />
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
                    <p>전자책: <span className="font-medium text-gray-900">{ebook.title}</span></p>
                    <p>결제 금액: <span className="font-bold text-gray-900">{price.toLocaleString()}원</span></p>

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
                        onClick={() => handleTossPayment(ebook.id, ebook.title, finalPrice)}
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

export default EbookDetailPage
