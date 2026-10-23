import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { communityService } from '../../services/communityService'
import { useCommunity } from '../../pages/community/communityState'
import { pcDate } from '../../lib/communityUtils'
import { GRADE_INFO, HEAD_LABEL, PIN_LABEL, type CommunityMyStats, type CommunityPinLabel, type CommunityPostView } from '../../types/community'

// PC(1024px 이상) 전용 부품 — 네이버 카페 PC 방식: 왼쪽 메뉴 + 표 목록 + 페이지 번호

/** 올린 지 24시간 안 된 글 */
function isRecent(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 86400_000
}

/** 왼쪽 사이드바: 커뮤니티 정보 · 내 정보 · 글쓰기 · 게시판 메뉴 */
export function PcSidebar() {
  const { member, groups, boards, readable, favorites, newCounts, unread, boardBySlug } = useCommunity()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [members, setMembers] = useState<number | null>(null)
  const [stats, setStats] = useState<CommunityMyStats | null>(null)
  useEffect(() => {
    communityService.memberCount().then(setMembers).catch(() => undefined)
    communityService.myStats().then(setStats).catch(() => undefined)
  }, [])

  const curSlug = pathname.startsWith('/community/b/') ? decodeURIComponent(pathname.split('/')[3] ?? '') : ''
  const cur = curSlug ? boardBySlug(curSlug) : undefined
  const grade = member ? GRADE_INFO[member.badge ?? member.grade] ?? GRADE_INFO.s : null
  const ungrouped = boards.filter((b) => b.enabled && !groups.some((g) => g.id === b.group_id))
  const sections = [
    ...groups.map((g) => ({ key: g.id, name: g.name, items: boards.filter((b) => b.enabled && b.group_id === g.id) })),
    ...(ungrouped.length ? [{ key: -1, name: '기타', items: ungrouped }] : []),
  ].filter((s) => s.items.length)

  const item = (to: string, label: React.ReactNode, on: boolean, extra?: React.ReactNode, locked = false) => (
    <Link to={to} className={`pc-bd${on ? ' on' : ''}${locked ? ' lk' : ''}`}>
      <span className="nm">{label}</span>{extra}
    </Link>
  )

  return (
    <div className="pc-side">
      <div className="pc-box pc-cafe">
        <b>아마 돈 벌고 있을걸요?</b>
        <p>아마겟돈 클래스 수강생 커뮤니티</p>
        <dl><dt>멤버</dt><dd>{members == null ? '-' : `${members.toLocaleString()}명`}</dd></dl>
      </div>
      <div className="pc-box pc-me">
        <div className="who">
          <b>{member?.nickname}</b>
          {grade && <span className="gi"><i className={`ti ${grade.icon}`} />{grade.label}</span>}
        </div>
        <ul>
          <li><Link to="/community/my/posts">내가 쓴 글</Link><span>{stats?.posts ?? '-'}</span></li>
          <li><Link to="/community/my/comments">댓글 단 글</Link><span>{stats?.commented ?? '-'}</span></li>
          <li><Link to="/community/my/saved">저장한 글</Link><span>{stats?.saved ?? '-'}</span></li>
          <li><Link to="/community/news">내소식</Link><span className={unread ? 'red' : ''}>{unread}</span></li>
        </ul>
        <Link to="/community/me" className="pc-link">내정보·닉네임 바꾸기</Link>
      </div>
      <button className="pc-write" onClick={() => navigate(cur && readable.has(cur.id) ? `/community/write?board=${cur.slug}` : '/community/write')}>
        <i className="ti ti-pencil" />글쓰기
      </button>
      <form className="pc-sfind" onSubmit={(e) => {
        e.preventDefault()
        const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
        if (q) navigate(`/community/search?q=${encodeURIComponent(q)}`)
      }}>
        <input name="q" placeholder="커뮤니티 검색" aria-label="커뮤니티 검색" /><button aria-label="검색"><i className="ti ti-search" /></button>
      </form>
      <nav className="pc-menu" aria-label="게시판 메뉴">
        {item('/community', <><i className="ti ti-list" />전체글보기</>, pathname === '/community' || pathname === '/community/')}
        {item('/community/hot', <><i className="ti ti-flame" />인기글</>, pathname.startsWith('/community/hot'))}
        {item('/community/sub', <><i className="ti ti-star" />MY구독</>, pathname.startsWith('/community/sub'))}
        {favorites.size > 0 && (
          <>
            <p className="pc-grp">즐겨찾는 게시판</p>
            {boards.filter((b) => favorites.has(b.id) && b.enabled && readable.has(b.id)).map((b) => (
              <span key={`f${b.id}`}>{item(`/community/b/${b.slug}`, b.name, curSlug === b.slug, newCounts[b.id] ? <em className="n">N</em> : null)}</span>
            ))}
          </>
        )}
        {sections.map((s) => (
          <div key={s.key}>
            <p className="pc-grp">{s.name}</p>
            {s.items.map((b) => {
              const locked = !readable.has(b.id)
              return (
                <span key={b.id}>
                  {item(`/community/b/${b.slug}`, b.name, curSlug === b.slug,
                    locked ? <i className="ti ti-lock" /> : newCounts[b.id] ? <em className="n">N</em> : null, locked)}
                </span>
              )
            })}
          </div>
        ))}
      </nav>
    </div>
  )
}

export interface PcPinRow { id: number; label: CommunityPinLabel; post: CommunityPostView }

/** 글 목록 표: 말머리 · 제목[댓글] · 작성자 · 작성일 · 조회 (+ 게시판) */
export function PostTable({ posts, pins = [], showBoard, currentId, empty = '등록된 글이 없어요.' }: {
  posts: CommunityPostView[]; pins?: PcPinRow[]; showBoard?: boolean; currentId?: number; empty?: string
}) {
  const { boardById } = useCommunity()
  const pinnedIds = new Set(pins.map((p) => p.post.id))
  const rows = posts.filter((p) => !pinnedIds.has(p.id))
  const titleCell = (p: CommunityPostView) => (
    <Link to={`/community/p/${p.id}`} className="tt">
      {p.is_hidden && <span className="hd">[숨김] </span>}
      {p.deleted_at ? <span className="del">{p.title}</span> : p.title}
      {p.image_count > 0 && <i className="ti ti-photo pic" aria-label="사진" />}
      {p.comment_count > 0 && <span className="cc">[{p.comment_count}]</span>}
      {isRecent(p.created_at) && <em className="new">N</em>}
    </Link>
  )
  return (
    <table className="pc-table">
      <colgroup>
        <col style={{ width: 84 }} /><col />{showBoard && <col style={{ width: 120 }} />}
        <col style={{ width: 130 }} /><col style={{ width: 96 }} /><col style={{ width: 64 }} />
      </colgroup>
      <thead>
        <tr><th>말머리</th><th>제목</th>{showBoard && <th>게시판</th>}<th>작성자</th><th>작성일</th><th>조회</th></tr>
      </thead>
      <tbody>
        {pins.map((p) => (
          <tr key={`pin${p.id}`} className="pin">
            <td><span className={`lb ${p.label}`}>{PIN_LABEL[p.label]}</span></td>
            <td className="t">{titleCell(p.post)}</td>
            {showBoard && <td className="bd">{boardById(p.post.board_id)?.name}</td>}
            <td className="au">{p.post.author?.nickname ?? '알 수 없음'}</td>
            <td className="dt">{pcDate(p.post.created_at)}</td>
            <td className="vw">{p.post.view_count.toLocaleString()}</td>
          </tr>
        ))}
        {rows.map((p) => (
          <tr key={p.id} className={p.id === currentId ? 'cur' : ''}>
            <td className="hdc">{p.head && HEAD_LABEL[p.head] ? <span className={`hd ${p.head}`}>{HEAD_LABEL[p.head]}</span> : ''}</td>
            <td className="t">{titleCell(p)}</td>
            {showBoard && <td className="bd">{boardById(p.board_id)?.name}</td>}
            <td className="au">{p.author?.nickname ?? '알 수 없음'}{p.author?.badge === 'instructor' && <span className="tag ins">강사</span>}{p.author?.badge === 'staff' && <span className="tag staff">스탭</span>}</td>
            <td className="dt">{pcDate(p.created_at)}</td>
            <td className="vw">{p.view_count.toLocaleString()}</td>
          </tr>
        ))}
        {!pins.length && !rows.length && (
          <tr><td colSpan={showBoard ? 6 : 5} className="empty">{empty}</td></tr>
        )}
      </tbody>
    </table>
  )
}

/** 페이지 번호(10개씩 묶음) */
export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const last = Math.max(1, Math.ceil(total / pageSize))
  if (last <= 1) return null
  const start = Math.floor((page - 1) / 10) * 10 + 1
  const end = Math.min(last, start + 9)
  const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i)
  return (
    <div className="pc-pager">
      {start > 1 && <button onClick={() => onPage(start - 1)}><i className="ti ti-chevron-left" />이전</button>}
      {nums.map((n) => <button key={n} className={n === page ? 'on' : ''} onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined}>{n}</button>)}
      {end < last && <button onClick={() => onPage(end + 1)}>다음<i className="ti ti-chevron-right" /></button>}
    </div>
  )
}

/** 목록 아래 검색(이 게시판 또는 전체) */
export function PcSearchBar({ boardSlug }: { boardSlug?: string }) {
  const navigate = useNavigate()
  return (
    <form className="pc-search" onSubmit={(e) => {
      e.preventDefault()
      const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
      if (!q) return
      navigate(`/community/search?q=${encodeURIComponent(q)}${boardSlug ? `&board=${encodeURIComponent(boardSlug)}` : ''}`)
    }}>
      <input name="q" placeholder={boardSlug ? '이 게시판에서 제목·내용·작성자 검색' : '전체 글에서 제목·내용·작성자 검색'} aria-label="검색어" />
      <button>검색</button>
    </form>
  )
}
