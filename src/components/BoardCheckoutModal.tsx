import { useState } from 'react'
import toast from 'react-hot-toast'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { paymentService } from '../services/paymentService'
import { boardService } from '../services/boardService'
import { useAuth } from '../contexts/AuthContext'
import { trackBeginCheckout, trackPurchase } from '../lib/tracking'

// 뉴스레터 결제 모달 — 글 단건(kind: 'post', 영구 열람) / 강사 구독(kind: 'subscription', 기간제).
// 카드: 토스 orderId 접미사 _bpost_{id} / _bsub_{id} → confirm-payment 가 분기 처리.
// 포인트: boardService.purchaseWithPoints 로 즉시 부여 후 onPurchased 콜백.
export interface BoardCheckoutItem {
  kind: 'post' | 'subscription'
  id: number
  title: string
  price: number
  subDays?: number | null
  instructorName?: string | null // 전환 이벤트(begin_checkout/purchase)용
}

interface BoardCheckoutModalProps {
  item: BoardCheckoutItem | null
  onClose: () => void
  onPurchased: () => void
}

export default function BoardCheckoutModal({ item, onClose, onPurchased }: BoardCheckoutModalProps) {
  const { user, profile, refreshProfile } = useAuth()
  const [paying, setPaying] = useState<'card' | 'points' | null>(null)

  if (!item) return null
  const points = profile?.points ?? 0
  const isSub = item.kind === 'subscription'

  const payWithCard = async () => {
    if (!user || paying) return
    try {
      setPaying('card')
      const clientKey = await paymentService.getClientKey()
      if (!clientKey) { toast.error('결제 설정이 완료되지 않았습니다.'); return }
      const tossPayments = await loadTossPayments(clientKey)
      const payment = tossPayments.payment({ customerKey: user.id })
      const orderId = paymentService.generateOrderId() + (isSub ? `_bsub_${item.id}` : `_bpost_${item.id}`)

      // InitiateCheckout — 결제창 호출 직전 (강의/전자책 결제와 동일 규약)
      trackBeginCheckout({
        orderId,
        contentId: isSub ? `bsub_${item.id}` : `bpost_${item.id}`,
        contentName: item.title,
        contentCategory: '뉴스레터',
        instructorName: item.instructorName ?? null,
        value: item.price,
        user: { email: profile?.email, phone: profile?.phone },
      })

      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: item.price },
        orderId,
        orderName: item.title,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      // 사용자가 결제창을 닫은 경우는 조용히 무시
      if (!msg.includes('취소')) toast.error(msg || '결제 요청에 실패했습니다.')
    } finally {
      setPaying(null)
    }
  }

  const payWithPoints = async () => {
    if (!user || paying) return
    if (points < item.price) { toast.error('포인트가 부족합니다.'); return }
    try {
      setPaying('points')
      await boardService.purchaseWithPoints(
        user.id,
        isSub ? { instructorId: item.id } : { postId: item.id },
        item.title,
        item.price,
        item.subDays,
      )
      // Purchase — 포인트 결제 완료 (강의/전자책 포인트 결제와 동일 규약)
      trackPurchase({
        orderId: paymentService.generateOrderId() + (isSub ? `_bsub_${item.id}` : `_bpost_${item.id}`),
        contentId: isSub ? `bsub_${item.id}` : `bpost_${item.id}`,
        contentName: item.title,
        contentCategory: '뉴스레터',
        instructorName: item.instructorName ?? null,
        value: item.price,
        user: { email: profile?.email, phone: profile?.phone },
      })
      toast.success(isSub ? '구독이 시작되었습니다.' : '구매가 완료되었습니다.')
      refreshProfile()
      onPurchased()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '구매에 실패했습니다.')
    } finally {
      setPaying(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={() => !paying && onClose()} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <button
          onClick={() => !paying && onClose()}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 bg-transparent border-none cursor-pointer"
          aria-label="닫기"
        >
          <i className="ti ti-x text-lg" />
        </button>

        <div className="mb-6">
          <p className="text-xs font-bold text-[#1faf5c] mb-1.5">{isSub ? '뉴스레터 구독' : '뉴스레터 글 구매'}</p>
          <h2 className="text-lg font-bold text-gray-900 leading-snug break-words">{item.title}</h2>
          <p className="text-sm text-gray-500 mt-1.5">
            {isSub
              ? `${item.subDays && item.subDays > 0 ? item.subDays : 30}일 동안 이 강사의 모든 글을 볼 수 있습니다.`
              : '구매한 글은 기간 제한 없이 계속 볼 수 있습니다.'}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-4">{item.price.toLocaleString()}원</p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={payWithCard}
            disabled={!!paying}
            className="w-full py-3.5 bg-[#2ED573] text-white text-sm font-bold rounded-xl border-none cursor-pointer hover:bg-[#25B866] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <i className="ti ti-credit-card text-base" />
            {paying === 'card' ? '결제창 여는 중...' : '카드로 결제하기'}
          </button>
          <button
            onClick={payWithPoints}
            disabled={!!paying || points < item.price}
            className="w-full py-3.5 bg-gray-900 text-white text-sm font-bold rounded-xl border-none cursor-pointer hover:bg-gray-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <i className="ti ti-coin text-base" />
            {paying === 'points' ? '처리 중...' : `포인트로 결제 (보유 ${points.toLocaleString()}P)`}
          </button>
          {points < item.price && (
            <p className="text-[11px] text-gray-400 text-center">보유 포인트가 부족하면 카드 결제를 이용해 주세요.</p>
          )}
        </div>
      </div>
    </div>
  )
}
