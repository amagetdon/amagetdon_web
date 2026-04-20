import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import {
  fetchExternalCodes,
  invalidateExternalCodes,
  saveExternalCodes,
} from '../../hooks/useExternalCodes'
import { EXTERNAL_CODE_TYPE_OPTIONS, type ExternalCode } from '../../types/externalCode'

export default function AdminCodeSettings() {
  const [codes, setCodes] = useState<ExternalCode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)

  const typeLabelMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const opt of EXTERNAL_CODE_TYPE_OPTIONS) map[opt.value] = opt.label
    return map
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      invalidateExternalCodes()
      const data = await fetchExternalCodes()
      setCodes(data)
    } catch {
      toast.error('외부 코드를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])
  useVisibilityRefresh(load)

  const allSelected = useMemo(
    () => codes.length > 0 && selected.size === codes.length,
    [codes.length, selected.size],
  )

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === codes.length) return new Set()
      return new Set(codes.map((c) => c.id))
    })
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const persist = async (next: ExternalCode[]) => {
    setSaving(true)
    try {
      await saveExternalCodes(next)
      setCodes(next)
      return true
    } catch {
      toast.error('저장에 실패했습니다.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const bulkUpdate = async (enabled: boolean) => {
    if (selected.size === 0) {
      toast.error('변경할 항목을 선택해 주세요.')
      return
    }
    const skipped: string[] = []
    const next = codes.map((c) => {
      if (!selected.has(c.id)) return c
      if (enabled && !c.content.trim()) {
        skipped.push(c.name || c.id)
        return c
      }
      return { ...c, enabled }
    })
    if (JSON.stringify(next) === JSON.stringify(codes)) {
      toast.error(
        enabled
          ? '선택한 항목 모두 내용이 비어 있어 사용 처리할 수 없습니다.'
          : '변경된 항목이 없습니다.',
      )
      return
    }
    const ok = await persist(next)
    if (!ok) return
    setSelected(new Set())
    toast.success(enabled ? '선택한 코드가 사용 처리되었습니다.' : '선택한 코드가 사용 해제되었습니다.')
    if (skipped.length > 0) {
      toast(`내용이 비어 있어 제외된 코드: ${skipped.join(', ')}`, { icon: '⚠️', duration: 5000 })
    }
  }

  const handleDelete = async () => {
    if (selected.size === 0) {
      toast.error('삭제할 항목을 선택해 주세요.')
      return
    }
    const next = codes.filter((c) => !selected.has(c.id))
    const ok = await persist(next)
    setConfirmDelete(false)
    if (!ok) return
    setSelected(new Set())
    toast.success('선택한 코드가 삭제되었습니다.')
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">외부 코드 설정</h1>
        <p className="text-sm text-gray-500 mt-1">사이트 전체에 삽입할 스크립트·스타일·링크 코드를 관리합니다.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
          <div className="flex gap-2">
            <Link
              to="/admin/code-settings/registration"
              className="bg-[#2ED573] text-white px-4 py-2 rounded-lg text-sm font-medium border-none no-underline hover:bg-[#25B866] transition-colors inline-flex items-center gap-1"
            >
              <i className="ti ti-plus text-sm" /> 추가하기
            </Link>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || selected.size === 0}
              className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium border-none cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              삭제하기
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => bulkUpdate(true)}
              disabled={saving || selected.size === 0}
              className="bg-[#2ED573] text-white px-4 py-2 rounded-lg text-sm font-medium border-none cursor-pointer hover:bg-[#25B866] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              선택 사용함
            </button>
            <button
              type="button"
              onClick={() => bulkUpdate(false)}
              disabled={saving || selected.size === 0}
              className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium border-none cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              선택 사용 안함
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-10 text-center text-sm text-gray-400">
            등록된 외부 코드가 없습니다. 상단 "추가하기"로 새 코드를 등록해 주세요.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-xs">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="전체 선택"
                      className="accent-[#2ED573] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 text-center font-medium w-24">사용함</th>
                  <th className="py-3 px-3 text-left font-medium">코드 명</th>
                  <th className="py-3 px-3 text-left font-medium w-36">코드 타입</th>
                  <th className="py-3 px-3 text-center font-medium w-20">수정</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(code.id)}
                        onChange={() => toggleOne(code.id)}
                        aria-label={`${code.name} 선택`}
                        className="accent-[#2ED573] cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                          code.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {code.enabled ? '사용함' : '사용안함'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-900">{code.name || <span className="text-gray-400">(이름 없음)</span>}</td>
                    <td className="py-3 px-3 text-gray-600 text-xs">{typeLabelMap[code.type] ?? code.type}</td>
                    <td className="py-3 px-3 text-center">
                      <Link
                        to={`/admin/code-settings/registration?id=${encodeURIComponent(code.id)}`}
                        className="text-[#2ED573] hover:text-[#25B866] text-sm font-medium no-underline"
                      >
                        수정
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="외부 코드 삭제"
        message={`선택한 ${selected.size}건의 외부 코드를 삭제하시겠습니까?`}
      />
    </AdminLayout>
  )
}
