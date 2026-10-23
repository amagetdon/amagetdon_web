import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import AdminLayout from '../../../components/admin/AdminLayout'
import AdminFormModal from '../../../components/admin/AdminFormModal'
import ConfirmDialog from '../../../components/admin/ConfirmDialog'
import AdminPagination from '../../../components/admin/AdminPagination'
import { useAuth } from '../../../contexts/AuthContext'
import { communityAdminService, type AdminMemberRow } from '../../../services/communityAdminService'
import { GRADE_INFO, type CommunityBadge, type CommunityBlockItem } from '../../../types/community'
import { Chip, Field, IconBtn, LoadError, LoadingRows, PageHeader } from './CommunityAdminParts'
import { btnLine, btnLineRed, cardCls, errMsg, fmtDate, fmtDateTime, inputCls, selectCls } from './shared'

const PER_PAGE = 20
const BADGE_LABEL: Record<CommunityBadge, string> = { instructor: '강사', staff: '스탭' }
const SUSPEND_DAYS = [1, 3, 7, 30]

interface EditForm {
  nickname: string
  badge: CommunityBadge | ''
  instructor_id: number | ''
  /** 정지: '' = 바꾸지 않음, 'clear' = 해제, 숫자 = n일, 'date' = 날짜 지정 */
  suspend: '' | 'clear' | 'date' | `${number}`
  suspendDate: string
  suspendReason: string
}

function isSuspended(m: AdminMemberRow) {
  return !!m.sanction && new Date(m.sanction.suspended_until).getTime() > Date.now()
}

export default function AdminCommunityMembers() {
  const { user } = useAuth()
  const adminId = user?.id ?? ''
  const [tab, setTab] = useState<'members' | 'block'>('members')

  // 회원
  const [rows, setRows] = useState<AdminMemberRow[]>([])
  const [total, setTotal] = useState(0)
  const [instructors, setInstructors] = useState<{ id: number; name: string }[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = () => setTick((t) => t + 1)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<AdminMemberRow | null>(null)
  const [form, setForm] = useState<EditForm | null>(null)

  // 차단 목록
  const [blocks, setBlocks] = useState<CommunityBlockItem[]>([])
  const [newKind, setNewKind] = useState<'word' | 'domain'>('domain')
  const [newValue, setNewValue] = useState('')
  const [blockDelete, setBlockDelete] = useState<CommunityBlockItem | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      communityAdminService.listMembers({ q: search, page, perPage: PER_PAGE }),
      communityAdminService.instructors(),
      communityAdminService.blocklist(),
    ])
      .then(([list, ins, bl]) => {
        if (!alive) return
        setRows(list.rows); setTotal(list.total); setInstructors(ins); setBlocks(bl); setLoadError(null); setLoading(false)
      })
      .catch((e) => { if (alive) { setLoadError(errMsg(e)); setLoading(false) } })
    return () => { alive = false }
  }, [search, page, tick])

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

  const openEdit = (m: AdminMemberRow) => {
    setEditing(m)
    setForm({
      nickname: m.nickname,
      badge: m.badge ?? '',
      instructor_id: m.instructor_id ?? '',
      suspend: '',
      suspendDate: '',
      suspendReason: m.sanction?.reason ?? '',
    })
  }

  const save = async () => {
    if (!editing || !form) return
    if (form.badge === 'instructor' && !form.instructor_id) { toast.error('강사 배지는 연결할 강사를 골라 주세요.'); return }
    let until: Date | null = null
    if (form.suspend === 'date') {
      if (!form.suspendDate) { toast.error('정지 끝 날짜를 골라 주세요.'); return }
      until = new Date(`${form.suspendDate}T23:59:59+09:00`)
      if (until.getTime() <= Date.now()) { toast.error('정지 끝 날짜는 오늘 이후여야 해요.'); return }
    } else if (form.suspend && form.suspend !== 'clear') {
      until = new Date(Date.now() + Number(form.suspend) * 24 * 3600 * 1000)
    }
    const ok = await run(async () => {
      await communityAdminService.updateMember(editing.user_id, {
        nickname: form.nickname,
        badge: form.badge || null,
        instructor_id: form.badge === 'instructor' && form.instructor_id ? Number(form.instructor_id) : null,
      })
      if (until) await communityAdminService.setSanction(editing.user_id, until, form.suspendReason, adminId)
      if (form.suspend === 'clear') await communityAdminService.clearSanction(editing.user_id)
    }, '저장했어요.')
    if (ok) { setEditing(null); setForm(null) }
  }

  const addBlock = async () => {
    if (!newValue.trim()) return
    if (await run(() => communityAdminService.addBlock(newKind, newValue), '차단 목록에 넣었어요.')) setNewValue('')
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const instructorName = (id: number | null) => (id ? instructors.find((i) => i.id === id)?.name : undefined)
  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

  return (
    <AdminLayout>
      <PageHeader
        title="회원·차단"
        desc="커뮤니티 닉네임·배지·글쓰기 정지와 금칙어·링크 차단을 관리해요."
        right={<Link to="/admin/members" className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold no-underline hover:border-[#2ED573] hover:text-[#13b05a] transition-colors inline-flex items-center gap-1.5"><i className="ti ti-users text-sm" /> 회원 관리에서 보기</Link>}
      />

      <div className="flex bg-gray-100 rounded-lg p-1 w-fit mb-4">
        {([['members', '커뮤니티 회원'], ['block', `차단 목록 ${blocks.length}`]] as const).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-md text-sm border-none cursor-pointer ${tab === k ? 'bg-white font-bold text-gray-900 shadow-sm' : 'bg-transparent text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {loadError ? <LoadError message={loadError} onRetry={reload} /> : tab === 'members' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <form className="relative flex-1 min-w-[200px] max-w-xs" onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1) }}>
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="닉네임 검색 (Enter)"
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]" />
            </form>
            {search && (
              <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }} className="py-2 px-3 text-sm text-gray-500 bg-transparent border-none cursor-pointer hover:text-gray-800">검색 지우기</button>
            )}
            <span className="ml-auto text-xs text-gray-400">{total.toLocaleString()}명 · 이메일·전화 같은 개인정보는 '회원 관리'에서 봐요</span>
          </div>

          {loading ? <LoadingRows /> : (
            <div className={`${cardCls} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-gray-600">닉네임</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-600 whitespace-nowrap">배지</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-600 whitespace-nowrap">등급</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-600 whitespace-nowrap">가입일</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-600 whitespace-nowrap">작성 글</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-600 whitespace-nowrap">글쓰기 정지</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-600 whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없어요.' : '아직 닉네임을 만든 회원이 없어요.'}</td></tr>
                    ) : rows.map((m) => (
                      <tr key={m.user_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{m.nickname}</td>
                        <td className="px-4 py-3">
                          {m.badge ? (
                            <Chip tone={m.badge === 'instructor' ? 'blue' : 'dark'}>
                              {BADGE_LABEL[m.badge]}{m.badge === 'instructor' && instructorName(m.instructor_id) ? ` · ${instructorName(m.instructor_id)}` : ''}
                            </Chip>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          <i className={`ti ${GRADE_INFO[m.grade].icon} text-[#13b05a]`} /> {GRADE_INFO[m.grade].label}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400 text-xs whitespace-nowrap">{fmtDate(m.created_at)}</td>
                        <td className="px-4 py-3 text-center tabular-nums text-gray-700">{m.post_count}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {isSuspended(m)
                            ? <Chip tone="red">~ {fmtDateTime(m.sanction!.suspended_until)}</Chip>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3"><div className="flex justify-center"><IconBtn icon="ti-pencil" label="수정" tone="blue" onClick={() => openEdit(m)} /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <AdminPagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      ) : (
        <div className={`${cardCls} max-w-[720px]`}>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">차단 목록</h2>
            <p className="text-xs text-gray-400 mt-1">글·댓글에 들어 있으면 올리기가 막혀요. 도메인 예: open.kakao.com (오픈채팅), 다른 강의 홍보 주소</p>
          </div>
          <form className="flex items-center gap-2 px-5 py-4 border-b border-gray-50 flex-wrap" onSubmit={(e) => { e.preventDefault(); addBlock() }}>
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as 'word' | 'domain')} className={selectCls}>
              <option value="domain">링크 도메인</option>
              <option value="word">금칙어</option>
            </select>
            <input value={newValue} onChange={(e) => setNewValue(e.target.value)} maxLength={100}
              placeholder={newKind === 'domain' ? 'open.kakao.com' : '막을 단어'}
              className="flex-1 min-w-[180px] py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]" />
            <button type="submit" className={btnLine} disabled={busy || !newValue.trim()}><i className="ti ti-plus text-xs" />추가</button>
          </form>
          {(['domain', 'word'] as const).map((k) => (
            <div key={k} className="px-5 py-4 border-b border-gray-50 last:border-none">
              <p className="text-xs font-bold text-gray-500 mb-2">{k === 'domain' ? '링크 도메인' : '금칙어'} {blocks.filter((b) => b.kind === k).length}</p>
              <div className="flex flex-wrap gap-2">
                {blocks.filter((b) => b.kind === k).length === 0 && <span className="text-sm text-gray-300">없음</span>}
                {blocks.filter((b) => b.kind === k).map((b) => (
                  <span key={b.id} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-lg border border-gray-200 text-sm text-gray-800">
                    {b.value}
                    <button type="button" aria-label="삭제" onClick={() => setBlockDelete(b)} className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer">
                      <i className="ti ti-x text-xs" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminFormModal isOpen={!!editing} onClose={() => { setEditing(null); setForm(null) }} title="커뮤니티 회원 수정" onSubmit={save} loading={busy} maxWidthClass="max-w-[560px]">
        {editing && form && (
          <div className="space-y-4">
            <Field label="닉네임 *" hint="2~12자. 다른 회원과 겹치면 저장되지 않아요.">
              <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className={inputCls} maxLength={12} />
            </Field>
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
              <Field label="배지">
                <select value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value as EditForm['badge'] })} className={inputCls}>
                  <option value="">없음</option>
                  <option value="instructor">강사</option>
                  <option value="staff">스탭</option>
                </select>
              </Field>
              {form.badge === 'instructor' && (
                <Field label="연결 강사 *" hint="이 강사의 강의 기수 방·질문에 강사로 답해요.">
                  <select value={form.instructor_id} onChange={(e) => setForm({ ...form, instructor_id: e.target.value ? Number(e.target.value) : '' })} className={inputCls}>
                    <option value="">고르기</option>
                    {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </Field>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-bold mb-1">글쓰기 정지</p>
              <p className="text-xs text-gray-500 mb-3">
                {isSuspended(editing)
                  ? <>지금 정지 중: {fmtDateTime(editing.sanction!.suspended_until)}까지{editing.sanction!.reason ? ` (${editing.sanction!.reason})` : ''}</>
                  : '지금은 정지 상태가 아니에요. 정지해도 글 읽기는 돼요.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setForm({ ...form, suspend: '' })}
                  className={`px-3 py-1.5 rounded-lg text-sm cursor-pointer border ${form.suspend === '' ? 'border-[#2ED573] bg-[#2ED573]/10 text-[#13803f] font-bold' : 'border-gray-200 bg-white text-gray-600'}`}>
                  그대로
                </button>
                {SUSPEND_DAYS.map((d) => (
                  <button key={d} type="button" onClick={() => setForm({ ...form, suspend: `${d}` })}
                    className={`px-3 py-1.5 rounded-lg text-sm cursor-pointer border ${form.suspend === `${d}` ? 'border-red-400 bg-red-50 text-red-600 font-bold' : 'border-gray-200 bg-white text-gray-600'}`}>
                    {d}일
                  </button>
                ))}
                <button type="button" onClick={() => setForm({ ...form, suspend: 'date' })}
                  className={`px-3 py-1.5 rounded-lg text-sm cursor-pointer border ${form.suspend === 'date' ? 'border-red-400 bg-red-50 text-red-600 font-bold' : 'border-gray-200 bg-white text-gray-600'}`}>
                  날짜 지정
                </button>
                {editing.sanction && (
                  <button type="button" onClick={() => setForm({ ...form, suspend: 'clear' })}
                    className={form.suspend === 'clear' ? btnLineRed : 'px-3 py-1.5 rounded-lg text-sm cursor-pointer border border-gray-200 bg-white text-gray-600'}>
                    정지 해제
                  </button>
                )}
              </div>
              {form.suspend === 'date' && (
                <input type="date" min={todayStr} value={form.suspendDate} onChange={(e) => setForm({ ...form, suspendDate: e.target.value })} className={`${inputCls} mt-3 max-w-[200px]`} />
              )}
              {form.suspend !== '' && form.suspend !== 'clear' && (
                <Field label="사유(운영 기록용)" className="mt-3">
                  <input value={form.suspendReason} onChange={(e) => setForm({ ...form, suspendReason: e.target.value })} className={inputCls} placeholder="예: 오픈채팅 홍보 반복" maxLength={100} />
                </Field>
              )}
            </div>
            <p className="text-xs text-gray-400">
              이메일·전화 등은 <Link to="/admin/members" className="text-[#13b05a]">회원 관리</Link>에서 봐요.
            </p>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog
        isOpen={!!blockDelete}
        onClose={() => setBlockDelete(null)}
        onConfirm={async () => { if (blockDelete && await run(() => communityAdminService.deleteBlock(blockDelete.id), '차단 목록에서 뺐어요.')) setBlockDelete(null) }}
        title="차단 풀기"
        message={`'${blockDelete?.value ?? ''}'을(를) 차단 목록에서 뺄까요?`}
        confirmText="빼기"
        loading={busy}
      />
    </AdminLayout>
  )
}
