import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import {
  saveSectionConfig,
  getSectionDefault,
  type SectionKey,
  type SectionConfig,
} from '../../hooks/useSectionSettings'

interface Props {
  sectionKey: SectionKey
  config: SectionConfig
  as?: 'h2' | 'h3'
  className: string
  /** 다크 배경에서 사용할 때 편집 UI 색감을 어둡게 */
  theme?: 'light' | 'dark'
  /** 노출 개수 편집 허용 (1~maxCount) */
  editableCount?: boolean
  maxCount?: number
  minCount?: number
  /** 부제 편집 허용 */
  editableSubtitle?: boolean
  /** 표시는 같지만 강제로 보일 컨테이너 wrapping을 잡는 ref */
  containerClassName?: string
}

export function EditableSectionTitle({
  sectionKey,
  config,
  as = 'h2',
  className,
  theme = 'light',
  editableCount = false,
  maxCount = 12,
  minCount = 1,
  editableSubtitle = false,
  containerClassName = 'inline-flex items-center gap-2 min-w-0',
}: Props) {
  const { isAdmin } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(config.title)
  const [draftSubtitle, setDraftSubtitle] = useState(config.subtitle ?? '')
  const [draftCount, setDraftCount] = useState(config.count ?? getSectionDefault(sectionKey).count ?? 6)
  const [saving, setSaving] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraftTitle(config.title)
    setDraftSubtitle(config.subtitle ?? '')
    if (config.count != null) setDraftCount(config.count)
  }, [config.title, config.subtitle, config.count])

  useEffect(() => {
    if (!editing) return
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setEditing(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [editing])

  const handleSave = async () => {
    if (!draftTitle.trim()) {
      toast.error('제목을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const patch: Partial<SectionConfig> = { title: draftTitle.trim() }
      if (editableSubtitle) patch.subtitle = draftSubtitle.trim()
      if (editableCount) patch.count = draftCount
      await saveSectionConfig(sectionKey, patch)
      toast.success('저장되었습니다.')
      setEditing(false)
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const def = getSectionDefault(sectionKey)
    setDraftTitle(def.title)
    setDraftSubtitle(def.subtitle ?? '')
    if (def.count != null) setDraftCount(def.count)
  }

  const Tag = as

  if (!isAdmin) {
    return <Tag className={className}>{config.title}</Tag>
  }

  const isDark = theme === 'dark'
  const iconBtnClass = isDark
    ? 'flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border-0 cursor-pointer transition-colors'
    : 'flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 border-0 cursor-pointer transition-colors'

  return (
    <div className={containerClassName} style={{ position: 'relative' }}>
      <Tag className={className}>{config.title}</Tag>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setEditing((v) => !v)
        }}
        className={iconBtnClass}
        aria-label="섹션 편집"
        title="섹션 편집"
      >
        <i className="ti ti-pencil text-sm" />
      </button>

      {editing && (
        <div
          ref={panelRef}
          className="absolute left-0 z-40 mt-2 w-[320px] bg-white rounded-xl shadow-2xl border border-gray-200 p-4 text-left"
          style={{ top: '100%' }}
          onClick={(e) => e.stopPropagation()}
        >
          <label className="block text-xs font-semibold text-gray-700 mb-1">제목</label>
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#2ED573]"
            autoFocus
          />

          {editableSubtitle && (
            <>
              <label className="block text-xs font-semibold text-gray-700 mt-3 mb-1">부제</label>
              <input
                type="text"
                value={draftSubtitle}
                onChange={(e) => setDraftSubtitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#2ED573]"
              />
            </>
          )}

          {editableCount && (
            <>
              <label className="block text-xs font-semibold text-gray-700 mt-3 mb-1">
                노출 개수 ({minCount}–{maxCount})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={minCount}
                  max={maxCount}
                  step={1}
                  value={draftCount}
                  onChange={(e) => setDraftCount(Number(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  min={minCount}
                  max={maxCount}
                  value={draftCount}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (!Number.isNaN(v)) setDraftCount(Math.max(minCount, Math.min(maxCount, v)))
                  }}
                  className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-sm text-center"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between mt-4 gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-800 bg-transparent border-0 cursor-pointer p-0"
            >
              기본값으로
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 text-sm text-white bg-[#2ED573] hover:bg-[#26b863] rounded-md border-0 cursor-pointer disabled:opacity-50"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EditableSectionTitle
