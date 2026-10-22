import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppBar, Spinner } from '../../components/community/CommunityParts'
import { timeLabel } from '../../lib/communityUtils'
import { communityService } from '../../services/communityService'
import type { CommunityNotification, CommunityNotificationKind, CommunityPostView } from '../../types/community'
import { useCommunity } from './communityState'
import { postsInOrder, useKeyedLoad } from './extra/hooks'

const KIND: Record<CommunityNotificationKind, { icon: string; text: string }> = {
  comment: { icon: 'ti-message-circle', text: '내 글에 새 댓글이 달렸어요' },
  reply: { icon: 'ti-corner-down-right', text: '내 댓글에 답글이 달렸어요' },
  instructor_answer: { icon: 'ti-school', text: '강사님이 내 질문에 답했어요' },
  remind_instructor: { icon: 'ti-alarm', text: '48시간 넘게 답이 없는 질문이 있어요' },
  admin: { icon: 'ti-speakerphone', text: '운영진 알림이 있어요' },
}

async function loadNews(): Promise<{ list: CommunityNotification[]; posts: Map<number, CommunityPostView> }> {
  const list = await communityService.notifications(50)
  const ids = [...new Set(list.map((n) => n.post_id).filter((id): id is number => id != null))]
  const posts = await postsInOrder(ids, true).catch(() => [] as CommunityPostView[])
  return { list, posts: new Map(posts.map((p) => [p.id, p])) }
}

// 내소식: 내 글 댓글·답글·강사 답변·운영 알림. 들어오면 모두 읽음 처리
export default function CommunityNews() {
  const { boardById, refreshCounts } = useCommunity()
  const { data, loading, error } = useKeyedLoad('news', loadNews)

  const hasUnread = !!data?.list.some((n) => !n.read_at)
  useEffect(() => {
    if (!hasUnread) return
    communityService.markNotificationsRead()
      .then(() => refreshCounts())
      .catch(() => undefined)
  }, [hasUnread, refreshCounts])

  return (
    <>
      <AppBar title="내소식" />
      {loading ? <Spinner /> : !data?.list.length ? (
        <p className="cm-empty">{error ? '알림을 불러오지 못했어요.' : '아직 새 소식이 없어요.'}</p>
      ) : (
        <div>
          {data.list.map((n) => {
            const k = KIND[n.kind] ?? KIND.admin
            const post = n.post_id != null ? data.posts.get(n.post_id) : undefined
            const text = n.kind === 'admin' ? n.message || k.text : k.text
            const board = post ? boardById(post.board_id)?.name : undefined
            const inner = (
              <>
                <i className={`ti ${k.icon}`} style={!n.read_at ? { color: 'var(--pd)' } : undefined} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p>{text}</p>
                  {post && (
                    <p style={{ fontSize: 13.5, color: 'var(--g6)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {post.deleted_at ? '삭제된 글이에요' : `'${post.title}'`}
                    </p>
                  )}
                  <span>{timeLabel(n.created_at)}{board ? ` · ${board}` : ''}</span>
                </div>
              </>
            )
            const cls = `news${n.read_at ? '' : ' new'}`
            return n.post_id != null
              ? <Link key={n.id} className={cls} to={`/community/p/${n.post_id}`}>{inner}</Link>
              : <div key={n.id} className={cls}>{inner}</div>
          })}
          {data.list.length >= 50 && <p style={{ padding: '14px 16px 24px', fontSize: 12, color: 'var(--g4)', textAlign: 'center' }}>최근 알림 50개까지 보여요</p>}
        </div>
      )}
    </>
  )
}
