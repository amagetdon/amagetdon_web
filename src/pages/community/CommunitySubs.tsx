import { Link } from 'react-router-dom'
import { AppBar, SearchButton, Spinner, WriteFab } from '../../components/community/CommunityParts'
import { useCommunity } from './communityState'
import { FeedCards, MoreButton } from './extra/ExtraParts'
import { usePagedPosts } from './extra/hooks'

// 구독: 즐겨찾기(별) 한 게시판들의 최신 글 모음
export default function CommunitySubs() {
  const { boards, favorites, readable, newCounts, setDrawerOpen } = useCommunity()
  const subs = boards.filter((b) => b.enabled && favorites.has(b.id) && readable.has(b.id))
  const ids = subs.map((b) => b.id).sort((a, b) => a - b)
  const key = ids.length ? ids.join(',') : null
  const { posts, more, busy, loading, error, loadMore } = usePagedPosts(key, { boardIds: ids })

  return (
    <>
      <AppBar title={<span style={{ display: 'block', textAlign: 'center', paddingLeft: 30 }}>구독</span>} right={<SearchButton />} />
      {!subs.length ? (
        <div className="lock">
          <i className="ti ti-star" />
          <h2>구독하는 게시판이 없어요</h2>
          <p>게시판 메뉴에서 별(☆)을 누르면<br />그 게시판의 새 글을 여기서 모아 볼 수 있어요.</p>
          <button className="go" onClick={() => setDrawerOpen(true)}>게시판 메뉴 열기</button>
        </div>
      ) : (
        <>
          <div className="cm-filter" style={{ borderBottom: '8px solid var(--g1)' }}>
            {subs.map((b) => (
              <Link key={b.id} to={`/community/b/${b.slug}`}
                style={{ height: 30, padding: '0 12px', border: '1px solid var(--g3)', borderRadius: 15, fontSize: 13, whiteSpace: 'nowrap', color: 'var(--g8)', display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none' }}>
                <i className={`ti ${b.icon || 'ti-list'}`} style={{ fontSize: 15, color: 'var(--g5)' }} />
                {b.name}
                {!!newCounts[b.id] && <span style={{ color: '#e5484d', fontWeight: 700, fontSize: 12 }}>N</span>}
              </Link>
            ))}
            <button onClick={() => setDrawerOpen(true)} aria-label="구독 게시판 고르기" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <i className="ti ti-plus" style={{ fontSize: 15 }} />편집
            </button>
          </div>
          {loading ? <Spinner /> : posts.length ? (
            <>
              <FeedCards posts={posts} />
              <MoreButton show={more} busy={busy} onClick={() => void loadMore()} />
            </>
          ) : (
            <p className="cm-empty">{error ? '글을 불러오지 못했어요.' : '구독한 게시판에 아직 글이 없어요.'}</p>
          )}
        </>
      )}
      <WriteFab />
    </>
  )
}
