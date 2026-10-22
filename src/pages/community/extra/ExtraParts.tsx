import { Link } from 'react-router-dom'
import { Avatar, GradeTag, HeadTag } from '../../../components/community/CommunityParts'
import { timeLabel, useSignedUrls } from '../../../lib/communityUtils'
import type { CommunityPostView } from '../../../types/community'
import { useCommunity } from '../communityState'

// 보조 화면 전용 작은 부품(공용 CSS 클래스 + 인라인 스타일만 사용)

/** 인기글 한 줄: 순위 + 제목 + 조회·좋아요·댓글 + 게시판 (시안 hotRow) */
export function HotList({ posts }: { posts: CommunityPostView[] }) {
  const { boardById } = useCommunity()
  const urls = useSignedUrls(posts.map((p) => p.thumb_path))
  return (
    <div>
      {posts.map((p, i) => (
        <Link key={p.id} className="row6" to={`/community/p/${p.id}`}>
          <span style={{ width: 22, flex: 'none', fontWeight: 800, fontSize: 15, color: i < 3 ? 'var(--pd)' : 'var(--g5)', marginTop: 1 }}>{i + 1}</span>
          <div className="c">
            <p className="tt"><HeadTag head={p.head} />{p.title}</p>
            <div className="st6">
              <span>조회 {p.view_count.toLocaleString()}</span>
              <span><i className="ti ti-heart" />{p.reaction_count}</span>
              <span><i className="ti ti-message-circle" />{p.comment_count}</span>
            </div>
            <div className="mt" style={{ marginTop: 3 }}><span>{boardById(p.board_id)?.name}</span></div>
          </div>
          {p.image_count > 0 && (
            <span className="th6">
              {p.thumb_path && urls[p.thumb_path] && (
                <img src={urls[p.thumb_path]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} />
              )}
              {p.image_count > 1 && <em style={{ zIndex: 2 }}>{p.image_count}</em>}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}

/** 구독 피드 카드(시안 card6) */
export function FeedCards({ posts }: { posts: CommunityPostView[] }) {
  const { boardById } = useCommunity()
  const urls = useSignedUrls(posts.map((p) => p.thumb_path))
  return (
    <div>
      {posts.map((p) => {
        const img = p.thumb_path ? urls[p.thumb_path] : undefined
        return (
          <div key={p.id} className="card6">
            <div className="hd6">
              <Avatar name={p.author?.nickname} />
              <div style={{ minWidth: 0 }}>
                <b>{p.author?.nickname ?? '알 수 없음'}</b> <GradeTag author={p.author} />
                <p>{timeLabel(p.created_at)} · {boardById(p.board_id)?.name}</p>
              </div>
            </div>
            <Link to={`/community/p/${p.id}`} style={{ display: 'block' }}>
              <h3><HeadTag head={p.head} />{p.title}</h3>
              {p.body && <p className="bd6">{p.body.replace(/\s+/g, ' ').slice(0, 200)}</p>}
              {p.image_count > 0 && (
                <div className="ph" style={{ position: 'relative', overflow: 'hidden' }}>
                  {img && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  {p.image_count > 1 && (
                    <em style={{ position: 'absolute', right: 8, bottom: 8, fontStyle: 'normal', fontSize: 11, color: '#fff', background: '#00000066', borderRadius: 8, padding: '1px 6px' }}>
                      {p.image_count}장
                    </em>
                  )}
                </div>
              )}
            </Link>
            <div className="ft">
              <span><i className="ti ti-heart" style={{ fontSize: 17 }} /> {p.reaction_count}</span>
              <span><i className="ti ti-message-circle" style={{ fontSize: 17 }} /> {p.comment_count}</span>
              <span className="r">조회 {p.view_count.toLocaleString()}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** '더보기' 버튼 */
export function MoreButton({ show, busy, onClick }: { show: boolean; busy: boolean; onClick: () => void }) {
  if (!show) return null
  return (
    <button className="cm-load" onClick={onClick} disabled={busy}>
      {busy ? '불러오는 중…' : <>더보기 <i className="ti ti-chevron-down" style={{ fontSize: 16 }} /></>}
    </button>
  )
}
