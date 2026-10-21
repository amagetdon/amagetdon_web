import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { useCourse } from '../hooks/useCourses'
import { supabase } from '../lib/supabase'
import { purchaseService } from '../services/purchaseService'
import { webhookService } from '../services/webhookService'
import { webhookScheduleService } from '../services/webhookScheduleService'
import AfterPurchaseLinkModal from '../components/AfterPurchaseLinkModal'
import SeoHead from '../components/SeoHead'
import NotFoundPage from './NotFoundPage'
import { setChromeHidden } from '../lib/chrome'
import { SECRET_PAGES } from '../lib/secretPages'
import { trackViewItem, trackFreeEnroll, buildContentId, courseCategoryLabel } from '../lib/tracking'
import { logProductVisit } from '../lib/attribution'
import { isUpcomingLive } from '../lib/liveCalendar'
import { detectInAppBrowser, openExternalBrowser } from '../lib/inAppBrowser'
import { rememberPostLogin, takePostLoginAction } from '../lib/postLogin'

// 시크릿 페이지 /s/:slug — 받은 화면(정적 HTML)을 꽉 차게 띄우고, 그 안의 '무료 강의 신청하기'(postMessage 'amag-saju:apply')를
// 129 상세와 같은 흐름으로 처리한다: 카카오 로그인(·회원정보 입력) → 무료 신청(enroll_free) → 알림톡·예약 알림 → Lead → 완료 화면.
// 추적도 129 상세와 같다: 상세 보기(view_item·ViewContent), 상품 방문 기록(log_product_visit), 신청(free_enroll_complete·Lead, 이벤트 ID 같음),
// 구매 경로(purchase_touch — 광고 링크로 들어오면 landing 이 /s/<slug>).
export default function SecretGamePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const cfg = SECRET_PAGES[slug]
  if (!cfg) return <NotFoundPage />
  return <SecretGame cfg={cfg} />
}

function SecretGame({ cfg }: { cfg: (typeof SECRET_PAGES)[string] }) {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const { course } = useCourse(cfg.courseId)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [frameReady, setFrameReady] = useState(false)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [afterLink, setAfterLink] = useState<string | null>(null)

  // 사이트 헤더·푸터·상담 버튼 숨김(꽉 찬 화면)
  useEffect(() => {
    setChromeHidden(true)
    return () => setChromeHidden(false)
  }, [])

  const post = useCallback((type: string) => {
    try { frameRef.current?.contentWindow?.postMessage({ type }, window.location.origin) } catch { /* 화면 준비 전 */ }
  }, [])
  // 신청이 끝났으면 화면을 완료 장면으로(로그인 뒤 돌아와 이어서 신청한 경우 화면이 늦게 뜰 수 있어 준비되면 보냄)
  useEffect(() => { if (done && frameReady) post('amag-saju:done') }, [done, frameReady, post])

  // 페이지 보기 추적 — 129 상세와 같은 view_item + 상품 방문 기록(한 번)
  const viewedRef = useRef(false)
  useEffect(() => {
    if (!course || viewedRef.current) return
    viewedRef.current = true
    const contentId = buildContentId('course', course.id)
    trackViewItem({
      contentId,
      contentName: course.title,
      contentCategory: courseCategoryLabel(course.course_type),
      contentSubcategory: cfg.trackingLabel,
      instructorName: course.instructor?.name ?? null,
      value: 0,
      user: { email: profile?.email, phone: profile?.phone },
    })
    logProductVisit(contentId)
  }, [course, cfg.trackingLabel, profile?.email, profile?.phone])

  const enroll = useCallback(async () => {
    if (!user || !course) return
    setBusy(true)
    try {
      // 이미 신청했으면 신청 없이 완료 화면
      if (await purchaseService.checkOwnership(user.id, course.id)) {
        toast('이미 신청한 강의입니다.')
        setDone(true)
        return
      }
      const { count } = await supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('course_id', course.id)
      await purchaseService.enrollFree({ courseId: course.id })
      const isPreAlert = course.course_type === 'pre_alert'
      // 129 상세와 같은 후속 처리: 신청 알림톡 + D-N 예약 알림톡 + 정원 도달 알림
      webhookService.fireCustomEvent(isPreAlert ? 'course_pre_alert' : 'purchase_free', {
        course_type: course.course_type,
        price: 0,
        original_price: course.original_price ?? course.sale_price ?? 0,
        type: 'course',
      }, {
        userId: user.id,
        userName: profile?.name || '',
        userPhone: profile?.phone || '',
        userEmail: profile?.email || '',
        title: course.title,
        scope: 'course',
        scopeId: course.id,
      }).catch(() => {})
      webhookScheduleService.enqueueForPurchase({ userId: user.id, userName: profile?.name || '', userPhone: profile?.phone || '', userEmail: profile?.email || '', scope: 'course', scopeId: course.id, courseTitle: course.title }).catch(() => {})
      webhookScheduleService.triggerEnrollmentFullIfReached('course', course.id, (count ?? 0) + 1, course.max_enrollments).catch(() => {})
      // Lead — 129 상세와 같은 주문번호·이벤트 ID(같은 사람이 두 곳에서 신청해도 한 번으로 셈)
      trackFreeEnroll({
        orderId: `free_course_${course.id}_${user.id}`,
        contentId: buildContentId('course', course.id),
        contentName: course.title,
        contentCategory: courseCategoryLabel(course.course_type),
        contentSubcategory: cfg.trackingLabel,
        instructorName: course.instructor?.name ?? null,
        user: { email: profile?.email, phone: profile?.phone },
      })
      setDone(true)
      if (course.after_purchase_url) setAfterLink(course.after_purchase_url)
      await refreshProfile()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '신청에 실패했습니다.')
      post('amag-saju:idle')
    } finally {
      setBusy(false)
    }
  }, [user, course, profile, cfg.trackingLabel, refreshProfile, post])

  // '무료 강의 신청하기' — 129 상세 신청 버튼과 같은 순서
  const apply = useCallback(() => {
    if (busy) return
    if (!user) {
      // 안드로이드 인앱(인스타·페북)은 카카오 로그인이 막혀 크롬으로 넘기고, 크롬에서 ?ext_act=purchase 로 이어서 신청
      const inApp = detectInAppBrowser()
      if (inApp.isInApp && inApp.isAndroid) {
        openExternalBrowser({ params: { ext_act: 'purchase' } })
        return
      }
      rememberPostLogin('purchase')
      navigate('/login')
      return
    }
    const isGuest = profile?.provider === 'guest'
    if (!isGuest && profile && (!profile.phone || !profile.name || !profile.gender || !profile.birth_date)) {
      toast.error('회원정보를 먼저 입력해주세요.')
      rememberPostLogin('purchase')
      navigate('/mypage')
      return
    }
    void enroll()
  }, [busy, user, profile, navigate, enroll])

  // 화면 속 신청 버튼
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return
      if ((e.data as { type?: string } | null)?.type === 'amag-saju:apply') apply()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [apply])

  // 크롬으로 넘어온 경우(?ext_act=purchase) — 주소에서 표시를 지우고 '로그인 뒤 이어서 신청'으로 기억
  const [extResume] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      if (p.get('ext_act') !== 'purchase' || detectInAppBrowser().isInApp) return false
      p.delete('ext_act')
      const clean = window.location.pathname + (p.toString() ? `?${p}` : '')
      window.history.replaceState(window.history.state, '', clean)
      rememberPostLogin('purchase', clean)
      return true
    } catch { return false }
  })
  useEffect(() => {
    if (!extResume || authLoading || user) return
    navigate('/login')
  }, [extResume, authLoading, user, navigate])

  // 로그인(·회원정보 입력)을 마치고 돌아오면 신청을 이어서
  const resumedRef = useRef(false)
  useEffect(() => {
    if (resumedRef.current || !user || !profile || !course) return
    resumedRef.current = true
    if (takePostLoginAction() === 'purchase') apply()
  }, [user, profile, course, apply])

  return (
    <div className="fixed inset-0 bg-[#0b0e0d]">
      {/* 제목·설명은 서버(api/_lib/render-page.ts)가 noindex 와 함께 넣는다 — 앱 안에서도 같은 제목 유지 */}
      <SeoHead override={{ title: '하루 30분, 월 300만원 도전 | 아마겟돈 클래스', description: 'AI 블로그로 시작하는 나의 수익화 미션 — 무료 온라인 LIVE' }} />
      <iframe
        ref={frameRef}
        src={cfg.src}
        title="하루 30분, 월 300만원 도전"
        onLoad={() => setFrameReady(true)}
        className="w-full h-full border-0 block"
        allow="autoplay"
      />
      <AfterPurchaseLinkModal
        url={afterLink}
        onClose={() => setAfterLink(null)}
        itemLabel="강의"
        live={course && isUpcomingLive(course.scheduled_at) ? { courseId: course.id, title: course.title, startsAt: course.scheduled_at, openchatUrl: course.after_purchase_url } : null}
        tracking={{
          contentId: course ? buildContentId('course', course.id) : '',
          contentName: course?.title ?? '',
          instructorName: course?.instructor?.name ?? null,
          email: profile?.email,
          phone: profile?.phone,
        }}
      />
    </div>
  )
}
