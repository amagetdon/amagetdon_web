import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { AppBar, Avatar, GradeTag, PostList, Spinner } from '../../components/community/CommunityParts'
import { communityService } from '../../services/communityService'
import { useCommunity } from './communityState'
import { errMsg, useKeyedLoad } from './extra/hooks'

function untilLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 아직 끝나지 않은 글쓰기 정지면 그 시각 */
function stillSuspended(iso: string | null | undefined): string | null {
  return iso && new Date(iso).getTime() > new Date().getTime() ? iso : null
}

const chev = <i className="ti ti-chevron-right" />

// 내정보: 닉네임·등급, 내 활동 숫자, 바로가기, 최근 작성글
export default function CommunityMe() {
  const { user } = useAuth()
  const { member, access, favorites, boardById, boardBySlug, setDrawerOpen } = useCommunity()
  const [editing, setEditing] = useState(false)
  const uid = user?.id ?? null

  const stats = useKeyedLoad(uid, () => communityService.myStats())
  const recent = useKeyedLoad(uid ? `recent:${uid}` : null, () => communityService.listPosts({ authorId: uid!, limit: 5 }))

  const s = stats.data
  const suspended = stillSuspended(access?.suspended_until)
  const gradeBoard = boardBySlug('grade')
  const cohorts = (s?.cohorts ?? []).map((c) => ({ ...c, slug: boardById(c.board_id)?.slug }))

  return (
    <>
      <AppBar title="내정보" />
      <div className="me">
        <Avatar name={member?.nickname} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{member?.nickname}</b>
          <GradeTag author={member} />
        </div>
        <button className="cm-btn" style={{ height: 34, padding: '0 12px', fontSize: 13 }} onClick={() => setEditing(true)}>
          닉네임 바꾸기
        </button>
      </div>

      {suspended && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '0 16px 14px', padding: '10px 12px', borderRadius: 8, background: '#fff4f4', color: '#c2383d', fontSize: 13.5 }}>
          <i className="ti ti-alert-circle" style={{ fontSize: 18 }} />
          <span>{untilLabel(suspended)}까지 글·댓글 쓰기가 멈춰 있어요. 읽기는 그대로 할 수 있어요.</span>
        </div>
      )}

      <div className="me-n">
        <Link to="/community/my/posts" style={{ flex: 1, padding: '14px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--g6)' }}>
          <b>{s ? s.posts.toLocaleString() : '-'}</b>작성글
        </Link>
        <Link to="/community/my/comments" style={{ flex: 1, padding: '14px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--g6)' }}>
          <b>{s ? s.commented.toLocaleString() : '-'}</b>댓글단 글
        </Link>
        <Link to="/community/my/liked" style={{ flex: 1, padding: '14px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--g6)' }}>
          <b>{s ? s.liked.toLocaleString() : '-'}</b>좋아요한 글
        </Link>
      </div>

      {gradeBoard && <Link className="lnk" to={`/community/b/${gradeBoard.slug}`}>등급 안내<span>{chev}</span></Link>}
      {cohorts.length === 0 ? (
        <div className="lnk">가입한 기수<span>{stats.loading ? '' : '아직 없어요'}</span></div>
      ) : cohorts.map((c, i) => (
        c.slug
          ? <Link key={c.board_id} className="lnk" to={`/community/b/${c.slug}`}>{i === 0 ? '가입한 기수' : ''}<span>{c.name} {chev}</span></Link>
          : <div key={c.board_id} className="lnk">{i === 0 ? '가입한 기수' : ''}<span>{c.name}</span></div>
      ))}
      <button className="lnk" onClick={() => setDrawerOpen(true)}>즐겨찾는 게시판<span>{favorites.size}개 {chev}</span></button>
      <Link className="lnk" to="/community/my/saved">저장한 글<span>{s ? `${s.saved.toLocaleString()}개 ` : ''}{chev}</span></Link>
      <Link className="lnk" to="/my-classroom">내 강의실<span>{chev}</span></Link>

      <p className="grp" style={{ borderTop: '8px solid var(--g1)', paddingTop: 14 }}>최근 작성글</p>
      {recent.loading ? <Spinner /> : (
        <>
          <PostList posts={recent.data ?? []} showBoard empty={recent.error ? '글을 불러오지 못했어요.' : '아직 쓴 글이 없어요.'} />
          {(s?.posts ?? 0) > 5 && <Link className="cm-load" to="/community/my/posts">내 글 모두 보기</Link>}
        </>
      )}

      {editing && <NicknameSheet onClose={() => setEditing(false)} />}
    </>
  )
}

function NicknameSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { member, setMember } = useCommunity()
  const [nick, setNick] = useState(member?.nickname ?? '')
  const [saving, setSaving] = useState(false)
  const v = nick.trim()
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || saving) return
    if (v === member?.nickname) { onClose(); return }
    setSaving(true)
    try {
      setMember(await communityService.saveNickname(user.id, v))
      toast.success('닉네임을 바꿨어요.')
      onClose()
    } catch (err) {
      toast.error(errMsg(err, '저장하지 못했어요.'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <div className="cm-sheet-dim" onClick={onClose} />
      <form className="cm-sheet" onSubmit={submit} role="dialog" aria-label="닉네임 바꾸기">
        <h3>닉네임 바꾸기</h3>
        <div style={{ padding: '4px 16px 0' }}>
          <input className="cm-field" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={12}
            placeholder="2~12자" autoComplete="off" autoFocus aria-label="새 닉네임" style={{ marginBottom: 6 }} />
          <p style={{ fontSize: 12.5, color: 'var(--g5)' }}>실명·전화번호·오픈채팅 주소는 닉네임에 쓰지 말아 주세요.</p>
        </div>
        <div className="bt" style={{ marginTop: 10 }}>
          <button type="button" className="cm-btn" onClick={onClose}>닫기</button>
          <button className="cm-btn main" disabled={saving || v.length < 2}>{saving ? '저장 중…' : '저장하기'}</button>
        </div>
      </form>
    </>
  )
}
