import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
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

const AcademyPage = lazy(() => import('./pages/AcademyPage'))
const InstructorListPage = lazy(() => import('./pages/InstructorListPage'))
const InstructorDetailPage = lazy(() => import('./pages/InstructorDetailPage'))
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'))
const ReviewResultsPage = lazy(() => import('./pages/ReviewResultsPage'))
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'))
const AcademyFreePage = lazy(() => import('./pages/AcademyFreePage'))
const AcademyPremiumPage = lazy(() => import('./pages/AcademyPremiumPage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))
const NoticePage = lazy(() => import('./pages/NoticePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignUpPage = lazy(() => import('./pages/SignUpPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const MyPage = lazy(() => import('./pages/MyPage'))
const MyClassroomPage = lazy(() => import('./pages/MyClassroomPage'))
const EbookDetailPage = lazy(() => import('./pages/EbookDetailPage'))
const EbookReaderPage = lazy(() => import('./pages/EbookReaderPage'))
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
const AdminCodeSettings = lazy(() => import('./pages/admin/AdminCodeSettings'))
const AdminCodeSettingsDetail = lazy(() => import('./pages/admin/AdminCodeSettingsDetail'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminMembers = lazy(() => import('./pages/admin/AdminMembers'))
const AdminAchievements = lazy(() => import('./pages/admin/AdminAchievements'))
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'))
const AdminUtmBuilder = lazy(() => import('./pages/admin/AdminUtmBuilder'))
const AdminWebhook = lazy(() => import('./pages/admin/AdminWebhook'))
const AdminPages = lazy(() => import('./pages/admin/AdminPages'))
const AdminCourseDetail = lazy(() => import('./pages/admin/AdminCourseDetail'))
const AdminEbookDetail = lazy(() => import('./pages/admin/AdminEbookDetail'))
const LandingPage = lazy(() => import('./pages/LandingPage'))

const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'))
const PaymentFailPage = lazy(() => import('./pages/PaymentFailPage'))

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
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="w-full font-sans bg-white min-h-screen flex flex-col">
          <LoadingBar />
          <UtmCapture />
          <DynamicMeta />
          <SeoHead />
          <ExternalServicesInjector />
          <ExternalCodesInjector />
          <Header />
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
                <Route path="/search" element={<SearchPage />} />
                <Route path="/landing/:slug" element={<LandingPage />} />

                <Route path="/payment/success" element={<PaymentSuccessPage />} />
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
                <Route path="/admin/achievements" element={<AdminRoute><AdminAchievements /></AdminRoute>} />
                <Route path="/admin/site-settings" element={<AdminRoute><AdminSiteSettings /></AdminRoute>} />
                <Route path="/admin/external-services" element={<AdminRoute><AdminExternalServices /></AdminRoute>} />
                <Route path="/admin/external-services/:id" element={<AdminRoute><AdminExternalServiceDetail /></AdminRoute>} />
                <Route path="/admin/code-settings" element={<AdminRoute><AdminCodeSettings /></AdminRoute>} />
                <Route path="/admin/code-settings/registration" element={<AdminRoute><AdminCodeSettingsDetail /></AdminRoute>} />
                <Route path="/admin/coupons" element={<AdminRoute><AdminCoupons /></AdminRoute>} />
                <Route path="/admin/utm" element={<AdminRoute><AdminUtmBuilder /></AdminRoute>} />
                <Route path="/admin/webhook" element={<AdminRoute><AdminWebhook /></AdminRoute>} />
                <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
                <Route path="/admin/pages" element={<AdminRoute><AdminPages /></AdminRoute>} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
          <Toaster position="top-center" toastOptions={{ duration: 3000, style: { fontSize: '14px' } }} />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
