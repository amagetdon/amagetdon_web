import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { setChromeHidden } from '../lib/chrome'
import { logProductVisit } from '../lib/attribution'
import { trackViewItem, trackFreeEnroll, trackOpenChatJoin, buildContentId, courseCategoryLabel } from '../lib/tracking'
import { logOpenChat } from '../lib/openchatLog'
import { r2Proxy } from '../lib/image'
import { isUpcomingLive, liveLabel } from '../lib/liveCalendar'
import { detectInAppBrowser, openExternalBrowser } from '../lib/inAppBrowser'
import { rememberPostLogin, takePostLoginAction } from '../lib/postLogin'
import { useCourse } from '../hooks/useCourses'
import { supabase } from '../lib/supabase'
import { authService } from '../services/authService'
import { purchaseService } from '../services/purchaseService'
import { webhookService } from '../services/webhookService'
import { webhookScheduleService } from '../services/webhookScheduleService'
import { landingCategoryService } from '../services/landingCategoryService'
import LiveCalendarCta from '../components/LiveCalendarCta'
import SeoHead from '../components/SeoHead'
import { WEBTOON_LANDINGS, CONCERN_MAX, type Bubble, type WebtoonCut, type WebtoonLanding, type AskStep } from '../lib/webtoonLandings'

// 웹툰식 랜딩 /w/:slug — 표지(W1) → 웹툰(W2) → 카카오 신청(W3) → 자동 신청 저장(W4) → 선택 질문 3개(W5·W6) → 완료(W7).
// 화면 흐름: PM 스토리보드 v3 '5 · 화면 흐름표' + 6장 권장안 R1~R5. 강의 상세·기존 신청 흐름과는 별개 페이지이고,
// 신청은 강의 상세와 같은 서버 함수(enroll_free)·알림톡·전환 이벤트를 쓴다.
// 단계는 주소 ?step= 로 나누고 새로고침 없이 바꾼다(뒤로 가기 = 앞 단계, 새로고침해도 그 단계에서 이어 보기).

type Step = 'cover' | 'webtoon' | 'signup' | 'saved' | 'ask1' | 'ask2' | 'ask3' | 'done'
const STEPS: Step[] = ['cover', 'webtoon', 'signup', 'saved', 'ask1', 'ask2', 'ask3', 'done']
const ASK_STEPS: Step[] = ['ask1', 'ask2', 'ask3']
const GREEN = '#2ED573'
const IN_APP_RE = /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|FB4A|Line\/|NAVER\(inapp|DaumApps|BAND\/|everytimeApp/i

/** 랜딩 단계 이벤트 — GTM(dataLayer)에만. 광고 매체로는 보내지 않는다 */
function pushEvent(event: string, data: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { dataLayer?: unknown[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event, ...data })
  } catch { /* GTM 없음 */ }
}

const ss = {
  get(k: string) { try { return sessionStorage.getItem(k) } catch { return null } },
  set(k: string, v: string) { try { sessionStorage.setItem(k, v) } catch { /* 저장 불가 */ } },
  del(k: string) { try { sessionStorage.removeItem(k) } catch { /* 저장 불가 */ } },
}

type Answers = { blog_exp?: string; daily_time?: string; concern?: string }

export default function WebtoonLandingPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const cfg = WEBTOON_LANDINGS[slug] as WebtoonLanding | undefined
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const raw = params.get('step') as Step | null
  const step: Step = raw && STEPS.includes(raw) ? raw : 'cover'
  const { course } = useCourse(cfg?.courseId ?? null)
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()

  // 신청 여부 — 회원별로 기억(로그아웃·다른 회원이면 '모름')
  const [ownedBy, setOwnedBy] = useState<{ uid: string; value: boolean } | null>(null)
  const owned = user && ownedBy?.uid === user.id ? ownedBy.value : null
  // 이미 신청한 사람이 완료 화면에 온 경우 — 새로고침해도 유지되게 sessionStorage
  const already = ss.get(`wt_already_${slug}`) === '1'
  const [saveError, setSaveError] = useState<string | null>(null)
  const [fetchedLanding, setFetchedLanding] = useState<{ id: number; name: string | null } | null>(null)
  const catId = course ? (course.landing_category_id ?? course.landing_category_ids?.[0] ?? null) : undefined
  const landingName: string | null | undefined = catId === undefined ? undefined : catId === null ? null : fetchedLanding?.id === catId ? fetchedLanding.name : undefined

  const name = profile?.name || '회원'
  const isGuest = profile?.provider === 'guest'
  const profileComplete = !!profile && (isGuest || !!(profile.name && profile.phone && profile.gender && profile.birth_date))
  const live = course?.scheduled_at ? liveLabel(course.scheduled_at) : cfg?.liveFallback ?? ''
  const fill = useCallback((s: string) => s.replace(/\{name\}/g, name).replace(/\{live\}/g, live), [name, live])
  const savedPath = `/w/${slug}?step=saved`

  const go = useCallback((s: Step, replace = false) => {
    const p = new URLSearchParams(window.location.search)
    if (s === 'cover') p.delete('step')
    else p.set('step', s)
    setParams(p, { replace })
    window.scrollTo(0, 0)
  }, [setParams])

  // 효과음 손글씨 글꼴 — 효과음에 쓰는 글자만 받는다(Google Fonts text= 로 몇 KB)
  useEffect(() => {
    if (!cfg) return
    const chars = [...new Set(cfg.webtoon.cuts.flatMap((c) => c.bubbles.filter((b) => b.type === 'sfx').map((b) => b.text)).join(''))].join('')
    if (!chars || document.getElementById('wt-sfx-font')) return
    const link = document.createElement('link')
    link.id = 'wt-sfx-font'
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap&text=${encodeURIComponent(chars)}`
    document.head.appendChild(link)
  }, [cfg])

  // 사이트 머리글·바닥글·상담 버튼 숨김
  useEffect(() => {
    setChromeHidden(true)
    return () => setChromeHidden(false)
  }, [])

  // 통합 대시보드 '유입' — 강의 상세 주소가 아니라서 여기서 직접 기록
  useEffect(() => {
    if (cfg) logProductVisit(`course_${cfg.courseId}`)
  }, [cfg])

  // 랜딩 카테고리 이름(전환 이벤트 subcategory — 강의 상세와 같게)
  useEffect(() => {
    if (catId == null) return
    landingCategoryService.getPublished()
      .then((cats) => setFetchedLanding({ id: catId, name: cats.find((c) => c.id === catId)?.name ?? null }))
      .catch(() => setFetchedLanding({ id: catId, name: null }))
  }, [catId])

  // ViewContent — 첫 진입 1회 (강의 상세와 같은 이벤트)
  const viewFired = useRef(false)
  useEffect(() => {
    if (!course || landingName === undefined || viewFired.current) return
    viewFired.current = true
    trackViewItem({
      contentId: buildContentId('course', course.id),
      contentName: course.title,
      contentCategory: courseCategoryLabel(course.course_type),
      contentSubcategory: landingName,
      instructorName: course.instructor?.name ?? null,
      value: 0,
    })
  }, [course, landingName])

  // 신청 여부
  useEffect(() => {
    if (!user || !cfg) return
    const uid = user.id
    purchaseService.checkOwnership(uid, cfg.courseId).then((v) => setOwnedBy({ uid, value: v }), () => setOwnedBy({ uid, value: false }))
  }, [user, cfg])

  // 앱 안 브라우저(안드로이드)에서 크롬으로 넘어온 경우 — 표시만 지우고 카카오 신청 화면에서 이어 간다
  useEffect(() => {
    if (params.get('ext_act') !== 'purchase' || detectInAppBrowser().isInApp) return
    const p = new URLSearchParams(window.location.search)
    p.delete('ext_act')
    p.set('step', 'signup')
    setParams(p, { replace: true })
  }, [params, setParams])

  // 주소로 바로 들어온 뒤 단계 확인 — 로그인·신청 기록이 없으면 표지로
  useEffect(() => {
    if (authLoading) return
    if ((ASK_STEPS.includes(step) || step === 'done') && !user) { go('cover', true); return }
    if (step === 'done' && owned === false) { go('cover', true); return }
    // 이미 신청한 사람이 신청 화면에 오면 바로 완료 화면
    if (step === 'signup' && user && owned === true) {
      ss.set(`wt_already_${slug}`, '1')
      go('done', true)
    }
  }, [authLoading, step, user, owned, go, slug])

  // 카카오에서 그냥 돌아온 경우(취소)
  useEffect(() => {
    if (step !== 'signup' || authLoading || user) return
    if (ss.get('wt_kakao_started') === slug) {
      ss.del('wt_kakao_started')
      pushEvent('kakao_cancel', { landing: slug })
    }
  }, [step, authLoading, user, slug])

  const startSignup = async () => {
    if (!cfg) return
    pushEvent('kakao_start', { landing: slug, logged_in: !!user })
    if (!user) {
      // 안드로이드 인스타·페북 앱 안에서는 카카오 로그인이 막혀 크롬으로 넘긴다(돌아올 단계·UTM 포함)
      const inApp = detectInAppBrowser()
      if (inApp.isInApp && inApp.isAndroid) {
        openExternalBrowser({ params: { ext_act: 'purchase', step: 'signup' } })
        return
      }
      // 로그인 화면을 거치지 않고 카카오로 바로. 돌아오면 홈 → 이 랜딩의 신청 저장 단계로 자동 이동(App PostLoginRedirect)
      rememberPostLogin('purchase', savedPath)
      ss.set('wt_kakao_started', slug)
      ss.set('pendingSignIn', '1')
      try {
        await authService.signInWithOAuth('kakao')
      } catch (err) {
        ss.del('wt_kakao_started')
        toast.error(err instanceof Error ? err.message : '카카오 로그인을 시작하지 못했어요.')
      }
      return
    }
    if (!profileComplete) {
      // 회원정보 빈칸 → 온보딩(빈 칸만) → 이 랜딩 신청 저장 단계로 복귀
      rememberPostLogin('purchase', savedPath)
      toast('회원정보를 먼저 입력해 주세요.')
      navigate('/mypage')
      return
    }
    go('saved')
  }

  // W4 신청 저장 — 강의 상세 handleEnrollFree 와 같은 처리(서버 신청 + 알림톡 + 예약 알림 + Lead)
  const savingRef = useRef(false)
  useEffect(() => {
    if (step !== 'saved' || authLoading || !cfg) return
    if (!user) { go('cover', true); return }
    if (!course || !profile || landingName === undefined || savingRef.current) return
    savingRef.current = true
    takePostLoginAction(window.location.pathname) // 로그인 복귀 표시는 여기서 소진
    if (ss.get('wt_kakao_started') === slug) { ss.del('wt_kakao_started'); pushEvent('kakao_return', { landing: slug }) }
    if (!profileComplete) {
      rememberPostLogin('purchase', savedPath)
      navigate('/mypage')
      return
    }
    void (async () => {
      const has = await purchaseService.checkOwnership(user.id, course.id).catch(() => false)
      if (has) {
        setOwnedBy({ uid: user.id, value: true }); ss.set(`wt_already_${slug}`, '1')
        go('done', true)
        return
      }
      const { count } = await supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('course_id', course.id)
      try {
        await purchaseService.enrollFree({ courseId: course.id })
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : '신청에 실패했어요.')
        return
      }
      const isPreAlert = course.course_type === 'pre_alert'
      const who = { userId: user.id, userName: profile.name || '', userPhone: profile.phone || '', userEmail: profile.email || '' }
      webhookService.fireCustomEvent(isPreAlert ? 'course_pre_alert' : 'purchase_free', {
        course_type: course.course_type, price: 0, original_price: course.original_price ?? course.sale_price ?? 0, type: 'course',
      }, { ...who, title: course.title, scope: 'course', scopeId: course.id }).catch(() => {})
      webhookScheduleService.enqueueForPurchase({ ...who, scope: 'course', scopeId: course.id, courseTitle: course.title }).catch(() => {})
      webhookScheduleService.triggerEnrollmentFullIfReached('course', course.id, (count ?? 0) + 1, course.max_enrollments).catch(() => {})
      trackFreeEnroll({
        orderId: `free_course_${course.id}_${user.id}`,
        contentId: buildContentId('course', course.id),
        contentName: course.title,
        contentCategory: courseCategoryLabel(course.course_type),
        contentSubcategory: landingName,
        instructorName: course.instructor?.name ?? null,
        user: { email: profile.email, phone: profile.phone },
      })
      setOwnedBy({ uid: user.id, value: true }); ss.del(`wt_already_${slug}`)
      refreshProfile().catch(() => {})
      window.setTimeout(() => go('ask1', true), 1200)
    })()
  }, [step, authLoading, user, profile, course, landingName, profileComplete, cfg, slug, savedPath, go, navigate, refreshProfile])

  if (!cfg) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-black text-white gap-4">
        <p>페이지를 찾을 수 없어요.</p>
        <Link to="/" className="underline">홈으로</Link>
      </div>
    )
  }

  const askIndex = ASK_STEPS.indexOf(step)

  return (
    <div className="bg-black min-h-[100dvh] text-white">
      <SeoHead override={{ title: cfg.seo.title, description: cfg.seo.description, ogImage: cfg.seo.image, twitterImage: cfg.seo.image }} />
      {step === 'cover' && <Cover cfg={cfg} fill={fill} onNext={() => go('webtoon')} />}
      {step === 'webtoon' && (
        <Webtoon cfg={cfg} onNext={(via) => { pushEvent(via === 'skip' ? 'webtoon_skip' : 'webtoon_end_click', { landing: slug }); go('signup') }} />
      )}
      {step === 'signup' && (
        <ChatScreen bg={cfg.chatBg} speaker={cfg.speaker} line={fill(cfg.signup.line)} onBack={() => go('webtoon')}>
          <button
            type="button" onClick={startSignup} disabled={authLoading}
            className="w-full h-[60px] rounded-xl bg-[#FEE500] text-[#191919] font-bold text-[16px] flex flex-col items-center justify-center active:scale-[0.98] transition disabled:opacity-60"
          >
            <span className="flex items-center gap-2"><KakaoIcon />{user ? fill(cfg.signup.buttonMember) : cfg.signup.buttonGuest}</span>
            <span className="text-[11px] font-medium opacity-70">{cfg.signup.buttonSub}</span>
          </button>
          {!user && (
            <p className="text-[11px] text-white/60 text-center mt-3 leading-relaxed">
              가입하면 <Link to="/terms" className="underline">이용약관</Link>·<Link to="/privacy" className="underline">개인정보 처리방침</Link>에 동의하게 돼요. (만 14세 이상)
            </p>
          )}
        </ChatScreen>
      )}
      {step === 'saved' && (
        saveError ? (
          <ChatScreen bg={cfg.chatBg} speaker={cfg.speaker} line={/마감|정원|찼/.test(saveError) ? cfg.saved.full : saveError} delay={0}>
            <Link to="/" className="w-full h-14 rounded-xl bg-white text-black font-bold text-[17px] flex items-center justify-center">{cfg.saved.fullButton}</Link>
          </ChatScreen>
        ) : (
          <ChatScreen bg={cfg.chatBg} speaker={cfg.speaker} line={fill(cfg.saved.line)} delay={0}>
            <div className="flex justify-center py-2"><span className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" /></div>
          </ChatScreen>
        )
      )}
      {askIndex >= 0 && (
        <Ask
          key={step} cfg={cfg} slug={slug} ask={cfg.asks[askIndex]} index={askIndex} total={cfg.asks.length} fill={fill}
          onBack={askIndex > 0 ? () => go(ASK_STEPS[askIndex - 1]) : undefined}
          onNext={() => go(askIndex < ASK_STEPS.length - 1 ? ASK_STEPS[askIndex + 1] : 'done')}
        />
      )}
      {step === 'done' && (
        <Done
          cfg={cfg} fill={fill} already={already}
          openChatUrl={course?.after_purchase_url ?? null}
          tracking={course ? { contentId: buildContentId('course', course.id), contentName: course.title, instructorName: course.instructor?.name ?? null, email: profile?.email, phone: profile?.phone } : null}
          liveEvent={course && isUpcomingLive(course.scheduled_at) ? { courseId: course.id, title: course.title, startsAt: course.scheduled_at, openchatUrl: course.after_purchase_url } : null}
        />
      )}
    </div>
  )
}

/* ───────── W1 표지 ───────── */
function Cover({ cfg, fill, onNext }: { cfg: WebtoonLanding; fill: (s: string) => string; onNext: () => void }) {
  const c = cfg.cover
  return (
    <section className="relative max-w-[480px] mx-auto">
      <div className="relative h-[100dvh] overflow-hidden">
        {c.video ? (
          <video
            className="absolute inset-0 w-full h-full object-cover"
            src={r2Proxy(c.video)} poster={r2Proxy(c.poster)}
            autoPlay muted loop playsInline preload="auto"
          />
        ) : (
          <img className="absolute inset-0 w-full h-full object-cover" src={r2Proxy(c.poster)} alt="" fetchPriority="high" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85" />
        <div className="relative h-full flex flex-col items-center px-6 pt-[9vh] pb-[calc(env(safe-area-inset-bottom)+20px)]">
          <p className="text-[15px] tracking-[0.3em] font-semibold" style={{ color: GREEN }}>{c.kicker}</p>
          <h1 className="mt-2 text-[40px] leading-tight font-black text-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{c.title}</h1>
          <p className="mt-3 text-[16px] text-white/90 text-center">“ {c.quote} ”</p>
          <div className="flex-1" />
          <button
            type="button" onClick={onNext}
            className="w-full h-[60px] rounded-xl border-2 border-white bg-white/10 backdrop-blur-sm text-white font-bold active:scale-[0.98] transition flex flex-col items-center justify-center"
          >
            <span className="text-[17px]">{c.cta}</span>
            <span className="text-[11px] font-medium text-white/80">{c.ctaSub}</span>
          </button>
          <p className="mt-3 text-[12px] text-white/70">{fill(c.note)}</p>
          <a href="#more" className="mt-2 text-[11px] text-white/50 underline">{c.detailsSummary} ▾</a>
        </div>
      </div>
      <details id="more" className="px-6 py-6 bg-[#0b0f14] text-[13px] text-white/75 leading-relaxed">
        <summary className="cursor-pointer font-bold text-white">{c.detailsSummary}</summary>
        <div className="mt-3 space-y-3">{c.details.map((d) => <p key={d}>{d}</p>)}</div>
      </details>
    </section>
  )
}

/* ───────── W2 웹툰 ───────── */
function Webtoon({ cfg, onNext }: { cfg: WebtoonLanding; onNext: (via: 'skip' | 'end') => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [endVisible, setEndVisible] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const sent = useRef(new Set<number>())
  const key = `wt_scroll_${cfg.slug}`

  useEffect(() => {
    pushEvent('webtoon_view', { landing: cfg.slug })
    // 새로고침이면 보던 위치에서 이어 보기(뒤로 가기·새 진입은 맨 위부터)
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const y = Number(ss.get(key) || 0)
    if (nav?.type === 'reload' && y > 0) window.scrollTo(0, y)
    else ss.del(key)
  }, [cfg.slug, key])

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (window.scrollY > 20) setScrolled(true)
        ss.set(key, String(Math.round(window.scrollY)))
        const max = document.documentElement.scrollHeight - window.innerHeight
        const pct = max > 0 ? (window.scrollY / max) * 100 : 100
        for (const mark of [25, 50, 75, 100]) {
          if (pct >= mark - 1 && !sent.current.has(mark)) {
            sent.current.add(mark)
            pushEvent('webtoon_progress', { landing: cfg.slug, percent: mark })
          }
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [cfg.slug, key])

  useEffect(() => {
    const el = endRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setEndVisible(e.isIntersecting), { threshold: 0.1 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section className="max-w-[480px] mx-auto bg-[#0b0f14]">
      {!scrolled && (
        <div className="fixed left-6 bottom-[calc(env(safe-area-inset-bottom)+30px)] z-30 text-white/80 text-xs flex flex-col items-center animate-bounce pointer-events-none">
          <span>스크롤</span><span>▼</span>
        </div>
      )}
      {cfg.webtoon.cuts.map((c, i) => <Cut key={c.id} cut={c} eager={i < 2} />)}
      <div ref={endRef} className="px-6 pt-10 pb-[calc(env(safe-area-inset-bottom)+48px)] flex flex-col items-center gap-3">
        <button
          type="button" onClick={() => onNext('end')}
          className="w-full h-14 rounded-xl text-black font-bold text-[17px] active:scale-[0.98] transition"
          style={{ background: GREEN }}
        >
          {cfg.webtoon.endCta}
        </button>
        <p className="text-[12px] text-white/60">{cfg.webtoon.endNote}</p>
      </div>

      {!endVisible && (
        <div className="fixed z-40 right-[max(22px,calc(50vw-240px+22px))] bottom-[calc(env(safe-area-inset-bottom)+26px)] flex items-center gap-2">
          {!scrolled && (
            <span className="bg-white text-black text-[12px] font-bold rounded-full px-3 py-2 shadow-lg">{cfg.webtoon.skipBubble}</span>
          )}
          <button
            type="button" aria-label="웹툰 건너뛰기" onClick={() => onNext('skip')}
            className="w-10 h-10 rounded-full bg-white text-black font-black text-lg shadow-lg flex items-center justify-center active:scale-95"
          >
            »
          </button>
        </div>
      )}
    </section>
  )
}

function Cut({ cut, eager }: { cut: WebtoonCut; eager: boolean }) {
  if (!cut.src) return <TextScene card={cut.card ?? { lines: [] }} />
  return (
    <div className="relative" style={{ aspectRatio: `1 / ${cut.ratio}` }}>
      <img
        src={r2Proxy(cut.src)} alt="" className="absolute inset-0 w-full h-full object-cover"
        loading={eager ? 'eager' : 'lazy'} decoding="async"
      />
      {cut.bubbles.map((b, i) => <BubbleView key={i} b={b} />)}
    </div>
  )
}

/** 글자 장면 — 검은 바탕에 글자가 화면에 들어오면 한 줄씩 나타난다. 첫 줄이 질문(?)이거나 ①~⑤ 로 시작하면 제목 */
function TextScene({ card }: { card: NonNullable<WebtoonCut['card']> }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(0)
  const [started, setStarted] = useState(false)
  const typing = card.animation === 'typing'
  const titleFirst = !card.title && /[?？]$|^[①②③④⑤]/.test(card.lines[0] ?? '')
  const title = card.title ?? (titleFirst ? card.lines[0] : undefined)
  const body = titleFirst ? card.lines.slice(1) : card.lines
  const offset = titleFirst ? 1 : 0
  const total = body.length + (title ? 1 : 0) + (typing ? 1 : 0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStarted(true); io.disconnect() } }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!started || shown >= total) return
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 150 : typing && shown === (title ? 2 : 1) ? 2600 : 550) // 초안 화면이 다 채워진 뒤 다음 줄
    return () => window.clearTimeout(t)
  }, [started, shown, total, typing, title])

  const fade = (i: number) => `transition-all duration-700 ${shown > i ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`
  let k = 0
  return (
    <div ref={ref} className="relative flex flex-col items-center justify-center gap-4 px-8 py-16 text-center bg-[#0b0f14] border-y border-white/5" style={{ minHeight: '75vh' }}>
      {card.images && card.images.length > 0 && (
        <div className="flex gap-2 w-full justify-center mb-2">
          {card.images.map((src) => <img key={src} src={r2Proxy(src)} alt="" loading="lazy" className="w-[42%] aspect-[3/4] object-cover rounded-lg opacity-80" />)}
        </div>
      )}
      {title && <p className={`text-[24px] font-black leading-snug ${fade(k++)}`} style={{ color: GREEN }}>{title}</p>}
      {typing && <TypingDraft run={shown > k - 0} className={fade(k++)} />}
      {body.map((l, i) => {
        const idx = k++
        const hl = card.highlight?.includes(i + offset)
        return (
          <p key={i} className={`${hl ? 'text-[26px] font-black' : 'text-[18px] font-bold'} leading-relaxed whitespace-pre-line ${fade(idx)}`} style={hl ? { color: GREEN } : undefined}>{l}</p>
        )
      })}
      {card.note && <p className={`text-[11px] text-white/45 mt-2 ${fade(total - 1)}`}>{card.note}</p>}
    </div>
  )
}

/** 빈 글쓰기 화면 → 커서 깜빡임 → AI 초안이 한 줄씩 채워짐(약 2.5초) */
function TypingDraft({ run, className = '' }: { run: boolean; className?: string }) {
  const [n, setN] = useState(0)
  const BARS = [92, 78, 85, 60, 88, 70]
  useEffect(() => {
    if (!run || n >= BARS.length) return
    const t = window.setTimeout(() => setN((x) => x + 1), n === 0 ? 700 : 320)
    return () => window.clearTimeout(t)
  }, [run, n, BARS.length])
  return (
    <div className={`w-full max-w-[300px] rounded-xl bg-white text-left p-4 shadow-lg ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-gray-500">새 글 쓰기</span>
        <span className="text-[11px] font-bold" style={{ color: n >= BARS.length ? '#16a34a' : '#9ca3af' }}>{n >= BARS.length ? 'AI 초안 완료' : n > 0 ? 'AI 초안 작성 중…' : ''}</span>
      </div>
      <div className="space-y-2 min-h-[96px]">
        {BARS.slice(0, n).map((w, i) => <div key={i} className="h-2.5 rounded bg-gray-200" style={{ width: `${w}%` }} />)}
        {n < BARS.length && <span className="inline-block w-[2px] h-4 bg-gray-800 animate-pulse align-middle" />}
      </div>
    </div>
  )
}

function BubbleView({ b }: { b: Bubble }) {
  // 위치: 그림 높이 기준 %. 아래쪽(60% 넘음)은 말풍선 아래 끝을 그 위치에 맞춘다
  const pos: React.CSSProperties = { top: `${Math.min(b.top, 94)}%` }
  if (b.align === 'left') pos.left = 12
  else if (b.align === 'right') pos.right = 12
  else pos.left = '50%'
  const tx = b.align === 'center' ? 'translateX(-50%)' : ''
  const ty = b.top > 60 ? 'translateY(-100%)' : ''
  if (tx || ty) pos.transform = `${tx} ${ty}`.trim()
  // 청월당 웹툰과 같은 모양(2026-10-19 원본 캡처 기준): 글자는 가운데 정렬·보통 굵기·짧은 줄, 줄바꿈은 단어 단위
  const text = { wordBreak: 'keep-all', textWrap: 'balance' } as React.CSSProperties
  if (b.w) pos.width = `${b.w}%`
  switch (b.type) {
    case 'narration':
      // 흰 사각 + 얇은 검은 테두리, 넓게(화면 폭 55~72%), 여백 넉넉히
      return (
        <p className="absolute bg-[#fbfbf9] text-[#111] border-[1.5px] border-[#111] px-6 py-5 text-[14.5px] leading-[1.7] font-normal text-center"
          style={{ ...pos, ...text, minWidth: b.w ? undefined : '55%', maxWidth: '72%' }}>{b.text}</p>
      )
    case 'dark_box':
      // 검은 사각 + 흰 글자(전환)
      return <p className="absolute bg-black text-white px-5 py-3 text-[14px] leading-[1.6] font-normal text-center" style={{ ...pos, ...text, maxWidth: '60%' }}>{b.text}</p>
    case 'sfx':
      // 손글씨 효과음: 흰 글자 + 얇은 검은 외곽선, 기울임
      return (
        <p className="absolute text-[48px] font-extrabold text-white tracking-[-0.02em] [-webkit-text-stroke:1.2px_#111] [paint-order:stroke_fill] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
          style={{ ...pos, rotate: '-12deg', fontFamily: '"Nanum Pen Script","Gaegu",cursive', fontStyle: 'italic' }}>{b.text}</p>
      )
    case 'caption':
      return <p className="absolute text-[10.5px] leading-[1.5] text-white/85 bg-black/55 px-2.5 py-1.5" style={{ ...pos, ...text, maxWidth: '80%' }}>{b.text}</p>
    default: {
      // 대사: 거의 둥근 흰 타원 + 얇은 회색 테두리 + 가는 선 꼬리(말하는 사람 쪽). 아래쪽 말풍선은 꼬리를 위로
      const up = b.tail === 'up' || (b.tail == null && b.top > 60)
      const tailX = b.tailX ?? (b.align === 'right' ? 35 : b.align === 'left' ? 65 : 50)
      return (
        <div className="absolute" style={{ ...pos, maxWidth: '50%', minWidth: '34%' }}>
          <p className="relative bg-[#f8fafc] text-[#111] rounded-[50%] border border-black/30 shadow-[0_1px_3px_rgba(0,0,0,0.35)] px-6 py-6 text-[13.5px] leading-[1.6] font-normal text-center"
            style={text}>
            {b.text}
          </p>
          {b.tail !== 'none' && (
            <span className="absolute w-[1.5px] h-[22px] bg-[#f8fafc] shadow-[0_0_1px_rgba(0,0,0,0.6)]"
              style={{ left: `${tailX}%`, ...(up ? { bottom: '100%' } : { top: '100%' }), rotate: `${tailX < 50 ? 12 : tailX > 50 ? -12 : 0}deg` }} />
          )}
        </div>
      )
    }
  }
}

/* ───────── 대화 화면 틀 (W3~W7 공용) ───────── */
function ChatScreen({ bg, speaker, line, onBack, children, delay = 1500, top }: {
  bg: string; speaker: string; line: string; onBack?: () => void; children?: ReactNode; delay?: number; top?: ReactNode
}) {
  const [shown, setShown] = useState(delay === 0)
  useEffect(() => {
    if (delay === 0) return
    const t = window.setTimeout(() => setShown(true), delay)
    return () => window.clearTimeout(t)
  }, [delay])
  return (
    <section className="relative min-h-[100dvh] max-w-[480px] mx-auto overflow-hidden">
      <img src={r2Proxy(bg)} alt="" className="fixed inset-0 w-full max-w-[480px] mx-auto h-full object-cover" fetchPriority="high" />
      <div className="fixed inset-0 max-w-[480px] mx-auto bg-gradient-to-b from-black/20 via-transparent to-black/85" />
      <div className="absolute top-[calc(env(safe-area-inset-top)+14px)] inset-x-4 z-20 flex items-center">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="이전" className="h-9 px-3 rounded-full bg-black/40 text-white text-[13px] flex items-center gap-1">‹ 이전</button>
        )}
        <div className="flex-1 flex justify-center">{top}</div>
        {onBack && <span className="w-[68px]" />}
      </div>
      <div className={`relative z-10 min-h-[100dvh] flex flex-col justify-end px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] transition-all duration-700 ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        <div className="mb-5">
          <span className="text-[12px] font-bold" style={{ color: GREEN }}>{speaker}</span>
          <p className="mt-1 text-[19px] leading-relaxed font-bold whitespace-pre-line drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">“ {line} ”</p>
        </div>
        {children}
      </div>
    </section>
  )
}

/* ───────── W5·W6 선택 질문 (한 화면에 하나, 진행 점) ───────── */
function Ask({ cfg, slug, ask, index, total, fill, onBack, onNext }: {
  cfg: WebtoonLanding; slug: string; ask: AskStep; index: number; total: number; fill: (s: string) => string
  onBack?: () => void; onNext: () => void
}) {
  const key = `wt_ans_${slug}`
  const [answers, setAnswers] = useState<Answers>(() => { try { return JSON.parse(ss.get(key) || '{}') as Answers } catch { return {} } })
  const value = answers[ask.key] ?? ''
  const set = (v: string) => {
    const next = { ...answers, [ask.key]: v }
    setAnswers(next)
    ss.set(key, JSON.stringify(next))
  }
  const [busy, setBusy] = useState(false)

  const next = async () => {
    if (busy) return
    setBusy(true)
    const v = value.trim()
    pushEvent('ask_step', { landing: slug, step: index + 1, answered: !!v })
    if (v) {
      // 선택 답 저장 — 표(course_survey_answers)·함수가 아직 없으면 조용히 넘어간다(신청은 이미 저장됨)
      await supabase.rpc('save_course_survey' as never, {
        p_course_id: cfg.courseId,
        p_blog_exp: ask.key === 'blog_exp' ? v : null,
        p_daily_time: ask.key === 'daily_time' ? v : null,
        p_concern: ask.key === 'concern' ? v : null,
      } as never).then(({ error }) => { if (error) console.warn('[webtoon] 선택 답 저장 실패', error.message) }, () => {})
    }
    setBusy(false)
    onNext()
  }

  const dots = (
    <div className="flex items-center gap-1.5" aria-label={`${index + 1}/${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="w-2 h-2 rounded-full" style={{ background: i <= index ? GREEN : 'rgba(255,255,255,0.35)' }} />
      ))}
      <span className="ml-1 text-[11px] text-white/70">{index + 1}/{total}</span>
    </div>
  )

  return (
    <ChatScreen bg={cfg.chatBg} speaker={cfg.speaker} line={fill(ask.line)} onBack={onBack} top={dots}>
      {ask.options ? (
        <div className="flex flex-col gap-2">
          {ask.options.map((o) => (
            <button
              key={o} type="button" onClick={() => set(value === o ? '' : o)}
              className="w-full h-12 rounded-xl text-[16px] font-semibold border transition"
              style={value === o ? { background: GREEN, color: '#000', borderColor: GREEN } : { background: 'rgba(0,0,0,0.55)', color: '#fff', borderColor: 'rgba(255,255,255,0.35)' }}
            >
              {o}
            </button>
          ))}
        </div>
      ) : (
        <>
          <textarea
            value={value} onChange={(e) => set(e.target.value.slice(0, CONCERN_MAX))}
            placeholder={ask.placeholder} rows={4}
            className="w-full rounded-xl bg-white text-black p-3 text-[16px] resize-none"
          />
          <p className="text-right text-[11px] text-white/60 mt-1">{value.length}/{CONCERN_MAX}</p>
        </>
      )}
      {ask.why && <p className="text-[12px] text-white/65 mt-3 leading-relaxed">{ask.why}</p>}
      <p className="text-[11px] text-white/50 mt-1">* {cfg.skipNote}</p>
      <button type="button" onClick={next} disabled={busy} className="mt-4 w-full h-14 rounded-xl text-black font-bold text-[17px] disabled:opacity-70" style={{ background: GREEN }}>
        {ask.button}
      </button>
    </ChatScreen>
  )
}

/* ───────── W7 완료 ───────── */
function Done({ cfg, fill, already, openChatUrl, tracking, liveEvent }: {
  cfg: WebtoonLanding; fill: (s: string) => string; already: boolean; openChatUrl: string | null
  tracking: { contentId: string; contentName: string; instructorName: string | null; email?: string | null; phone?: string | null } | null
  liveEvent: { courseId: number; title: string; startsAt: string; openchatUrl?: string | null } | null
}) {
  const navigatingRef = useRef(false)
  const sameTab = useMemo(() => IN_APP_RE.test(navigator.userAgent), [])

  // 오픈채팅 입장 — 사용자가 눌렀을 때만 연다(팝업 차단 방지). 입장 기록·전환 이벤트는 AfterPurchaseLinkModal 과 같게
  const recordJoin = () => {
    trackOpenChatJoin({
      dedupeKey: openChatUrl ?? '',
      contentId: tracking?.contentId, contentName: tracking?.contentName, instructorName: tracking?.instructorName,
      user: { email: tracking?.email, phone: tracking?.phone },
    })
    return logOpenChat(tracking?.contentId, true)
  }
  const enter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!openChatUrl) return
    if (!sameTab) { void recordJoin(); return }
    e.preventDefault()
    if (navigatingRef.current) return
    navigatingRef.current = true
    const goTo = () => { window.location.href = openChatUrl }
    Promise.race([recordJoin(), new Promise((r) => setTimeout(r, 800))]).then(goTo, goTo)
  }

  return (
    <ChatScreen bg={cfg.doneBg} speaker={cfg.speaker} line={fill(already ? cfg.done.already : cfg.done.line)}>
      <p className="text-[13px] text-white/85 mb-3">{cfg.done.notice}</p>
      {cfg.done.gift && <p className="text-[13px] mb-3" style={{ color: GREEN }}>{cfg.done.gift}</p>}
      {openChatUrl && (
        <a
          href={openChatUrl} target={sameTab ? '_self' : '_blank'} rel="noopener noreferrer" onClick={enter}
          className="w-full h-14 rounded-xl text-black font-bold text-[17px] flex items-center justify-center no-underline" style={{ background: GREEN }}
        >
          오픈채팅 입장하기
        </a>
      )}
      {liveEvent && (
        <div className="mt-3 rounded-xl bg-white">
          <LiveCalendarCta event={liveEvent} />
        </div>
      )}
      <p className="mt-4 text-[10px] text-white/50 leading-relaxed">{cfg.done.legal}</p>
    </ChatScreen>
  )
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#191919" d="M12 3C6.48 3 2 6.48 2 10.77c0 2.76 1.84 5.18 4.6 6.55l-.94 3.44c-.08.3.26.54.52.37l4.1-2.71c.56.08 1.13.12 1.72.12 5.52 0 10-3.48 10-7.77S17.52 3 12 3z" /></svg>
  )
}
