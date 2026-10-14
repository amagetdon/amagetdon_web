import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { boardService, BOARD_CTA_DEFAULTS, BOARD_MEMBER_CTA_DEFAULTS } from '../services/boardService'
import { textToHtml } from '../utils/richText'
import { decodePostId } from '../utils/postHash'
import { useAuth } from '../contexts/AuthContext'
import BoardCheckoutModal, { type BoardCheckoutItem } from '../components/BoardCheckoutModal'
import { membershipPriceLabel } from '../components/BoardNewsletterBits'
import BlogPostView from '../components/blog/BlogPostView'
import { setChromeHidden } from '../lib/chrome'
import { logProductVisit } from '../lib/attribution'
import { rememberPostLogin, takePostLoginAction } from '../lib/postLogin'
import type { BoardInstructor, BoardPostPublic } from '../types'

// 뉴스레터 글 열람 페이지. 두 경로에서 재사용:
//   /board/p/:token — 비밀 공유 링크 (목록 비공개 글 포함)
//   /board/:id      — 공개 목록(/board)에서 진입 (is_listed 글만, id 는 난독화 해시)
// 잠금 판정(is_locked)과 본문 자르기는 서버 RPC 가 수행 — 클라이언트는 표시만 담당한다.
// 유료 글은 단건 구매(영구) 또는 강사 구독(기간제)으로 열람 — 결제는 BoardCheckoutModal.
// 글 단건 구매 / 강사 뉴스레터 구독 결제 창에 넘길 항목 (구독 정보가 없으면 null)
function checkoutItemFor(post: BoardPostPublic, kind: 'post' | 'subscription'): BoardCheckoutItem | null {
  if (kind === 'post') {
    return { kind: 'post', id: post.id, title: post.title, price: post.post_price, instructorName: post.instructor_name }
  }
  if (!post.instructor_id || !post.sub_price) return null
  return {
    kind: 'subscription',
    id: post.instructor_id,
    title: `${post.instructor_name ?? '강사'} 뉴스레터 구독`,
    price: post.sub_price,
    subMonths: post.sub_months,
    instructorName: post.instructor_name,
  }
}

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
  const [instructors, setInstructors] = useState<BoardInstructor[]>([])

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

  // 시크릿 페이지처럼 사이트 헤더·푸터 숨김 (글 설정)
  useEffect(() => {
    setChromeHidden(!!post?.hide_chrome)
    return () => setChromeHidden(false)
  }, [post?.hide_chrome])

  // 블로그형 화면 사이드바 — 강사 프로필·카테고리(강사별 뉴스레터)·최근 글
  useEffect(() => {
    boardService.getBoardInstructors().then(setInstructors).catch(() => {})
  }, [])

  // 본문 끝의 태그 블록(<div class="btags" data-tags="a,b">)은 하단 태그 영역으로
  const { bodyHtml, tags } = useMemo(() => {
    const html = textToHtml(post?.content ?? '')
    const m = html.match(/<div class="btags" data-tags="([^"]*)"[^>]*>[\s\S]*?<\/div>/)
    return {
      bodyHtml: m ? html.replace(m[0], '') : html,
      tags: m ? m[1].split(',').map((t) => t.trim()).filter(Boolean) : [],
    }
  }, [post?.content])

  // 본문 속 우리 강의·전자책 링크: 같은 창으로 열고, UTM 이 있으면 소재 구분(utm_content)을 채운다
  //   광고로 이 글에 들어온 방문자는 그 광고의 utm_content 를 그대로 넘기고, 없으면 글 번호(post_N)
  useEffect(() => {
    const el = contentRef.current
    if (!el || !post) return
    const arrival = new URLSearchParams(window.location.search).get('utm_content')
    el.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
      let u: URL
      try { u = new URL(a.getAttribute('href') || '', window.location.origin) } catch { return }
      const ours = u.origin === window.location.origin || /(^|\.)amag-class\.com$/.test(u.hostname)
      if (!ours || !/^\/(course|ebook|landing)\//.test(u.pathname)) return
      if (u.searchParams.get('utm_source')) u.searchParams.set('utm_content', arrival || u.searchParams.get('utm_content') || `post_${post.id}`)
      a.href = u.origin === window.location.origin ? u.pathname + u.search : u.toString()
      a.removeAttribute('target')
    })
  }, [post, bodyHtml])

  // 게시글 방문 기록 — 같은 방문자의 강의 페이지 방문·신청과 이어서 관리자 통합 대시보드 '게시글 경유'에 집계 (하루 1건)
  useEffect(() => {
    if (status === 'ok' && post?.id) logProductVisit(`board_post_${post.id}`)
  }, [status, post?.id])

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

  // 로그인 전에 '구매/구독'을 눌렀던 사람이 로그인을 마치고 돌아오면 결제 창을 바로 띄운다
  // (이미 열람 가능·구독 중이면 띄우지 않음).
  useEffect(() => {
    if (status !== 'ok' || !post || !user) return
    const action = takePostLoginAction(location.pathname)
    // 저장소(localStorage)에 남은 '이어서 할 일'을 한 번 소비해 결제 창을 여는 것이라 effect 안 setState 가 맞다
    /* eslint-disable react-hooks/set-state-in-effect */
    if (action === 'checkout_post' && post.is_locked && post.post_price > 0) {
      setCheckout(checkoutItemFor(post, 'post'))
    } else if (action === 'checkout_subscription' && !post.is_subscribed) {
      setCheckout(checkoutItemFor(post, 'subscription'))
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [status, post, user, location.pathname])

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
  const subLabel = post.sub_price ? membershipPriceLabel(post.sub_price, post.sub_months) : null

  // 로그인 후 이 글로 돌아오게 기억 — 구매/구독 버튼에서 왔으면 돌아와서 결제 창까지 이어서 띄운다
  const goLogin = (kind?: 'post' | 'subscription') => {
    rememberPostLogin(kind === 'post' ? 'checkout_post' : kind === 'subscription' ? 'checkout_subscription' : undefined)
    navigate('/login', { state: { from: { pathname: location.pathname } } })
  }

  const openCheckout = (kind: 'post' | 'subscription') => {
    if (!user) { goLogin(kind); return }
    const item = checkoutItemFor(post, kind)
    if (item) setCheckout(item)
  }

  // 기본 스킨 — 기존 뉴스레터 화면
  if (post.skin !== 'blog') {
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
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
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
                      <button onClick={() => goLogin()} className="text-[#2ED573] font-semibold bg-transparent border-none cursor-pointer p-0 hover:underline">
                        로그인
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  state={{ from: { pathname: location.pathname } }}
                  onClick={() => rememberPostLogin()}
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

  // 블로그형 스킨 — blog_meta(블로그 이름·닉네임·프로필·소개·카테고리)가 있으면 그것, 없으면 강사 정보
  const meta = post.blog_meta ?? {}
  const blogTitle = meta.blogTitle || (post.instructor_name ? `${post.instructor_name}의 뉴스레터` : '아마겟돈 뉴스레터')
  const me = instructors.find((i) => i.id === post.instructor_id) ?? null
  const boardHome = post.instructor_id ? `/board/instructor/${post.instructor_id}` : '/board'
  const canSubscribe = !!(post.instructor_id && post.sub_price && !post.is_subscribed)

  const stateBadge = post.is_paid && !post.is_locked ? (
    <span className="blog-state">
      <i className="ti ti-lock-open" />
      {post.is_purchased ? '구매한 글입니다'
        : post.is_subscribed ? '구독 중인 강사의 글입니다'
        : isAdmin ? '관리자 권한으로 열람 중입니다 (일반 방문자에게는 잠겨 보입니다)'
        : '열람 가능한 글입니다'}
    </span>
  ) : null

  // 잠금 하단: 안내문 + 결제/로그인 유도 (비워둔 항목은 기본값으로 표시)
  const lockPanel = teaser ? (
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
                  post.post_price > 0 ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-[#2ED573] text-white hover:bg-[#25B866] shadow-sm shadow-[#2ED573]/20'
                }`}
              >
                {subLabel} 구독하고 모든 글 보기
              </button>
            )}
            {!user && (
              <p className="text-xs text-gray-400 mt-2">
                이미 구매하셨나요?{' '}
                <button onClick={() => goLogin()} className="text-[#2ED573] font-semibold bg-transparent border-none cursor-pointer p-0 hover:underline">로그인</button>
              </p>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            state={{ from: { pathname: location.pathname } }}
            onClick={() => rememberPostLogin()}
            className="block w-full max-w-md mx-auto mt-8 py-4 bg-[#2ED573] text-white text-center font-bold rounded-xl no-underline hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20"
          >
            {buttonText}
          </Link>
        )}
      </div>
    </>
  ) : null

  return (
    <>
      <BlogPostView
        blogTitle={blogTitle}
        blogHref={boardHome}
        profile={{
          image: meta.profileImage || me?.image_url,
          name: meta.nickname || post.instructor_name || '아마겟돈 클래스',
          sub: meta.sub ?? me?.title ?? null,
          description: meta.description || me?.headline || null,
          moreHref: post.instructor_id ? `/instructors/${post.instructor_id}` : null,
          button: canSubscribe
            ? { label: '구독하기', onClick: () => openCheckout('subscription') }
            : { label: '글 더보기', href: boardHome },
        }}
        // 원래 블로그의 목차·최근 글(가져오기·관리자 입력) — 다른 강사 뉴스레터는 넣지 않는다, 클릭 없는 표시용
        categories={meta.categories?.length
          ? meta.categories.map((c, i) => ({ label: c.label, count: c.count, active: i === 0 }))
          : [{ label: '전체보기', active: true }, { label: meta.category || '게시판' }]}
        recent={meta.recent?.length ? meta.recent.map((t) => ({ label: t })) : [{ label: post.title }]}
        post={{
          category: meta.category || (post.instructor_name ? `${post.instructor_name}의 뉴스레터` : '뉴스레터'),
          categoryHref: token ? null : boardHome,
          title: post.title,
          authorName: meta.nickname || post.instructor_name || '아마겟돈 클래스',
          authorImage: meta.profileImage || me?.image_url,
          dateText: blogDate(post.created_at),
          bodyHtml,
          tags,
        }}
        subscribe={canSubscribe ? { label: '구독', onClick: () => openCheckout('subscription') } : null}
        beforeBody={stateBadge}
        bodyRef={contentRef}
        bodyStyle={teaser ? { maxHeight: post.preview_height } : undefined}
        bodyOverlay={teaser && clipped ? <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-white pointer-events-none" /> : null}
        afterBody={lockPanel}
      />

      <BoardCheckoutModal
        item={checkout}
        onClose={() => setCheckout(null)}
        onPurchased={() => setReloadKey((k) => k + 1)}
      />
    </>
  )
}

/** 네이버 블로그식 날짜: 하루 안이면 'N분/시간 전', 아니면 '2026. 10. 12. 21:30' */
function blogDate(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  if (diff >= 0 && diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))}분 전`
  if (diff >= 0 && diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}시간 전`
  const d = new Date(t + 9 * 3600 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}. ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}
