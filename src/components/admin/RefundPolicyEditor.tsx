import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { refundPolicyTemplateService } from '../../services/refundPolicyTemplateService'
import type { RefundPolicyTemplate } from '../../types'
import ConfirmDialog from './ConfirmDialog'
import RichTextEditor from './RichTextEditor'

const htmlToPlain = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()

interface Props {
  value: string
  onChange: (value: string) => void
}

export default function RefundPolicyEditor({ value, onChange }: Props) {
  const [templates, setTemplates] = useState<RefundPolicyTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveMode, setSaveMode] = useState<'new' | 'overwrite'>('new')
  const [newName, setNewName] = useState('')
  const [overwriteId, setOverwriteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RefundPolicyTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [defaultBusyId, setDefaultBusyId] = useState<number | null>(null)

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const data = await refundPolicyTemplateService.getAll()
      setTemplates(data)
    } catch {
      toast.error('환불규정 템플릿을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const applyTemplate = (tpl: RefundPolicyTemplate) => {
    if (htmlToPlain(value) && !window.confirm(`"${tpl.name}" 템플릿 내용으로 덮어씁니다. 계속할까요?`)) return
    onChange(tpl.content)
    toast.success(`"${tpl.name}" 템플릿이 적용되었습니다.`)
  }

  const openSaveDialog = () => {
    if (!htmlToPlain(value)) {
      toast.error('저장할 내용이 비어 있습니다.')
      return
    }
    const nextIndex = templates.length + 1
    setNewName(`템플릿 ${nextIndex}`)
    setSaveMode(templates.length > 0 ? 'new' : 'new')
    setOverwriteId(templates[0]?.id ?? null)
    setSaveOpen(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      if (saveMode === 'new') {
        const name = newName.trim()
        if (!name) { toast.error('템플릿 이름을 입력해 주세요.'); return }
        await refundPolicyTemplateService.create({
          name,
          content: value,
          sort_order: templates.length,
        })
        toast.success('새 템플릿으로 저장되었습니다.')
      } else {
        if (!overwriteId) { toast.error('덮어쓸 템플릿을 선택해 주세요.'); return }
        await refundPolicyTemplateService.update(overwriteId, { content: value })
        toast.success('템플릿이 업데이트되었습니다.')
      }
      setSaveOpen(false)
      await loadTemplates()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleDefault = async (tpl: RefundPolicyTemplate) => {
    if (defaultBusyId != null) return
    try {
      setDefaultBusyId(tpl.id)
      await refundPolicyTemplateService.setDefault(tpl.is_default ? null : tpl.id)
      toast.success(tpl.is_default ? '기본 템플릿을 해제했습니다.' : `"${tpl.name}"을 기본 템플릿으로 설정했습니다.`)
      await loadTemplates()
    } catch {
      toast.error('기본 템플릿 설정에 실패했습니다.')
    } finally {
      setDefaultBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await refundPolicyTemplateService.delete(deleteTarget.id)
      toast.success('템플릿이 삭제되었습니다.')
      setDeleteTarget(null)
      await loadTemplates()
    } catch {
      toast.error('삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mt-6 pt-5 border-t border-gray-100">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">환불규정</h3>
          <p className="text-xs text-gray-400">상세 페이지 하단에 표시됩니다. 원격 학원 환불규정 등 판매 상품별로 다르게 설정할 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openSaveDialog}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-700 cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors flex items-center gap-1"
          >
            <i className="ti ti-device-floppy text-sm" />
            템플릿으로 저장
          </button>
        </div>
      </div>

      {/* 템플릿 목록 */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <p className="text-xs font-bold text-gray-700">저장된 템플릿</p>
          <p className="text-[11px] text-gray-400">
            <i className="ti ti-star-filled text-amber-400" /> 기본 템플릿은 새 강의/전자책 등록 시 자동 입력됩니다.
          </p>
        </div>
        {loading ? (
          <p className="text-xs text-gray-400 py-2">불러오는 중...</p>
        ) : templates.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">저장된 템플릿이 없습니다. 내용을 작성한 뒤 "템플릿으로 저장" 버튼을 눌러 보세요.</p>
        ) : (
          <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-xl bg-gray-50">
            {templates.map((tpl) => (
              <div key={tpl.id} className={`flex items-center gap-1 rounded-lg border bg-white overflow-hidden ${tpl.is_default ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'}`}>
                <button
                  type="button"
                  onClick={() => handleToggleDefault(tpl)}
                  disabled={defaultBusyId === tpl.id}
                  aria-label={tpl.is_default ? `${tpl.name} 기본 해제` : `${tpl.name} 기본으로 설정`}
                  title={tpl.is_default ? '기본 템플릿 (클릭하여 해제)' : '기본 템플릿으로 설정'}
                  className={`px-2 py-1.5 bg-transparent border-none cursor-pointer transition-colors disabled:opacity-50 ${tpl.is_default ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}
                >
                  <i className={`ti ${tpl.is_default ? 'ti-star-filled' : 'ti-star'} text-sm`} />
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-transparent border-none cursor-pointer hover:bg-[#2ED573]/10 hover:text-[#2ED573] transition-colors flex items-center gap-1"
                >
                  {tpl.name}
                  {tpl.is_default && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">기본</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(tpl)}
                  aria-label={`${tpl.name} 삭제`}
                  className="px-2 py-1.5 text-gray-400 bg-transparent border-none border-l border-gray-200 cursor-pointer hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <i className="ti ti-x text-xs" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 환불규정 본문 */}
      <div className="mt-4">
        <label className="text-xs font-bold text-gray-700 mb-1 block">환불규정 내용</label>
        <RichTextEditor
          value={value}
          onChange={onChange}
          placeholder={'예)\n① 제1조 (환불 기준)\n본 강의는 원격평생교육시설 환불규정에 따라...'}
        />
      </div>

      {/* 저장 다이얼로그 */}
      {saveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setSaveOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">환불규정 템플릿 저장</h3>
            <p className="text-xs text-gray-500 mb-4">현재 작성한 내용을 템플릿으로 저장합니다.</p>

            <div className="space-y-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={saveMode === 'new'}
                  onChange={() => setSaveMode('new')}
                  className="mt-1 accent-[#2ED573]"
                />
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-900">새 템플릿으로 저장</div>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={saveMode !== 'new'}
                    placeholder="템플릿 이름"
                    className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573] disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </label>

              {templates.length > 0 && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={saveMode === 'overwrite'}
                    onChange={() => setSaveMode('overwrite')}
                    className="mt-1 accent-[#2ED573]"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-900">기존 템플릿에 덮어쓰기</div>
                    <select
                      value={overwriteId ?? ''}
                      onChange={(e) => setOverwriteId(e.target.value ? Number(e.target.value) : null)}
                      disabled={saveMode !== 'overwrite'}
                      className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573] disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                      ))}
                    </select>
                  </div>
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-[#2ED573] text-white border-none cursor-pointer hover:bg-[#25B866] transition-colors disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget != null}
        title="템플릿 삭제"
        message={deleteTarget ? `"${deleteTarget.name}" 템플릿을 삭제하시겠습니까?` : ''}
        confirmText="삭제"
        confirmColor="red"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
      />
    </div>
  )
}
