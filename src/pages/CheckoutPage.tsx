import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { paymentService } from '../services/paymentService'
import { couponService } from '../services/couponService'
import CouponSelector from '../components/CouponSelector'
import type { Coupon } from '../types'

// 글로벌 PaymentWidget 타입 선언
declare global {
  interface Window {
    PaymentWidget: (clientKey: string, customerKey: string) => {
      renderPaymentMethods: (selector: string, amount: number) => { updateAmount: (amount: number, reason?: string) => void }
      renderAgreement: (selector: string) => void
      requestPayment: (params: Record<string, unknown>) => Promise<void>
    }
  }
}

interface OrderInfo {
  type: 'course' | 'ebook' | 'charge'
  id?: number
  title: string
  price: number
  durationDays?: number
}

export default function CheckoutPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [myCoupons, setMyCoupons] = useState<Coupon[]>([])
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)
  const widgetRef = useRef<ReturnType<typeof window.PaymentWidget> | null>(null)
  const methodsRef = useRef<{ updateAmount: (amount: number, reason?: string) => void } | null>(null)
  const widgetRendered = useRef(false)

  const type = searchParams.get('type') as 'course' | 'ebook' | 'charge' | null
  const id = searchParams.get('id')
  const chargeAmount = searchParams.get('amount')
  const couponIdParam = searchParams.get('couponId')

  // 상품 정보 로드
  useEffect(() => {
    if (!type) { navigate('/'); return }
    if (!user) { navigate('/login'); return }

    const loadOrder = async () => {
      try {
        if (type === 'charge') {
          const amount = Number(chargeAmount) || 10000
          setOrder({ type: 'charge', title: `포인트 ${amount.toLocaleString()}P 충전`, price: amount })
        } else if (type === 'course' && id) {
          const { data } = await supabase.from('courses').select('id, title, sale_price, duration_days').eq('id', Number(id)).single()
          if (!data) throw new Error('강의를 찾을 수 없습니다.')
          setOrder({ type: 'course', id: data.id, title: data.title, price: data.sale_price ?? 0, durationDays: data.duration_days })
        } else if (type === 'ebook' && id) {
          const { data } = await supabase.from('ebooks').select('id, title, sale_price, duration_days').eq('id', Number(id)).single()
          if (!data) throw new Error('전자책을 찾을 수 없습니다.')
          setOrder({ type: 'ebook', id: data.id, title: data.title, price: data.sale_price ?? 0, durationDays: data.duration_days })
        }
      } catch {
        toast.error('상품 정보를 불러오는데 실패했습니다.')
        navigate(-1)
      } finally {
        setLoading(false)
      }
    }
    loadOrder()
  }, [type, id, chargeAmount, user, navigate])

  // 쿠폰 로드
  useEffect(() => {
    if (!user) return
    couponService.getUsableCoupons(user.id).then((coupons) => {
      setMyCoupons(coupons)
      // URL에 couponId가 있으면 자동 선택
      if (couponIdParam) {
        const found = coupons.find((c) => c.id === Number(couponIdParam))
        if (found) setSelectedCoupon(found)
      }
    }).catch(() => {})
  }, [user, couponIdParam])

  // 결제 위젯 렌더링
  useEffect(() => {
    if (!order || !user || widgetRendered.current) return
    if (!window.PaymentWidget) {
      toast.error('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    const initWidget = async () => {
      const clientKey = await paymentService.getClientKey()
      if (!clientKey) {
        toast.error('결제 설정이 완료되지 않았습니다.')
        return
      }

      const widget = window.PaymentWidget(clientKey, user.id)
      widgetRef.current = widget

      const methods = widget.renderPaymentMethods('#payment-method', order.price)
      methodsRef.current = methods

      widget.renderAgreement('#agreement')
      widgetRendered.current = true
    }
    initWidget()
  }, [order, user])

  // 쿠폰 할인 계산
  const price = order?.price ?? 0
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

  // 쿠폰 적용 시 금액 업데이트
  useEffect(() => {
    if (methodsRef.current && order) {
      if (selectedCoupon) {
        methodsRef.current.updateAmount(finalPrice, '쿠폰')
      } else {
        methodsRef.current.updateAmount(order.price)
      }
    }
  }, [selectedCoupon, finalPrice, order])

  // 결제 요청
  const handlePayment = async () => {
    if (!widgetRef.current || !order || !user) return
    try {
      setPaying(true)
      let orderId = paymentService.generateOrderId()
      if (order.type === 'charge') {
        orderId += '_charge'
      } else {
        orderId += `_${order.type}_${order.id}`
      }
      if (selectedCoupon) {
        orderId += `_cpn_${selectedCoupon.id}`
      }

      await widgetRef.current.requestPayment({
        orderId,
        orderName: order.title,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: profile?.email || undefined,
        customerName: profile?.name || undefined,
      })
    } catch (err: unknown) {
      const error = err as { code?: string }
      if (error.code === 'USER_CANCEL') return
      toast.error('결제 요청에 실패했습니다.')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <section className="w-full bg-gray-50 min-h-[60vh] flex items-center justify-center py-20">
        <div className="relative w-12 h-12">
          <div className="w-12 h-12 border-4 border-gray-200 rounded-full" />
          <div className="absolute inset-0 w-12 h-12 border-4 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
        </div>
      </section>
    )
  }

  if (!order) return null

  return (
    <section className="w-full bg-gray-50 min-h-screen py-10">
      <div className="max-w-[640px] mx-auto px-5">
        {/* 상품 정보 */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">주문 정보</h2>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-900">{order.title}</p>
              {order.durationDays && (
                <p className="text-xs text-gray-400 mt-1">
                  {order.type === 'ebook' ? '열람' : '수강'} 기간: {order.durationDays}일
                </p>
              )}
            </div>
            <p className="text-lg font-bold text-gray-900">{order.price.toLocaleString()}원</p>
          </div>

          {/* 쿠폰 (충전이 아닐 때만) */}
          {order.type !== 'charge' && myCoupons.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <CouponSelector
                coupons={myCoupons}
                selected={selectedCoupon}
                onSelect={setSelectedCoupon}
                price={order.price}
              />
            </div>
          )}

          {/* 할인 적용 시 최종 금액 */}
          {selectedCoupon && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">상품 금액</span>
                <span className="text-gray-500 line-through">{order.price.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-red-500">쿠폰 할인</span>
                <span className="text-red-500">-{couponDiscount.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
                <span className="font-bold text-gray-900">최종 결제 금액</span>
                <span className="font-bold text-[#2ED573] text-lg">{finalPrice.toLocaleString()}원</span>
              </div>
            </div>
          )}
        </div>

        {/* 결제 수단 위젯 */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">결제 수단</h2>
          <div id="payment-method" />
        </div>

        {/* 약관 위젯 */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <div id="agreement" />
        </div>

        {/* 결제 버튼 */}
        <button
          onClick={handlePayment}
          disabled={paying || finalPrice <= 0}
          className="w-full py-4 bg-blue-600 text-white text-base font-bold rounded-2xl border-none cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {paying ? '결제 진행 중...' : `${finalPrice.toLocaleString()}원 결제하기`}
        </button>
      </div>
    </section>
  )
}
