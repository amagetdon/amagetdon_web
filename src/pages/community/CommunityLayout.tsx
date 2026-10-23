import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { rememberPostLogin } from '../../lib/postLogin'
import { communityService } from '../../services/communityService'
import { BoardDrawer, BottomNav, LockView, Spinner } from '../../components/community/CommunityParts'
import { CommunityProvider } from './CommunityContext'
import { useCommunity } from './communityState'
import './community.css'

// /community 아래 모든 화면의 틀: 로그인·닉네임 확인 → 화면(Outlet) + 하단 탭 + 게시판 서랍
export default function CommunityLayout() {
  return (
    <CommunityProvider>
      <div className="cmty">
        <Gate />
      </div>
    </CommunityProvider>
  )
}

function Gate() {
  const { user, loading } = useAuth()
  const { ready, error, member, reload } = useCommunity()
  const location = useLocation()

  useEffect(() => { document.title = '아마 돈 벌고 있을걸요? | 아마겟돈 클래스' }, [])

  if (loading || (user && !ready)) return <Spinner />
  if (!user) {
    return (
      <>
        <LockView title="로그인하고 들어오세요" text="아마겟돈 클래스 회원이면 누구나 둘러볼 수 있어요" />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: -60 }}>
          <Link className="cm-btn main" to="/login" onClick={() => rememberPostLogin(undefined, location.pathname + location.search)}>로그인</Link>
        </div>
      </>
    )
  }
  if (error) {
    return (
      <div className="lock">
        <i className="ti ti-cloud-off" />
        <h2>잠시 후 다시 시도해 주세요</h2>
        <p>{error}</p>
        <button className="go" onClick={() => void reload()}>다시 불러오기</button>
      </div>
    )
  }
  if (!member) return <Onboarding />
  return (
    <>
      <Outlet />
      <BottomNav />
      <BoardDrawer />
    </>
  )
}

/** 첫 방문 1회: 닉네임 정하기 + 둘러보기 안내 */
function Onboarding() {
  const { user } = useAuth()
  const { access, setMember } = useCommunity()
  const [nick, setNick] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || saving) return
    setSaving(true)
    try {
      setMember(await communityService.saveNickname(user.id, nick))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장하지 못했어요.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className="cm-onb" onSubmit={submit}>
      <div className="logo">아</div>
      <h1>아마 돈 벌고 있을걸요?</h1>
      <p className="sub">수익화 실행 기록을 나누는 수강생 커뮤니티예요.</p>
      <ul>
        <li><i className="ti ti-notebook" />됐다·안 됐다·멈춤까지 솔직하게 기록해요</li>
        <li><i className="ti ti-help-circle" />질문방에 올리면 48시간 안에 답해요</li>
        <li><i className={`ti ${access?.paid ? 'ti-users' : 'ti-lock'}`} />기수 방은 그 기수 수강생만 들어가요</li>
        <li><i className="ti ti-shield-check" />실명·연락처 대신 닉네임만 보여요</li>
      </ul>
      <label htmlFor="cm-nick">커뮤니티에서 쓸 닉네임</label>
      <input id="cm-nick" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={12} placeholder="2~12자 (나중에 바꿀 수 있어요)" autoComplete="off" />
      <button className="cm-btn main wide" disabled={saving || nick.trim().length < 2}>{saving ? '저장 중…' : '시작하기'}</button>
      <p className="note">실명·전화번호·오픈채팅 주소는 글과 닉네임에 쓰지 말아 주세요.</p>
    </form>
  )
}
