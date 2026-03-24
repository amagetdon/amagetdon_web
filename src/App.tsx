import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Header from './components/Header'
import Footer from './components/Footer'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AdminRoute from './components/auth/AdminRoute'
import HomePage from './pages/HomePage'
import AcademyPage from './pages/AcademyPage'
import InstructorListPage from './pages/InstructorListPage'
import InstructorDetailPage from './pages/InstructorDetailPage'
import ReviewsPage from './pages/ReviewsPage'
import ReviewResultsPage from './pages/ReviewResultsPage'
import CourseDetailPage from './pages/CourseDetailPage'
import AcademyFreePage from './pages/AcademyFreePage'
import AcademyPremiumPage from './pages/AcademyPremiumPage'
import FAQPage from './pages/FAQPage'
import NoticePage from './pages/NoticePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import MyPage from './pages/MyPage'
import MyClassroomPage from './pages/MyClassroomPage'
import MyEbooksPage from './pages/MyEbooksPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminInstructors from './pages/admin/AdminInstructors'
import AdminCourses from './pages/admin/AdminCourses'
import SearchPage from './pages/SearchPage'
import EbookDetailPage from './pages/EbookDetailPage'
import AdminEbooks from './pages/admin/AdminEbooks'
import AdminReviews from './pages/admin/AdminReviews'
import AdminResults from './pages/admin/AdminResults'
import AdminSchedules from './pages/admin/AdminSchedules'
import AdminFaqs from './pages/admin/AdminFaqs'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="w-full font-sans bg-white min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/academy" element={<AcademyPage />} />
              <Route path="/instructors" element={<InstructorListPage />} />
              <Route path="/instructors/:id" element={<InstructorDetailPage />} />
              <Route path="/reviews" element={<ReviewsPage />} />
              <Route path="/reviews/results" element={<ReviewResultsPage />} />
              <Route path="/academy/free" element={<AcademyFreePage />} />
              <Route path="/academy/premium" element={<AcademyPremiumPage />} />
              <Route path="/course/:id" element={<CourseDetailPage />} />
              <Route path="/ebook/:id" element={<EbookDetailPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/notice" element={<NoticePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
              <Route path="/my-classroom" element={<ProtectedRoute><MyClassroomPage /></ProtectedRoute>} />
              <Route path="/my-ebooks" element={<ProtectedRoute><MyEbooksPage /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/instructors" element={<AdminRoute><AdminInstructors /></AdminRoute>} />
              <Route path="/admin/courses" element={<AdminRoute><AdminCourses /></AdminRoute>} />
              <Route path="/admin/ebooks" element={<AdminRoute><AdminEbooks /></AdminRoute>} />
              <Route path="/admin/reviews" element={<AdminRoute><AdminReviews /></AdminRoute>} />
              <Route path="/admin/results" element={<AdminRoute><AdminResults /></AdminRoute>} />
              <Route path="/admin/schedules" element={<AdminRoute><AdminSchedules /></AdminRoute>} />
              <Route path="/admin/faqs" element={<AdminRoute><AdminFaqs /></AdminRoute>} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
