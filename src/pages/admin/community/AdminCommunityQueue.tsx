import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../../components/admin/AdminLayout'
import ConfirmDialog from '../../../components/admin/ConfirmDialog'
import { useAuth } from '../../../contexts/AuthContext'
import { communityAdminService, type ReportGroup, type UnansweredQuestion } from '../../../services/communityAdminService'
import { REPORT_REASON_LABEL, type CommunityBoard, type CommunityReportReason, type CommunityReportStatus } from '../../../types/community'
import { Chip, LoadError, LoadingRows, PageHeader } from './CommunityAdminParts'
import { btnLine, btnLineRed, cardCls, errMsg, fmtDate, fmtDateTime } from './shared'

type Action = 'hide' | 'delete' | 'restore' | 'dismiss'
const STATUS_LABEL: Record<CommunityReportStatus, string> = {
  open: '처리 전', hidden: '숨김', dismissed: '신고 무시', deleted: '삭제', restored: '복구',
}
const ACTION_DONE: Record<Action, string> = {
  hide: '숨겼어요.', delete: '삭제했어요.', restore: '복구했어요.', dismiss: '신고를 무시 처리했어요.',
}

function hoursSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
}

export default function AdminCommunityQueue() {
  const { user } = useAuth()
  const adminId = user?.id ?? ''

  const [boards, setBoards] = useState<CommunityBoard[]>([])
  const [groups, setGroups] = useState<ReportGroup[]>([])
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([])
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = () => setTick((t) => t + 1)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ReportGroup | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([communityAdminService.boards(), communityAdminService.reportGroups(done), communityAdminService.unansweredQuestions()])
      .then(([b, g, q]) => {
        if (!alive) return
        setBoards(b); setGroups(g); setQuestions(q); setLoadError(null); setLoading(false)
      })
      .catch((e) => { if (alive) { setLoadError(errMsg(e)); setLoading(false) } })
    return () => { alive = false }
  }, [done, tick])

  const boardName = (id: number | null) => (id ? boards.find((b) => b.id === id)?.name : undefined) ?? '-'

  const act = async (g: ReportGroup, action: Action) => {
    if (!adminId) { toast.error('로그인 정보를 확인할 수 없어요.'); return }
    try {
      setBusyKey(g.key)
      await communityAdminService.handleReport(g, action, adminId)
      toast.success(ACTION_DONE[action])
      reload()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusyKey(null)
    }
  }

  const remind = async (q: UnansweredQuestion) => {
    try {
      setBusyKey(`q${q.id}`)
      const n = await communityAdminService.remindInstructor(q.id)
      if (n > 0) toast.success(`강사 ${n}명에게 알림을 다시 보냈어요.`)
      else toast('알림을 받을 강사 계정이 없어요. 회원·차단 화면에서 강사 배지를 연결해 주세요.', { icon: 'ℹ️' })
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusyKey(null)
    }
  }

  const autoHidden = groups.filter((g) => g.is_hidden && g.reports.every((r) => !r.handled_by)).length

  return (
    <AdminLayout>
      <PageHeader title="운영 대기열" desc="처리할 일만 모았어요. 처리하면 목록에서 빠져요." />

      {loadError ? <LoadError message={loadError} onRetry={reload} /> : (
        <>
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4 mb-5">
            <div className={`${cardCls} p-5 flex items-center gap-4`}>
              <span className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center"><i className="ti ti-flag text-2xl" /></span>
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{done ? '-' : groups.length}</p>
                <p className="text-xs text-gray-500">처리 전 신고{!done && autoHidden > 0 ? ` · 자동 숨김 ${autoHidden}` : ''}</p>
              </div>
            </div>
            <div className={`${cardCls} p-5 flex items-center gap-4`}>
              <span className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><i className="ti ti-clock-exclamation text-2xl" /></span>
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{questions.length}</p>
                <p className="text-xs text-gray-500">48시간 넘은 미답변 질문</p>
              </div>
            </div>
          </div>

          <div className="flex gap-5 items-start max-lg:flex-col">
            {/* 신고 */}
            <div className={`${cardCls} flex-[3] min-w-0 w-full`}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">신고 <span className="text-gray-400 font-normal text-sm">{groups.length}</span></h2>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  {([[false, '처리 전'], [true, '처리 완료']] as const).map(([v, t]) => (
                    <button key={t} type="button" onClick={() => setDone(v)}
                      className={`px-3 py-1 rounded-md text-sm border-none cursor-pointer ${done === v ? 'bg-white font-bold text-gray-900 shadow-sm' : 'bg-transparent text-gray-500'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {loading ? <div className="p-4"><LoadingRows /></div> : groups.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-gray-400">{done ? '처리한 신고가 없어요.' : '처리할 신고가 없어요.'}</p>
              ) : groups.map((g) => {
                const busy = busyKey === g.key
                const auto = g.is_hidden && g.reports.every((r) => !r.handled_by)
                const handled = g.reports.find((r) => r.handled_at)
                return (
                  <div key={g.key} className="px-5 py-4 border-b border-gray-50 last:border-none">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-[240px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Chip tone={g.target_type === 'post' ? 'amber' : 'blue'}>{g.target_type === 'post' ? '글' : '댓글'}</Chip>
                          {auto && <Chip tone="red">자동 숨김</Chip>}
                          {!auto && g.is_hidden && <Chip tone="red">숨김 중</Chip>}
                          {g.deleted && <Chip>삭제됨</Chip>}
                          {g.missing && <Chip>지워진 대상</Chip>}
                          {done && g.statuses.map((s) => <Chip key={s} tone="green">{STATUS_LABEL[s]}</Chip>)}
                          <a href={`/community/p/${g.post_id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-gray-900 no-underline hover:underline truncate max-w-[420px]">
                            {g.target_type === 'post' ? (g.title ?? '(제목 없음)') : `"${(g.body ?? '').slice(0, 40)}"`}
                          </a>
                        </div>
                        <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-line line-clamp-3">
                          {g.missing ? '대상을 찾을 수 없어요(이미 지워졌을 수 있어요).'
                            : g.target_type === 'post' ? ((g.body ?? '').slice(0, 200) || '(본문 없음)')
                              : <>'{g.title ?? '-'}' 글에 달린 댓글</>}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap text-xs text-gray-400">
                          <span>{boardName(g.board_id)} · {g.author?.nickname ?? '(닉네임 없음)'} · 마지막 신고 {fmtDate(g.latest_at)}</span>
                          {Object.entries(g.reasons).map(([r, n]) => (
                            <Chip key={r}>{REPORT_REASON_LABEL[r as CommunityReportReason] ?? r} {n}</Chip>
                          ))}
                          {handled?.handled_at && <span>· 처리 {fmtDateTime(handled.handled_at)}</span>}
                        </div>
                        {g.reports.some((r) => r.detail) && (
                          <ul className="mt-1.5 text-xs text-gray-500 list-disc pl-4 space-y-0.5">
                            {g.reports.filter((r) => r.detail).slice(0, 3).map((r) => <li key={r.id}>{r.detail}</li>)}
                          </ul>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!g.missing && !g.deleted && (
                          <button type="button" className={btnLineRed} disabled={busy} onClick={() => setDeleteTarget(g)}><i className="ti ti-trash text-xs" />삭제</button>
                        )}
                        {!g.missing && !g.deleted && !g.is_hidden && (
                          <button type="button" className={btnLine} disabled={busy} onClick={() => act(g, 'hide')}><i className="ti ti-eye-off text-xs" />숨김</button>
                        )}
                        {!g.missing && !g.deleted && g.is_hidden && (
                          <button type="button" className={btnLine} disabled={busy} onClick={() => act(g, 'restore')}><i className="ti ti-eye text-xs" />복구</button>
                        )}
                        {!done && (
                          <button type="button" className={btnLine} disabled={busy} onClick={() => act(g, 'dismiss')}>신고 무시</button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-50">같은 글·댓글에 신고가 3건 모이면 자동으로 숨겨지고 여기로 와요. 숨김만 한 신고는 삭제·복구·무시할 때까지 '처리 전'에 남아요.</p>
            </div>

            {/* 48시간 넘은 질문 */}
            <div className={`${cardCls} flex-[2] min-w-0 w-full`}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">48시간 넘은 질문 <span className="text-gray-400 font-normal text-sm">{questions.length}</span></h2>
                <span className="text-xs text-gray-400">강사 답변 대기</span>
              </div>
              {loading ? <div className="p-4"><LoadingRows /></div> : questions.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-gray-400">밀린 질문이 없어요.</p>
              ) : questions.map((q) => (
                <div key={q.id} className="flex items-start gap-3 px-5 py-4 border-b border-gray-50 last:border-none">
                  <div className="flex-1 min-w-0">
                    <a href={`/community/p/${q.id}`} target="_blank" rel="noopener noreferrer" className="block text-sm font-bold text-gray-900 no-underline hover:underline truncate">{q.title}</a>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap text-xs text-gray-400">
                      <span>{boardName(q.board_id)} · {q.author?.nickname ?? '(닉네임 없음)'} · 댓글 {q.comment_count}</span>
                      <Chip tone={hoursSince(q.created_at) >= 72 ? 'red' : 'amber'}>{hoursSince(q.created_at)}시간</Chip>
                      {q.is_hidden && <Chip tone="red">숨김</Chip>}
                    </div>
                  </div>
                  <button type="button" className={btnLine} disabled={busyKey === `q${q.id}`} onClick={() => remind(q)}>
                    <i className="ti ti-bell-ringing text-xs" />강사에게 알림 다시 보내기
                  </button>
                </div>
              ))}
              <p className="mx-5 my-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                '다시 보내기'는 이 게시판 강의의 강사 계정에 사이트 안 알림을 보내요. 강사가 댓글로 답하면 목록에서 빠져요.
              </p>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          const g = deleteTarget
          setDeleteTarget(null)
          await act(g, 'delete')
        }}
        title={deleteTarget?.target_type === 'post' ? '글 삭제' : '댓글 삭제'}
        message={deleteTarget?.target_type === 'post'
          ? '이 글을 삭제할까요? 댓글이 있으면 "삭제된 글입니다"로 자리만 남고, 없으면 완전히 지워져요. 되돌릴 수 없어요.'
          : '이 댓글을 삭제할까요? 답글이 있으면 "삭제된 댓글입니다"로 자리만 남아요. 되돌릴 수 없어요.'}
      />
    </AdminLayout>
  )
}
