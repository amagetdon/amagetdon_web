import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { webhookService } from '../../services/webhookService'

interface KeyRow {
  id: number
  label: string
  api_key: string
  enabled: boolean
  last_used_at: string | null
  last_error_at: string | null
  last_error_message: string | null
  error_count: number
  use_count: number
  sort_order: number
}

function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 14) return key
  return `${key.slice(0, 8)}...${key.slice(-6)}`
}

export default function OpenaiKeyManager() {
  const [expanded, setExpanded] = useState(false)
  const [keys, setKeys] = useState<KeyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newKey, setNewKey] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [showKeyId, setShowKeyId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<{ label: string; api_key: string }>({ label: '', api_key: '' })

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    try {
      const list = await webhookService.listOpenaiKeys()
      setKeys(list)
    } catch {
      toast.error('키 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (expanded) fetchKeys() }, [expanded, fetchKeys])

  const handleAdd = async () => {
    if (!newKey.trim()) { toast.error('API 키를 입력해주세요.'); return }
    if (!newKey.trim().startsWith('sk-')) {
      if (!confirm('OpenAI 키는 보통 "sk-"로 시작합니다. 그래도 저장할까요?')) return
    }
    setAdding(true)
    try {
      await webhookService.upsertOpenaiKey({
        label: newLabel.trim() || `Key #${keys.length + 1}`,
        api_key: newKey.trim(),
        enabled: true,
        sort_order: keys.length,
      })
      toast.success('키가 추가되었습니다.')
      setNewLabel('')
      setNewKey('')
      fetchKeys()
    } catch {
      toast.error('추가 실패')
    } finally {
      setAdding(false)
    }
  }

  const handleBulkAdd = async () => {
    const raw = bulkText.trim()
    if (!raw) { toast.error('키를 붙여넣어주세요.'); return }
    let parsed: string[] = []
    // JSON 배열 형식 지원
    if (raw.startsWith('[')) {
      try {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) parsed = arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      } catch {
        toast.error('JSON 파싱 실패')
        return
      }
    } else {
      // 줄바꿈/콤마 분리
      parsed = raw.split(/[\n,]/).map((s) => s.trim()).filter((s) => s.length > 0)
    }
    if (parsed.length === 0) { toast.error('키가 없습니다.'); return }
    setAdding(true)
    try {
      const n = await webhookService.bulkInsertOpenaiKeys(parsed, '풀키')
      toast.success(`${n}개 키가 추가되었습니다.`)
      setBulkText('')
      setBulkOpen(false)
      fetchKeys()
    } catch {
      toast.error('일괄 추가 실패')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (k: KeyRow) => {
    try {
      await webhookService.upsertOpenaiKey({
        id: k.id,
        label: k.label,
        api_key: k.api_key,
        enabled: !k.enabled,
        sort_order: k.sort_order,
      })
      fetchKeys()
    } catch {
      toast.error('상태 변경 실패')
    }
  }

  const handleDelete = async (k: KeyRow) => {
    if (!confirm(`"${k.label}" 키를 삭제합니다. 계속?`)) return
    try {
      await webhookService.deleteOpenaiKey(k.id)
      toast.success('삭제되었습니다.')
      fetchKeys()
    } catch {
      toast.error('삭제 실패')
    }
  }

  const beginEdit = (k: KeyRow) => {
    setEditingId(k.id)
    setEditDraft({ label: k.label, api_key: k.api_key })
  }

  const saveEdit = async () => {
    if (editingId === null) return
    try {
      const k = keys.find((x) => x.id === editingId)
      if (!k) return
      await webhookService.upsertOpenaiKey({
        id: k.id,
        label: editDraft.label,
        api_key: editDraft.api_key,
        enabled: k.enabled,
        sort_order: k.sort_order,
      })
      toast.success('수정되었습니다.')
      setEditingId(null)
      fetchKeys()
    } catch {
      toast.error('수정 실패')
    }
  }

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)}
        className="w-full bg-white hover:bg-gray-50 rounded-xl shadow-sm p-4 border-none cursor-pointer flex items-center justify-between text-left">
        <div>
          <h2 className="text-sm font-bold text-gray-900">
            <i className="ti ti-key text-[#2ED573] mr-1" />
            OpenAI API 키 풀 (템플릿 변수 분석용)
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">클릭해서 펼치기 — 키 추가/수정/사용 통계</p>
        </div>
        <i className="ti ti-chevron-down text-gray-400" />
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex-1 min-w-0">
          <button type="button" onClick={() => setExpanded(false)}
            className="text-left w-full bg-transparent border-none cursor-pointer p-0">
            <h2 className="text-sm font-bold text-gray-900">
              <i className="ti ti-chevron-up text-gray-400 mr-1" />
              <i className="ti ti-key text-[#2ED573] mr-1" />
              OpenAI API 키 풀 (템플릿 변수 분석용)
            </h2>
          </button>
          <p className="text-xs text-gray-400 mt-0.5">
            템플릿 저장 시 GPT-5.4-mini가 미확인 변수를 canonical 키로 매핑 제안. 사용량 적은 키부터 라운드로빈, 실패 시 자동 폴백.
          </p>
        </div>
        <button onClick={() => setBulkOpen(!bulkOpen)}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-1.5 border-none cursor-pointer">
          <i className="ti ti-upload mr-1" />일괄 추가
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-start gap-2 mb-3">
        <i className="ti ti-shield-lock text-amber-600 mt-0.5" />
        <div>
          <strong>보안 주의</strong>: 어드민만 접근 가능한 DB에 저장됩니다. 외부 유출되거나 실수로 공유된 키는
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline mx-1">OpenAI 콘솔</a>
          에서 즉시 revoke하세요.
        </div>
      </div>

      {/* 신규 추가 */}
      <div className="border border-gray-200 rounded-xl p-3 mb-3 bg-gray-50">
        <div className="flex items-start gap-2 flex-wrap">
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
            placeholder="라벨 (예: A계정, 2호기)"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#2ED573] w-40 bg-white" />
          <input type="password" value={newKey} onChange={(e) => setNewKey(e.target.value)}
            placeholder="sk-proj-..."
            className="flex-1 min-w-[280px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#2ED573] font-mono bg-white" />
          <button onClick={handleAdd} disabled={adding}
            className="bg-[#2ED573] text-white px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none hover:bg-[#25B866] disabled:opacity-50">
            {adding ? '추가 중...' : '추가'}
          </button>
        </div>
      </div>

      {bulkOpen && (
        <div className="border border-gray-200 rounded-xl p-3 mb-3 bg-blue-50">
          <label className="text-xs font-bold text-gray-700 block mb-1">일괄 추가 (JSON 배열 또는 줄바꿈 구분)</label>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)}
            placeholder={`["sk-proj-AAA...","sk-proj-BBB..."]\n\n또는 줄바꿈:\nsk-proj-AAA...\nsk-proj-BBB...`}
            rows={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#2ED573] font-mono resize-none bg-white" />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => { setBulkOpen(false); setBulkText('') }}
              className="text-xs bg-white hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 cursor-pointer">취소</button>
            <button onClick={handleBulkAdd} disabled={adding}
              className="text-xs bg-[#2ED573] hover:bg-[#25B866] text-white border-none rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-50">
              {adding ? '추가 중...' : '전부 추가'}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="text-xs text-gray-400 text-center py-6">불러오는 중...</div>
      ) : keys.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-8">등록된 키가 없습니다. 위에서 추가해주세요.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left font-bold text-gray-600">라벨</th>
                <th className="px-2 py-2 text-left font-bold text-gray-600">키</th>
                <th className="px-2 py-2 text-center font-bold text-gray-600">사용</th>
                <th className="px-2 py-2 text-center font-bold text-gray-600">오류</th>
                <th className="px-2 py-2 text-center font-bold text-gray-600">마지막 사용</th>
                <th className="px-2 py-2 text-center font-bold text-gray-600">상태</th>
                <th className="px-2 py-2 text-center font-bold text-gray-600 w-28">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => (
                <tr key={k.id} className={!k.enabled ? 'bg-gray-50 text-gray-400' : ''}>
                  <td className="px-2 py-2">
                    {editingId === k.id ? (
                      <input value={editDraft.label} onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })}
                        className="w-24 border border-gray-300 rounded px-1.5 py-0.5 text-xs outline-none focus:border-[#2ED573]" />
                    ) : (
                      <span className="font-medium">{k.label}</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {editingId === k.id ? (
                      <input value={editDraft.api_key} onChange={(e) => setEditDraft({ ...editDraft, api_key: e.target.value })}
                        className="w-full min-w-[240px] border border-gray-300 rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-[#2ED573] font-mono" />
                    ) : (
                      <code className="text-[10px] font-mono">
                        {showKeyId === k.id ? k.api_key : maskKey(k.api_key)}
                      </code>
                    )}
                    {editingId !== k.id && (
                      <button onClick={() => setShowKeyId(showKeyId === k.id ? null : k.id)}
                        className="ml-1 text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer"
                        title={showKeyId === k.id ? '가리기' : '보이기'}>
                        <i className={`ti ti-${showKeyId === k.id ? 'eye-off' : 'eye'} text-[10px]`} />
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-500">{k.use_count}</td>
                  <td className="px-2 py-2 text-center">
                    {k.error_count > 0 ? (
                      <span className="text-red-600" title={k.last_error_message || ''}>{k.error_count}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center text-[10px] text-gray-400">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button type="button" onClick={() => handleToggle(k)}
                      className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer border-none ${k.enabled ? 'bg-[#2ED573]' : 'bg-gray-300'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform shadow ${k.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-1">
                      {editingId === k.id ? (
                        <>
                          <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-800 bg-transparent border-none cursor-pointer" title="저장">
                            <i className="ti ti-check text-sm" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer" title="취소">
                            <i className="ti ti-x text-sm" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => beginEdit(k)} className="text-blue-500 hover:text-blue-700 bg-transparent border-none cursor-pointer" title="수정">
                            <i className="ti ti-pencil text-sm" />
                          </button>
                          <button onClick={() => handleDelete(k)} className="text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer" title="삭제">
                            <i className="ti ti-trash text-sm" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
