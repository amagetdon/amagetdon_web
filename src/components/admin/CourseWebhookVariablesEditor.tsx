import { useState, useEffect } from 'react'
import { webhookService } from '../../services/webhookService'

// 알림톡 템플릿에 자주 쓰이는 강의 특화 변수의 추천 키들.
// 이 키들은 클릭 한 번으로 추가할 수 있도록 quick-add 버튼으로 제공한다.
const SUGGESTED_KEYS = [
  '강사의 한 줄 메시지',
  '강의핵심내용1',
  '강의핵심내용2',
  '수강생에게 전하는 메시지',
  '링크명1',
]

interface Props {
  value: Record<string, string>
  onChange: (next: Record<string, string>) => void
  onSave: () => void | Promise<void>
  saving: boolean
}

export default function CourseWebhookVariablesEditor({ value, onChange, onSave, saving }: Props) {
  // 객체 → 순서 유지를 위한 배열. key 변경/삭제 중에도 입력 포커스가 튀지 않도록 로컬 상태로 관리.
  const initialRows = (): Array<{ key: string; value: string }> => {
    const entries = Object.entries(value || {})
    return entries.length > 0 ? entries.map(([k, v]) => ({ key: k, value: v })) : []
  }
  const [rows, setRows] = useState<Array<{ key: string; value: string }>>(initialRows)
  const [globalVars, setGlobalVars] = useState<Array<{ key: string; value: string; description: string }>>([])

  useEffect(() => {
    webhookService.listCustomCanonicalVars()
      .then((list) => setGlobalVars(list.map((v) => ({ key: v.key, value: v.value, description: v.description }))))
      .catch(() => { /* 공용 변수 조회 실패는 무시 — 강의 변수 편집은 그대로 가능 */ })
  }, [])

  const commit = (next: Array<{ key: string; value: string }>) => {
    setRows(next)
    // key 가 빈 행은 제외하고 객체로 변환. 같은 key 가 여러 번이면 마지막 값으로 덮어씀.
    const obj: Record<string, string> = {}
    for (const r of next) {
      const k = r.key.trim()
      if (k) obj[k] = r.value
    }
    onChange(obj)
  }

  const addRow = (key = '', value = '') => commit([...rows, { key, value }])
  const updateRow = (idx: number, patch: Partial<{ key: string; value: string }>) =>
    commit(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const removeRow = (idx: number) => commit(rows.filter((_, i) => i !== idx))

  const usedKeys = new Set(rows.map((r) => r.key.trim()).filter(Boolean))

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 max-sm:p-4">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-gray-900">강의 변수</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            여기 정의한 변수는 알림톡 템플릿에서 <code className="bg-gray-100 px-1 rounded text-[11px]">{`{#키#}`}</code> 형태로 자동 치환됩니다.
            예: <code className="bg-gray-100 px-1 rounded text-[11px]">{`{#강사명#}`}</code>
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50 shrink-0"
        >
          {saving ? '저장 중...' : '강의 변수 저장'}
        </button>
      </div>

      {/* quick-add 추천 키 */}
      <div className="flex flex-wrap gap-1.5 mt-4 mb-3">
        {SUGGESTED_KEYS.filter((k) => !usedKeys.has(k)).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => addRow(k)}
            className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full border-none cursor-pointer transition-colors flex items-center gap-1"
            title={`+ ${k}`}
          >
            <i className="ti ti-plus text-[10px]" /> {k}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400 bg-gray-50 rounded-xl">
          정의된 변수가 없습니다. 위의 추천 키를 누르거나 '변수 추가'로 시작하세요.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <input
                type="text"
                value={r.key}
                onChange={(e) => updateRow(idx, { key: e.target.value })}
                placeholder="키 (예: 강사명)"
                className="w-[200px] max-sm:w-[120px] shrink-0 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]"
              />
              <textarea
                value={r.value}
                onChange={(e) => updateRow(idx, { value: e.target.value })}
                placeholder="값"
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573] resize-y min-h-[40px]"
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border border-gray-200 cursor-pointer transition-colors"
                aria-label="변수 삭제"
                title="삭제"
              >
                <i className="ti ti-trash text-sm" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => addRow()}
        className="mt-3 w-full py-2.5 rounded-lg text-xs font-medium border border-dashed border-gray-300 text-gray-500 bg-white cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors flex items-center justify-center gap-1.5"
      >
        <i className="ti ti-plus text-sm" /> 변수 추가
      </button>

      {/* 공용 변수 (전역) — 어드민 → 알림톡 설정에서 등록한 사이트 공용값. 여기선 참조만. */}
      {globalVars.length > 0 && (
        <div className="mt-6 pt-5 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <i className="ti ti-variable text-[#2ED573]" /> 공용 변수
            </h4>
            <p className="text-[11px] text-gray-400">사이트 전역값 — 모든 알림톡에서 자동 사용. 강의별로 덮어쓰려면 칩을 눌러 위에 추가하세요.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {globalVars.map((g) => {
              const alreadyAdded = usedKeys.has(g.key)
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => { if (!alreadyAdded) addRow(g.key, g.value) }}
                  disabled={alreadyAdded}
                  className={`px-2.5 py-1 text-xs rounded-full border-none cursor-pointer transition-colors flex items-center gap-1 ${
                    alreadyAdded
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                  }`}
                  title={alreadyAdded ? '이미 강의 변수에 추가됨' : `${g.description || g.value} (클릭 시 강의 변수에 추가)`}
                >
                  <code className="text-[11px]">{`{#${g.key}#}`}</code>
                  {alreadyAdded && <i className="ti ti-check text-[10px]" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
