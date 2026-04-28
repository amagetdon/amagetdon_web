import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const { loading: authLoading, refreshProfile } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [orderTitle, setOrderTitle] = useState('')
  const [isCharge, setIsCharge] = useState(false)
  const [afterPurchaseUrl, setAfterPurchaseUrl] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    const paymentKey = searchParams.get('paymentKey')
    const orderId = searchParams.get('orderId')
    const amount = searchParams.get('amount')

    if (!paymentKey || !orderId || !amount) {
      setStatus('error')
      setMessage('결제 정보가 올바르지 않습니다.')
      return
    }

    let mounted = true
    const confirmPayment = async () => {
      try {
        const { data: { session } } = await supabase.auth.refreshSession()
        if (!session) {
          const { data: { session: existing } } = await supabase.auth.getSession()
          if (!existing) {
            if (!mounted) return
            setStatus('error')
            setMessage('로그인 세션이 만료되었습니다. 다시 로그인해주세요.')
            return
          }
        }

        const response = await supabase.functions.invoke('confirm-payment', {
          body: { paymentKey, orderId, amount: Number(amount) },
        })
        if (!mounted) return

        const data = response.data
        const error = response.error

        if (error) {
          const errBody = typeof data === 'object' && data?.error ? data.error : error.message
          throw new Error(errBody || '결제 승인 요청에 실패했습니다.')
        }
        if (data?.error) throw new Error(data.error)

        setOrderTitle(data?.title || '상품')
        setIsCharge(data?.type === 'charge')
        setStatus('success')
        setMessage(data?.type === 'charge' ? '포인트가 충전되었습니다.' : '결제가 완료되었습니다.')
        const link = (data?.after_purchase_url as string | null | undefined) ?? null
        if (link) {
          setAfterPurchaseUrl(link)
          // 결제 PG 리디렉션 직후라 팝업이 차단될 수 있음. 차단되면 아래 안내 버튼으로 대체.
          window.open(link, '_blank', 'noopener,noreferrer')
        }
        refreshProfile()
      } catch (err) {
        if (!mounted) return
        setStatus('error')
        setMessage(err instanceof Error ? err.message : '결제 승인에 실패했습니다.')
      }
    }

    confirmPayment()
    return () => { mounted = false }
  }, [searchParams, authLoading, refreshProfile])

  return (
    <section className="w-full bg-white min-h-[60vh] flex items-center justify-center py-20">
      <div className="max-w-md mx-auto px-5 text-center">
        {status === 'loading' && (
          <>
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="w-16 h-16 border-4 border-gray-200 rounded-full" />
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
            <p className="text-sm text-gray-500 mb-6">{message}</p>
            {afterPurchaseUrl && (
              <a
                href={afterPurchaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 mb-6 bg-[#FAE100] text-[#3C1E1E] rounded-lg text-sm font-bold no-underline hover:brightness-95 transition-all"
              >
                <i className="ti ti-message-circle text-base" />
                안내 채널 입장하기
              </a>
            )}
            <div className="flex gap-3 justify-center">
              {isCharge ? (
                <Link to="/mypage" className="px-6 py-2.5 bg-[#2ED573] text-white rounded-lg text-sm font-bold no-underline hover:bg-[#25B866] transition-colors">
                  마이페이지
                </Link>
              ) : (
                <Link to="/my-classroom" className="px-6 py-2.5 bg-[#2ED573] text-white rounded-lg text-sm font-bold no-underline hover:bg-[#25B866] transition-colors">
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
