import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { boardService, BOARD_CTA_DEFAULTS, BOARD_MEMBER_CTA_DEFAULTS } from '../services/boardService'
import { textToHtml } from '../utils/richText'
import { decodePostId } from '../utils/postHash'
import { useAuth } from '../contexts/AuthContext'
import BoardCheckoutModal, { type BoardCheckoutItem } from '../components/BoardCheckoutModal'
import { membershipPriceLabel } from '../components/BoardNewsletterBits'
import type { BoardPostPublic } from '../types'

// 뉴스레터 글 열람 페이지. 두 경로에서 재사용:
//   /board/p/:token — 비밀 공유 링크 (목록 비공개 글 포함)
//   /board/:id      — 공개 목록(/board)에서 진입 (is_listed 글만, id 는 난독화 해시)
// 잠금 판정(is_locked)과 본문 자르기는 서버 RPC 가 수행 — 클라이언트는 표시만 담당한다.
// 유료 글은 단건 구매(영구) 또는 강사 구독(기간제)으로 열람 — 결제는 BoardCheckoutModal.
export default function BoardPostPage() {
  const { token, id } = useParams<{ token?: string; id?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: authLoading, isAdmin } = useAuth()
  const [post, setPost] = useState<BoardPostPublic | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound'>('loading')
  const contentRef = useRef<HTMLDivElement>(null)
  const [clipped, setClipped] = useState(false)
  const [checkout, setCheckout] = useState<BoardCheckoutItem | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // 공개 목록 진입 경로(/board/:id)의 id 는 난독화 해시 — 숫자 직접 접근은 받지 않는다.
  const postId = decodePostId(id)

  useEffect(() => {
    let active = true
    // 세션 복원 전에 조회하면 로그인/구매자도 잠긴 응답을 받으므로 auth 로딩을 기다린다.
    if (authLoading) return
    if (!token && !postId) { setStatus('notfound'); return }
    setStatus('loading')
    boardService.getPublic(token ? { token } : { id: postId! })
      .then((data) => {
        if (!active) return
        if (data) { setPost(data); setStatus('ok') }
        else { setStatus('notfound') }
      })
      .catch(() => { if (active) setStatus('notfound') })
    return () => { active = false }
  }, [token, postId, authLoading, user?.id, reloadKey])

  useEffect(() => {
    if (post?.title) {
      const prev = document.title
      document.title = post.title
      return () => { document.title = prev }
    }
  }, [post?.title])

  // 서버가 잘라 보낸 잠긴 글 — 미리보기 높이로 클리핑하고 CTA 를 노출한다.
  const teaser = status === 'ok' && !!post?.is_locked

  // 실제 본문이 미리보기 높이를 넘는지 측정해서 하단 페이드 표시 여부 결정.
  // 한 번만 재면 이미지가 아직 로드 전이라 높이가 작게 잡혀(캐시 여부에 따라 들쭉날쭉) 페이드가 왔다갔다 한다.
  // ResizeObserver 로 본문 크기 변화(이미지/폰트 로드, 리사이즈)마다 다시 측정한다.
  useEffect(() => {
    const el = contentRef.current
    if (!teaser || !el || !post) { setClipped(false); return }
    const measure = () => setClipped(el.scrollHeight > post.preview_height + 8)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [teaser, post])

  if (status === 'loading' || authLoading) {
    return (
      <section className="w-full bg-white min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
      </section>
    )
  }

  if (status === 'notfound' || !post) {
    return (
      <section className="w-full bg-white min-h-[60vh] flex items-center justify-center px-5">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-file-off text-gray-400 text-2xl" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">글을 찾을 수 없습니다</h1>
          <p className="text-sm text-gray-500">링크가 만료되었거나 삭제된 글입니다.</p>
        </div>
      </section>
    )
  }

  const isPaid = post.is_paid
  const defaults = isPaid ? BOARD_MEMBER_CTA_DEFAULTS : BOARD_CTA_DEFAULTS
  const lockedText = post.cta_locked_text?.trim() || defaults.lockedText
  const ctaTitle = post.cta_title?.trim() || defaults.title
  const ctaSubtitle = post.cta_subtitle?.trim() || defaults.subtitle
  const buttonText = post.cta_button_text?.trim() || BOARD_CTA_DEFAULTS.buttonText
  const subLabel = post.sub_price ? membershipPriceLabel(post.sub_price, post.sub_days) : null

  const goLogin = () => {
    sessionStorage.setItem('postLoginRedirect', location.pathname)
    navigate('/login', { state: { from: { pathname: location.pathname } } })
  }

  const openCheckout = (kind: 'post' | 'subscription') => {
    if (!user) { goLogin(); return }
    if (kind === 'post') {
      setCheckout({ kind: 'post', id: post.id, title: post.title, price: post.post_price })
    } else if (post.instructor_id && post.sub_price) {
      setCheckout({
        kind: 'subscription',
        id: post.instructor_id,
        title: `${post.instructor_name ?? '강사'} 뉴스레터 구독`,
        price: post.sub_price,
        subDays: post.sub_days,
      })
    }
  }

  return (
    <section className="w-full bg-white py-12 max-sm:py-8">
      <div className="max-w-[800px] mx-auto px-5">
        {/* 공개 목록에서 진입한 글에만 목록 백링크 노출 (비밀 링크 글은 목록에 없음) */}
        {!token && (
          <Link to="/board" className="inline-flex items-center gap-1 text-sm text-gray-400 no-underline hover:text-gray-600 mb-6 transition-colors">
            <i className="ti ti-chevron-left text-base" /> 아마겟돈 뉴스레터
          </Link>
        )}

        {/* 유료 글을 잠금 없이 보는 이유 안내 — 관리자 확인 시 "결제 없이 보인다"는 혼동 방지 */}
        {post.is_paid && !post.is_locked && (
          <div className="mb-5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-[#2ED573]/10 text-[#1faf5c]">
              <i className="ti ti-lock-open text-sm" />
              {post.is_purchased
                ? '구매한 글입니다'
                : post.is_subscribed
                  ? '구독 중인 강사의 글입니다'
                  : isAdmin
                    ? '관리자 권한으로 열람 중입니다 (일반 방문자에게는 잠겨 보입니다)'
                    : '열람 가능한 글입니다'}
            </span>
          </div>
        )}

        <header className="border-b border-gray-200 pb-6 mb-8">
          <h1 className="text-2xl max-sm:text-xl font-bold text-gray-900 leading-snug break-words">{post.title}</h1>
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-400">
            {post.instructor_name && (
              <>
                {post.instructor_id ? (
                  <Link to={`/board/instructor/${post.instructor_id}`} className="font-medium text-gray-600 no-underline hover:text-[#25B866] transition-colors">
                    {post.instructor_name}
                  </Link>
                ) : (
                  <span className="font-medium text-gray-600">{post.instructor_name}</span>
                )}
                <span className="text-gray-300">·</span>
              </>
            )}
            <span>{new Date(post.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </header>

        {/* 본문 — 잠긴 글이면 preview_height 만큼만 노출하고 하단 페이드 */}
        <div
          className="relative overflow-hidden"
          style={teaser ? { maxHeight: post.preview_height } : undefined}
        >
          <div
            ref={contentRef}
            className="rich-text-content text-[15px] text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: textToHtml(post.content) }}
          />
          {teaser && clipped && (
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-white pointer-events-none" />
          )}
        </div>

        {/* 잠금 하단: 안내문 + 결제/로그인 유도 (비워둔 항목은 기본값으로 표시) */}
        {teaser && (
          <>
            <p className="text-center text-gray-400 text-sm mt-4 mb-10">{lockedText}</p>

            <div className="border-t border-gray-100 pt-12 pb-4 text-center">
              <div
                className="rich-text-content text-xl max-sm:text-lg font-bold text-gray-900 leading-relaxed [&_p]:text-center"
                dangerouslySetInnerHTML={{ __html: textToHtml(ctaTitle) }}
              />
              <p className="text-sm text-gray-400 mt-3">{ctaSubtitle}</p>

              {isPaid ? (
                <div className="flex flex-col gap-2.5 w-full max-w-md mx-auto mt-8">
                  {post.post_price > 0 && (
                    <button
                      onClick={() => openCheckout('post')}
                      className="w-full py-4 bg-[#2ED573] text-white text-center text-[15px] font-bold rounded-xl border-none cursor-pointer hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20"
                    >
                      이 글만 구매하기 · {post.post_price.toLocaleString()}원
                    </button>
                  )}
                  {subLabel && (
                    <button
                      onClick={() => openCheckout('subscription')}
                      className={`w-full py-4 text-center text-[15px] font-bold rounded-xl border-none cursor-pointer transition-colors ${
                        post.post_price > 0
                          ? 'bg-gray-900 text-white hover:bg-gray-700'
                          : 'bg-[#2ED573] text-white hover:bg-[#25B866] shadow-sm shadow-[#2ED573]/20'
                      }`}
                    >
                      {subLabel} 구독하고 모든 글 보기
                    </button>
                  )}
                  {!user && (
                    <p className="text-xs text-gray-400 mt-2">
                      이미 구매하셨나요?{' '}
                      <button onClick={goLogin} className="text-[#2ED573] font-semibold bg-transparent border-none cursor-pointer p-0 hover:underline">
                        로그인
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  state={{ from: { pathname: location.pathname } }}
                  onClick={() => sessionStorage.setItem('postLoginRedirect', location.pathname)}
                  className="block w-full max-w-md mx-auto mt-8 py-4 bg-[#2ED573] text-white text-center font-bold rounded-xl no-underline hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20"
                >
                  {buttonText}
                </Link>
              )}
            </div>
          </>
        )}
      </div>

      <BoardCheckoutModal
        item={checkout}
        onClose={() => setCheckout(null)}
        onPurchased={() => setReloadKey((k) => k + 1)}
      />
    </section>
  )
}
