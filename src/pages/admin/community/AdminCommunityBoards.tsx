import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../../components/admin/AdminLayout'
import AdminFormModal from '../../../components/admin/AdminFormModal'
import ConfirmDialog from '../../../components/admin/ConfirmDialog'
import { communityAdminService, moveRow } from '../../../services/communityAdminService'
import { HEAD_LABEL, LEVEL_LABEL, type CommunityBoard, type CommunityBoardGroup, type CommunityBoardKind, type CommunityLevel } from '../../../types/community'
import { Chip, Field, IconBtn, LoadError, LoadingRows, MoveButtons, PageHeader, Toggle } from './CommunityAdminParts'
import { btnLine, btnPrimary, cardCls, errMsg, inputCls, normIcon } from './shared'

const LEVELS: CommunityLevel[] = ['member', 'buyer', 'paid', 'cohort', 'staff']
const KIND_LABEL: Record<CommunityBoardKind, string> = { normal: '일반', qna: '질문(강사 답변)', notice: '공지' }
const SLUG_RE = /^[a-z0-9-]{1,40}$/

type BoardForm = Partial<CommunityBoard> & { headsText: string }

const NEW_BOARD: BoardForm = {
  group_id: null, slug: '', name: '', description: '', icon: 'ti-message-2', kind: 'normal', read_level: 'buyer', write_level: 'buyer',
  course_ids: [], heads: [], allow_images: true, enabled: true, headsText: '',
}

function LevelChip({ level, courseCount }: { level: CommunityLevel; courseCount: number }) {
  if (level === 'staff') return <Chip tone="dark">{LEVEL_LABEL.staff}</Chip>
  if (level === 'cohort') return <Chip tone="blue">{LEVEL_LABEL.cohort}{courseCount ? `(강의 ${courseCount})` : ''}</Chip>
  return <span className="text-gray-700 text-xs whitespace-nowrap">{LEVEL_LABEL[level]}</span>
}

export default function AdminCommunityBoards() {
  const [groups, setGroups] = useState<CommunityBoardGroup[]>([])
  const [boards, setBoards] = useState<CommunityBoard[]>([])
  const [newCounts, setNewCounts] = useState<Record<number, number>>({})
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = () => setTick((t) => t + 1)
  const [busy, setBusy] = useState(false)

  const [newGroup, setNewGroup] = useState('')
  const [groupEdit, setGroupEdit] = useState<CommunityBoardGroup | null>(null)
  const [groupDelete, setGroupDelete] = useState<CommunityBoardGroup | null>(null)

  const [edit, setEdit] = useState<BoardForm | null>(null)
  const [courseSearch, setCourseSearch] = useState('')
  const [levelConfirm, setLevelConfirm] = useState<{ count: number } | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([communityAdminService.groups(), communityAdminService.boards(), communityAdminService.courses()])
      .then(async ([g, b, c]) => {
        const counts = await communityAdminService.boardNewCounts(b.map((x) => x.id))
        if (!alive) return
        setGroups(g); setBoards(b); setCourses(c); setNewCounts(counts); setLoadError(null); setLoading(false)
      })
      .catch((e) => { if (alive) { setLoadError(errMsg(e)); setLoading(false) } })
    return () => { alive = false }
  }, [tick])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
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

  // 묶음 순서대로, 그 안에서 게시판 순서대로
  const sections = useMemo(() => {
    const out: { group: CommunityBoardGroup | null; boards: CommunityBoard[] }[] = groups.map((g) => ({ group: g, boards: boards.filter((b) => b.group_id === g.id) }))
    const loose = boards.filter((b) => !b.group_id || !groups.some((g) => g.id === b.group_id))
    if (loose.length) out.push({ group: null, boards: loose })
    return out
  }, [groups, boards])

  const addGroup = async () => {
    if (!newGroup.trim()) return
    const order = Math.max(0, ...groups.map((g) => g.sort_order)) + 1
    if (await run(() => communityAdminService.saveGroup({ name: newGroup, sort_order: order }), '묶음을 만들었어요.')) setNewGroup('')
  }

  const openEdit = (b?: CommunityBoard) => {
    setCourseSearch('')
    setEdit(b ? { ...b, headsText: b.heads.join(', ') } : { ...NEW_BOARD, group_id: groups[0]?.id ?? null })
  }

  const doSave = async () => {
    if (!edit) return
    const heads = edit.headsText.split(',').map((h) => h.trim()).filter(Boolean)
    const sameGroup = boards.filter((b) => b.group_id === (edit.group_id ?? null))
    const payload = {
      ...edit,
      heads: [...new Set(heads)],
      icon: normIcon(edit.icon) || null,
      sort_order: edit.id ? edit.sort_order : Math.max(0, ...sameGroup.map((b) => b.sort_order)) + 1,
      // 기수 단계가 아니어도 강의 연결은 남겨 둔다(질문방 강사 알림 대상 강의로도 쓰임)
      course_ids: edit.course_ids ?? [],
    }
    delete (payload as Partial<BoardForm>).headsText
    if (await run(() => communityAdminService.saveBoard(payload), edit.id ? '게시판을 고쳤어요.' : '게시판을 만들었어요.')) {
      setEdit(null)
      setLevelConfirm(null)
    }
  }

  const submit = async () => {
    if (!edit) return
    if (!edit.name?.trim()) { toast.error('게시판 이름을 적어 주세요.'); return }
    if (!SLUG_RE.test(edit.slug ?? '')) { toast.error('주소(slug)는 영어 소문자·숫자·- 만, 40자까지 써요.'); return }
    const needsCourse = edit.read_level === 'cohort' || edit.write_level === 'cohort'
    if (needsCourse && !(edit.course_ids ?? []).length) { toast.error("'이 기수만'을 고르면 강의를 하나 이상 골라야 해요."); return }
    const before = edit.id ? boards.find((b) => b.id === edit.id) : null
    const coursesChanged = before && before.read_level === 'cohort' && edit.read_level === 'cohort'
      && [...before.course_ids].sort().join(',') !== [...(edit.course_ids ?? [])].sort().join(',')
    if (before && (before.read_level !== edit.read_level || coursesChanged)) {
      try {
        const count = await communityAdminService.boardPostCount(before.id)
        setLevelConfirm({ count })
      } catch (e) {
        toast.error(errMsg(e))
      }
      return
    }
    await doSave()
  }

  const toggleCourse = (id: number) => {
    if (!edit) return
    const cur = edit.course_ids ?? []
    setEdit({ ...edit, course_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  }

  const courseTitle = (id: number) => courses.find((c) => c.id === id)?.title ?? `강의 #${id}`
  const needsCourse = !!edit && (edit.read_level === 'cohort' || edit.write_level === 'cohort')
  const showCourses = needsCourse || edit?.kind === 'qna'

  return (
    <AdminLayout>
      <PageHeader
        title="게시판"
        desc="게시판 묶음·이름·순서와 읽기·쓰기 권한을 관리해요."
        right={<button type="button" className={btnPrimary} onClick={() => openEdit()}><i className="ti ti-plus text-sm" /> 게시판 만들기</button>}
      />

      {loadError ? <LoadError message={loadError} onRetry={reload} /> : loading ? <LoadingRows /> : (
        <div className="space-y-5">
          {/* 묶음 */}
          <div className={cardCls}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-gray-900">묶음 <span className="text-xs text-gray-400 font-normal">사용자 메뉴에서 게시판을 나누는 제목</span></h2>
              <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); addGroup() }}>
                <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="새 묶음 이름" maxLength={20}
                  className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573] w-40" />
                <button type="submit" className={btnLine} disabled={busy || !newGroup.trim()}><i className="ti ti-plus text-xs" />추가</button>
              </form>
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              {groups.length === 0 && <p className="text-sm text-gray-400">묶음이 없어요.</p>}
              {groups.map((g, i) => (
                <div key={g.id} className="flex items-center gap-1 border border-gray-200 rounded-lg pl-3 pr-1 py-1">
                  <span className="text-sm font-medium text-gray-800">{g.name}</span>
                  <span className="text-xs text-gray-400 ml-1">{boards.filter((b) => b.group_id === g.id).length}</span>
                  <MoveButtons onUp={() => run(() => moveRow('community_board_groups', groups, i, -1), '순서를 바꿨어요.')} onDown={() => run(() => moveRow('community_board_groups', groups, i, 1), '순서를 바꿨어요.')} upDisabled={busy || i === 0} downDisabled={busy || i === groups.length - 1} />
                  <IconBtn icon="ti-pencil" label="이름 바꾸기" tone="blue" onClick={() => setGroupEdit({ ...g })} />
                  <IconBtn icon="ti-trash" label="삭제" tone="red" onClick={() => setGroupDelete(g)} />
                </div>
              ))}
            </div>
          </div>

          {/* 게시판 표 */}
          <div className={`${cardCls} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-bold text-gray-600 whitespace-nowrap">순서</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-600 whitespace-nowrap">묶음</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-600">게시판</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-600 whitespace-nowrap">종류</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-600 whitespace-nowrap">읽기</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-600 whitespace-nowrap">쓰기</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-600 whitespace-nowrap">말머리</th>
                    <th className="px-3 py-3 text-center font-bold text-gray-600 whitespace-nowrap">사진</th>
                    <th className="px-3 py-3 text-center font-bold text-gray-600 whitespace-nowrap">새 글(7일)</th>
                    <th className="px-3 py-3 text-center font-bold text-gray-600 whitespace-nowrap">켜짐</th>
                    <th className="px-3 py-3 text-center font-bold text-gray-600 whitespace-nowrap">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {boards.length === 0 && <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">게시판이 없어요.</td></tr>}
                  {sections.map((s) => s.boards.map((b, i) => (
                    <tr key={b.id} className={`hover:bg-gray-50 ${b.enabled ? '' : 'opacity-60'}`}>
                      <td className="px-2 py-2">
                        <MoveButtons onUp={() => run(() => moveRow('community_boards', s.boards, i, -1), '순서를 바꿨어요.')} onDown={() => run(() => moveRow('community_boards', s.boards, i, 1), '순서를 바꿨어요.')} upDisabled={busy || i === 0} downDisabled={busy || i === s.boards.length - 1} />
                      </td>
                      <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">{s.group?.name ?? '(묶음 없음)'}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {normIcon(b.icon) && <i className={`ti ${normIcon(b.icon)} text-gray-500`} />}
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 whitespace-nowrap">{b.name}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[220px]">/{b.slug}{b.description ? ` · ${b.description}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{KIND_LABEL[b.kind]}</td>
                      <td className="px-3 py-3"><LevelChip level={b.read_level} courseCount={b.course_ids.length} /></td>
                      <td className="px-3 py-3"><LevelChip level={b.write_level} courseCount={b.course_ids.length} /></td>
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{b.heads.length ? b.heads.map((h) => HEAD_LABEL[h] ?? h).join(' · ') : '—'}</td>
                      <td className="px-3 py-3 text-center">{b.allow_images ? <i className="ti ti-check text-[#2ED573]" /> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-gray-700">{newCounts[b.id] ?? 0}</td>
                      <td className="px-3 py-3"><div className="flex justify-center"><Toggle checked={b.enabled} disabled={busy} label="켜고 끄기" onChange={(v) => run(() => communityAdminService.setBoardEnabled(b.id, v), v ? '게시판을 켰어요.' : '게시판을 껐어요.')} /></div></td>
                      <td className="px-3 py-3"><div className="flex justify-center"><IconBtn icon="ti-pencil" label="수정" tone="blue" onClick={() => openEdit(b)} /></div></td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-400">게시판을 끄면 사용자 메뉴에서 빠져요(글은 그대로 남아요). 회원 배지·글쓰기 정지·차단 목록은 '커뮤니티 회원·차단' 화면에서 관리해요.</p>
        </div>
      )}

      {/* 게시판 만들기·수정 */}
      <AdminFormModal isOpen={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '게시판 수정' : '게시판 만들기'} onSubmit={submit} loading={busy} maxWidthClass="max-w-[720px]">
        {edit && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <Field label="이름 *">
              <input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} maxLength={20} />
            </Field>
            <Field label="주소(slug) *" hint="영어 소문자·숫자·- 만. 예: ai-blog-1">
              <input value={edit.slug ?? ''} onChange={(e) => setEdit({ ...edit, slug: e.target.value.toLowerCase() })}
                className={`${inputCls} ${!edit.slug || SLUG_RE.test(edit.slug) ? '' : 'border-red-400'}`} maxLength={40} />
            </Field>
            <Field label="묶음">
              <select value={edit.group_id ?? ''} onChange={(e) => setEdit({ ...edit, group_id: e.target.value ? Number(e.target.value) : null })} className={inputCls}>
                <option value="">(묶음 없음)</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="종류" hint="질문 게시판은 48시간 미답변 알림 대상이에요.">
              <select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as CommunityBoardKind })} className={inputCls}>
                {(Object.keys(KIND_LABEL) as CommunityBoardKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </Field>
            <Field label="설명 한 줄" className="col-span-2 max-sm:col-span-1">
              <input value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className={inputCls} maxLength={40} />
            </Field>
            <Field label="아이콘" hint="tabler 아이콘 이름 예: ti-notebook">
              <div className="flex items-center gap-2">
                <span className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  {normIcon(edit.icon) ? <i className={`ti ${normIcon(edit.icon)} text-xl text-gray-700`} /> : <i className="ti ti-photo-off text-gray-300" />}
                </span>
                <input value={edit.icon ?? ''} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} className={inputCls} />
              </div>
            </Field>
            <Field label="말머리" hint="쉼표로 구분. 예: win, fail, stop, q (됐다·안 됐다·멈춤·질문)">
              <input value={edit.headsText} onChange={(e) => setEdit({ ...edit, headsText: e.target.value })} className={inputCls} placeholder="win, fail, stop" />
            </Field>
            <Field label="읽기 단계">
              <select value={edit.read_level} onChange={(e) => setEdit({ ...edit, read_level: e.target.value as CommunityLevel })} className={inputCls}>
                {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
              </select>
            </Field>
            <Field label="쓰기 단계" hint="쓰기는 읽기 권한도 있어야 해요.">
              <select value={edit.write_level} onChange={(e) => setEdit({ ...edit, write_level: e.target.value as CommunityLevel })} className={inputCls}>
                {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
              </select>
            </Field>
            {showCourses && (
              <Field label={needsCourse ? '기수 강의 *' : '연결 강의(선택)'} className="col-span-2 max-sm:col-span-1" hint={needsCourse ? '고른 강의를 산 회원(무료 신청 포함)과 그 강의 강사만 들어와요.' : '질문 게시판: 48시간 미답변 알림을 이 강의 강사에게만 보내요. 비우면 모든 강사에게 가요.'}>
                {(edit.course_ids ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(edit.course_ids ?? []).map((id) => (
                      <button key={id} type="button" onClick={() => toggleCourse(id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs border-none cursor-pointer">
                        {courseTitle(id)} <i className="ti ti-x text-xs" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="border border-gray-300 rounded-xl overflow-hidden">
                  <div className="relative border-b border-gray-200">
                    <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    <input value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)} placeholder="강의 검색..." className="w-full pl-8 pr-3 py-2 text-sm border-none outline-none" />
                  </div>
                  <div className="max-h-[180px] overflow-y-auto">
                    {courses.filter((c) => !courseSearch.trim() || c.title.toLowerCase().includes(courseSearch.trim().toLowerCase()) || String(c.id) === courseSearch.trim()).map((c) => {
                      const on = (edit.course_ids ?? []).includes(c.id)
                      return (
                        <label key={c.id} className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${on ? 'bg-[#2ED573]/10' : 'hover:bg-gray-50'}`}>
                          <input type="checkbox" className="accent-[#2ED573]" checked={on} onChange={() => toggleCourse(c.id)} />
                          <span className="text-xs text-gray-400 tabular-nums">#{c.id}</span> {c.title}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </Field>
            )}
            <div className="col-span-2 max-sm:col-span-1 flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="accent-[#2ED573]" checked={edit.allow_images !== false} onChange={(e) => setEdit({ ...edit, allow_images: e.target.checked })} /> 사진 첨부 허용
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="accent-[#2ED573]" checked={edit.enabled !== false} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} /> 켜기(메뉴에 보이기)
              </label>
            </div>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog
        isOpen={!!levelConfirm}
        onClose={() => setLevelConfirm(null)}
        onConfirm={doSave}
        title="읽기 범위 바꾸기"
        message={`지금 이 게시판 글 ${levelConfirm?.count ?? 0}개가 보이는 범위가 바뀝니다. 계속할까요?`}
        confirmText="바꾸기"
        confirmColor="green"
        icon="ti-lock-access"
        loading={busy}
      />

      {/* 묶음 이름 바꾸기 */}
      <AdminFormModal isOpen={!!groupEdit} onClose={() => setGroupEdit(null)} title="묶음 이름 바꾸기" loading={busy} maxWidthClass="max-w-[400px]"
        onSubmit={async () => { if (groupEdit && await run(() => communityAdminService.saveGroup(groupEdit), '묶음 이름을 바꿨어요.')) setGroupEdit(null) }}>
        {groupEdit && <input value={groupEdit.name} onChange={(e) => setGroupEdit({ ...groupEdit, name: e.target.value })} className={inputCls} maxLength={20} />}
      </AdminFormModal>

      <ConfirmDialog
        isOpen={!!groupDelete}
        onClose={() => setGroupDelete(null)}
        onConfirm={async () => { if (groupDelete && await run(() => communityAdminService.deleteGroup(groupDelete.id), '묶음을 지웠어요.')) setGroupDelete(null) }}
        title="묶음 삭제"
        message={`'${groupDelete?.name ?? ''}' 묶음을 지울까요? 안에 있던 게시판 ${groupDelete ? boards.filter((b) => b.group_id === groupDelete.id).length : 0}개는 '묶음 없음'으로 옮겨져요(게시판·글은 그대로).`}
        loading={busy}
      />
    </AdminLayout>
  )
}
