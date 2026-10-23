import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { communityService } from '../../services/communityService'
import { splitLinks, timeLabel, useIsPc, useSignedUrls } from '../../lib/communityUtils'
import { PostTable } from '../../components/community/CommunityPc'
import { AppBar, Avatar, GradeTag, HeadTag, Spinner } from '../../components/community/CommunityParts'
import { useCommunity } from './communityState'
import { REPORT_REASON_LABEL, type CommunityComment, type CommunityPostImage, type CommunityPostView, type CommunityReportReason } from '../../types/community'

type Sheet =
  | { kind: 'post' }
  | { kind: 'comment'; c: CommunityComment }
  | { kind: 'report'; target_type: 'post' | 'comment'; target_id: number }
  | null

// 글 상세: 본문·사진·수익 · 좋아요·저장·공유 · 댓글(답글 1단, 강사 배지·고정) · 신고
export default function CommunityPost() {
  const { id } = useParams()
  const postId = Number(id)
  const { user } = useAuth()
  const { boardById, member, access } = useCommunity()
  const navigate = useNavigate()
  const [post, setPost] = useState<CommunityPostView | null | undefined>(undefined)
  const [images, setImages] = useState<CommunityPostImage[]>([])
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null)
  const [sending, setSending] = useState(false)
  const pc = useIsPc()
  const [adj, setAdj] = useState<CommunityPostView[]>([])

  const loadComments = useCallback(async () => setComments(await communityService.comments(postId)), [postId])

  useEffect(() => {
    if (!Number.isFinite(postId)) { setPost(null); return }
    let alive = true
    ;(async () => {
      try {
        const p = await communityService.getPost(postId)
        if (!alive) return
        setPost(p)
        if (!p) return
        void communityService.viewPost(postId)
        const [imgs, likes, sv] = await Promise.all([
          p.image_count > 0 ? communityService.images(postId) : Promise.resolve([]),
          communityService.myLikes([postId]),
          communityService.isSaved(postId),
        ])
        if (!alive) return
        setImages(imgs); setLiked(likes.has(postId)); setSaved(sv)
        await loadComments()
      } catch (e) {
        if (alive) { setPost(null); toast.error(e instanceof Error ? e.message : '글을 불러오지 못했어요.') }
      }
    })()
    return () => { alive = false }
  }, [postId, loadComments])

  const urls = useSignedUrls(images.map((i) => i.path))
  const adjKey = post ? `${post.id}|${post.board_id}|${post.created_at}` : ''
  // PC: 같은 게시판 앞뒤 글
  useEffect(() => {
    if (!pc || !adjKey) return
    const [id, boardId, createdAt] = adjKey.split('|')
    let alive = true
    communityService.adjacent({ id: Number(id), board_id: Number(boardId), created_at: createdAt }, 3)
      .then((r) => { if (alive) setAdj(r) }).catch(() => undefined)
    return () => { alive = false }
  }, [pc, adjKey])
  const board = post ? boardById(post.board_id) : undefined
  const mine = !!post && post.author_id === user?.id
  const canPin = !!access?.admin || member?.badge === 'instructor'

  // 고정 댓글 → 나머지(작성순), 답글은 부모 아래로
  const threads = useMemo(() => {
    const roots = comments.filter((c) => !c.parent_id)
    const sorted = [...roots.filter((c) => c.is_pinned), ...roots.filter((c) => !c.is_pinned)]
    return sorted.map((r) => ({ root: r, replies: comments.filter((c) => c.parent_id === r.id) }))
  }, [comments])

  if (post === undefined) return <><AppBar back /><Spinner /></>
  if (post === null) return <><AppBar back /><p className="cm-empty">글을 찾을 수 없어요. 지워졌거나 볼 수 없는 글이에요.</p></>
  const deleted = !!post.deleted_at

  const toggleLike = async () => {
    const on = !liked
    setLiked(on); setPost({ ...post, reaction_count: post.reaction_count + (on ? 1 : -1) })
    try { await communityService.setLike(post.id, on) } catch (e) {
      setLiked(!on); setPost({ ...post }); toast.error(e instanceof Error ? e.message : '처리하지 못했어요.')
    }
  }
  const toggleSave = async () => {
    const on = !saved
    setSaved(on)
    try { await communityService.setSaved(post.id, on); toast.success(on ? '저장했어요. 내정보 > 저장한 글에서 볼 수 있어요.' : '저장을 취소했어요.') } catch (e) {
      setSaved(!on); toast.error(e instanceof Error ? e.message : '처리하지 못했어요.')
    }
  }
  const share = async () => {
    const url = `${window.location.origin}/community/p/${post.id}`
    try { await navigator.clipboard.writeText(url); toast.success('주소를 복사했어요. 커뮤니티 회원만 볼 수 있어요.') } catch { toast(url) }
  }
  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await communityService.addComment(post.id, text, replyTo ? (replyTo.parent_id ?? replyTo.id) : null)
      setText(''); setReplyTo(null)
      await loadComments()
      setPost({ ...post, comment_count: post.comment_count + 1 })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '댓글을 남기지 못했어요.')
    } finally {
      setSending(false)
    }
  }
  const removePost = async () => {
    if (!window.confirm(post.comment_count > 0 ? '글을 지울까요? 댓글이 있어 "삭제된 글입니다"로 자리만 남아요.' : '글을 지울까요?')) return
    try {
      await communityService.deletePost(post.id)
      toast.success('글을 지웠어요.')
      navigate(board ? `/community/b/${board.slug}` : '/community', { replace: true })
    } catch (e) { toast.error(e instanceof Error ? e.message : '지우지 못했어요.') }
  }
  const removeComment = async (c: CommunityComment) => {
    if (!window.confirm('댓글을 지울까요?')) return
    try { await communityService.deleteComment(c.id); await loadComments() } catch (e) { toast.error(e instanceof Error ? e.message : '지우지 못했어요.') }
  }
  const pin = async (c: CommunityComment) => {
    try { await communityService.pinComment(c.id, !c.is_pinned); await loadComments() } catch (e) { toast.error(e instanceof Error ? e.message : '처리하지 못했어요.') }
  }

  const commentView = (c: CommunityComment, re: boolean) => (
    <div key={c.id} className={`cm${re ? ' re' : ''}${c.is_pinned && !re ? ' pin' : ''}`}>
      <Avatar name={c.author?.nickname} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{c.deleted_at ? '알 수 없음' : c.author?.nickname ?? '알 수 없음'}</b>
        {!c.deleted_at && c.author_id === post.author_id && <span className="tag mine">작성자</span>}
        {!c.deleted_at && c.is_instructor && <span className="tag ins">강사</span>}
        {!c.deleted_at && c.author?.badge === 'staff' && <span className="tag staff">스탭</span>}
        {c.is_pinned && !re && <span className="tag mine"><i className="ti ti-pin" style={{ fontSize: 11 }} />고정</span>}
        <p style={c.deleted_at || c.is_hidden ? { color: 'var(--g5)' } : undefined}>
          {c.is_hidden && !c.deleted_at ? '숨김 처리된 댓글이에요.' : <BodyText text={c.body} />}
        </p>
        <div className="acts2">
          <span>{timeLabel(c.created_at)}</span>
          {!c.deleted_at && !deleted && <button onClick={() => { setReplyTo(c); document.getElementById('cm-input')?.focus() }}>답글</button>}
          {!c.deleted_at && <button onClick={() => setSheet({ kind: 'comment', c })} aria-label="댓글 메뉴"><i className="ti ti-dots" style={{ fontSize: 14 }} /></button>}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <AppBar back title={board?.name}
        right={<button className="ib" aria-label="더보기" onClick={() => setSheet({ kind: 'post' })}><i className="ti ti-dots-vertical" /></button>} />
      <div className="dt">
        {board && <Link className="bn" to={`/community/b/${board.slug}`}>{board.name}<i className="ti ti-chevron-right" /></Link>}
        {post.is_hidden && <p style={{ marginTop: 8, fontSize: 13, color: '#e5484d' }}>숨김 처리된 글이에요{post.hidden_reason ? ` (${post.hidden_reason})` : ''}. 나와 운영진만 볼 수 있어요.</p>}
        <h1 style={deleted ? { color: 'var(--g5)' } : undefined}>{!deleted && <HeadTag head={post.head} />}{post.title}</h1>
        <div className="au">
          <Avatar name={post.author?.nickname} />
          <div style={{ minWidth: 0 }}>
            <b>{post.author?.nickname ?? '알 수 없음'}</b> <GradeTag author={post.author} />
            <div className="m">{timeLabel(post.created_at)} · 조회 {post.view_count.toLocaleString()}{post.updated_at !== post.created_at && !deleted ? ' · 수정됨' : ''}</div>
          </div>
        </div>
      </div>
      {!deleted && (
        <div className="body">
          <BodyText text={post.body} />
          {images.length > 0 && (
            <div className="dt photos" style={{ padding: 0 }}>
              {images.map((i) => urls[i.path]
                ? <img key={i.id} src={urls[i.path]} alt="" loading="lazy" width={i.width ?? undefined} height={i.height ?? undefined} style={{ height: 'auto' }} />
                : <div key={i.id} className="img"><i className="ti ti-photo" />사진 불러오는 중</div>)}
            </div>
          )}
          {(post.revenue != null || post.spend != null) && (
            <div className="money">
              {post.revenue != null && <span>수익 <b>{post.revenue.toLocaleString()}원</b></span>}
              {post.spend != null && <span>지출 <b>{post.spend.toLocaleString()}원</b></span>}
              <span className="ok" style={post.verify_status === 'approved' ? undefined : { color: 'var(--g5)' }}>
                <i className={`ti ${post.verify_status === 'approved' ? 'ti-rosette-discount-check' : 'ti-clock'}`} />
                {post.verify_status === 'approved' ? '운영자 확인' : post.verify_status === 'rejected' ? '확인 안 됨' : '확인 전'}
              </span>
            </div>
          )}
        </div>
      )}
      {deleted && <div className="body" style={{ color: 'var(--g5)' }}>작성자가 지운 글이에요.</div>}
      <div className="acts">
        <button className={liked ? 'on' : ''} onClick={() => void toggleLike()} disabled={deleted}><i className={`ti ${liked ? 'ti-heart-filled' : 'ti-heart'}`} />좋아요 {post.reaction_count}</button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><i className="ti ti-message-circle" />댓글 {post.comment_count}</span>
        <button onClick={() => void toggleSave()} disabled={deleted}><i className={`ti ${saved ? 'ti-bookmark-filled' : 'ti-bookmark'}`} style={saved ? { color: 'var(--pd)' } : undefined} />저장</button>
        <button className="share" onClick={() => void share()}><i className="ti ti-share" />공유</button>
      </div>
      <div className="cmts">
        <div className="ch">댓글 {comments.filter((c) => !c.deleted_at).length}<span>{board?.kind === 'qna' && !post.instructor_answered_at ? '강사 답변을 기다리는 중' : ''}</span></div>
        {threads.length === 0 && <p className="cm-empty" style={{ padding: '30px 0' }}>첫 댓글을 남겨 보세요.</p>}
        {threads.map((t) => (
          <Fragment key={t.root.id}>
            {commentView(t.root, false)}
            {t.replies.map((r) => commentView(r, true))}
          </Fragment>
        ))}
      </div>
      {!deleted && (
        <div className="cbox">
          {replyTo && <div className="reply"><span>{replyTo.author?.nickname ?? ''}님에게 답글</span><button onClick={() => setReplyTo(null)}>취소</button></div>}
          <input id="cm-input" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={replyTo ? '답글을 남겨보세요' : '댓글을 남겨보세요'}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send() }} />
          <button className="send" onClick={() => void send()} disabled={sending || !text.trim()}>등록</button>
        </div>
      )}

      {pc && adj.length > 1 && board && (
        <div className="pc-adj">
          <div className="pc-sub"><b>'{board.name}' 게시판 글</b><Link to={`/community/b/${board.slug}`}><span>목록 보기</span></Link></div>
          <PostTable posts={adj} currentId={post.id} />
        </div>
      )}

      {sheet && (
        <ActionSheet onClose={() => setSheet(null)}>
          {sheet.kind === 'post' && (mine ? (
            <>
              {!deleted && <button className="it" onClick={() => navigate(`/community/write?edit=${post.id}`)}><i className="ti ti-pencil" />수정</button>}
              {!deleted && <button className="it danger" onClick={() => { setSheet(null); void removePost() }}><i className="ti ti-trash" />삭제</button>}
              <button className="it" onClick={() => { setSheet(null); void share() }}><i className="ti ti-link" />주소 복사</button>
            </>
          ) : (
            <>
              <button className="it" onClick={() => { setSheet(null); void share() }}><i className="ti ti-link" />주소 복사</button>
              {!deleted && <button className="it danger" onClick={() => setSheet({ kind: 'report', target_type: 'post', target_id: post.id })}><i className="ti ti-alarm" />신고</button>}
              {access?.admin && !deleted && <button className="it danger" onClick={() => { setSheet(null); void removePost() }}><i className="ti ti-trash" />삭제(운영자)</button>}
            </>
          ))}
          {sheet.kind === 'comment' && (
            <>
              {canPin && !sheet.c.parent_id && <button className="it" onClick={() => { const c = sheet.c; setSheet(null); void pin(c) }}><i className="ti ti-pin" />{sheet.c.is_pinned ? '고정 해제' : '맨 위에 고정'}</button>}
              {(sheet.c.author_id === user?.id || access?.admin)
                ? <button className="it danger" onClick={() => { const c = sheet.c; setSheet(null); void removeComment(c) }}><i className="ti ti-trash" />삭제</button>
                : <button className="it danger" onClick={() => setSheet({ kind: 'report', target_type: 'comment', target_id: sheet.c.id })}><i className="ti ti-alarm" />신고</button>}
            </>
          )}
          {sheet.kind === 'report' && <ReportForm postId={post.id} target_type={sheet.target_type} target_id={sheet.target_id} onDone={() => setSheet(null)} />}
        </ActionSheet>
      )}
    </>
  )
}

/** 글자만 — 줄바꿈은 그대로, 주소는 링크로 */
function BodyText({ text }: { text: string }) {
  return <>{splitLinks(text).map((p, i) => p.href
    ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow ugc">{p.text}</a>
    : <Fragment key={i}>{p.text}</Fragment>)}</>
}

function ActionSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <>
      <div className="cm-sheet-dim" onClick={onClose} />
      <div className="cm-sheet" role="dialog">{children}<button className="it" onClick={onClose} style={{ justifyContent: 'center', color: 'var(--g6)' }}>닫기</button></div>
    </>
  )
}

function ReportForm({ postId, target_type, target_id, onDone }: { postId: number; target_type: 'post' | 'comment'; target_id: number; onDone: () => void }) {
  const [reason, setReason] = useState<CommunityReportReason | null>(null)
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!reason) return
    setBusy(true)
    try {
      await communityService.report({ target_type, target_id, post_id: postId, reason, detail })
      toast.success('신고를 받았어요. 운영진이 확인할게요.')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '신고하지 못했어요.')
    } finally { setBusy(false) }
  }
  return (
    <>
      <h3>{target_type === 'post' ? '글' : '댓글'} 신고 사유</h3>
      {(Object.keys(REPORT_REASON_LABEL) as CommunityReportReason[]).map((r) => (
        <button key={r} className={`it${reason === r ? ' on' : ''}`} onClick={() => setReason(r)}>
          <i className={`ti ${reason === r ? 'ti-circle-check-filled' : 'ti-circle'}`} />{REPORT_REASON_LABEL[r]}
        </button>
      ))}
      <textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={300} placeholder="자세한 내용(선택)" />
      <div className="bt"><button className="cm-btn main" disabled={!reason || busy} onClick={() => void submit()}>신고하기</button></div>
    </>
  )
}
