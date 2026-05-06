import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 프로필 미완성 시 마이페이지로 리다이렉트 (마이페이지 자체는 허용)
  // 비회원(guest)은 가입 시점에 주소·성별·생년월일이 비어있는 게 정상이므로 강제 리다이렉트 대상에서 제외.
  // /mypage 에 도착하면 거기서 다시 /onboarding 으로 보냄.
  const isGuest = profile?.provider === 'guest'
  const isIncomplete = profile && !isGuest && (!profile.phone || !profile.name || !profile.gender || !profile.birth_date)
  if (isIncomplete && location.pathname !== '/mypage' && location.pathname !== '/onboarding') {
    return <Navigate to="/mypage" replace />
  }

  return <>{children}</>
}
