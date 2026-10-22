import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { communityService } from '../../services/communityService'
import { useCommunity } from '../../pages/community/communityState'
import { timeLabel, useSignedUrls } from '../../lib/communityUtils'
import { GRADE_INFO, HEAD_LABEL, PIN_LABEL, type CommunityMember, type CommunityPinLabel, type CommunityPostView } from '../../types/community'

// 커뮤니티 여러 화면이 같이 쓰는 작은 부품들(시안 v8 모양)

/** 닉네임 옆 등급·배지 */
export function GradeTag({ author }: { author: Pick<CommunityMember, 'badge' | 'grade'> | null | undefined }) {
  if (!author) return null
  const g = GRADE_INFO[author.badge ?? author.grade] ?? GRADE_INFO.s
  return <span className="gi"><i className={`ti ${g.icon}`} />{g.label}</span>
}

export function Avatar({ name, className = 'av' }: { name: string | null | undefined; className?: string }) {
  return <div className={className}>{(name || '?').slice(0, 1)}</div>
}

export function HeadTag({ head }: { head: string | null }) {
  if (!head || !HEAD_LABEL[head]) return null
  return <><span className={`hd ${head}`}>[{HEAD_LABEL[head]}]</span>{' '}</>
}

/** 목록 한 줄(시안 row6) */
export function PostRow({ post, thumbUrl, unread, showBoard }: { post: CommunityPostView; thumbUrl?: string; unread?: boolean; showBoard?: boolean }) {
  const { boardById } = useCommunity()
  const deleted = !!post.deleted_at
  return (
    <Link className="row6" to={`/community/p/${post.id}`}>
      <div className="c">
        <p className="tt">
          {unread && <span className="nw" />}
          {post.is_hidden && <span className="hd">[숨김] </span>}
          {!deleted && <HeadTag head={post.head} />}
          <span style={deleted ? { color: 'var(--g5)' } : undefined}>{post.title}</span>
        </p>
        <div className="mt">
          {showBoard && <><span>{boardById(post.board_id)?.name}</span><span className="dot" /></>}
          <span>{post.author?.nickname ?? '알 수 없음'}</span><GradeTag author={post.author} />
          <span className="dot" /><span>{timeLabel(post.created_at)}</span>
          <span className="dot" /><span>조회 {post.view_count.toLocaleString()}</span>
          {post.reaction_count > 0 && <><span className="dot" /><span>좋아요 {post.reaction_count}</span></>}
        </div>
      </div>
      {post.image_count > 0 && (
        <span className="th6">
          {thumbUrl && <img src={thumbUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} />}
          {post.image_count > 1 && <em style={{ zIndex: 2 }}>{post.image_count}</em>}
        </span>
      )}
      <span className="cbx">{post.comment_count}<small>댓글</small></span>
    </Link>
  )
}

/** 사진 썸네일·새 글 점까지 붙인 목록 */
export function PostList({ posts, showBoard, empty = '아직 글이 없어요.' }: { posts: CommunityPostView[]; showBoard?: boolean; empty?: string }) {
  const urls = useSignedUrls(posts.map((p) => p.thumb_path))
  const [seen, setSeen] = useState<{ ids: Set<number>; at: number } | null>(null)
  const ids = posts.map((p) => p.id).join(',')
  useEffect(() => {
    let alive = true
    const list = ids ? ids.split(',').map(Number) : []
    communityService.seenPostIds(list).then((s) => { if (alive) setSeen({ ids: s, at: Date.now() }) }).catch(() => undefined)
    return () => { alive = false }
  }, [ids])
  if (!posts.length) return <p className="cm-empty">{empty}</p>
  return (
    <div>
      {posts.map((p) => (
        <PostRow key={p.id} post={p} showBoard={showBoard}
          thumbUrl={p.thumb_path ? urls[p.thumb_path] : undefined}
          unread={!!seen && !seen.ids.has(p.id) && seen.at - new Date(p.created_at).getTime() < 3 * 86400_000} />
      ))}
    </div>
  )
}

/** 고정 줄(회색 바탕 + 공지·필독·고정 라벨). 3개 넘으면 '공지 n개 더보기' */
export function PinnedRows({ pins }: { pins: { id: number; label: CommunityPinLabel; post: CommunityPostView }[] }) {
  const [open, setOpen] = useState(false)
  if (!pins.length) return null
  const shown = open ? pins : pins.slice(0, 3)
  return (
    <div>
      {shown.map((p) => (
        <Link key={p.id} className="notice" to={`/community/p/${p.post.id}`}>
          <span className="lb">{PIN_LABEL[p.label]}</span><span>{p.post.title}</span>
        </Link>
      ))}
      {pins.length > 3 && (
        <button className="notice cm-more" onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : `공지 ${pins.length - 3}개 더보기`}<i className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'}`} />
        </button>
      )}
    </div>
  )
}

/** 앱 상단바 */
export function AppBar({ title, back, right, menu }: { title?: React.ReactNode; back?: boolean | string; right?: React.ReactNode; menu?: boolean }) {
  const navigate = useNavigate()
  const { setDrawerOpen } = useCommunity()
  return (
    <div className="appbar">
      {back ? (
        <button className="ib" aria-label="뒤로" onClick={() => (typeof back === 'string' ? navigate(back) : window.history.length > 1 ? navigate(-1) : navigate('/community'))}>
          <i className="ti ti-chevron-left" />
        </button>
      ) : menu ? (
        <button className="ib" aria-label="게시판 메뉴" onClick={() => setDrawerOpen(true)}><i className="ti ti-menu-2" /></button>
      ) : <span style={{ width: 10 }} />}
      <span className="t">{title}</span>
      {right}
    </div>
  )
}

export function SearchButton() {
  return <Link className="ib" to="/community/search" aria-label="검색"><i className="ti ti-search" /></Link>
}

/** 하단 탭 */
export function BottomNav() {
  const { pathname } = useLocation()
  const { unread } = useCommunity()
  const tab = (to: string, icon: string, label: string, badge?: number) => {
    const on = to === '/community' ? pathname === '/community' || pathname === '/community/' : pathname.startsWith(to)
    return (
      <Link to={to} className={on ? 'on' : ''}>
        <i className={`ti ${icon}`} />{label}
        {!!badge && <span className="bdg">{badge > 99 ? '99+' : badge}</span>}
      </Link>
    )
  }
  return (
    <nav className="nav">
      {tab('/community', 'ti-home', '홈')}
      {tab('/community/hot', 'ti-flame', '인기글')}
      {tab('/community/sub', 'ti-file-text', '구독')}
      {tab('/community/news', 'ti-bell', '내소식', unread)}
      {tab('/community/me', 'ti-user', '내정보')}
    </nav>
  )
}

/** 글쓰기 떠 있는 버튼 */
export function WriteFab({ boardSlug }: { boardSlug?: string }) {
  return (
    <Link className="fabw" to={boardSlug ? `/community/write?board=${boardSlug}` : '/community/write'}>
      <i className="ti ti-pencil" />글쓰기
    </Link>
  )
}

/** 게시판 메뉴 서랍 */
export function BoardDrawer() {
  const { drawerOpen, setDrawerOpen, groups, boards, readable, favorites, toggleFavorite, newCounts, member } = useCommunity()
  const navigate = useNavigate()
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen, setDrawerOpen])
  if (!drawerOpen) return null
  const go = (to: string) => { setDrawerOpen(false); navigate(to) }
  const ungrouped = boards.filter((b) => b.enabled && !groups.some((g) => g.id === b.group_id))
  const sections = [...groups.map((g) => ({ key: g.id, name: g.name, items: boards.filter((b) => b.enabled && b.group_id === g.id) })),
    ...(ungrouped.length ? [{ key: -1, name: '기타', items: ungrouped }] : [])]
  return (
    <div>
      <div className="dim" onClick={() => setDrawerOpen(false)} />
      <aside className="drawer" aria-label="게시판 메뉴">
        <div className="dr-top">
          <div className="logo">아</div>
          <div><b>아마 돈 벌고 있을걸요?</b><span>{member?.nickname ? `${member.nickname}님` : '아마겟돈 클래스 수강생 커뮤니티'}</span></div>
        </div>
        <div className="dr-quick">
          <button onClick={() => go('/community/my/posts')}><i className="ti ti-file-text" />내 글</button>
          <button onClick={() => go('/community/my/comments')}><i className="ti ti-message-circle" />댓글단 글</button>
          <button onClick={() => go('/community/my/saved')}><i className="ti ti-bookmark" />저장한 글</button>
        </div>
        {favorites.size > 0 && (
          <>
            <p className="grp">즐겨찾는 게시판</p>
            {boards.filter((b) => favorites.has(b.id) && b.enabled).map((b) => (
              <button key={`f${b.id}`} className="bd" onClick={() => go(`/community/b/${b.slug}`)}>
                <i className={`ti ${b.icon || 'ti-list'}`} />{b.name}
                {!!newCounts[b.id] && <span className="n">N</span>}
              </button>
            ))}
          </>
        )}
        {sections.map((s) => (
          <div key={s.key}>
            <p className="grp">{s.name}</p>
            {s.items.map((b) => {
              const locked = !readable.has(b.id)
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <button className="bd" onClick={() => go(`/community/b/${b.slug}`)}>
                    <i className={`ti ${locked ? 'ti-lock' : b.icon || 'ti-list'}`} />
                    <span className={locked ? 'lk' : ''}>{b.name}</span>
                    {!locked && !!newCounts[b.id] && <span className="n">N</span>}
                  </button>
                  {!locked && (
                    <button aria-label={favorites.has(b.id) ? '즐겨찾기 해제' : '즐겨찾기'} style={{ padding: '0 16px 0 4px' }} onClick={() => void toggleFavorite(b.id)}>
                      <i className={`ti ${favorites.has(b.id) ? 'ti-star-filled star on' : 'ti-star star'}`} style={{ fontSize: 18 }} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        <div style={{ height: 40 }} />
      </aside>
    </div>
  )
}

/** 잠금 안내 */
export function LockView({ title, text, action }: { title: string; text: string; action?: { label: string; to: string } }) {
  return (
    <div className="lock">
      <i className="ti ti-lock" />
      <h2>{title}</h2>
      <p>{text}</p>
      {action && <Link className="go" to={action.to} style={{ display: 'inline-flex', alignItems: 'center' }}>{action.label}</Link>}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 240 }}>
      <div className="w-7 h-7 border-4 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
