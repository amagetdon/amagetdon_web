import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { webhookService } from '../../services/webhookService'

interface VarRow {
  id: number
  key: string
  value: string
  description: string
  sort_order: number
}

export default function CustomCanonicalVarsManager() {
  const [vars, setVars] = useState<VarRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<{ key: string; value: string; description: string }>({ key: '', value: '', description: '' })

  const fetchVars = useCallback(async () => {
    setLoading(true)
    try {
      const list = await webhookService.listCustomCanonicalVars()
      setVars(list)
    } catch {
      toast.error('변수 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchVars() }, [fetchVars])

  const validKey = (k: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)

  const handleAdd = async () => {
    const k = newKey.trim()
    if (!k) { toast.error('키를 입력해주세요.'); return }
    if (!validKey(k)) { toast.error('키는 영문/숫자/언더스코어만 가능 (예: open_chat_url)'); return }
    setAdding(true)
    try {
      await webhookService.upsertCustomCanonicalVar({
        key: k,
        value: newValue,
        description: newDesc,
        sort_order: vars.length,
      })
      toast.success('추가되었습니다.')
      setNewKey(''); setNewValue(''); setNewDesc('')
      fetchVars()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '추가 실패'
      toast.error(msg.includes('unique') || msg.includes('duplicate') ? '같은 키가 이미 있습니다.' : '추가 실패')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (v: VarRow) => {
    if (!confirm(`"{#${v.key}#}" 변수를 삭제합니다. 계속?`)) return
    try {
      await webhookService.deleteCustomCanonicalVar(v.id)
      toast.success('삭제되었습니다.')
      fetchVars()
    } catch {
      toast.error('삭제 실패')
    }
  }

  const beginEdit = (v: VarRow) => {
    setEditingId(v.id)
    setEditDraft({ key: v.key, value: v.value, description: v.description })
  }

  const saveEdit = async () => {
    if (editingId === null) return
    const k = editDraft.key.trim()
    if (!validKey(k)) { toast.error('키는 영문/숫자/언더스코어만 가능'); return }
    try {
      const v = vars.find((x) => x.id === editingId)
      if (!v) return
      await webhookService.upsertCustomCanonicalVar({
        id: v.id,
        key: k,
        value: editDraft.value,
        description: editDraft.description,
        sort_order: v.sort_order,
      })
      toast.success('수정되었습니다.')
      setEditingId(null)
      fetchVars()
    } catch {
      toast.error('수정 실패')
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-gray-900">
          <i className="ti ti-variable text-[#2ED573] mr-1" />
          사용자 정의 변수 (canonical)
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          사이트 전역 고정값(오픈카톡 링크, 홈페이지 URL 등)을 등록하면 <code className="bg-gray-100 px-1 rounded text-[10px]">{`{#키#}`}</code>로 모든 템플릿에서 참조할 수 있습니다.
          GPT-5.4-mini의 canonical 매핑 후보에도 자동 포함됩니다.
        </p>
      </div>

      {/* 신규 추가 */}
      <div className="border border-gray-200 rounded-xl p-3 mb-3 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_1fr_auto] gap-2 items-start">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)}
            placeholder="open_chat_url"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#2ED573] font-mono bg-white" />
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)}
            placeholder="값 (URL 등)"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#2ED573] bg-white" />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="설명 (GPT 힌트용, 선택)"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#2ED573] bg-white" />
          <button onClick={handleAdd} disabled={adding}
            className="bg-[#2ED573] text-white px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none hover:bg-[#25B866] disabled:opacity-50 whitespace-nowrap">
            {adding ? '추가 중...' : '추가'}
          </button>
        </div>
        <p className="text-[10px] text-gray-500 mt-2">
          <i className="ti ti-bulb mr-1" />
          예시: <code className="bg-white px-1 rounded">open_chat_url</code> = <code className="bg-white px-1 rounded">https://open.kakao.com/o/xxxxxx</code>
        </p>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-xs text-gray-400 text-center py-6">불러오는 중...</div>
      ) : vars.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-8">등록된 변수가 없습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left font-bold text-gray-600">키</th>
                <th className="px-2 py-2 text-left font-bold text-gray-600">값</th>
                <th className="px-2 py-2 text-left font-bold text-gray-600">설명</th>
                <th className="px-2 py-2 text-center font-bold text-gray-600 w-24">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vars.map((v) => (
                <tr key={v.id}>
                  <td className="px-2 py-2 font-mono">
                    {editingId === v.id ? (
                      <input value={editDraft.key} onChange={(e) => setEditDraft({ ...editDraft, key: e.target.value })}
                        className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs outline-none focus:border-[#2ED573] font-mono" />
                    ) : (
                      <code className="text-[#2ED573] bg-green-50 px-1.5 py-0.5 rounded text-[11px]">{`{#${v.key}#}`}</code>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {editingId === v.id ? (
                      <input value={editDraft.value} onChange={(e) => setEditDraft({ ...editDraft, value: e.target.value })}
                        className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs outline-none focus:border-[#2ED573]" />
                    ) : (
                      <span className="text-gray-700 break-all">{v.value}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-gray-500">
                    {editingId === v.id ? (
                      <input value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                        className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs outline-none focus:border-[#2ED573]" />
                    ) : (
                      v.description || <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-1">
                      {editingId === v.id ? (
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
                          <button onClick={() => beginEdit(v)} className="text-blue-500 hover:text-blue-700 bg-transparent border-none cursor-pointer" title="수정">
                            <i className="ti ti-pencil text-sm" />
                          </button>
                          <button onClick={() => handleDelete(v)} className="text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer" title="삭제">
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
