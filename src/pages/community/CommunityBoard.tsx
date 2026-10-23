import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { communityService } from '../../services/communityService'
import { AppBar, LockView, PinnedRows, PostList, SearchButton, Spinner, WriteFab } from '../../components/community/CommunityParts'
import { useCommunity } from './communityState'
import { Pager, PcSearchBar, PostTable } from '../../components/community/CommunityPc'
import { useIsPc } from '../../lib/communityUtils'
import { HEAD_LABEL, type CommunityBoard as Board, type CommunityPin, type CommunityPostView } from '../../types/community'

// 게시판 목록: 이름·설명·즐겨찾기 · 말머리 거르기 · 고정 줄 · 글 목록(더보기)
export default function CommunityBoard() {
  const { slug = '' } = useParams()
  const { boardBySlug, readable, favorites, toggleFavorite, refreshCounts, access } = useCommunity()
  const board = boardBySlug(slug)
  const pc = useIsPc()

  if (!board || (!board.enabled && !access?.admin)) {
    return <><AppBar title="게시판" back menu /><p className="cm-empty">게시판을 찾을 수 없어요.</p></>
  }
  if (!readable.has(board.id)) return <><AppBar title={board.name} back /><BoardLock board={board} /></>
  if (pc) return <BoardBodyPc key={board.id} board={board} fav={favorites.has(board.id)} onFav={() => void toggleFavorite(board.id)} onRead={refreshCounts} />
  return <BoardBody key={board.id} board={board} fav={favorites.has(board.id)} onFav={() => void toggleFavorite(board.id)} onRead={refreshCounts} />
}

function BoardLock({ board }: { board: Board }) {
  if (board.read_level === 'cohort') {
    const cid = board.course_ids[0]
    return <LockView title="수강생 전용 게시판이에요" text="해당 기수 수강생만 볼 수 있어요" action={cid ? { label: '과정 보기', to: `/course/${cid}` } : undefined} />
  }
  if (board.read_level === 'paid') return <LockView title="유료 수강생 전용 게시판이에요" text="정규 과정을 들으면 함께할 수 있어요" action={{ label: '정규 과정 보기', to: '/academy/premium' }} />
  if (board.read_level === 'buyer') return <LockView title="무료 강의 신청 후 들어올 수 있어요" text="무료 강의를 신청하면 바로 열려요" action={{ label: '무료 강의 보기', to: '/academy/free' }} />
  return <LockView title="볼 수 없는 게시판이에요" text="운영진만 볼 수 있어요" />
}

function BoardBody({ board, fav, onFav, onRead }: { board: Board; fav: boolean; onFav: () => void; onRead: () => Promise<void> }) {
  const [head, setHead] = useState<string>('')
  const [pins, setPins] = useState<(CommunityPin & { post: CommunityPostView })[]>([])
  const [posts, setPosts] = useState<CommunityPostView[] | null>(null)
  const [more, setMore] = useState(false)
  const [canWrite, setCanWrite] = useState(false)

  useEffect(() => {
    communityService.pins('board', board.id).then(setPins).catch(() => undefined)
    communityService.canWrite(board.id).then(setCanWrite).catch(() => undefined)
    // 들어오면 이 게시판 새 글 표시(N)를 지움
    communityService.markBoardRead(board.id).then(() => onRead()).catch(() => undefined)
  }, [board.id, onRead])

  useEffect(() => {
    let alive = true
    communityService.listPosts({ boardId: board.id, head: head || undefined, limit: 20 })
      .then((list) => { if (alive) { setPosts(list); setMore(list.length === 20) } })
      .catch((e) => { if (alive) { setPosts([]); toast.error(e instanceof Error ? e.message : '글을 불러오지 못했어요.') } })
    return () => { alive = false }
  }, [board.id, head])

  const loadMore = async () => {
    if (!posts?.length) return
    const last = posts[posts.length - 1]
    const list = await communityService.listPosts({ boardId: board.id, head: head || undefined, limit: 20, before: { created_at: last.created_at, id: last.id } })
    setPosts([...posts, ...list])
    setMore(list.length === 20)
  }

  return (
    <>
      <AppBar title="아마 돈 벌고 있을걸요?" menu right={<SearchButton />} />
      <div className="board-h" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2><i className={`ti ${board.icon || 'ti-list'}`} style={{ fontSize: 20 }} />{board.name}</h2>
          {board.description && <p>{board.description}</p>}
          {board.kind === 'qna' && <p>질문을 올리면 48시간 안에 강사·스탭이 답해요.</p>}
        </div>
        <button aria-label={fav ? '즐겨찾기 해제' : '즐겨찾기'} onClick={onFav} style={{ padding: 6 }}>
          <i className={`ti ${fav ? 'ti-star-filled star on' : 'ti-star star'}`} />
        </button>
      </div>
      {board.heads.length > 0 && (
        <div className="cm-filter">
          <button className={head === '' ? 'on' : ''} onClick={() => { setPosts(null); setHead('') }}>전체</button>
          {board.heads.map((h) => (
            <button key={h} className={head === h ? 'on' : ''} onClick={() => { setPosts(null); setHead(h) }}>{HEAD_LABEL[h] ?? h}</button>
          ))}
        </div>
      )}
      <PinnedRows pins={pins} />
      {posts === null ? <Spinner /> : <PostList posts={posts} empty="아직 글이 없어요. 첫 글을 남겨 보세요!" />}
      {posts && more && <button className="cm-load" onClick={() => void loadMore()}>더보기</button>}
      {canWrite && <WriteFab boardSlug={board.slug} />}
    </>
  )
}

const PAGE_SIZE = 20

/** PC: 게시판 머리 · 말머리 · 표(고정 글 맨 위) · 페이지 번호 · 검색 */
function BoardBodyPc({ board, fav, onFav, onRead }: { board: Board; fav: boolean; onFav: () => void; onRead: () => Promise<void> }) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const head = params.get('head') ?? ''
  const [pins, setPins] = useState<(CommunityPin & { post: CommunityPostView })[]>([])
  const [data, setData] = useState<{ posts: CommunityPostView[]; total: number } | null>(null)

  useEffect(() => {
    communityService.pins('board', board.id).then(setPins).catch(() => undefined)
    communityService.markBoardRead(board.id).then(() => onRead()).catch(() => undefined)
  }, [board.id, onRead])

  useEffect(() => {
    let alive = true
    communityService.listPage({ boardId: board.id, head: head || undefined, page, pageSize: PAGE_SIZE })
      .then((r) => { if (alive) setData(r) })
      .catch((e) => { if (alive) { setData({ posts: [], total: 0 }); toast.error(e instanceof Error ? e.message : '글을 불러오지 못했어요.') } })
    return () => { alive = false }
  }, [board.id, head, page])

  const go = (next: { page?: number; head?: string }) => {
    const p = new URLSearchParams(params)
    if (next.head !== undefined) { if (next.head) p.set('head', next.head); else p.delete('head'); p.delete('page') }
    if (next.page) { if (next.page > 1) p.set('page', String(next.page)); else p.delete('page') }
    setData(null)
    setParams(p)
    window.scrollTo(0, 0)
  }

  return (
    <>
      <div className="pc-head">
        <h2>{board.name}</h2>
        {board.description && <p>{board.description}</p>}
        <span className="sp" />
        <button className="opt" onClick={onFav} aria-label={fav ? '즐겨찾기 해제' : '즐겨찾기'}>
          <i className={`ti ${fav ? 'ti-star-filled star on' : 'ti-star star'}`} style={{ fontSize: 16 }} />즐겨찾기
        </button>
      </div>
      {board.kind === 'qna' && <p className="pc-sub"><span>질문을 올리면 48시간 안에 강사·스탭이 답해요.</span></p>}
      {board.heads.length > 0 && (
        <div className="cm-filter" style={{ padding: '10px 20px' }}>
          <button className={head === '' ? 'on' : ''} onClick={() => go({ head: '' })}>전체</button>
          {board.heads.map((h) => <button key={h} className={head === h ? 'on' : ''} onClick={() => go({ head: h })}>{HEAD_LABEL[h] ?? h}</button>)}
        </div>
      )}
      {data === null ? <Spinner /> : (
        <>
          <PostTable posts={data.posts} pins={page === 1 && !head ? pins : []} />
          <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPage={(n) => go({ page: n })} />
        </>
      )}
      <PcSearchBar boardSlug={board.slug} />
    </>
  )
}
