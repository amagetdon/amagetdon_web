import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { couponService } from '../services/couponService'
import toast from 'react-hot-toast'
import { imgUrl } from '../lib/image'
import type { Coupon } from '../types'

function CouponBanner() {
  const { user } = useAuth()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set())
  const [claiming, setClaiming] = useState<number | null>(null)

  useEffect(() => {
    couponService.getPublished().then(setCoupons).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) return
    couponService.getUserClaims(user.id).then(setClaimedIds).catch(() => {})
  }, [user])

  const handleClaim = async (coupon: Coupon) => {
    if (!user) {
      toast.error('로그인 후 쿠폰을 받을 수 있습니다.')
      return
    }
    if (claimedIds.has(coupon.id)) {
      toast('이미 받은 쿠폰입니다.', { icon: '🎫' })
      return
    }
    try {
      setClaiming(coupon.id)
      await couponService.claim(coupon.id, user.id)
      setClaimedIds((prev) => new Set([...prev, coupon.id]))
      toast.success(`쿠폰이 발급되었습니다! 코드: ${coupon.code}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '쿠폰 받기에 실패했습니다.')
    } finally {
      setClaiming(null)
    }
  }

  if (coupons.length === 0) return null

  return (
    <section className="w-full py-10 max-sm:py-6">
      <style>{`
        .coupon-ticket {
        }
        .coupon-inner {
          -webkit-mask-image:
            radial-gradient(circle 12px at 0 50%, transparent 99%, black 100%),
            radial-gradient(circle 12px at 100% 50%, transparent 99%, black 100%);
          -webkit-mask-composite: destination-in;
          mask-image:
            radial-gradient(circle 12px at 0 50%, transparent 99%, black 100%),
            radial-gradient(circle 12px at 100% 50%, transparent 99%, black 100%);
          mask-composite: intersect;
        }
        .coupon-perforation {
          position: absolute;
          right: 0;
          top: 24px;
          bottom: 24px;
          width: 0;
          border-right: 2px dashed rgba(0,0,0,0.1);
        }
      `}</style>
      <div className="max-w-[1200px] mx-auto px-5 flex flex-col gap-5">
        {coupons.map((coupon) => {
          const claimed = claimedIds.has(coupon.id)
          const expired = coupon.expires_at && new Date(coupon.expires_at) < new Date()
          const full = coupon.max_claims !== null && coupon.claims_count >= coupon.max_claims
          const disabled = !!expired || !!full || claimed

          return (
            <div key={coupon.id} className="coupon-ticket">
            <div
              className="coupon-inner rounded-2xl overflow-hidden flex max-sm:flex-col"
              style={{ backgroundColor: coupon.banner_bg_color || '#c0e3d1' }}
            >
              {/* 왼쪽: 쿠폰 티켓 */}
              <div className="relative shrink-0 flex flex-col items-center justify-center px-10 py-8 max-sm:px-6 max-sm:py-6 min-w-[220px] max-sm:min-w-0"
                style={{ background: `linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.4)), ${coupon.banner_bg_color || '#c0e3d1'}` }}>
                <div className="coupon-perforation max-sm:hidden" />

                {coupon.brand_name && (
                  <span className="text-[10px] font-bold tracking-widest uppercase opacity-50 mb-2"
                    style={{ color: coupon.banner_text_color || '#171717' }}>
                    {coupon.brand_name}
                  </span>
                )}

                <div className="flex items-baseline gap-0.5">
                  <span className="text-4xl max-sm:text-3xl font-black tracking-tight"
                    style={{ color: coupon.banner_text_color || '#171717' }}>
                    {coupon.discount_type === 'percent'
                      ? coupon.discount_value
                      : coupon.discount_value.toLocaleString()}
                  </span>
                  <span className="text-lg max-sm:text-base font-bold opacity-70"
                    style={{ color: coupon.banner_text_color || '#171717' }}>
                    {coupon.discount_type === 'percent' ? '%' : '원'}
                  </span>
                </div>

                {coupon.description && (
                  <p className="text-[11px] opacity-50 mt-1.5 text-center leading-snug"
                    style={{ color: coupon.banner_text_color || '#171717' }}>
                    {coupon.description}
                  </p>
                )}

                <button
                  onClick={() => handleClaim(coupon)}
                  disabled={disabled || claiming === coupon.id}
                  className={`mt-4 w-full max-w-[160px] py-2.5 rounded-xl text-xs font-bold border-none transition-all ${
                    claiming === coupon.id
                      ? 'bg-gray-100 text-gray-400 cursor-wait'
                      : claimed
                      ? 'bg-gray-100 text-gray-400 cursor-default'
                      : expired || full
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-[#2ED573] text-white cursor-pointer hover:bg-[#25B866] hover:shadow-md hover:shadow-[#2ED573]/20 active:scale-[0.97]'
                  }`}
                >
                  {claiming === coupon.id ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                      발급 중
                    </span>
                  ) : claimed ? (
                    <span className="flex items-center justify-center gap-1">
                      <i className="ti ti-check text-xs" /> 받기 완료
                    </span>
                  ) : expired ? '기간 만료' : full ? '소진' : '쿠폰 받기'}
                </button>

                {coupon.expires_at && (
                  <p className="text-[10px] opacity-30 mt-2"
                    style={{ color: coupon.banner_text_color || '#171717' }}>
                    ~{new Date(coupon.expires_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                  </p>
                )}
              </div>

              {/* 오른쪽: 타이틀 영역 */}
              <div className="flex-1 flex items-center max-sm:flex-col">
                <div className="flex-1 px-10 py-8 max-sm:px-6 max-sm:py-5 min-w-0">
                  <h3 className="text-2xl max-sm:text-lg font-black leading-snug whitespace-pre-line"
                    style={{ color: coupon.banner_text_color || '#171717' }}>
                    {coupon.title}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {coupon.min_purchase > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/40 opacity-60"
                        style={{ color: coupon.banner_text_color || '#171717' }}>
                        {coupon.min_purchase.toLocaleString()}P 이상 결제 시
                      </span>
                    )}
                    {coupon.discount_type === 'percent' && coupon.max_discount && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/40 opacity-60"
                        style={{ color: coupon.banner_text_color || '#171717' }}>
                        최대 {coupon.max_discount.toLocaleString()}P 할인
                      </span>
                    )}
                  </div>
                </div>

                {coupon.banner_image_url && (
                  <div className="w-[280px] max-sm:w-full max-sm:h-[140px] shrink-0 self-stretch">
                    <img src={imgUrl(coupon.banner_image_url, 'wide')} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default CouponBanner
