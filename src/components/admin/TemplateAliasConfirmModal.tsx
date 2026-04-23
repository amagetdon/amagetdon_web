import { useEffect, useState } from 'react'
import { webhookService } from '../../services/webhookService'
import CanonicalKeyPicker from './CanonicalKeyPicker'

export interface AliasSuggestion {
  variable: string
  canonical: string
  reason: string
}

interface Props {
  isOpen: boolean
  unknownVars: string[]
  suggestedAliases: Record<string, { canonical: string; reason: string }>
  emptySlots: string[]
  suggestedSlotFills: Record<string, { canonical: string; reason: string }>
  warning?: string
  onCancel: () => void
  /** aliases: {임의변수명 → canonical}, slotFills: {빈슬롯키 → canonical} */
  onConfirm: (aliases: Record<string, string>, slotFills: Record<string, string>) => void
}

export default function TemplateAliasConfirmModal({ isOpen, unknownVars, suggestedAliases, emptySlots, suggestedSlotFills, warning, onCancel, onConfirm }: Props) {
  const [customCanonicals, setCustomCanonicals] = useState<Array<{ key: string; value: string; description: string }>>([])
  useEffect(() => {
    if (!isOpen) return
    webhookService.listCustomCanonicalVars().then((list) => {
      setCustomCanonicals(list.map((v) => ({ key: v.key, value: v.value, description: v.description })))
    }).catch(() => setCustomCanonicals([]))
  }, [isOpen])

  const customOptions = customCanonicals.map((c) => ({ key: c.key, description: c.description || c.value.slice(0, 50) }))

  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const v of unknownVars) {
      m[v] = suggestedAliases[v]?.canonical ?? ''
    }
    return m
  })
  const [slotFills, setSlotFills] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const s of emptySlots) {
      m[s] = suggestedSlotFills[s]?.canonical ?? ''
    }
    return m
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              <i className="ti ti-sparkles text-[#2ED573] mr-1" />
              새 변수 감지됨
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              템플릿에서 기본 딕셔너리에 없는 변수를 발견했습니다. 각 변수를 어느 canonical 키에 매핑할지 선택해주세요.
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer">
            <i className="ti ti-x text-xl" />
          </button>
        </div>

        {warning && (
          <div className="mb-3 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-xs text-amber-900 flex items-start gap-2">
            <i className="ti ti-alert-triangle text-amber-600 mt-0.5" />
            <span>{warning}</span>
          </div>
        )}

        {unknownVars.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-700 mb-2">🔤 미확인 {`{#변수#}`} 매핑 ({unknownVars.length}개)</p>
            <div className="space-y-2">
              {unknownVars.map((v) => {
                const suggestion = suggestedAliases[v]
                return (
                  <div key={v} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-[120px]">
                        <code className="text-sm font-mono text-[#2ED573] bg-white px-2 py-1 rounded border border-gray-200">{`{#${v}#}`}</code>
                        {suggestion && (
                          <p className="text-[10px] text-gray-500 mt-1">💡 {suggestion.reason}</p>
                        )}
                      </div>
                      <div className="flex-1 min-w-[220px]">
                        <CanonicalKeyPicker
                          value={mappings[v] ?? ''}
                          onChange={(val) => setMappings({ ...mappings, [v]: val })}
                          placeholder="canonical 키 선택"
                          customOptions={customOptions}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {emptySlots.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-700 mb-2">🫙 빈 <code className="bg-gray-100 px-1 rounded text-[10px]">variables.X</code> 슬롯 자동 채움 ({emptySlots.length}개)</p>
            <p className="text-[10px] text-gray-500 mb-2">💡 canonical 키(TITLE, user_name 등) 또는 고정 URL/텍스트(<code>https://open.kakao.com/o/xxx</code> 등)를 직접 입력할 수 있습니다.</p>
            <div className="space-y-2">
              {emptySlots.map((s) => {
                const suggestion = suggestedSlotFills[s]
                return (
                  <div key={s} className="border border-blue-200 rounded-xl p-3 bg-blue-50">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-[160px]">
                        <code className="text-xs font-mono text-blue-700 bg-white px-2 py-1 rounded border border-blue-200">variables.{s}: ""</code>
                        {suggestion && (
                          <p className="text-[10px] text-blue-600 mt-1">💡 {suggestion.reason}</p>
                        )}
                      </div>
                      <div className="flex-1 min-w-[220px]">
                        <CanonicalKeyPicker
                          value={slotFills[s] ?? ''}
                          onChange={(val) => setSlotFills({ ...slotFills, [s]: val })}
                          placeholder="canonical 키 또는 고정값 입력"
                          customOptions={customOptions}
                          accentColor="blue"
                          allowFreeInput
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm cursor-pointer hover:bg-gray-50">취소</button>
          <button
            onClick={() => {
              const filteredAliases: Record<string, string> = {}
              for (const [k, v] of Object.entries(mappings)) if (v) filteredAliases[k] = v
              const filteredFills: Record<string, string> = {}
              for (const [k, v] of Object.entries(slotFills)) if (v) filteredFills[k] = v
              onConfirm(filteredAliases, filteredFills)
            }}
            className="px-4 py-2 rounded-lg bg-[#2ED573] text-white text-sm font-bold cursor-pointer border-none hover:bg-[#25B866]">
            확인 후 저장
          </button>
        </div>
      </div>
    </div>
  )
}
