import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import Header from './components/Header'
import Footer from './components/Footer'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AdminRoute from './components/auth/AdminRoute'
import HomePage from './pages/HomePage'

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
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminMembers = lazy(() => import('./pages/admin/AdminMembers'))
const AdminAchievements = lazy(() => import('./pages/admin/AdminAchievements'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-3 border-[#04F87F] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="w-full font-sans bg-white min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">
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
                <Route path="/admin/ebooks" element={<AdminRoute><AdminEbooks /></AdminRoute>} />
                <Route path="/admin/reviews" element={<AdminRoute><AdminReviews /></AdminRoute>} />
                <Route path="/admin/results" element={<AdminRoute><AdminResults /></AdminRoute>} />
                <Route path="/admin/schedules" element={<AdminRoute><AdminSchedules /></AdminRoute>} />
                <Route path="/admin/faqs" element={<AdminRoute><AdminFaqs /></AdminRoute>} />
                <Route path="/admin/members" element={<AdminRoute><AdminMembers /></AdminRoute>} />
                <Route path="/admin/achievements" element={<AdminRoute><AdminAchievements /></AdminRoute>} />
                <Route path="/admin/site-settings" element={<AdminRoute><AdminSiteSettings /></AdminRoute>} />
                <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
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
