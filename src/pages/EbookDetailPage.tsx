import { useState, useEffect, Fragment } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { purchaseService } from '../services/purchaseService'
import { Dialog, Transition } from '@headlessui/react'
import toast from 'react-hot-toast'
import type { EbookWithInstructor } from '../types'

function EbookDetailPage() {
  const { id } = useParams()
  const ebookId = id ? Number(id) : null
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()

  const [ebook, setEbook] = useState<EbookWithInstructor | null>(null)
  const [loading, setLoading] = useState(true)
  const [owned, setOwned] = useState(false)
  const [ownershipLoading, setOwnershipLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [purchasing, setPurchasing] = useState(false)

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

  const isFree = ebook?.is_free === true
  const price = isFree ? 0 : (ebook?.sale_price ?? 0)

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
        price,
        ebook.duration_days
      )
      toast.success('전자책을 구매했습니다!')
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
    if (ownershipLoading) {
      return (
        <button disabled className="w-full py-4 bg-gray-300 text-white font-bold text-center rounded-xl mt-6 cursor-not-allowed border-none">
          확인 중...
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
                {ebook.original_price && (
                  <p className="text-sm text-gray-400 line-through mt-2">
                    정가 {ebook.original_price.toLocaleString()}원
                  </p>
                )}
                <p className="text-4xl font-extrabold text-gray-900 mt-1">
                  {ebook.is_free ? '무료' : ebook.sale_price ? `${ebook.sale_price.toLocaleString()}원` : '가격 미정'}
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
                    <span>열람 기간: {ebook.duration_days}일</span>
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
                    <p>전자책: <span className="font-medium text-gray-900">{ebook.title}</span></p>
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

export default EbookDetailPage
