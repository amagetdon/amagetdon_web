import { useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { logPaymentAttempt, productFromOrderId, stageFromError } from '../lib/paymentAttempts'

export default function PaymentFailPage() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') || ''
  const message = searchParams.get('message') || '결제가 취소되었습니다.'
  const orderId = searchParams.get('orderId') || ''

  // 결제창 기록 — 실패·취소로 돌아온 것을 남긴다(주문 번호에서 상품을 읽음. 같은 주문·단계는 서버가 한 번만 기록)
  useEffect(() => {
    const product = productFromOrderId(orderId)
    if (product) logPaymentAttempt(stageFromError(code, searchParams.get('message') || ''), { ...product, orderId, code: code || 'UNKNOWN' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, code])

  return (
    <section className="w-full bg-white min-h-[60vh] flex items-center justify-center py-20">
      <div className="max-w-md mx-auto px-5 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="ti ti-x text-red-500 text-3xl" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">결제 실패</h2>
        <p className="text-sm text-red-500 mb-2">{message}</p>
        {code && <p className="text-xs text-gray-400 mb-8">오류 코드: {code}</p>}
        <div className="flex gap-3 justify-center">
          <Link to="/academy" className="px-6 py-2.5 bg-[#2ED573] text-white rounded-lg text-sm font-bold no-underline hover:bg-[#25B866] transition-colors">
            아카데미
          </Link>
          <Link to="/" className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold no-underline hover:bg-gray-200 transition-colors">
            홈으로
          </Link>
        </div>
      </div>
    </section>
  )
}
