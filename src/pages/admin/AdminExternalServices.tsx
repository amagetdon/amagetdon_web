import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import { supabase } from '../../lib/supabase'
import {
  EXTERNAL_SERVICE_DEFINITIONS,
  type ExternalServiceSettings,
  type ExternalServiceId,
} from '../../constants/externalServices'
import { invalidateExternalServices } from '../../hooks/useExternalServices'

const EXTERNAL_SERVICES_KEY = 'external_services'

const createEmptySettings = (): ExternalServiceSettings => {
  const result = {} as ExternalServiceSettings
  for (const def of EXTERNAL_SERVICE_DEFINITIONS) {
    result[def.id] = { code: '', enabled: false }
  }
  return result
}

export default function AdminExternalServices() {
  const [settings, setSettings] = useState<ExternalServiceSettings>(createEmptySettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<ExternalServiceId>>(new Set())

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', EXTERNAL_SERVICES_KEY)
        .maybeSingle()
      if (error) throw error
      const next = createEmptySettings()
      const row = data as { value?: Partial<ExternalServiceSettings> } | null
      const stored = (row?.value ?? {}) as Partial<ExternalServiceSettings>
      for (const def of EXTERNAL_SERVICE_DEFINITIONS) {
        const item = stored[def.id]
        if (item) {
          next[def.id] = {
            code: typeof item.code === 'string' ? item.code : '',
            enabled: !!item.enabled,
          }
        }
      }
      setSettings(next)
    } catch {
      toast.error('외부 서비스 설정을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])
  useVisibilityRefresh(fetchData)

  const allSelected = useMemo(
    () => EXTERNAL_SERVICE_DEFINITIONS.length > 0 && selected.size === EXTERNAL_SERVICE_DEFINITIONS.length,
    [selected.size],
  )

  const toggleOne = (id: ExternalServiceId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === EXTERNAL_SERVICE_DEFINITIONS.length) return new Set()
      return new Set(EXTERNAL_SERVICE_DEFINITIONS.map((d) => d.id))
    })
  }

  const bulkUpdate = async (enabled: boolean) => {
    if (selected.size === 0) {
      toast.error('변경할 항목을 선택해 주세요.')
      return
    }
    const next: ExternalServiceSettings = { ...settings }
    const skipped: string[] = []
    const applied: ExternalServiceId[] = []
    for (const id of selected) {
      const current = next[id] ?? { code: '', enabled: false }
      if (enabled && !current.code.trim()) {
        skipped.push(EXTERNAL_SERVICE_DEFINITIONS.find((d) => d.id === id)?.name ?? id)
        continue
      }
      next[id] = { ...current, enabled }
      applied.push(id)
    }

    if (applied.length === 0) {
      toast.error(
        enabled
          ? '선택한 서비스 모두 코드가 입력되지 않아 사용 처리할 수 없습니다. 먼저 코드를 입력해 주세요.'
          : '변경할 항목이 없습니다.',
      )
      return
    }

    try {
      setSaving(true)
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: EXTERNAL_SERVICES_KEY, value: next } as never, { onConflict: 'key' })
      if (error) throw error
      setSettings(next)
      invalidateExternalServices(next)
      setSelected(new Set())
      toast.success(enabled ? '선택한 서비스가 사용 처리되었습니다.' : '선택한 서비스가 사용 해제되었습니다.')
      if (skipped.length > 0) {
        toast(`코드가 비어 있어 제외된 서비스: ${skipped.join(', ')}`, { icon: '⚠️', duration: 5000 })
      }
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">외부 서비스 설정</h1>
        <p className="text-sm text-gray-500 mt-1">사이트에 연동되는 외부 서비스의 코드와 사용 여부를 관리합니다.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex gap-2 items-center justify-end mb-4">
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

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />
            ))}
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
                  <th className="py-3 px-3 text-left font-medium">외부 서비스 명</th>
                  <th className="py-3 px-3 text-center font-medium w-24">사용함</th>
                  <th className="py-3 px-3 text-center font-medium w-20">수정</th>
                </tr>
              </thead>
              <tbody>
                {EXTERNAL_SERVICE_DEFINITIONS.map((def) => {
                  const item = settings[def.id]
                  const enabled = !!item?.enabled
                  return (
                    <tr key={def.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(def.id)}
                          onChange={() => toggleOne(def.id)}
                          aria-label={`${def.name} 선택`}
                          className="accent-[#2ED573] cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-gray-900">{def.name}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                            enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {enabled ? '사용함' : '사용안함'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Link
                          to={`/admin/external-services/${def.id}`}
                          className="text-[#2ED573] hover:text-[#25B866] text-sm font-medium no-underline"
                        >
                          수정
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
