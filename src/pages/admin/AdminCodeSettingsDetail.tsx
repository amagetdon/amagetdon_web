import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import {
  fetchExternalCodes,
  invalidateExternalCodes,
  saveExternalCodes,
} from '../../hooks/useExternalCodes'
import {
  EXTERNAL_CODE_POSITION_OPTIONS,
  EXTERNAL_CODE_TYPE_OPTIONS,
  type ExternalCode,
  type ExternalCodePosition,
  type ExternalCodeType,
} from '../../types/externalCode'

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function AdminCodeSettingsDetail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('id')
  const isEdit = !!editId

  const [codes, setCodes] = useState<ExternalCode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [type, setType] = useState<ExternalCodeType>('script')
  const [content, setContent] = useState('')
  const [position, setPosition] = useState<ExternalCodePosition>('head')
  const [enabled, setEnabled] = useState(true)

  const currentTypeOption = useMemo(
    () => EXTERNAL_CODE_TYPE_OPTIONS.find((opt) => opt.value === type),
    [type],
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        invalidateExternalCodes()
        const data = await fetchExternalCodes()
        if (cancelled) return
        setCodes(data)
        if (isEdit) {
          const target = data.find((c) => c.id === editId)
          if (target) {
            setName(target.name)
            setType(target.type)
            setContent(target.content)
            setPosition(target.position)
            setEnabled(target.enabled)
          } else {
            toast.error('해당 외부 코드를 찾을 수 없습니다.')
            navigate('/admin/code-settings', { replace: true })
          }
        }
      } catch {
        if (!cancelled) toast.error('외부 코드를 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [editId, isEdit, navigate])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('코드 이름을 입력해 주세요.')
      return
    }
    if (!content.trim()) {
      toast.error('코드 내용을 입력해 주세요.')
      return
    }
    try {
      setSaving(true)
      let next: ExternalCode[]
      if (isEdit) {
        next = codes.map((c) =>
          c.id === editId
            ? { ...c, name: name.trim(), type, content, position, enabled }
            : c,
        )
      } else {
        const newCode: ExternalCode = {
          id: generateId(),
          name: name.trim(),
          type,
          content,
          position,
          enabled,
          createdAt: new Date().toISOString(),
        }
        next = [newCode, ...codes]
      }
      await saveExternalCodes(next)
      toast.success(isEdit ? '수정되었습니다.' : '등록되었습니다.')
      navigate('/admin/code-settings')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/admin/code-settings"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 no-underline transition-colors"
          aria-label="목록으로"
        >
          <i className="ti ti-arrow-left text-base" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">외부 코드 설정</h1>
          <p className="text-sm text-gray-500 mt-1">{isEdit ? '등록된 외부 코드를 수정합니다.' : '새 외부 코드를 등록합니다.'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 max-w-3xl">
        {loading ? (
          <div className="space-y-4">
            <div className="animate-pulse h-10 w-full bg-gray-100 rounded" />
            <div className="animate-pulse h-10 w-2/3 bg-gray-100 rounded" />
            <div className="animate-pulse h-32 w-full bg-gray-100 rounded" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <label htmlFor="code-name" className="text-xs font-bold text-gray-600 mb-1 block">
                <span className="text-red-400">*</span> 코드 이름
              </label>
              <input
                id="code-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예) Microsoft Clarity"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all"
              />
            </div>

            <div className="border-t border-gray-100 pt-5">
              <span className="text-xs font-bold text-gray-600 mb-2 block">코드 타입</span>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {EXTERNAL_CODE_TYPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="code-type"
                      value={opt.value}
                      checked={type === opt.value}
                      onChange={() => setType(opt.value)}
                      className="accent-[#2ED573] cursor-pointer"
                    />
                    <span className="font-mono text-xs">{opt.label}</span>
                  </label>
                ))}
              </div>
              {currentTypeOption?.description && (
                <p className="text-xs text-gray-400 mt-2">{currentTypeOption.description}</p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label htmlFor="code-content" className="text-xs font-bold text-gray-600 mb-1 block">
                <span className="text-red-400">*</span> 삽입할 코드
              </label>
              <textarea
                id="code-content"
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={currentTypeOption?.placeholder ?? ''}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all font-mono resize-y min-h-[200px]"
              />
            </div>

            <div className="border-t border-gray-100 pt-5 flex items-center gap-6 flex-wrap">
              <span className="font-semibold text-sm text-gray-700 w-40 shrink-0">코드 삽입 위치</span>
              <div className="flex items-center gap-5 flex-wrap">
                {EXTERNAL_CODE_POSITION_OPTIONS.map((opt) => (
                  <label key={opt.value} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="code-position"
                      value={opt.value}
                      checked={position === opt.value}
                      onChange={() => setPosition(opt.value)}
                      className="accent-[#2ED573] cursor-pointer"
                    />
                    <span className="font-mono text-xs">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5 flex items-center gap-6">
              <span className="font-semibold text-sm text-gray-700 w-40 shrink-0">코드 사용여부</span>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="code-enabled"
                    value="Y"
                    checked={enabled}
                    onChange={() => setEnabled(true)}
                    className="accent-[#2ED573] cursor-pointer"
                  />
                  사용함
                </label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="code-enabled"
                    value="N"
                    checked={!enabled}
                    onChange={() => setEnabled(false)}
                    className="accent-[#2ED573] cursor-pointer"
                  />
                  사용안함
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <i className="ti ti-check text-sm" />
                {saving ? '저장 중...' : '저장하기'}
              </button>
              <Link
                to="/admin/code-settings"
                className="bg-white text-gray-600 px-6 py-2.5 rounded-lg text-sm font-medium border border-gray-200 no-underline hover:bg-gray-50 transition-colors"
              >
                취소
              </Link>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
