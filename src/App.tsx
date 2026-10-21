import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Header from './components/Header'
import LoadingBar from './components/LoadingBar'
import Footer from './components/Footer'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AdminRoute from './components/auth/AdminRoute'
import HomePage from './pages/HomePage'
import GlobalHero from './components/GlobalHero'
import { useGlobalFadeIn } from './hooks/useGlobalFadeIn'
import { useBusinessInfo } from './hooks/useBusinessInfo'
import SeoHead from './components/SeoHead'
import ExternalServicesInjector from './components/ExternalServicesInjector'
import ExternalCodesInjector from './components/ExternalCodesInjector'
import PixelInjector from './components/PixelInjector'
import { captureLastTouch, logProductVisit } from './lib/attribution'
import { useChromeHidden } from './lib/chrome'
import { takeReturnPath } from './lib/postLogin'

const AcademyPage = lazy(() => import('./pages/AcademyPage'))
const InstructorListPage = lazy(() => import('./pages/InstructorListPage'))
const InstructorDetailPage = lazy(() => import('./pages/InstructorDetailPage'))
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'))
const ReviewResultsPage = lazy(() => import('./pages/ReviewResultsPage'))
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'))
const WebtoonLandingPage = lazy(() => import('./pages/WebtoonLandingPage'))
const AcademyFreePage = lazy(() => import('./pages/AcademyFreePage'))
const AcademyPremiumPage = lazy(() => import('./pages/AcademyPremiumPage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))
const NoticePage = lazy(() => import('./pages/NoticePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignUpPage = lazy(() => import('./pages/SignUpPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const MyPage = lazy(() => import('./pages/MyPage'))
const MyClassroomPage = lazy(() => import('./pages/MyClassroomPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const EbookDetailPage = lazy(() => import('./pages/EbookDetailPage'))
const EbookReaderPage = lazy(() => import('./pages/EbookReaderPage'))
const EbooksFreePage = lazy(() => import('./pages/EbooksFreePage'))
const EbooksSecretPage = lazy(() => import('./pages/EbooksSecretPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminInstructors = lazy(() => import('./pages/admin/AdminInstructors'))
const AdminCourses = lazy(() => import('./pages/admin/AdminCourses'))
const AdminEbooks = lazy(() => import('./pages/admin/AdminEbooks'))
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'))
const AdminResults = lazy(() => import('./pages/admin/AdminResults'))
const AdminSchedules = lazy(() => import('./pages/admin/AdminSchedules'))
const AdminFaqs = lazy(() => import('./pages/admin/AdminFaqs'))
const AdminSiteSettings = lazy(() => import('./pages/admin/AdminSiteSettings'))
const AdminExternalServices = lazy(() => import('./pages/admin/AdminExternalServices'))
const AdminExternalServiceDetail = lazy(() => import('./pages/admin/AdminExternalServiceDetail'))
const AdminPixels = lazy(() => import('./pages/admin/AdminPixels'))
const AdminCodeSettings = lazy(() => import('./pages/admin/AdminCodeSettings'))
const AdminCodeSettingsDetail = lazy(() => import('./pages/admin/AdminCodeSettingsDetail'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminRevenueAnalytics = lazy(() => import('./pages/admin/AdminRevenueAnalytics'))
const AdminMembers = lazy(() => import('./pages/admin/AdminMembers'))
const AdminLinkpay = lazy(() => import('./pages/admin/AdminLinkpay'))
const AdminAchievements = lazy(() => import('./pages/admin/AdminAchievements'))
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'))
const AdminUtmBuilder = lazy(() => import('./pages/admin/AdminUtmBuilder'))
const AdminWebhook = lazy(() => import('./pages/admin/AdminWebhook'))
const AdminCrmLeads = lazy(() => import('./pages/admin/AdminCrmLeads'))
const AdminPages = lazy(() => import('./pages/admin/AdminPages'))
const AdminStorageCleanup = lazy(() => import('./pages/admin/AdminStorageCleanup'))
const AdminPerformance = lazy(() => import('./pages/admin/AdminPerformance'))
const AdminCourseDetail = lazy(() => import('./pages/admin/AdminCourseDetail'))
const AdminEbookDetail = lazy(() => import('./pages/admin/AdminEbookDetail'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const AdminBoard = lazy(() => import('./pages/admin/AdminBoard'))
const BoardPostPage = lazy(() => import('./pages/BoardPostPage'))
const BlogPreviewPage = lazy(() => import('./pages/BlogPreviewPage'))
const BoardListPage = lazy(() => import('./pages/BoardListPage'))
const BoardInstructorPage = lazy(() => import('./pages/BoardInstructorPage'))

const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'))
const PaymentFailPage = lazy(() => import('./pages/PaymentFailPage'))
const BillingSuccessPage = lazy(() => import('./pages/BillingSuccessPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-3 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function FadeInProvider() {
  useGlobalFadeIn()
  return null
}

function UtmCapture() {
  const location = useLocation()
  const prevPath = useRef(location.pathname)

  useEffect(() => {
    // 마지막 유입 경로(구매별 '이번 구매 경로' 기록용) — 아래 세션 UTM(가입 시 최초 경로)과 별개
    captureLastTouch()
    const params = new URLSearchParams(window.location.search)
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
    const hasUtm = keys.some((k) => params.get(k))
    if (hasUtm) {
      for (const k of keys) {
        const v = params.get(k)
        if (v) sessionStorage.setItem(k, v)
      }
    }
  }, [])

  useEffect(() => {
    const authPages = ['/login', '/signup']
    const curr = location.pathname
    const prev = prevPath.current
    if (authPages.includes(curr) && !authPages.includes(prev)) {
      sessionStorage.setItem('signup_referrer', prev)
    }
    prevPath.current = curr
  }, [location.pathname])

  // 상품 대시보드 '유입' — 강의·전자책 상세 주소로 들어오는 순간 기록(데이터 로딩 전에 나가는 방문도 잡히게).
  // 마지막 유입 경로 갱신(captureLastTouch, 위 effect)보다 뒤에 선언돼 같은 렌더에서 그 다음에 실행된다.
  useEffect(() => {
    const m = location.pathname.match(/^\/(course|ebook)\/(\d+)\/?$/)
    if (m) logProductVisit(`${m[1]}_${m[2]}`)
  }, [location.pathname])

  return null
}

// 카카오/구글 로그인·이메일 인증·로그인 링크는 홈(/)으로 돌아온다. 로그인 전에 신청·구매·로그인 버튼을
// 누른 화면(src/lib/postLogin)이 있으면 그리로 돌려보낸다.
// - /login 은 LoginPage 가 직접 처리한다(여기서도 움직이면 LoginPage 의 이동과 겹쳐 홈으로 튕기던 원인).
// - 회원정보가 비어 있으면 AuthContext 가 /mypage → /onboarding 으로 보내고, 온보딩 완료 후 OnboardingPage 가 복귀시킨다.
function PostLoginRedirect() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if (!user || !profile || pathname !== '/') return
    const isGuest = profile.provider === 'guest'
    const isIncomplete = !profile.name || !profile.phone || !profile.gender || !profile.birth_date
    if (isIncomplete && !isGuest) return
    const target = takeReturnPath()
    if (target && target !== pathname) navigate(target, { replace: true })
  }, [user, profile, pathname, navigate])
  return null
}

// 라우트 변경 시 스크롤 최상단으로. 뒤로/앞으로(POP) 는 브라우저가 위치 복원하도록 둠.
function ScrollToTop() {
  const { pathname } = useLocation()
  const navType = useNavigationType()
  useEffect(() => {
    if (navType === 'POP') return
    window.scrollTo(0, 0)
  }, [pathname, navType])
  return null
}

// 페이지별 canonical — 항상 운영 도메인 + 경로(쿼리 제외). 미리보기 주소에서도 운영 주소를 가리킨다.
function CanonicalLink() {
  const { pathname } = useLocation()
  useEffect(() => {
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = 'https://amag-class.com' + (pathname === '/' ? '/' : pathname.replace(/\/+$/, ''))
  }, [pathname])
  return null
}

function DynamicMeta() {
  const biz = useBusinessInfo()
  useEffect(() => {
    if (biz.faviconUrl) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (link) {
        link.href = biz.faviconUrl
      }
    }
  }, [biz.faviconUrl])
  return null
}

function App() {
  const chromeHidden = useChromeHidden()
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="w-full font-sans bg-white min-h-screen flex flex-col">
          <LoadingBar />
          <ScrollToTop />
          <PostLoginRedirect />
          <UtmCapture />
          <DynamicMeta />
          <SeoHead />
          <CanonicalLink />
          <ExternalServicesInjector />
          <PixelInjector />
          <ExternalCodesInjector />
          {!chromeHidden && <Header />}
          <FadeInProvider />
          <main className="flex-1">
            <GlobalHero />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/academy" element={<AcademyPage />} />
                <Route path="/instructors" element={<InstructorListPage />} />
                <Route path="/instructors/:id" element={<InstructorDetailPage />} />
                <Route path="/reviews" element={<ReviewsPage />} />
                <Route path="/results" element={<ReviewResultsPage />} />
                <Route path="/academy/free" element={<AcademyFreePage />} />
                <Route path="/academy/premium" element={<AcademyPremiumPage />} />
                <Route path="/course/:id" element={<CourseDetailPage />} />
                <Route path="/ebook/:id" element={<EbookDetailPage />} />
                <Route path="/ebooks/free" element={<EbooksFreePage />} />
                <Route path="/ebooks/secret" element={<EbooksSecretPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/landing/:slug" element={<LandingPage />} />
                {/* 웹툰식 랜딩(표지 → 웹툰 → 대화형 신청). 설정은 src/lib/webtoonLandings.ts */}
                <Route path="/w/:slug" element={<WebtoonLandingPage />} />

                {/* 아마겟돈 뉴스레터: /board 목록·/board/:id 글은 공개(잠금은 서버 RPC 판정),
                    /board/p/:token 은 비밀 공유 링크. 관리 화면은 /admin/board */}
                <Route path="/board" element={<BoardListPage />} />
                <Route path="/board/instructor/:id" element={<BoardInstructorPage />} />
                <Route path="/board/p/:token" element={<BoardPostPage />} />
                <Route path="/board/blog-preview" element={<BlogPreviewPage />} />
                <Route path="/board/:id" element={<BoardPostPage />} />

                <Route path="/payment/success" element={<PaymentSuccessPage />} />
                <Route path="/payment/billing-success" element={<BillingSuccessPage />} />
                <Route path="/payment/fail" element={<PaymentFailPage />} />
                <Route path="/faq" element={<FAQPage />} />
                <Route path="/notice" element={<NoticePage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
                <Route path="/my-classroom" element={<ProtectedRoute><MyClassroomPage /></ProtectedRoute>} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/my-ebooks/:id/read" element={<ProtectedRoute><EbookReaderPage /></ProtectedRoute>} />
                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/admin/instructors" element={<AdminRoute><AdminInstructors /></AdminRoute>} />
                <Route path="/admin/courses" element={<AdminRoute><AdminCourses /></AdminRoute>} />
                <Route path="/admin/courses/:id" element={<AdminRoute><AdminCourseDetail /></AdminRoute>} />
                <Route path="/admin/ebooks" element={<AdminRoute><AdminEbooks /></AdminRoute>} />
                <Route path="/admin/ebooks/:id" element={<AdminRoute><AdminEbookDetail /></AdminRoute>} />
                <Route path="/admin/reviews" element={<AdminRoute><AdminReviews /></AdminRoute>} />
                <Route path="/admin/results" element={<AdminRoute><AdminResults /></AdminRoute>} />
                <Route path="/admin/schedules" element={<AdminRoute><AdminSchedules /></AdminRoute>} />
                <Route path="/admin/faqs" element={<AdminRoute><AdminFaqs /></AdminRoute>} />
                <Route path="/admin/members" element={<AdminRoute><AdminMembers /></AdminRoute>} />
                <Route path="/admin/linkpay" element={<AdminRoute><AdminLinkpay /></AdminRoute>} />
                <Route path="/admin/achievements" element={<AdminRoute><AdminAchievements /></AdminRoute>} />
                <Route path="/admin/board" element={<AdminRoute><AdminBoard /></AdminRoute>} />
                <Route path="/admin/site-settings" element={<AdminRoute><AdminSiteSettings /></AdminRoute>} />
                <Route path="/admin/external-services" element={<AdminRoute><AdminExternalServices /></AdminRoute>} />
                <Route path="/admin/external-services/:id" element={<AdminRoute><AdminExternalServiceDetail /></AdminRoute>} />
                <Route path="/admin/pixels" element={<AdminRoute><AdminPixels /></AdminRoute>} />
                <Route path="/admin/code-settings" element={<AdminRoute><AdminCodeSettings /></AdminRoute>} />
                <Route path="/admin/code-settings/registration" element={<AdminRoute><AdminCodeSettingsDetail /></AdminRoute>} />
                <Route path="/admin/coupons" element={<AdminRoute><AdminCoupons /></AdminRoute>} />
                <Route path="/admin/utm" element={<AdminRoute><AdminUtmBuilder /></AdminRoute>} />
                <Route path="/admin/webhook" element={<AdminRoute><AdminWebhook /></AdminRoute>} />
                <Route path="/admin/crm-leads" element={<AdminRoute><AdminCrmLeads /></AdminRoute>} />
                <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
                <Route path="/admin/revenue-analytics" element={<AdminRoute><AdminRevenueAnalytics /></AdminRoute>} />
                <Route path="/admin/pages" element={<AdminRoute><AdminPages /></AdminRoute>} />
                <Route path="/admin/storage-cleanup" element={<AdminRoute><AdminStorageCleanup /></AdminRoute>} />
                <Route path="/admin/performance" element={<AdminRoute><AdminPerformance /></AdminRoute>} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </main>
          {!chromeHidden && <Footer />}
          <Toaster position="top-center" toastOptions={{ duration: 3000, style: { fontSize: '14px' } }} />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
