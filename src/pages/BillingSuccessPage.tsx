import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { trackPurchase } from '../lib/tracking'

// 뉴스레터 정기구독 카드 등록 성공 리다이렉트 페이지.
// 토스 requestBillingAuth 성공 시 successUrl 로 customerKey/authKey 가 붙어 돌아온다.
// billing-issue 엣지 함수가 빌링키 발급 + 1회차 자동결제 승인 + 열람권 부여까지 처리한다.

// authKey 는 1회용 — StrictMode(dev) 이펙트 중복 실행으로 두 번 승인 요청하지 않도록 모듈 레벨에서 가드
const processedAuthKeys = new Set<string>()

export default function BillingSuccessPage() {
  const [searchParams] = useSearchParams()
  const { loading: authLoading, profile, refreshProfile } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [orderTitle, setOrderTitle] = useState('')
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    const authKey = searchParams.get('authKey')
    const customerKey = searchParams.get('customerKey')
    const instructorId = Number(searchParams.get('instructorId'))

    if (!authKey || !customerKey || !instructorId || isNaN(instructorId)) {
      setStatus('error')
      setMessage('카드 등록 정보가 올바르지 않습니다.')
      return
    }
    if (processedAuthKeys.has(authKey)) return
    processedAuthKeys.add(authKey)

    let mounted = true
    const issueAndCharge = async () => {
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

        const response = await supabase.functions.invoke('billing-issue', {
          body: { authKey, customerKey, instructorId },
        })
        if (!mounted) return

        const data = response.data
        if (response.error) {
          const errBody = typeof data === 'object' && data?.error ? data.error : response.error.message
          throw new Error(errBody || '구독 결제에 실패했습니다.')
        }
        if (data?.error) throw new Error(data.error)

        setOrderTitle(data?.title || '뉴스레터 구독')
        setExpiresAt(data?.expires_at ?? null)
        setStatus('success')
        setMessage('정기구독이 시작되었습니다.')

        // Purchase — 1회차 자동결제 승인 완료 (카드 일반결제의 PaymentSuccessPage 와 동일 규약)
        trackPurchase({
          orderId: (data?.order_id as string) || `bsub_${instructorId}`,
          contentId: `bsub_${instructorId}`,
          contentName: data?.title || '뉴스레터 구독',
          contentCategory: '뉴스레터',
          instructorName: (data?.instructor_name as string | null | undefined) ?? null,
          value: Number(data?.price) || 0,
          user: { email: profile?.email, phone: profile?.phone },
        })

        refreshProfile()
      } catch (err) {
        if (!mounted) return
        setStatus('error')
        setMessage(err instanceof Error ? err.message : '구독 결제에 실패했습니다.')
      }
    }

    issueAndCharge()
    return () => { mounted = false }
    // profile 은 트래킹 보강용으로만 읽는다 — deps 에 넣으면 profile 로드 시 재호출되므로 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">구독 결제 진행 중...</h2>
            <p className="text-sm text-gray-500">카드 등록과 첫 결제를 처리하고 있습니다. 잠시만 기다려주세요.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-[#2ED573] rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ti ti-check text-white text-3xl" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">정기구독 시작</h2>
            <p className="text-sm text-gray-500 mb-2">{orderTitle}</p>
            <p className="text-sm text-gray-500 mb-2">{message}</p>
            {expiresAt && (
              <p className="text-xs text-gray-400 mb-6">
                이용 기간: {new Date(expiresAt).toLocaleDateString('ko-KR')} 까지 · 만료 전 자동 갱신됩니다.
                해지는 마이페이지에서 가능합니다.
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <Link to="/board" className="px-6 py-2.5 bg-[#2ED573] text-white rounded-lg text-sm font-bold no-underline hover:bg-[#25B866] transition-colors">
                뉴스레터 보러가기
              </Link>
              <Link to="/mypage" className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold no-underline hover:bg-gray-200 transition-colors">
                구독 관리
              </Link>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ti ti-x text-red-500 text-3xl" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">구독 결제 실패</h2>
            <p className="text-sm text-red-500 mb-8">{message}</p>
            <Link to="/board" className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold no-underline hover:bg-gray-200 transition-colors">
              뉴스레터로 돌아가기
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
