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
import { WEBTOON_LANDINGS, CONCERN_MAX, type Bubble, type WebtoonCut, type WebtoonLanding, type AskStep, type Paywall } from '../lib/webtoonLandings'

// 웹툰식 랜딩 /w/:slug — 표지(W1) → 웹툰(W2) → 카카오 신청(W3) → 자동 신청 저장(W4) → 선택 질문 3개(W5·W6) → 완료(W7).
// 화면 흐름: PM 스토리보드 v3 '5 · 화면 흐름표' + 6장 권장안 R1~R5. 강의 상세·기존 신청 흐름과는 별개 페이지이고,
// 신청은 강의 상세와 같은 서버 함수(enroll_free)·알림톡·전환 이벤트를 쓴다.
// 단계는 주소 ?step= 로 나누고 새로고침 없이 바꾼다(뒤로 가기 = 앞 단계, 새로고침해도 그 단계에서 이어 보기).

// confirm = v7.1 페이월의 신청 확인 화면(P8). signup = 예전 대화형 카카오 화면
type Step = 'cover' | 'webtoon' | 'confirm' | 'signup' | 'saved' | 'ask1' | 'ask2' | 'ask3' | 'done'
const STEPS: Step[] = ['cover', 'webtoon', 'confirm', 'signup', 'saved', 'ask1', 'ask2', 'ask3', 'done']
const ASK_STEPS: Step[] = ['ask1', 'ask2', 'ask3']
const GREEN = '#2ED573'

/** 랜딩 색 테마 — 설정(cfg.theme) 한 곳에서 바탕·글자·덮개·기본 띠 색을 바꾼다. 기본 light(10/19 대표님: 밝은 톤).
 *  컷 사이 띠·흐림 색은 PM 전환값(transitions.color)이 있으면 그 색이 우선 */
const THEMES: Record<'dark' | 'light', React.CSSProperties> = {
  dark: {
    '--wt-bg': '#000', '--wt-fg': '#fff', '--wt-muted': 'rgba(255,255,255,0.62)', '--wt-faint': 'rgba(255,255,255,0.45)',
    '--wt-line': 'rgba(255,255,255,0.12)', '--wt-card': 'rgba(255,255,255,0.05)', '--wt-band': '#000', '--wt-scene-bg': '#000',
    '--wt-cover-top': 'rgba(0,0,0,0.7)', '--wt-cover-bottom': 'rgba(0,0,0,0.85)', '--wt-title-shadow': '0 2px 10px rgba(0,0,0,0.8)',
  } as React.CSSProperties,
  light: {
    '--wt-bg': '#ffffff', '--wt-fg': '#111111', '--wt-muted': 'rgba(17,17,17,0.62)', '--wt-faint': 'rgba(17,17,17,0.45)',
    '--wt-line': 'rgba(0,0,0,0.1)', '--wt-card': 'rgba(0,0,0,0.035)', '--wt-band': '#ffffff', '--wt-scene-bg': '#FFFDF8',
    '--wt-cover-top': 'rgba(255,255,255,0.75)', '--wt-cover-bottom': 'rgba(255,255,255,0.92)', '--wt-title-shadow': '0 1px 10px rgba(255,255,255,0.9)',
  } as React.CSSProperties,
}
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
    if ((step === 'signup' || step === 'confirm') && user && owned === true) {
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
      // 선택 질문이 있으면 질문으로, 없으면(v7.1) 바로 완료 — 안쪽이 열림
      window.setTimeout(() => go(cfg.asks.length ? 'ask1' : 'done', true), 1200)
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
    <div className="bg-[var(--wt-bg)] min-h-[100dvh] text-[var(--wt-fg)]" style={THEMES[cfg.theme ?? 'light']}>
      <SeoHead override={{ title: cfg.seo.title, description: cfg.seo.description, ogImage: cfg.seo.image, twitterImage: cfg.seo.image }} />
      {step === 'cover' && <Cover cfg={cfg} fill={fill} onNext={() => go('webtoon')} />}
      {step === 'webtoon' && (
        <Webtoon
          cfg={cfg} liveAt={course?.scheduled_at ?? null} unlocked={owned === true}
          onNext={(via) => { pushEvent(via === 'skip' ? 'webtoon_skip' : 'webtoon_end_click', { landing: slug }); go('signup') }}
          footer={cfg.paywall ? (
            <Paywall
              pw={cfg.paywall} fill={fill} unlocked={owned === true}
              onApply={() => { pushEvent('offer_click', { landing: slug }); go('confirm') }}
              openChatUrl={course?.after_purchase_url ?? null}
              tracking={course ? { contentId: buildContentId('course', course.id), contentName: course.title, instructorName: course.instructor?.name ?? null, email: profile?.email, phone: profile?.phone } : null}
            />
          ) : undefined}
        />
      )}
      {step === 'confirm' && cfg.paywall && (
        <ConfirmScreen cfg={cfg} pw={cfg.paywall} fill={fill} onApply={startSignup} onBack={() => go('webtoon')} busy={authLoading} loggedIn={!!user} />
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
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, var(--wt-cover-top), transparent 33%, transparent 66%, var(--wt-cover-bottom))' }} />
        <div className={`relative h-full flex flex-col items-center px-6 ${c.logo ? 'pt-[calc(env(safe-area-inset-top)+14px)]' : 'pt-[9vh]'} pb-[calc(env(safe-area-inset-bottom)+20px)]`}>
          {/* 로고형: titleTop 이면 제목을 위(그림 위 0~33% 빈 자리, vF), 아니면 얼굴을 피해 아래쪽(v7.2) */}
          {c.logo && <p className="text-[13px] font-bold tracking-[0.2em] text-[var(--wt-fg)]">{c.logo}</p>}
          {c.logo && <div className={c.titleTop ? 'h-[4vh]' : 'flex-1'} />}
          <p className="text-[15px] tracking-[0.3em] font-semibold" style={{ color: GREEN }}>{c.kicker}</p>
          <h1 className="mt-2 text-[40px] leading-tight font-black text-center" style={{ textShadow: 'var(--wt-title-shadow)' }}>{c.title}</h1>
          <p className="mt-3 text-[16px] text-[var(--wt-fg)] text-center">“ {c.quote} ”</p>
          <div className={c.logo && !c.titleTop ? 'h-6' : 'flex-1'} />
          <button
            type="button" onClick={onNext}
            className="w-full h-[60px] rounded-xl border-2 border-[var(--wt-fg)] bg-[var(--wt-card)] backdrop-blur-sm text-[var(--wt-fg)] font-bold active:scale-[0.98] transition flex flex-col items-center justify-center"
          >
            <span className="text-[17px]">{c.cta}</span>
            {c.ctaSub && <span className="text-[11px] font-medium text-[var(--wt-fg)]">{c.ctaSub}</span>}
          </button>
          <p className="mt-3 text-[12px] text-[var(--wt-muted)]">{fill(c.note)}</p>
          <a href="#more" className="mt-2 text-[11px] text-[var(--wt-faint)] underline">{c.detailsSummary} ▾</a>
        </div>
      </div>
      <details id="more" className="px-6 py-6 bg-[var(--wt-bg)] text-[13px] text-[var(--wt-muted)] leading-relaxed">
        <summary className="cursor-pointer font-bold text-[var(--wt-fg)]">{c.detailsSummary}</summary>
        <div className="mt-3 space-y-3">{c.details.map((d) => <p key={d}>{d}</p>)}</div>
      </details>
    </section>
  )
}

/* ───────── W2 웹툰 ───────── */
function Webtoon({ cfg, onNext, footer, liveAt, unlocked }: {
  cfg: WebtoonLanding; onNext: (via: 'skip' | 'end') => void; footer?: ReactNode; liveAt?: string | null; unlocked?: boolean
}) {
  const [scrolled, setScrolled] = useState(false)
  const [pastTop, setPastTop] = useState(false)
  const [offerVisible, setOfferVisible] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    if (!footer) return
    const el = document.getElementById('wt-offer')
    if (!el) return
    const io = new IntersectionObserver(([e]) => setOfferVisible(e.isIntersecting), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [footer])
  const toPaywall = () => document.getElementById('paywall')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const toOffer = () => document.getElementById('wt-offer')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
        setPastTop(window.scrollY > document.documentElement.scrollHeight * 0.2)
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
    <section className="max-w-[480px] mx-auto bg-[var(--wt-bg)]" style={{ containerType: 'inline-size' }}>
      {!scrolled && (
        <div className="fixed left-6 bottom-[calc(env(safe-area-inset-bottom)+30px)] z-30 text-[var(--wt-fg)] text-xs flex flex-col items-center animate-bounce pointer-events-none">
          <span>스크롤</span><span>▼</span>
        </div>
      )}
      {groupCuts(cfg.webtoon.cuts).map((g, i) =>
        Array.isArray(g) ? <ReviewDeck key={g[0].id} cuts={g} /> : <Cut key={g.id} cut={g} eager={i < 2} />)}
      {footer ? (
        <div ref={endRef}>{footer}</div>
      ) : (
        <div ref={endRef} className="px-6 pt-10 pb-[calc(env(safe-area-inset-bottom)+48px)] flex flex-col items-center gap-3">
          <button
            type="button" onClick={() => onNext('end')}
            className="w-full h-14 rounded-xl text-black font-bold text-[17px] active:scale-[0.98] transition"
            style={{ background: GREEN }}
          >
            {cfg.webtoon.endCta}
          </button>
          <p className="text-[12px] text-[var(--wt-muted)]">{cfg.webtoon.endNote}</p>
        </div>
      )}

      {/* P7 떠 있는 바 — 위 20% 지나면, 오퍼 카드가 보이면 숨김. 이미 신청했으면 없음 */}
      {footer && !unlocked && pastTop && !offerVisible && (
        <div className="fixed z-40 bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3" style={{ background: 'linear-gradient(to top, var(--wt-bg), var(--wt-bg) 55%, transparent)' }}>
          <button type="button" onClick={toOffer} className="w-full h-14 rounded-xl text-black font-bold flex items-center justify-between px-5" style={{ background: GREEN }}>
            <span className="text-[13px] font-semibold">{liveRemain(liveAt, now) ?? '유튜브 무료 라이브'}</span>
            <span className="text-[16px]">{cfg.paywall?.floatButton ?? '신청하기'} ›</span>
          </button>
        </div>
      )}

      {!endVisible && !(footer && pastTop) && (
        <div className="fixed z-40 right-[max(22px,calc(50vw-240px+22px))] bottom-[calc(env(safe-area-inset-bottom)+26px)] flex items-center gap-2">
          {!scrolled && (
            <span className="bg-white text-black text-[12px] font-bold rounded-full px-3 py-2 shadow-lg">{cfg.webtoon.skipBubble}</span>
          )}
          <button
            type="button" aria-label="웹툰 건너뛰기" onClick={() => { if (footer) { pushEvent('webtoon_skip', { landing: cfg.slug }); toPaywall() } else onNext('skip') }}
            className="w-10 h-10 rounded-full bg-white text-black font-black text-lg shadow-lg flex items-center justify-center active:scale-95"
          >
            »
          </button>
        </div>
      )}
    </section>
  )
}

/** 연달아 있는 후기 컷은 한 묶음(배열)으로 — 휴대폰 틀 하나에서 넘겨 보게 */
function groupCuts(cuts: WebtoonCut[]): (WebtoonCut | WebtoonCut[])[] {
  const out: (WebtoonCut | WebtoonCut[])[] = []
  for (const c of cuts) {
    const last = out[out.length - 1]
    if (c.review && Array.isArray(last)) last.push(c)
    else out.push(c.review ? [c] : c)
  }
  return out
}

// 컷 이음새 — PM 대사목록 transitions(청월당 원본 측정값, 그림 폭 %): 위 그림 아래쪽을 띠 색으로 흐리고(fadeBottom),
// 띠(band)를 두고, 다음 그림 위쪽을 같은 색에서 그림으로 흐린다(fadeTop). 겹치기 없음. 값이 없으면 기본(36·24·36, 검정).
const DEFAULT_FADE = 36
const DEFAULT_BAND = 24

function Band({ cut, children }: { cut: WebtoonCut; children?: ReactNode }) {
  const band = cut.band
  if (!band && !children) return null
  return (
    <div className="relative z-10 flex flex-col items-center justify-start px-[7.7cqw]" style={{ background: band?.color ?? 'var(--wt-band)', minHeight: band ? `${band.size}cqw` : undefined, paddingTop: children ? '2cqw' : undefined }}>
      {children}
    </div>
  )
}

function Captions({ items }: { items: Bubble[] }) {
  if (items.length === 0) return null
  return (
    <div className="text-center text-[var(--wt-muted)] pb-[2cqw]" style={{ fontSize: '2.6cqw', lineHeight: 1.45, wordBreak: 'keep-all' }}>
      {items.map((c, i) => <p key={i}>{c.text}</p>)}
    </div>
  )
}

/** 띠 안에 얹는 앞 문구(실제 자료·후기 앞) — 내레이션은 흰 사각, 대사는 둥근 말풍선 모양 */
function BeforeLine({ b }: { b: { type: 'narration' | 'speech'; text: string } }) {
  const text: React.CSSProperties = { wordBreak: 'keep-all', textWrap: 'balance', fontSize: '4cqw', lineHeight: '7.2cqw', fontWeight: 500 }
  return b.type === 'speech' ? (
    <p className="bg-[#F7F8FB] text-[#111] text-center rounded-[999px]" style={{ ...text, border: '0.22cqw solid #111', padding: '4cqw 7cqw', maxWidth: '80cqw' }}>{b.text}</p>
  ) : (
    <p className="bg-white text-[#111] text-center" style={{ ...text, border: '0.36cqw solid #111', padding: '4.6cqw 5.3cqw', maxWidth: '80cqw' }}>{b.text}</p>
  )
}

function Cut({ cut, eager }: { cut: WebtoonCut; eager: boolean }) {
  if (cut.real) return <RealBlock cut={cut} />
  if (cut.carousel) {
    const cuts: WebtoonCut[] = cut.carousel.images.map((src, i) => ({ id: `${cut.id}-${i}`, src, ratio: 1, bubbles: [], review: { note: cut.carousel!.note } }))
    return (
      <>
        <div className="bg-[var(--wt-bg)] pt-[10cqw] flex justify-center px-[7.7cqw]">{cut.carousel.before && <BeforeLine b={cut.carousel.before} />}</div>
        <ReviewDeck cuts={cuts} intervalMs={cut.carousel.intervalMs ?? 3000} />
        <Band cut={cut} />
      </>
    )
  }
  if (!cut.src) return <><TextScene card={cut.card ?? { lines: [] }} /><Band cut={cut} /></>
  if (cut.review) return <ReviewDeck cuts={[cut]} />
  // 작은 출처·주석 글은 그림 위가 아니라 컷 아래 띠에 — 내레이션 상자와 겹치지 않게(K17)
  const captions = cut.bubbles.filter((b) => b.type === 'caption')
  const bubbles = cut.bubbles.filter((b) => b.type !== 'caption')
  const top = cut.fadeTop
  const bottom = cut.fadeBottom ?? (cut.band ? { size: DEFAULT_FADE, color: cut.band.color } : undefined)
  return (
    <>
      <div className="relative" style={{ aspectRatio: `1 / ${cut.ratio}` }}>
        <img
          src={r2Proxy(cut.src)} alt="" className="absolute inset-0 w-full h-full object-cover"
          loading={eager ? 'eager' : 'lazy'} decoding="async"
        />
        {top && <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: `${top.size}cqw`, background: `linear-gradient(to bottom, ${top.color}, transparent)` }} />}
        {bottom && <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: `${bottom.size}cqw`, background: `linear-gradient(to top, ${bottom.color}, transparent)` }} />}
        {bubbles.map((b, i) => <BubbleView key={i} b={b} />)}
      </div>
      {(cut.band || captions.length > 0) && <Band cut={cut.band ? cut : { ...cut, band: { size: DEFAULT_BAND / 2, color: 'var(--wt-band)' } }}><Captions items={captions} /></Band>}
    </>
  )
}

/** 실제 자료 — 검은 띠 안에 앞 문구, 그림(여러 장이면 세로로 이어 붙임), 출처 작은 글. 공개 전 확인 중이면 자리 표시 */
function RealBlock({ cut }: { cut: WebtoonCut }) {
  const r = cut.real!
  return (
    <>
      <div className="bg-[var(--wt-bg)] px-[7.7cqw] pt-[10cqw] pb-[6cqw] flex justify-center">{r.before && <BeforeLine b={r.before} />}</div>
      <div className="bg-[var(--wt-bg)]">
        {r.pending ? (
          <div className="mx-[7.7cqw] rounded-xl border border-dashed border-[var(--wt-line)] py-[14cqw] text-center text-[var(--wt-faint)]" style={{ fontSize: '3.4cqw' }}>{r.pending}</div>
        ) : (
          r.images.map((src) => <img key={src} src={r2Proxy(src)} alt="실제 자료" loading="lazy" decoding="async" className="w-full block mb-[2cqw]" />)
        )}
        {r.note && <p className="px-[7.7cqw] pt-[2cqw] text-center text-[var(--wt-muted)]" style={{ fontSize: '2.6cqw', lineHeight: 1.45, wordBreak: 'keep-all' }}>{r.note}</p>}
      </div>
      <Band cut={cut.band ? cut : { ...cut, band: { size: 18, color: 'var(--wt-band)' } }} />
    </>
  )
}

/** 줄 안의 강조 낱말을 초록·크게 */
function emphasize(line: string, words?: string[]): ReactNode {
  if (!words?.length) return line
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  return line.split(re).map((part, i) => (words.includes(part) ? <span key={i} className="text-[1.25em] font-black" style={{ color: GREEN }}>{part}</span> : part))
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
    <div ref={ref} className="relative flex flex-col items-center justify-center gap-4 px-8 py-16 text-center bg-[var(--wt-scene-bg)]" style={{ minHeight: "50vh" }}>
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
          <p key={i} className={`${hl ? 'text-[26px] font-black' : 'text-[18px] font-bold'} leading-relaxed whitespace-pre-line ${fade(idx)}`} style={hl ? { color: GREEN } : undefined}>{emphasize(l, card.emphasis)}</p>
        )
      })}
      {card.note && <p className={`text-[11px] text-[var(--wt-faint)] mt-2 ${fade(total - 1)}`}>{card.note}</p>}
    </div>
  )
}

/** 실제 후기 — 연달아 있는 후기 컷을 휴대폰 화면 틀 하나에 넣고 한 장씩 넘긴다(옆으로 밀기 + 화면에 보이면 4초마다 자동).
 *  카드마다 note(원문·개인의 경험) 작은 글 */
function ReviewDeck({ cuts, intervalMs = 4000 }: { cuts: WebtoonCut[]; intervalMs?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(false)
  const [touched, setTouched] = useState(false)
  const header = cuts.find((c) => c.review?.header)?.review?.header

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const goTo = useCallback((i: number) => {
    const t = track.current
    if (t) t.scrollTo({ left: i * t.clientWidth, behavior: 'smooth' })
  }, [])
  // 자동 넘김 — 화면에 보일 때만, 사용자가 직접 넘기면 멈춤
  useEffect(() => {
    if (!visible || touched || cuts.length < 2) return
    const t = window.setTimeout(() => goTo((idx + 1) % cuts.length), intervalMs)
    return () => window.clearTimeout(t)
  }, [visible, touched, idx, cuts.length, goTo, intervalMs])
  const onScroll = () => {
    const t = track.current
    if (t) setIdx(Math.round(t.scrollLeft / Math.max(1, t.clientWidth)))
  }

  return (
    <div ref={ref} className="bg-[var(--wt-bg)] px-6 pt-10 pb-8 flex flex-col items-center">
      {header && <p className="text-[17px] font-bold text-[var(--wt-fg)] mb-5">{header}</p>}
      <div className="w-[86%] rounded-[30px] border-[6px] border-[#1f2937] bg-[#111] p-2 shadow-2xl">
        <div
          ref={track} onScroll={onScroll} onTouchStart={() => setTouched(true)} onMouseDown={() => setTouched(true)}
          className="flex overflow-x-auto snap-x snap-mandatory rounded-[22px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cuts.map((c) => (
            <div key={c.id} className="w-full shrink-0 snap-center flex items-center bg-[#111]">
              <img src={r2Proxy(c.src ?? '')} alt="수강생 후기" decoding="async" className="w-full block" />
            </div>
          ))}
        </div>
      </div>
      {cuts.length > 1 && (
        <div className="flex gap-1.5 mt-3" aria-label={`${idx + 1}/${cuts.length}`}>
          {cuts.map((c, i) => (
            <button key={c.id} type="button" aria-label={`후기 ${i + 1}`} onClick={() => { setTouched(true); goTo(i) }}
              className="w-2 h-2 rounded-full" style={{ background: i === idx ? GREEN : 'rgba(255,255,255,0.3)' }} />
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-[var(--wt-muted)] text-center min-h-[2.4em]" style={{ wordBreak: 'keep-all' }}>{cuts[idx]?.review?.note}</p>
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

// 말풍선 — PM 대사목록_v6 '말풍선규격'(청월당 원본 11장 측정값). 크기는 모두 그림 폭(W) 기준이라 cqw(웹툰 영역 폭의 %)로 쓴다.
const SIDE = '7.7cqw' // 좌우 바깥 여백
function BubbleView({ b }: { b: Bubble }) {
  const anchorBottom = b.anchor ? b.anchor === 'bottom' : b.top > 60
  // zIndex: 다음 컷이 위로 살짝 겹치므로(Cut OVERLAP) 말풍선이 그 그림 아래로 묻히지 않게
  const pos: React.CSSProperties = { top: `${b.top}%`, zIndex: 10 }
  if (b.align === 'left') pos.left = SIDE
  else if (b.align === 'right') pos.right = SIDE
  else pos.left = '50%'
  const tx = b.align === 'center' ? 'translateX(-50%)' : ''
  const ty = anchorBottom ? 'translateY(-100%)' : ''
  if (tx || ty) pos.transform = `${tx} ${ty}`.trim()
  const text: React.CSSProperties = { wordBreak: 'keep-all', textWrap: 'balance', fontSize: '4cqw', lineHeight: '7.2cqw', fontWeight: 500 }
  const maxW = b.maxW ? `${b.maxW}cqw` : undefined
  switch (b.type) {
    case 'narration':
      // 흰 사각, 모서리·그림자 없음, 0.36%W 검은 테두리, 폭 50~80%W(글자에 맞춤)
      return (
        <p className="absolute bg-white text-[#111] text-center"
          style={{ ...pos, ...text, border: '0.36cqw solid #111', padding: '4.6cqw 5.3cqw', minWidth: b.maxW ? undefined : '50cqw', maxWidth: maxW ?? '80cqw', width: b.w ? `${b.w}cqw` : 'max-content' }}>
          {b.text}
        </p>
      )
    case 'dark_box':
      // 검은 사각, 테두리 없음, 폭 약 41%W, 한 줄 높이 약 22%W
      return (
        <p className="absolute bg-black text-white text-center flex items-center justify-center"
          style={{ ...pos, ...text, width: b.w ? `${b.w}cqw` : '41cqw', minHeight: '22cqw', padding: '4cqw 5cqw' }}>
          {b.text}
        </p>
      )
    case 'sfx':
      // 굵은 손글씨, 흰 글자 + 0.5%W 검은 외곽선, 글자 높이 12~20%W, -8°~-15°
      return (
        <p className="absolute text-white leading-none [paint-order:stroke_fill]"
          style={{ ...pos, fontSize: '14cqw', fontWeight: 900, WebkitTextStroke: '0.5cqw #111', rotate: '-10deg', fontFamily: '"Nanum Pen Script","Gaegu",cursive' }}>
          {b.text}
        </p>
      )
    case 'caption':
      // 작은 출처·주석: 2.4%W 흰색 70%, 그림 맨 아래 가운데
      return (
        <p className="absolute text-center text-white/70"
          style={{ ...pos, left: '50%', right: undefined, transform: `translateX(-50%)${anchorBottom ? ' translateY(-100%)' : ''}`, width: '90cqw', fontSize: '2.4cqw', lineHeight: 1.35, wordBreak: 'keep-all' }}>
          {b.text}
        </p>
      )
    default: {
      // 대사: 타원(#F7F8FB, 0.22%W 테두리), 폭 42~53%W(기본 48%W), 꼬리는 얇은 삼각형(밑변 2.7%W, 길이 약 8%W) — 말하는 사람 쪽
      const up = b.tail === 'up' || (b.tail == null && anchorBottom)
      const tailX = b.tailX ?? (b.align === 'right' ? 30 : b.align === 'left' ? 70 : 50)
      const width = b.w ? `${b.w}cqw` : maxW ? `min(48cqw, ${maxW})` : '48cqw'
      return (
        <div className="absolute" style={{ ...pos, width }}>
          <p className="relative bg-[#F7F8FB] text-[#111] text-center rounded-[50%] flex items-center justify-center"
            style={{ ...text, border: '0.22cqw solid #111', padding: '7cqw 6cqw', minHeight: `calc(${width} * 0.85)` }}>
            {b.text}
          </p>
          {b.tail !== 'none' && (
            <svg className="absolute overflow-visible" width="1" height="1" aria-hidden="true"
              style={{ left: `${tailX}%`, ...(up ? { top: 0 } : { bottom: 0 }), width: '2.7cqw', height: '8cqw', transform: `translate(-50%, ${up ? '-85%' : '85%'}) rotate(${tailX < 45 ? (up ? -18 : 18) : tailX > 55 ? (up ? 18 : -18) : 0}deg)` }}
              viewBox="0 0 10 30" preserveAspectRatio="none">
              <path d={up ? 'M0 30 L5 0 L10 30' : 'M0 0 L5 30 L10 0'} fill="#F7F8FB" stroke="#111" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
            </svg>
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

/* ───────── 오픈채팅 입장 버튼 ───────── */
type OpenChatTracking = { contentId: string; contentName: string; instructorName: string | null; email?: string | null; phone?: string | null } | null
type LiveEventProp = { courseId: number; title: string; startsAt: string; openchatUrl?: string | null } | null

// 사용자가 눌렀을 때만 연다(팝업 차단 방지). 입장 기록·전환 이벤트는 AfterPurchaseLinkModal 과 같게
function OpenChatButton({ url, tracking }: { url: string; tracking: OpenChatTracking }) {
  const navigatingRef = useRef(false)
  const sameTab = useMemo(() => IN_APP_RE.test(navigator.userAgent), [])
  const recordJoin = () => {
    trackOpenChatJoin({
      dedupeKey: url,
      contentId: tracking?.contentId, contentName: tracking?.contentName, instructorName: tracking?.instructorName,
      user: { email: tracking?.email, phone: tracking?.phone },
    })
    return logOpenChat(tracking?.contentId, true)
  }
  const enter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!sameTab) { void recordJoin(); return }
    e.preventDefault()
    if (navigatingRef.current) return
    navigatingRef.current = true
    const goTo = () => { window.location.href = url }
    Promise.race([recordJoin(), new Promise((r) => setTimeout(r, 800))]).then(goTo, goTo)
  }
  return (
    <a
      href={url} target={sameTab ? '_self' : '_blank'} rel="noopener noreferrer" onClick={enter}
      className="w-full h-14 rounded-xl text-black font-bold text-[17px] flex items-center justify-center no-underline" style={{ background: GREEN }}
    >
      오픈채팅 입장하기
    </a>
  )
}

/* ───────── W7 완료 ───────── */
function Done({ cfg, fill, already, openChatUrl, tracking, liveEvent }: {
  cfg: WebtoonLanding; fill: (s: string) => string; already: boolean; openChatUrl: string | null
  tracking: OpenChatTracking; liveEvent: LiveEventProp
}) {
  const pw = cfg.paywall
  if (pw) {
    // v7.1 P9 — 안쪽이 열림
    return (
      <section className="max-w-[480px] mx-auto min-h-[100dvh] bg-[var(--wt-bg)] px-5 pt-[calc(env(safe-area-inset-top)+36px)] pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <img src={r2Proxy(pw.lastImage)} alt="" className="w-28 h-28 rounded-full object-cover mx-auto border-2" style={{ borderColor: GREEN }} />
        <h1 className="mt-5 text-[24px] font-black text-center leading-snug">{fill(already ? pw.alreadyLine : pw.doneTitle)}</h1>
        <div className="mt-6"><LockedList pw={pw} unlocked /></div>
        <p className="mt-6 text-[16px] font-bold text-center leading-relaxed" style={{ color: GREEN }}>{fill(pw.doneLine)}</p>
        <div className="mt-5 space-y-3">
          {openChatUrl && <OpenChatButton url={openChatUrl} tracking={tracking} />}
          {liveEvent && <div className="rounded-xl bg-white"><LiveCalendarCta event={liveEvent} /></div>}
        </div>
        <p className="mt-4 text-[13px] text-[var(--wt-fg)] text-center">{cfg.done.notice}</p>
        <p className="mt-4 text-[10px] text-[var(--wt-faint)] leading-relaxed text-center">{cfg.done.legal}</p>
      </section>
    )
  }
  return (
    <ChatScreen bg={cfg.doneBg} speaker={cfg.speaker} line={fill(already ? cfg.done.already : cfg.done.line)}>
      <p className="text-[13px] text-[var(--wt-fg)] mb-3">{cfg.done.notice}</p>
      {cfg.done.gift && <p className="text-[13px] mb-3" style={{ color: GREEN }}>{cfg.done.gift}</p>}
      {openChatUrl && <OpenChatButton url={openChatUrl} tracking={tracking} />}
      {liveEvent && (
        <div className="mt-3 rounded-xl bg-white">
          <LiveCalendarCta event={liveEvent} />
        </div>
      )}
      <p className="mt-4 text-[10px] text-[var(--wt-faint)] leading-relaxed">{cfg.done.legal}</p>
    </ChatScreen>
  )
}

/* ───────── 페이월(v7.1 P1~P7) — 웹툰 바로 아래, 같은 화면 ───────── */
/** P2 잠긴 목차 — 제목은 보이고 설명만 흐림. unlocked 면 다 보임 */
function LockedList({ pw, unlocked }: { pw: Paywall; unlocked: boolean }) {
  const blur: React.CSSProperties = unlocked ? {} : { filter: 'blur(5px)', userSelect: 'none' }
  return (
    <div className="rounded-2xl border border-[var(--wt-line)] bg-[var(--wt-card)] p-5">
      <p className="text-[12px] font-bold tracking-wide" style={{ color: GREEN }}>{pw.lockedKicker}</p>
      <h2 className="mt-1 text-[20px] font-black">{pw.lockedTitle}</h2>
      <ol className="mt-4 space-y-3">
        {pw.items.map((it) => (
          <li key={it.no} className="flex gap-3">
            <span className="text-[15px] font-black w-7 shrink-0" style={{ color: GREEN }}>{it.no}</span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold">{it.title}</p>
              <p className="text-[13px] text-[var(--wt-muted)] mt-0.5 transition-[filter] duration-700" style={blur} aria-hidden={!unlocked}>
                {it.desc}
              </p>
            </div>
            {!unlocked && <span className="ml-auto text-[var(--wt-faint)] text-[13px] shrink-0" aria-label="잠김">🔒</span>}
          </li>
        ))}
      </ol>
      <p className="mt-5 text-[13px] font-bold text-[var(--wt-fg)]">{pw.extrasLabel}</p>
      <ul className="mt-2 space-y-2">
        {pw.extras.map((x) => (
          <li key={x.label} className="flex gap-2 text-[13px]">
            <span className="font-black shrink-0" style={{ color: GREEN }}>{x.label}</span>
            <span className="text-[var(--wt-fg)] transition-[filter] duration-700" style={blur}>{x.title}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Paywall({ pw, fill, unlocked, onApply, openChatUrl, tracking }: {
  pw: Paywall; fill: (s: string) => string; unlocked: boolean; onApply: () => void
  openChatUrl: string | null; tracking: OpenChatTracking
}) {
  const reviewCuts: WebtoonCut[] = pw.reviews.map((r, i) => ({
    id: `review-${i}`, src: r.src, ratio: 1, bubbles: [], review: { note: r.note, ...(i === 0 ? { header: pw.reviewsTitle } : {}) },
  }))
  return (
    <div className="bg-[var(--wt-bg)] text-[var(--wt-fg)]">
      {/* P1 생각 말풍선 카드 */}
      <div className="px-6 pt-12">
        <div className="relative rounded-[28px] bg-[#F7F8FB] text-[#111] px-6 py-6 text-center text-[15px] leading-relaxed font-medium" style={{ wordBreak: 'keep-all' }}>
          {pw.thought.map((l) => <p key={l}>{l}</p>)}
          <span className="absolute -bottom-2 left-10 w-4 h-4 rotate-45 bg-[#F7F8FB]" />
        </div>
        <p className="mt-4 text-[12px] font-bold" style={{ color: GREEN }}>민로로</p>
      </div>
      {/* P2 잠긴 목차 */}
      <div id="paywall" className="px-5 pt-8"><LockedList pw={pw} unlocked={unlocked} /></div>
      {/* P3 들어야 하는 이유 */}
      <div className="px-6 pt-10 text-center">
        <h3 className="text-[18px] font-black">{pw.reasonsTitle}</h3>
        <ul className="mt-4 space-y-3">
          {pw.reasons.map((r) => (
            <li key={r.main} className="rounded-xl bg-[var(--wt-card)] px-4 py-3">
              <p className="text-[15px] font-bold">“{r.main}”</p>
              <p className="text-[12px] text-[var(--wt-muted)] mt-0.5">{r.sub}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[14px] font-bold" style={{ color: GREEN }}>{pw.reasonsTail}</p>
      </div>
      {/* P4 실제 후기 */}
      <ReviewDeck cuts={reviewCuts} />
      {/* P5 마지막 제안 */}
      <div className="relative mx-5 mt-4 overflow-hidden rounded-2xl" style={{ aspectRatio: '4 / 5' }}>
        <img src={r2Proxy(pw.lastImage)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        <p className="absolute left-4 right-4 bottom-4 rounded-[24px] bg-[#F7F8FB] text-[#111] px-5 py-4 text-center text-[15px] font-medium leading-relaxed" style={{ wordBreak: 'keep-all' }}>{pw.lastLine}</p>
      </div>
      {/* P6 오퍼 카드 (이미 신청했으면 보관 카드) */}
      <div id="wt-offer" className="px-5 pt-8 pb-[calc(env(safe-area-inset-bottom)+40px)]">
        {unlocked ? (
          <div className="rounded-2xl border p-5 text-center" style={{ borderColor: GREEN }}>
            <p className="text-[17px] font-black">{fill(pw.alreadyLine)}</p>
            {openChatUrl && <div className="mt-4"><OpenChatButton url={openChatUrl} tracking={tracking} /></div>}
          </div>
        ) : (
          <div className="rounded-2xl border-2 p-5 bg-[var(--wt-card)]" style={{ borderColor: GREEN }}>
            <p className="text-[12px] font-bold" style={{ color: GREEN }}>{pw.offer.kicker}</p>
            <h3 className="mt-1 text-[19px] font-black">{pw.offer.title}</h3>
            <ul className="mt-3 space-y-2">
              {pw.offer.items.map((it, i) => (
                <li key={it} className="flex items-center gap-2 text-[15px]">
                  <span style={{ color: GREEN }}>✓</span>
                  <span className="font-medium">{it}</span>
                  {pw.offer.bonusLast && i === pw.offer.items.length - 1 && (
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-yellow-300 text-black">보너스</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-baseline justify-between border-t border-[var(--wt-line)] pt-4">
              <span className="text-[13px] text-[var(--wt-muted)]">참여비</span>
              <span className="text-[24px] font-black">{pw.offer.price}</span>
            </div>
            <button type="button" onClick={onApply} className="mt-4 w-full h-14 rounded-xl text-black font-bold text-[17px] active:scale-[0.98] transition" style={{ background: GREEN }}>
              {pw.offer.button}
            </button>
            <p className="mt-2 text-[12px] text-[var(--wt-muted)] text-center">{fill(pw.offer.note)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** P7 떠 있는 바 — 실제 라이브까지 남은 시간(가짜 타이머 아님) + 안쪽 열어 보기 */
function liveRemain(startsAt: string | null | undefined, now: number): string | null {
  if (!startsAt) return null
  const ms = new Date(startsAt).getTime() - now
  if (!(ms > 0)) return null
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return d > 0 ? `라이브까지 ${d}일 ${h}시간` : `라이브까지 ${h}시간 ${m}분`
}

/* ───────── P8 신청 확인 ───────── */
function ConfirmScreen({ cfg, pw, fill, onApply, onBack, busy, loggedIn }: {
  cfg: WebtoonLanding; pw: Paywall; fill: (s: string) => string; onApply: () => void; onBack: () => void; busy: boolean; loggedIn: boolean
}) {
  return (
    <section className="max-w-[480px] mx-auto min-h-[100dvh] bg-[var(--wt-bg)] px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+28px)] flex flex-col">
      <button type="button" onClick={onBack} className="self-start h-9 px-3 rounded-full bg-[var(--wt-card)] text-[var(--wt-fg)] text-[13px]">‹ {pw.confirm.back}</button>
      <div className="mt-8 text-center">
        <p className="text-[12px] font-bold" style={{ color: GREEN }}>{pw.confirm.kicker}</p>
        <h1 className="mt-2 text-[24px] font-black leading-snug">{pw.confirm.title}</h1>
      </div>
      <div className="mt-6 rounded-2xl border border-[var(--wt-line)] bg-[var(--wt-card)] p-5">
        <p className="text-[13px] font-bold text-[var(--wt-muted)]">받는 것</p>
        <ul className="mt-2 space-y-1.5">
          {pw.offer.items.map((it) => <li key={it} className="text-[15px]"><span style={{ color: GREEN }}>✓</span> {it}</li>)}
        </ul>
        <div className="mt-4 flex items-baseline justify-between border-t border-[var(--wt-line)] pt-4">
          <span className="text-[13px] text-[var(--wt-muted)]">참여비</span>
          <span className="text-[22px] font-black">{pw.confirm.price}</span>
        </div>
      </div>
      <ul className="mt-5 space-y-2 text-[13px] text-[var(--wt-fg)]">
        {pw.confirm.assurances.map((a) => <li key={a} className="flex gap-2"><span style={{ color: GREEN }}>•</span><span style={{ wordBreak: 'keep-all' }}>{fill(a)}</span></li>)}
      </ul>
      <div className="flex-1 min-h-6" />
      <button
        type="button" onClick={onApply} disabled={busy}
        className="w-full h-[60px] rounded-xl bg-[#FEE500] text-[#191919] font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
      >
        <KakaoIcon />{pw.confirm.button}
      </button>
      {!loggedIn && (
        <p className="text-[11px] text-[var(--wt-muted)] text-center mt-3 leading-relaxed">
          가입하면 <Link to="/terms" className="underline">이용약관</Link>·<Link to="/privacy" className="underline">개인정보 처리방침</Link>에 동의하게 돼요. (만 14세 이상)
        </p>
      )}
      <p className="mt-3 text-[10px] text-[var(--wt-faint)] text-center">{cfg.done.legal}</p>
    </section>
  )
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#191919" d="M12 3C6.48 3 2 6.48 2 10.77c0 2.76 1.84 5.18 4.6 6.55l-.94 3.44c-.08.3.26.54.52.37l4.1-2.71c.56.08 1.13.12 1.72.12 5.52 0 10-3.48 10-7.77S17.52 3 12 3z" /></svg>
  )
}
