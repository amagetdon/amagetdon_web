import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import { supabase } from '../../lib/supabase'
import {
  EXTERNAL_SERVICE_DEFINITIONS,
  getExternalServiceDefinition,
  type ExternalServiceSettings,
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

export default function AdminExternalServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const definition = id ? getExternalServiceDefinition(id) : undefined

  const [code, setCode] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [allSettings, setAllSettings] = useState<ExternalServiceSettings>(createEmptySettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!definition) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', EXTERNAL_SERVICES_KEY)
          .maybeSingle()
        if (error) throw error
        if (cancelled) return
        const merged = createEmptySettings()
        const row = data as { value?: Partial<ExternalServiceSettings> } | null
        const stored = (row?.value ?? {}) as Partial<ExternalServiceSettings>
        for (const def of EXTERNAL_SERVICE_DEFINITIONS) {
          const item = stored[def.id]
          if (item) {
            merged[def.id] = {
              code: typeof item.code === 'string' ? item.code : '',
              enabled: !!item.enabled,
            }
          }
        }
        setAllSettings(merged)
        setCode(merged[definition.id].code)
        setEnabled(merged[definition.id].enabled)
      } catch {
        if (!cancelled) toast.error('설정을 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [definition])

  const handleSave = async () => {
    if (!definition) return
    if (enabled && !code.trim()) {
      toast.error('사용하려면 코드를 입력해주세요.')
      return
    }
    try {
      setSaving(true)
      const next: ExternalServiceSettings = {
        ...allSettings,
        [definition.id]: { code: code.trim(), enabled },
      }
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: EXTERNAL_SERVICES_KEY, value: next } as never, { onConflict: 'key' })
      if (error) throw error
      setAllSettings(next)
      invalidateExternalServices(next)
      toast.success('저장되었습니다.')
      navigate('/admin/external-services')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (!definition) {
    return (
      <AdminLayout>
        <div className="bg-white rounded-xl shadow-sm p-10 text-center">
          <p className="text-gray-500 text-sm mb-4">존재하지 않는 외부 서비스입니다.</p>
          <Link
            to="/admin/external-services"
            className="inline-block bg-[#2ED573] text-white px-4 py-2 rounded-lg text-sm font-medium no-underline hover:bg-[#25B866] transition-colors"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/admin/external-services"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 no-underline transition-colors"
          aria-label="목록으로"
        >
          <i className="ti ti-arrow-left text-base" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">외부 서비스 설정</h1>
          <p className="text-sm text-gray-500 mt-1">선택한 외부 서비스의 코드와 사용 여부를 설정합니다.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
        {loading ? (
          <div className="space-y-4">
            <div className="animate-pulse h-6 w-1/3 bg-gray-100 rounded" />
            <div className="animate-pulse h-10 w-full bg-gray-100 rounded" />
            <div className="animate-pulse h-10 w-1/2 bg-gray-100 rounded" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-1">선택한 외부 서비스</p>
              <p className="text-2xl font-bold text-gray-900">{definition.name}</p>
              <p className="text-sm text-gray-500 mt-1">{definition.description}</p>
            </div>

            <div>
              <label htmlFor="external-service-code" className="text-xs font-bold text-gray-600 mb-1 block">
                {definition.codeLabel ?? '서비스 코드'}
              </label>
              <input
                id="external-service-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={definition.placeholder}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all font-mono"
              />
            </div>

            <div className="border-t border-gray-100 pt-5 flex items-center gap-6">
              <span className="font-semibold text-sm text-gray-700 w-40 shrink-0">외부 서비스 사용여부</span>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="external-service-enabled"
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
                    name="external-service-enabled"
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
                to="/admin/external-services"
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
