import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { communityService, MAX_IMAGES } from '../../services/communityService'
import { draftStore, useSignedUrls } from '../../lib/communityUtils'
import { AppBar, LockView, Spinner } from '../../components/community/CommunityParts'
import { useCommunity } from './communityState'
import { HEAD_LABEL, type CommunityBoard, type CommunityPostImage } from '../../types/community'

interface Draft { boardId: number | null; head: string | null; title: string; body: string; revenue: string; spend: string; at: number }
interface Pic { key: string; path: string; width: number | null; height: number | null; preview?: string; existingId?: number }

// 글쓰기·수정: 게시판 · 말머리 · 제목 · 본문(글자만) · 사진 5장 · 수익/지출 · 이 기기 임시저장
export default function CommunityWrite() {
  const [params] = useSearchParams()
  const editId = params.get('edit') ? Number(params.get('edit')) : null
  const presetSlug = params.get('board')
  const { user } = useAuth()
  const { boards, readable, access, boardBySlug, boardById } = useCommunity()
  const navigate = useNavigate()

  const [writable, setWritable] = useState<CommunityBoard[] | null>(null)
  const [boardId, setBoardId] = useState<number | null>(null)
  const [head, setHead] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [money, setMoney] = useState(false)
  const [revenue, setRevenue] = useState('')
  const [spend, setSpend] = useState('')
  const [pics, setPics] = useState<Pic[]>([])
  const [removed, setRemoved] = useState<{ id: number; path: string }[]>([])
  const [uploading, setUploading] = useState(0)
  const [saving, setSaving] = useState(false)
  const [pickBoard, setPickBoard] = useState(false)
  const [draftOffer, setDraftOffer] = useState<Draft | null>(null)
  const [loaded, setLoaded] = useState(!editId)
  const fileRef = useRef<HTMLInputElement>(null)
  const submitted = useRef(false)
  const newUploads = useRef<string[]>([])

  const draftKey = draftStore.key(presetSlug, editId)
  const board = boardId ? boardById(boardId) : undefined

  // 쓸 수 있는 게시판(서버 판단)
  useEffect(() => {
    let alive = true
    const cands = boards.filter((b) => b.enabled && readable.has(b.id))
    Promise.all(cands.map((b) => communityService.canWrite(b.id))).then((ok) => {
      if (!alive) return
      const list = cands.filter((_, i) => ok[i])
      setWritable(list)
      if (!editId) {
        const preset = presetSlug ? boardBySlug(presetSlug) : undefined
        setBoardId((cur) => cur ?? (preset && list.some((b) => b.id === preset.id) ? preset.id : null))
      }
    }).catch(() => setWritable([]))
    return () => { alive = false }
  }, [boards, readable, editId, presetSlug, boardBySlug])

  // 수정: 기존 글 불러오기 / 새 글: 임시저장 제안
  useEffect(() => {
    if (editId) {
      ;(async () => {
        const p = await communityService.getPost(editId)
        if (!p || p.author_id !== user?.id || p.deleted_at) { toast.error('고칠 수 없는 글이에요.'); navigate(-1); return }
        setBoardId(p.board_id); setHead(p.head); setTitle(p.title); setBody(p.body)
        if (p.revenue != null || p.spend != null) { setMoney(true); setRevenue(p.revenue?.toString() ?? ''); setSpend(p.spend?.toString() ?? '') }
        const imgs: CommunityPostImage[] = p.image_count ? await communityService.images(editId) : []
        setPics(imgs.map((i) => ({ key: `e${i.id}`, path: i.path, width: i.width, height: i.height, existingId: i.id })))
        setLoaded(true)
      })().catch(() => { toast.error('글을 불러오지 못했어요.'); navigate(-1) })
    } else {
      const d = draftStore.read<Draft>(draftKey)
      if (d && (d.title || d.body)) setDraftOffer(d)
    }
  }, [editId, draftKey, user?.id, navigate])

  // 쓰는 중 자동 저장(새 글만, 1초 쉬면 저장)
  useEffect(() => {
    if (editId || draftOffer || !loaded) return
    const t = setTimeout(() => {
      if (title || body) draftStore.write(draftKey, { boardId, head, title, body, revenue, spend, at: Date.now() } satisfies Draft)
    }, 1000)
    return () => clearTimeout(t)
  }, [editId, draftOffer, loaded, draftKey, boardId, head, title, body, revenue, spend])

  // 등록하지 않고 나가면 새로 올린 사진은 지움
  useEffect(() => () => {
    if (!submitted.current) void communityService.discardUploads(newUploads.current)
  }, [])

  const existingUrls = useSignedUrls(pics.filter((p) => p.existingId).map((p) => p.path))
  const heads = board?.heads ?? []
  const canSubmit = !!board && title.trim().length > 0 && !uploading && !saving

  const restoreDraft = (d: Draft) => {
    if (d.boardId && writable?.some((b) => b.id === d.boardId)) setBoardId(d.boardId)
    setHead(d.head); setTitle(d.title); setBody(d.body)
    if (d.revenue || d.spend) { setMoney(true); setRevenue(d.revenue); setSpend(d.spend) }
    setDraftOffer(null)
  }

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_IMAGES - pics.length
    const list = Array.from(files).slice(0, room)
    if (files.length > room) toast(`사진은 ${MAX_IMAGES}장까지 올릴 수 있어요.`)
    setUploading((n) => n + list.length)
    for (const f of list) {
      try {
        const up = await communityService.uploadImage(f)
        newUploads.current.push(up.path)
        setPics((prev) => [...prev, { key: up.path, ...up, preview: URL.createObjectURL(f) }])
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '사진을 올리지 못했어요.')
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const removePic = (p: Pic) => {
    setPics((prev) => prev.filter((x) => x.key !== p.key))
    if (p.existingId) setRemoved((r) => [...r, { id: p.existingId!, path: p.path }])
    else {
      newUploads.current = newUploads.current.filter((x) => x !== p.path)
      void communityService.discardUploads([p.path])
    }
  }

  const num = (s: string) => { const n = Number(s.replace(/[^0-9]/g, '')); return s.trim() && Number.isFinite(n) ? n : null }

  const submit = async () => {
    if (!board || !canSubmit) return
    if (heads.length && !head) { toast('말머리를 골라 주세요.'); return }
    setSaving(true)
    const input = {
      head: heads.length ? head : null,
      title: title.trim(),
      body: body.trim(),
      revenue: money ? num(revenue) : null,
      spend: money ? num(spend) : null,
    }
    try {
      let id = editId
      if (editId) {
        await communityService.updatePost(editId, input)
        for (const r of removed) await communityService.removeImage(r.id, r.path)
      } else {
        const p = await communityService.createPost({ board_id: board.id, ...input })
        id = p.id
      }
      const fresh = pics.filter((p) => !p.existingId)
      const keepCount = pics.filter((p) => p.existingId).length
      if (fresh.length) await communityService.attachImages(id!, fresh, keepCount)
      submitted.current = true
      draftStore.clear(draftKey)
      toast.success(editId ? '글을 고쳤어요.' : '글을 올렸어요.')
      navigate(`/community/p/${id}`, { replace: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '글을 올리지 못했어요.')
    } finally {
      setSaving(false)
    }
  }

  const suspended = access?.suspended_until
  const sortedWritable = useMemo(() => writable ?? [], [writable])

  if (suspended) {
    return <><AppBar back title="글쓰기" /><LockView title="지금은 글을 쓸 수 없어요" text={`${new Date(suspended).toLocaleDateString('ko-KR')}까지 글쓰기가 멈춰 있어요. 궁금한 점은 운영진에게 문의해 주세요.`} /></>
  }
  if (!writable || !loaded) return <><AppBar back title="글쓰기" /><Spinner /></>
  if (!editId && !sortedWritable.length) {
    return <><AppBar back title="글쓰기" /><LockView title="글을 쓸 수 있는 게시판이 없어요" text="무료 강의를 신청하면 글을 쓸 수 있어요" action={{ label: '무료 강의 보기', to: '/academy/free' }} /></>
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      <AppBar back title={editId ? '글 수정' : '글쓰기'}
        right={<button className="txt" style={{ padding: '0 10px', fontWeight: 700, fontSize: 15.5, color: canSubmit ? 'var(--pd)' : 'var(--g4)' }} disabled={!canSubmit} onClick={() => void submit()}>{saving ? '올리는 중' : '등록'}</button>} />
      {draftOffer && (
        <div className="notice" style={{ justifyContent: 'space-between' }}>
          <span>쓰다 만 글이 있어요</span>
          <span style={{ display: 'flex', gap: 12, flex: 'none' }}>
            <button style={{ color: 'var(--pd)', fontWeight: 600 }} onClick={() => restoreDraft(draftOffer)}>이어 쓰기</button>
            <button style={{ color: 'var(--g5)' }} onClick={() => { draftStore.clear(draftKey); setDraftOffer(null) }}>새로 쓰기</button>
          </span>
        </div>
      )}
      <button className="sel" onClick={() => !editId && setPickBoard(true)} disabled={!!editId}>
        {board ? <b>{board.name}</b> : <span>게시판을 골라 주세요</span>}
        {!editId && <i className="ti ti-chevron-down" />}
      </button>
      {heads.length > 0 && (
        <div className="chipsel">
          {heads.map((h) => <button key={h} className={head === h ? 'on' : ''} onClick={() => setHead(h)}>{HEAD_LABEL[h] ?? h}</button>)}
        </div>
      )}
      <input className="wt" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" maxLength={80} />
      <textarea className="wb" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000}
        placeholder={board?.kind === 'qna' ? '무엇이 궁금한지, 어디까지 해 봤는지 적어 주세요.' : '오늘 한 일, 배운 점을 적어 주세요. 실명·연락처·오픈채팅 주소는 쓰지 말아 주세요.'} />
      {pics.length > 0 && (
        <div className="cm-pics">
          {pics.map((p) => (
            <div key={p.key} className="cm-pic">
              {(p.preview || existingUrls[p.path]) && <img src={p.preview || existingUrls[p.path]} alt="" />}
              <button aria-label="사진 빼기" onClick={() => removePic(p)}><i className="ti ti-x" /></button>
            </div>
          ))}
          {uploading > 0 && <div className="cm-pic" style={{ display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--g5)' }}>올리는 중</div>}
        </div>
      )}
      {money && (
        <div className="cm-money">
          <span>수익</span><input inputMode="numeric" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="원" />
          <span>지출</span><input inputMode="numeric" value={spend} onChange={(e) => setSpend(e.target.value)} placeholder="원" />
        </div>
      )}
      {money && <p style={{ fontSize: 12, color: 'var(--g5)', padding: '0 16px 10px' }}>숫자는 운영진이 확인하기 전까지 '확인 전'으로 보여요.</p>}
      <div className="tool">
        {board?.allow_images !== false && (
          <button aria-label="사진" onClick={() => fileRef.current?.click()} disabled={pics.length >= MAX_IMAGES}>
            <i className="ti ti-photo" />{pics.length}/{MAX_IMAGES}
          </button>
        )}
        <button className={money ? 'on' : ''} onClick={() => setMoney((v) => !v)}><i className="ti ti-receipt" />수익 기록</button>
        <span className="r" style={{ fontSize: 12, color: 'var(--g5)', paddingRight: 8 }}>{editId ? '' : '자동 저장 중'}</span>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => void onFiles(e.target.files)} />

      {pickBoard && (
        <>
          <div className="cm-sheet-dim" onClick={() => setPickBoard(false)} />
          <div className="cm-sheet" role="dialog">
            <h3>게시판 고르기</h3>
            {sortedWritable.map((b) => (
              <button key={b.id} className={`it${b.id === boardId ? ' on' : ''}`} onClick={() => { setBoardId(b.id); if (!b.heads.includes(head ?? '')) setHead(null); setPickBoard(false) }}>
                <i className={`ti ${b.icon || 'ti-list'}`} />{b.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
