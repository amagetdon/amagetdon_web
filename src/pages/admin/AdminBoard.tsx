import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import RichTextEditor from '../../components/admin/RichTextEditor'
import { boardService, buildShareUrl, BOARD_CTA_DEFAULTS, type BoardPostInput } from '../../services/boardService'
import { htmlToPlainText } from '../../utils/richText'
import type { BoardPost } from '../../types'

// CTA 텍스트 필드는 비워둔 채로 시작 — 비어 있으면 공유 페이지에서 BOARD_CTA_DEFAULTS 로 자동 대체된다.
function newPost(): Partial<BoardPost> {
  return {
    title: '', content: '', is_published: true,
    preview_height: BOARD_CTA_DEFAULTS.previewHeight, cta_enabled: true,
    cta_locked_text: '', cta_title: '', cta_subtitle: '', cta_button_text: '',
  }
}

export default function AdminBoard() {
  const [posts, setPosts] = useState<BoardPost[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<BoardPost> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    try { setLoading(true); const data = await withTimeout(boardService.getAll()); setPosts(data) }
    catch { toast.error('데이터를 불러오는데 실패했습니다.') } finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])
  useVisibilityRefresh(fetchData)

  const handleSave = async () => {
    if (!editing?.title?.trim()) { toast.error('제목은 필수입니다.'); return }
    const payload: BoardPostInput = {
      title: editing.title,
      content: editing.content ?? '',
      is_published: editing.is_published ?? true,
      preview_height: Math.max(100, Math.min(3000, Number(editing.preview_height) || BOARD_CTA_DEFAULTS.previewHeight)),
      cta_enabled: editing.cta_enabled ?? true,
      cta_locked_text: editing.cta_locked_text ?? '',
      cta_title: editing.cta_title ?? '',
      cta_subtitle: editing.cta_subtitle ?? '',
      cta_button_text: editing.cta_button_text ?? '',
    }
    try {
      setSaving(true)
      if (editing.id) {
        await boardService.update(editing.id, payload)
        toast.success('글이 수정되었습니다.')
      } else {
        await boardService.create(payload)
        toast.success('새 글이 등록되었습니다.')
      }
      setEditing(null); await fetchData()
    } catch { toast.error('저장에 실패했습니다.') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try { await boardService.delete(deleteTarget); toast.success('글이 삭제되었습니다.'); setDeleteTarget(null); await fetchData() }
    catch { toast.error('삭제에 실패했습니다.') }
  }

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(token))
      toast.success('공유 링크를 복사했습니다.')
    } catch { toast.error('복사에 실패했습니다.') }
  }

  const handleRegenerate = async () => {
    if (!editing?.id) return
    if (!window.confirm('공유 링크를 재발급하면 기존에 공유한 링크는 즉시 사용할 수 없게 됩니다. 계속하시겠습니까?')) return
    try {
      const updated = await boardService.regenerateToken(editing.id)
      setEditing({ ...editing, share_token: updated.share_token })
      await fetchData()
      await navigator.clipboard.writeText(buildShareUrl(updated.share_token)).catch(() => {})
      toast.success('새 공유 링크를 발급하고 복사했습니다.')
    } catch { toast.error('재발급에 실패했습니다.') }
  }

  const filtered = posts.filter((p) =>
    p.title.includes(search) || htmlToPlainText(p.content).includes(search)
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">게시판</h1>
        <button onClick={() => setEditing(newPost())}
          className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20 flex items-center gap-1.5"><i className="ti ti-plus text-sm" /> 글 작성</button>
      </div>
      <p className="text-sm text-gray-500 mb-6">관리자만 볼 수 있는 비공개 게시판입니다. 각 글은 <span className="font-semibold text-gray-700">공유 링크</span>로만 외부에 공개됩니다.</p>

      <div className="mb-4"><div className="relative max-w-xs">
        <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="글 검색..."
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]" />
      </div></div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="px-4 py-3 text-left font-bold text-gray-600">제목</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600">공유</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600">상태</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">작성일</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 글이 없습니다.'}</td></tr>
              ) : filtered.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium max-w-0">
                    <p className="truncate">{post.title}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => copyLink(post.share_token)} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg text-gray-500 hover:text-[#2ED573] hover:bg-[#2ED573]/10 bg-gray-50 border border-gray-200 cursor-pointer transition-colors" aria-label="공유 링크 복사">
                        <i className="ti ti-link text-sm" /> 링크 복사
                      </button>
                      <a href={buildShareUrl(post.share_token)} target="_blank" rel="noreferrer" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 no-underline transition-colors" aria-label="새 탭에서 열기">
                        <i className="ti ti-external-link text-sm" />
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${post.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {post.is_published ? '링크 공개' : '링크 비공개'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden">
                    {new Date(post.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditing(post)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정"><i className="ti ti-pencil text-sm" /></button>
                      <button onClick={() => setDeleteTarget(post.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제"><i className="ti ti-trash text-sm" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminFormModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? '글 수정' : '새 글 작성'}
        onSubmit={handleSave}
        loading={saving}
        footerLeft={editing?.id && editing.share_token ? (
          <button type="button" onClick={handleRegenerate}
            className="text-xs text-gray-500 hover:text-red-500 bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors">
            <i className="ti ti-refresh text-sm" /> 공유 링크 재발급
          </button>
        ) : undefined}
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-bold block mb-1">제목 *</label>
              <input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="글 제목"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">내용</label>
              <RichTextEditor
                value={editing.content || ''}
                onChange={(html) => setEditing({ ...editing, content: html })}
                placeholder="내용을 입력해 주세요"
                minHeight={280}
              />
            </div>

            {/* 공유 페이지 티저(미리보기 + 가입 유도) 설정 */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
              <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                <input type="checkbox" checked={editing.cta_enabled ?? true} onChange={(e) => setEditing({ ...editing, cta_enabled: e.target.checked })} className="accent-[#2ED573]" />
                티저 모드 (미리보기 + 로그인 유도)
              </label>
              <p className="text-[11px] text-gray-400 mt-1 mb-3">켜면 비로그인 방문자에게 본문 일부만 보여주고 로그인 버튼을 노출합니다. (로그인한 회원은 전체 내용을 봅니다)</p>

              {(editing.cta_enabled ?? true) && (
                <div className="flex flex-col gap-3 pt-2 border-t border-gray-200">
                  <div>
                    <label className="text-xs font-bold block mb-1 text-gray-600">미리보기 높이 (px)</label>
                    <input type="number" min={100} max={3000} step={10}
                      value={editing.preview_height ?? 450}
                      onChange={(e) => setEditing({ ...editing, preview_height: Number(e.target.value) })}
                      className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
                  </div>
                  <p className="text-[11px] text-gray-400 -mt-1">아래 항목은 비워두면 기본값으로 표시됩니다. (placeholder = 기본값)</p>
                  <div>
                    <label className="text-xs font-bold block mb-1 text-gray-600">안내 문구</label>
                    <input value={editing.cta_locked_text ?? ''} onChange={(e) => setEditing({ ...editing, cta_locked_text: e.target.value })} placeholder={BOARD_CTA_DEFAULTS.lockedText}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1 text-gray-600">가입 유도 제목</label>
                    <RichTextEditor
                      value={editing.cta_title || ''}
                      onChange={(html) => setEditing({ ...editing, cta_title: html })}
                      placeholder={`기본값: ${BOARD_CTA_DEFAULTS.title}`}
                      minHeight={90}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1 text-gray-600">부제목</label>
                    <input value={editing.cta_subtitle ?? ''} onChange={(e) => setEditing({ ...editing, cta_subtitle: e.target.value })} placeholder={BOARD_CTA_DEFAULTS.subtitle}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1 text-gray-600">버튼 텍스트 <span className="text-gray-400 font-normal">(클릭 시 로그인 페이지로 이동)</span></label>
                    <input value={editing.cta_button_text ?? ''} onChange={(e) => setEditing({ ...editing, cta_button_text: e.target.value })} placeholder={BOARD_CTA_DEFAULTS.buttonText}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
                  </div>
                </div>
              )}
            </div>

            {editing.id && editing.share_token && (
              <div>
                <label className="text-sm font-bold block mb-1">공유 링크</label>
                <div className="flex items-center gap-2">
                  <input readOnly value={buildShareUrl(editing.share_token)}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-500 outline-none" />
                  <button type="button" onClick={() => copyLink(editing.share_token!)}
                    className="shrink-0 px-3 py-2.5 text-xs font-bold text-[#2ED573] bg-[#2ED573]/10 rounded-xl border-none cursor-pointer hover:bg-[#2ED573]/20 transition-colors flex items-center gap-1">
                    <i className="ti ti-copy text-sm" /> 복사
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">이 링크를 받은 사람은 로그인 없이도 접근할 수 있습니다. (티저 모드면 미리보기 + 로그인 버튼이 보입니다)</p>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={editing.is_published ?? true} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-[#2ED573]" />
              링크 공개 <span className="text-xs text-gray-400">(끄면 공유 링크로 접근해도 글이 보이지 않습니다)</span>
            </label>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="글 삭제" message="이 글을 삭제하시겠습니까? 공유된 링크도 더 이상 열리지 않습니다." />
    </AdminLayout>
  )
}
