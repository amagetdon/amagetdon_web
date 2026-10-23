import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../../components/admin/AdminLayout'
import AdminFormModal from '../../../components/admin/AdminFormModal'
import ConfirmDialog from '../../../components/admin/ConfirmDialog'
import AdminPagination from '../../../components/admin/AdminPagination'
import { useAuth } from '../../../contexts/AuthContext'
import { communityAdminService, moveRow, type AdminPinRow, type AdminPostRow, type PostStatusFilter } from '../../../services/communityAdminService'
import { HEAD_LABEL, PIN_LABEL, type CommunityBoard, type CommunityMember, type CommunityPinLabel, type CommunityPinScope } from '../../../types/community'
import { Chip, Field, IconBtn, LoadError, LoadingRows, MoveButtons, PageHeader } from './CommunityAdminParts'
import { btnDark, btnLine, cardCls, errMsg, fmtDate, inputCls, selectCls } from './shared'

const PER_PAGE = 20
const STATUS_TABS: { key: PostStatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pinned', label: '고정' },
  { key: 'hidden', label: '숨김' },
  { key: 'reported', label: '신고됨' },
  { key: 'deleted', label: '삭제됨' },
]
const PIN_LABELS: CommunityPinLabel[] = ['notice', 'must', 'pin']
const PIN_TONE: Record<CommunityPinLabel, 'dark' | 'red' | 'gray'> = { notice: 'dark', must: 'red', pin: 'gray' }

interface WriteForm { board_id: number | ''; head: string; title: string; body: string; nickname: string }

export default function AdminCommunityPosts() {
  const { user } = useAuth()
  const adminId = user?.id ?? ''

  const [boards, setBoards] = useState<CommunityBoard[]>([])
  const [pins, setPins] = useState<AdminPinRow[]>([])
  const [rows, setRows] = useState<AdminPostRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = () => setTick((t) => t + 1)

  const [boardFilter, setBoardFilter] = useState<number>(0)
  const [status, setStatus] = useState<PostStatusFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [pinTarget, setPinTarget] = useState<AdminPostRow | null>(null)
  const [pinScope, setPinScope] = useState<CommunityPinScope>('home')
  const [pinLabel, setPinLabel] = useState<CommunityPinLabel>('pin')
  const [hideTarget, setHideTarget] = useState<AdminPostRow | null>(null)
  const [hideReason, setHideReason] = useState('')
  const [restoreTarget, setRestoreTarget] = useState<AdminPostRow | null>(null)
  const [busy, setBusy] = useState(false)

  const [writeOpen, setWriteOpen] = useState(false)
  const [me, setMe] = useState<CommunityMember | null>(null)
  const [form, setForm] = useState<WriteForm>({ board_id: '', head: '', title: '', body: '', nickname: '운영자' })

  useEffect(() => {
    let alive = true
    Promise.all([
      communityAdminService.boards(),
      communityAdminService.pins(),
      communityAdminService.listPosts({ boardId: boardFilter || undefined, status, q: search, page, perPage: PER_PAGE }),
    ])
      .then(([b, p, list]) => {
        if (!alive) return
        setBoards(b); setPins(p); setRows(list.rows); setTotal(list.total)
        setLoadError(null); setLoading(false)
      })
      .catch((e) => { if (alive) { setLoadError(errMsg(e)); setLoading(false) } })
    return () => { alive = false }
  }, [boardFilter, status, search, page, tick])

  const boardName = useMemo(() => {
    const m = new Map(boards.map((b) => [b.id, b.name]))
    return (id: number | null | undefined) => (id ? m.get(id) : undefined) ?? '-'
  }, [boards])

  // 고정 목록: 홈 전체 한 묶음 + 게시판별 묶음
  const pinGroups = useMemo(() => {
    const groups: { key: string; title: string; rows: AdminPinRow[] }[] = []
    const home = pins.filter((p) => p.scope === 'home')
    if (home.length) groups.push({ key: 'home', title: '홈 전체', rows: home })
    const byBoard = new Map<number, AdminPinRow[]>()
    for (const p of pins.filter((x) => x.scope === 'board')) {
      const bid = p.post?.board_id ?? 0
      byBoard.set(bid, [...(byBoard.get(bid) ?? []), p])
    }
    for (const [bid, list] of byBoard) groups.push({ key: `b${bid}`, title: `게시판 · ${boardName(bid)}`, rows: list })
    return groups
  }, [pins, boardName])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      setBusy(true)
      await fn()
      toast.success(ok)
      reload()
      return true
    } catch (e) {
      toast.error(errMsg(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const openPin = (p: AdminPostRow) => {
    setPinTarget(p)
    const existing = p.pins[0]
    setPinScope(existing?.scope === 'board' ? 'board' : 'home')
    setPinLabel(existing?.label ?? 'pin')
  }

  const savePin = async () => {
    if (!pinTarget) return
    const sameGroup = pins.filter((x) => x.scope === pinScope && (pinScope === 'home' || x.post?.board_id === pinTarget.board_id))
    const existing = sameGroup.find((x) => x.post_id === pinTarget.id)
    const order = existing ? existing.sort_order : Math.max(0, ...sameGroup.map((x) => x.sort_order)) + 1
    const ok = await run(() => communityAdminService.addPin(pinTarget.id, pinScope, pinLabel, order), '고정했어요.')
    if (ok) setPinTarget(null)
  }

  const movePin = (list: AdminPinRow[], i: number, dir: -1 | 1) =>
    run(() => moveRow('community_pins', list, i, dir), '순서를 바꿨어요.')

  const openWrite = async () => {
    try {
      const m = adminId ? await communityAdminService.myMember(adminId) : null
      setMe(m)
      const first = boards.find((b) => b.kind === 'notice') ?? boards[0]
      setForm({ board_id: first?.id ?? '', head: '', title: '', body: '', nickname: '운영자' })
      setWriteOpen(true)
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const submitWrite = async () => {
    if (!adminId) { toast.error('로그인 정보를 확인할 수 없어요.'); return }
    if (!form.board_id) { toast.error('게시판을 골라 주세요.'); return }
    if (!form.title.trim()) { toast.error('제목을 적어 주세요.'); return }
    if (form.title.trim().length > 80) { toast.error('제목은 80자까지예요.'); return }
    if (form.body.length > 5000) { toast.error('본문은 5000자까지예요.'); return }
    try {
      setBusy(true)
      const id = await communityAdminService.writeAsAdmin({
        adminId, nickname: form.nickname, boardId: Number(form.board_id), head: form.head || null, title: form.title, body: form.body,
      })
      toast.success('글을 올렸어요.')
      setWriteOpen(false)
      window.open(`/community/p/${id}`, '_blank', 'noopener')
      reload()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const writeBoard = boards.find((b) => b.id === form.board_id)

  return (
    <AdminLayout>
      <PageHeader
        title="글 관리"
        desc="글을 홈이나 게시판 맨 위에 고정하고, 문제 글은 숨겨요."
        right={<button type="button" onClick={openWrite} className={btnDark}><i className="ti ti-pencil text-sm" /> 운영자로 글쓰기</button>}
      />

      {loadError ? <LoadError message={loadError} onRetry={reload} /> : (
        <>
          {/* 고정 목록 */}
          <div className={`${cardCls} mb-5`}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <i className="ti ti-pin text-[#2ED573]" /> 지금 고정된 글
                <span className="text-xs text-gray-400 font-normal">
                  홈 {pins.filter((p) => p.scope === 'home').length} · 게시판 {pins.filter((p) => p.scope === 'board').length}
                </span>
              </h2>
              <span className="text-xs text-gray-400">위·아래 화살표로 순서를 바꿔요</span>
            </div>
            {pinGroups.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">고정된 글이 없어요. 아래 표에서 '고정'을 눌러 보세요.</p>
            ) : pinGroups.map((g) => (
              <div key={g.key} className="border-b border-gray-50 last:border-none pb-1">
                <p className="px-5 pt-3 pb-1 text-xs font-bold text-gray-500">{g.title}</p>
                {g.rows.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-2 hover:bg-gray-50">
                    <span className="w-6 h-6 rounded-md bg-gray-900 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <Chip tone={PIN_TONE[p.label]}>{PIN_LABEL[p.label]}</Chip>
                    <a href={`/community/p/${p.post_id}`} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900 no-underline hover:underline">
                      {p.post?.title ?? '(찾을 수 없는 글)'}
                    </a>
                    {p.post?.is_hidden && <Chip tone="red">숨김</Chip>}
                    <Chip tone={p.scope === 'home' ? 'green' : 'blue'}>{p.scope === 'home' ? '홈 전체' : boardName(p.post?.board_id)}</Chip>
                    <MoveButtons onUp={() => movePin(g.rows, i, -1)} onDown={() => movePin(g.rows, i, 1)} upDisabled={busy || i === 0} downDisabled={busy || i === g.rows.length - 1} />
                    <button type="button" className={btnLine} disabled={busy} onClick={() => run(() => communityAdminService.removePin(p.id), '고정을 풀었어요.')}>해제</button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* 필터 */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select value={boardFilter} onChange={(e) => { setBoardFilter(Number(e.target.value)); setPage(1) }} className={`${selectCls} max-w-[200px]`}>
              <option value={0}>게시판 전체</option>
              {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { setStatus(t.key); setPage(1) }}
                  className={`px-3 py-1 rounded-md text-sm border-none cursor-pointer ${status === t.key ? 'bg-white font-bold text-gray-900 shadow-sm' : 'bg-transparent text-gray-500'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <form
              className="relative flex-1 min-w-[200px] max-w-xs"
              onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1) }}
            >
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="제목 · 닉네임 검색 (Enter)"
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]"
              />
            </form>
            {(search || boardFilter > 0 || status !== 'all') && (
              <button
                type="button"
                onClick={() => { setSearch(''); setSearchInput(''); setBoardFilter(0); setStatus('all'); setPage(1) }}
                className="py-2 px-3 text-sm text-gray-500 bg-transparent border-none cursor-pointer hover:text-gray-800"
              >
                필터 초기화
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400">{total.toLocaleString()}개</span>
          </div>

          {loading ? <LoadingRows /> : (
            <div className={`${cardCls} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left font-bold text-gray-600 whitespace-nowrap">게시판</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-600 whitespace-nowrap">말머리</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-600">제목</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-600 whitespace-nowrap">닉네임</th>
                      <th className="px-3 py-3 text-center font-bold text-gray-600 whitespace-nowrap">작성일</th>
                      <th className="px-3 py-3 text-center font-bold text-gray-600 whitespace-nowrap">조회·댓글·반응</th>
                      <th className="px-3 py-3 text-center font-bold text-gray-600 whitespace-nowrap">신고</th>
                      <th className="px-3 py-3 text-center font-bold text-gray-600 whitespace-nowrap">상태</th>
                      <th className="px-3 py-3 text-center font-bold text-gray-600 whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없어요.' : '글이 없어요.'}</td></tr>
                    ) : rows.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3"><Chip>{boardName(p.board_id)}</Chip></td>
                        <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{p.head ? (HEAD_LABEL[p.head] ?? p.head) : '-'}</td>
                        <td className="px-3 py-3 max-w-[320px]">
                          <span className={`block truncate font-medium ${p.deleted_at ? 'text-gray-400 line-through' : 'text-gray-900'}`} title={p.title}>{p.title}</span>
                          {p.is_hidden && p.hidden_reason && <span className="block text-xs text-red-400 truncate">숨긴 이유: {p.hidden_reason}</span>}
                        </td>
                        <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{p.author?.nickname ?? <span className="text-gray-400">(닉네임 없음)</span>}</td>
                        <td className="px-3 py-3 text-center text-gray-400 text-xs whitespace-nowrap">{fmtDate(p.created_at)}</td>
                        <td className="px-3 py-3 text-center text-gray-500 text-xs whitespace-nowrap tabular-nums">{p.view_count} · {p.comment_count} · {p.reaction_count}</td>
                        <td className="px-3 py-3 text-center">{p.report_count > 0 ? <Chip tone="red">{p.report_count}</Chip> : <span className="text-gray-300 text-xs">0</span>}</td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span className="inline-flex gap-1">
                            {p.deleted_at ? <Chip>삭제됨</Chip> : p.is_hidden ? <Chip tone="red">숨김</Chip> : <Chip tone="green">공개</Chip>}
                            {p.pins.map((x) => <Chip key={x.id} tone={PIN_TONE[x.label]}>{PIN_LABEL[x.label]}{x.scope === 'home' ? '·홈' : ''}</Chip>)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {!p.deleted_at && <button type="button" className={btnLine} onClick={() => openPin(p)}><i className="ti ti-pin text-xs" />고정</button>}
                            {!p.deleted_at && (p.is_hidden
                              ? <button type="button" className={btnLine} onClick={() => setRestoreTarget(p)}><i className="ti ti-eye text-xs" />복구</button>
                              : <button type="button" className={btnLine} onClick={() => { setHideTarget(p); setHideReason('') }}><i className="ti ti-eye-off text-xs" />숨김</button>)}
                            <IconBtn icon="ti-external-link" label="글 보기(새 탭)" tone="blue" onClick={() => window.open(`/community/p/${p.id}`, '_blank', 'noopener')} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <AdminPagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {/* 고정 설정 */}
      <AdminFormModal isOpen={!!pinTarget} onClose={() => setPinTarget(null)} title="고정 설정" onSubmit={savePin} submitText="고정하기" loading={busy} maxWidthClass="max-w-[460px]">
        {pinTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 truncate">[{boardName(pinTarget.board_id)}] {pinTarget.title}</p>
            <Field label="어디에 고정할까요">
              <div className="flex gap-2">
                {([['home', 'ti-home', '홈 전체'], ['board', 'ti-list', '이 게시판만']] as const).map(([k, ic, t]) => (
                  <button key={k} type="button" onClick={() => setPinScope(k)}
                    className={`px-3 py-2 rounded-lg text-sm cursor-pointer border inline-flex items-center gap-1 ${pinScope === k ? 'border-[#2ED573] bg-[#2ED573]/10 text-[#13803f] font-bold' : 'border-gray-200 bg-white text-gray-600'}`}>
                    <i className={`ti ${ic} text-sm`} />{t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="표시 라벨">
              <div className="flex gap-2">
                {PIN_LABELS.map((l) => (
                  <button key={l} type="button" onClick={() => setPinLabel(l)}
                    className={`px-4 py-2 rounded-lg text-sm cursor-pointer border ${pinLabel === l ? 'border-[#2ED573] bg-[#2ED573]/10 text-[#13803f] font-bold' : 'border-gray-200 bg-white text-gray-600'}`}>
                    {PIN_LABEL[l]}
                  </button>
                ))}
              </div>
            </Field>
            {pinTarget.pins.length > 0 && (
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1.5">
                <p className="font-bold">지금 고정 상태</p>
                {pinTarget.pins.map((x) => (
                  <div key={x.id} className="flex items-center gap-2">
                    <Chip tone={PIN_TONE[x.label]}>{PIN_LABEL[x.label]}</Chip>
                    <span>{x.scope === 'home' ? '홈 전체' : '이 게시판'}</span>
                    <button type="button" className={`${btnLine} ml-auto`} disabled={busy}
                      onClick={async () => { if (await run(() => communityAdminService.removePin(x.id), '고정을 풀었어요.')) setPinTarget(null) }}>
                      해제
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400">같은 곳에 이미 고정돼 있으면 라벨만 바뀌어요. 새로 고정한 글은 그 묶음 맨 아래로 가요.</p>
          </div>
        )}
      </AdminFormModal>

      {/* 숨김 */}
      <AdminFormModal isOpen={!!hideTarget} onClose={() => setHideTarget(null)} title="글 숨기기" submitText="숨기기" loading={busy} maxWidthClass="max-w-[460px]"
        onSubmit={async () => {
          if (!hideTarget) return
          if (await run(() => communityAdminService.setPostHidden(hideTarget.id, true, adminId, hideReason), '글을 숨겼어요.')) setHideTarget(null)
        }}>
        {hideTarget && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 truncate">{hideTarget.title}</p>
            <Field label="숨긴 이유(운영 기록용)" hint="비우면 '운영자 숨김'으로 남아요. 숨긴 글은 작성자 본인과 관리자만 볼 수 있어요.">
              <input value={hideReason} onChange={(e) => setHideReason(e.target.value)} className={inputCls} placeholder="예: 다른 강의 홍보" maxLength={100} />
            </Field>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={async () => {
          if (!restoreTarget) return
          if (await run(() => communityAdminService.setPostHidden(restoreTarget.id, false, adminId), '다시 보이게 했어요.')) setRestoreTarget(null)
        }}
        title="숨김 풀기"
        message="이 글을 다시 모든 회원에게 보이게 할까요?"
        confirmText="복구"
        confirmColor="green"
        icon="ti-eye"
        loading={busy}
      />

      {/* 운영자로 글쓰기 */}
      <AdminFormModal isOpen={writeOpen} onClose={() => setWriteOpen(false)} title="운영자로 글쓰기" onSubmit={submitWrite} submitText="올리기" loading={busy}>
        <div className="space-y-4">
          {me ? (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">'{me.nickname}' 닉네임으로 올라가요.</p>
          ) : (
            <Field label="커뮤니티 닉네임 *" hint="관리자 계정에 아직 커뮤니티 닉네임이 없어요. 여기서 정하면 스탭 배지와 함께 저장돼요(2~12자).">
              <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className={inputCls} maxLength={12} />
            </Field>
          )}
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <Field label="게시판 *">
              <select value={form.board_id} onChange={(e) => setForm({ ...form, board_id: Number(e.target.value), head: '' })} className={inputCls}>
                {boards.map((b) => <option key={b.id} value={b.id}>{b.name}{b.enabled ? '' : ' (꺼짐)'}</option>)}
              </select>
            </Field>
            <Field label="말머리">
              <select value={form.head} onChange={(e) => setForm({ ...form, head: e.target.value })} className={inputCls} disabled={!writeBoard?.heads.length}>
                <option value="">없음</option>
                {(writeBoard?.heads ?? []).map((h) => <option key={h} value={h}>{HEAD_LABEL[h] ?? h}</option>)}
              </select>
            </Field>
          </div>
          <Field label="제목 *">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} maxLength={80} />
          </Field>
          <Field label="본문" hint={`글자만 들어가요(서식 없음). ${form.body.length}/5000`}>
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={10} maxLength={5000} className={`${inputCls} resize-y`} />
          </Field>
        </div>
      </AdminFormModal>
    </AdminLayout>
  )
}
