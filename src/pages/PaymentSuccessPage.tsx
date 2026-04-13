import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const { refreshProfile } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [orderTitle, setOrderTitle] = useState('')
  const [isCharge, setIsCharge] = useState(false)

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey')
    const orderId = searchParams.get('orderId')
    const amount = searchParams.get('amount')

    if (!paymentKey || !orderId || !amount) {
      setStatus('error')
      setMessage('결제 정보가 올바르지 않습니다.')
      return
    }

    confirmPayment(paymentKey, orderId, Number(amount))
  }, [searchParams])

  const confirmPayment = async (paymentKey: string, orderId: string, amount: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('confirm-payment', {
        body: { paymentKey, orderId, amount },
      })

      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)

      setOrderTitle(data?.title || '상품')
      setIsCharge(data?.type === 'charge')
      setStatus('success')
      setMessage(data?.type === 'charge' ? '포인트가 충전되었습니다.' : '결제가 완료되었습니다.')
      refreshProfile()
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : '결제 승인에 실패했습니다.')
    }
  }

  return (
    <section className="w-full bg-white min-h-[60vh] flex items-center justify-center py-20">
      <div className="max-w-md mx-auto px-5 text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-gray-200 rounded-full mx-auto mb-6 relative">
              <div className="absolute inset-0 w-16 h-16 border-4 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">결제 승인 중...</h2>
            <p className="text-sm text-gray-500">잠시만 기다려주세요.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-[#2ED573] rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ti ti-check text-white text-3xl" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">결제 완료</h2>
            <p className="text-sm text-gray-500 mb-2">{orderTitle}</p>
            <p className="text-sm text-gray-500 mb-8">{message}</p>
            <div className="flex gap-3 justify-center">
              {isCharge ? (
                <Link to="/mypage" className="px-6 py-2.5 bg-[#2ED573] text-white rounded-lg text-sm font-bold no-underline hover:bg-[#25B866] transition-colors">
                  마이페이지
                </Link>
              ) : (
                <Link to="/mypage/classroom" className="px-6 py-2.5 bg-[#2ED573] text-white rounded-lg text-sm font-bold no-underline hover:bg-[#25B866] transition-colors">
                  내 강의실
                </Link>
              )}
              <Link to="/" className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold no-underline hover:bg-gray-200 transition-colors">
                홈으로
              </Link>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ti ti-x text-red-500 text-3xl" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">결제 실패</h2>
            <p className="text-sm text-red-500 mb-8">{message}</p>
            <Link to="/" className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold no-underline hover:bg-gray-200 transition-colors">
              홈으로 돌아가기
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
