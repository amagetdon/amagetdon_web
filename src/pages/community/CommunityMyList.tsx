import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { AppBar, PostList, Spinner } from '../../components/community/CommunityParts'
import { communityService } from '../../services/communityService'
import { MoreButton } from './extra/ExtraParts'
import { postsInOrder, useKeyedLoad, usePagedPosts } from './extra/hooks'

type Kind = 'posts' | 'comments' | 'liked' | 'saved'

const TITLE: Record<Kind, { title: string; empty: string }> = {
  posts: { title: '내 글', empty: '아직 쓴 글이 없어요.' },
  comments: { title: '댓글단 글', empty: '아직 댓글 단 글이 없어요.' },
  liked: { title: '좋아요한 글', empty: '아직 좋아요한 글이 없어요.' },
  saved: { title: '저장한 글', empty: '아직 저장한 글이 없어요.' },
}

// 내 글 · 댓글단 글 · 좋아요한 글 · 저장한 글
export default function CommunityMyList() {
  const { kind } = useParams()
  const { user } = useAuth()
  if (!kind || !(kind in TITLE)) return <Navigate to="/community/me" replace />
  if (!user) return null
  const k = kind as Kind
  return (
    <>
      <AppBar title={TITLE[k].title} back="/community/me" />
      {k === 'posts' ? <MyPosts userId={user.id} /> : <IdList key={k} kind={k} userId={user.id} />}
    </>
  )
}

function MyPosts({ userId }: { userId: string }) {
  const { posts, more, busy, loading, error, loadMore } = usePagedPosts(`mine:${userId}`, { authorId: userId })
  if (loading) return <Spinner />
  return (
    <>
      <PostList posts={posts} showBoard empty={error ? '글을 불러오지 못했어요.' : TITLE.posts.empty} />
      <MoreButton show={more} busy={busy} onClick={() => void loadMore()} />
    </>
  )
}

const ID_LOADER: Record<Exclude<Kind, 'posts'>, (userId: string) => Promise<number[]>> = {
  comments: (u) => communityService.myCommentedPostIds(u, 50),
  liked: (u) => communityService.myLikedPostIds(u, 50),
  saved: (u) => communityService.mySavedPostIds(u, 50),
}

/** id 목록을 받아 그 순서대로(최근 활동순) 보여 줌. 최근 50개까지 */
function IdList({ kind, userId }: { kind: Exclude<Kind, 'posts'>; userId: string }) {
  const { data, loading, error } = useKeyedLoad(`${kind}:${userId}`, async () => postsInOrder(await ID_LOADER[kind](userId)))
  if (loading) return <Spinner />
  const posts = data ?? []
  return (
    <>
      <PostList posts={posts} showBoard empty={error ? '글을 불러오지 못했어요.' : TITLE[kind].empty} />
      {posts.length >= 50 && <p style={{ padding: '14px 16px 24px', fontSize: 12, color: 'var(--g4)', textAlign: 'center' }}>최근 50개까지 보여요</p>}
    </>
  )
}
