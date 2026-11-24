// 강의 플랜 옵션 편집 (베이직·마스터·프리미엄 등) — 강의 정보 탭.
// 플랜을 하나라도 '판매 중'으로 두면 상세 페이지에서 플랜을 골라 결제하고, 위의 강의 가격 대신 플랜 가격을 쓴다.
// 할인 기간은 강의의 할인 시작·종료를 같이 쓴다. 저장은 플랜마다 바로 된다(강의 저장 버튼과 별개).
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

type PlanDraft = {
  id?: number
  name: string
  description: string
  original_price: string
  sale_price: string
  installment_months: string
  max_enrollments: string
  duration_days: string
  is_active: boolean
  sort_order: number
  sold: number
  dirty?: boolean
}

type PlanRow = {
  id: number; name: string; description: string | null; original_price: number | null; sale_price: number | null
  installment_months: number; max_enrollments: number | null; duration_days: number | null; is_active: boolean; sort_order: number
}

const toDraft = (p: PlanRow, sold: number): PlanDraft => ({
  id: p.id,
  name: p.name,
  description: p.description ?? '',
  original_price: p.original_price == null ? '' : String(p.original_price),
  sale_price: p.sale_price == null ? '' : String(p.sale_price),
  installment_months: String(p.installment_months ?? 0),
  max_enrollments: p.max_enrollments == null ? '' : String(p.max_enrollments),
  duration_days: p.duration_days == null ? '' : String(p.duration_days),
  is_active: p.is_active,
  sort_order: p.sort_order,
  sold,
})

const numOrNull = (s: string) => (s.trim() === '' ? null : Math.max(0, Math.round(Number(s))))

const inputCls = 'w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-[#2ED573]'

export default function CoursePlansEditor({ courseId, onChange }: { courseId: number; onChange?: () => void }) {
  const [plans, setPlans] = useState<PlanDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [savingIdx, setSavingIdx] = useState<number | null>(null)

  const load = useCallback(async () => {
    const [{ data, error }, { data: counts }] = await Promise.all([
      supabase.from('course_plans' as never)
        .select('id, name, description, original_price, sale_price, installment_months, max_enrollments, duration_days, is_active, sort_order')
        .eq('course_id', courseId).order('sort_order').order('id'),
      supabase.rpc('get_course_plan_counts' as never, { p_course_id: courseId } as never),
    ])
    if (error) {
      // 플랜 DB(SQL)가 아직 적용되지 않은 환경
      setUnavailable(true)
      setLoading(false)
      return
    }
    const sold = new Map(((counts ?? []) as { plan_id: number; sold: number }[]).map((c) => [c.plan_id, Number(c.sold)]))
    setPlans(((data ?? []) as PlanRow[]).map((p) => toDraft(p, sold.get(p.id) ?? 0)))
    setLoading(false)
  }, [courseId])

  // load 는 서버 응답(await) 뒤에만 상태를 바꾼다 — 첫 화면 데이터 읽기
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const patch = (idx: number, v: Partial<PlanDraft>) =>
    setPlans((prev) => prev.map((p, i) => (i === idx ? { ...p, ...v, dirty: true } : p)))

  const addPlan = () => {
    const names = ['베이직', '마스터', '프리미엄']
    setPlans((prev) => [...prev, {
      name: names[prev.length] ?? '', description: '', original_price: '', sale_price: '', installment_months: '12',
      max_enrollments: '', duration_days: '', is_active: true, sort_order: prev.length + 1, sold: 0, dirty: true,
    }])
  }

  const save = async (idx: number) => {
    const p = plans[idx]
    if (!p.name.trim()) { toast.error('플랜 이름을 입력하세요.'); return }
    const original = numOrNull(p.original_price)
    const sale = numOrNull(p.sale_price)
    if (original == null && sale == null) { toast.error('정가 또는 할인가를 입력하세요.'); return }
    const row = {
      course_id: courseId,
      name: p.name.trim(),
      description: p.description.trim() || null,
      original_price: original,
      sale_price: sale,
      installment_months: numOrNull(p.installment_months) ?? 0,
      max_enrollments: numOrNull(p.max_enrollments) || null,
      duration_days: numOrNull(p.duration_days),
      is_active: p.is_active,
      sort_order: idx + 1,
      updated_at: new Date().toISOString(),
    }
    setSavingIdx(idx)
    const { error } = p.id
      ? await supabase.from('course_plans' as never).update(row as never).eq('id', p.id)
      : await supabase.from('course_plans' as never).insert(row as never)
    setSavingIdx(null)
    if (error) { toast.error(`플랜 저장 실패: ${error.message}`); return }
    toast.success(`'${row.name}' 플랜을 저장했습니다.`)
    await load()
    onChange?.()
  }

  const remove = async (idx: number) => {
    const p = plans[idx]
    if (!p.id) { setPlans((prev) => prev.filter((_, i) => i !== idx)); return }
    if (p.sold > 0) { toast.error('이미 판매된 플랜은 지울 수 없습니다. "판매 중" 체크를 끄고 저장하세요.'); return }
    if (!window.confirm(`'${p.name}' 플랜을 지울까요?`)) return
    const { error } = await supabase.from('course_plans' as never).delete().eq('id', p.id)
    if (error) { toast.error(`삭제 실패: ${error.message}`); return }
    await load()
    onChange?.()
  }

  if (unavailable) return null

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-bold">플랜 옵션</p>
          <p className="text-xs text-gray-400 mt-0.5">
            판매 중인 플랜이 있으면 상세 페이지에서 플랜을 골라 결제하고, 위의 정가·할인가·할부 대신 플랜 값을 씁니다. 할인 기간은 위 강의 설정을 같이 씁니다.
          </p>
        </div>
        <button type="button" onClick={addPlan}
          className="shrink-0 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573]">
          <i className="ti ti-plus text-xs" /> 플랜 추가
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse h-16 bg-gray-100 rounded-lg" />
      ) : plans.length === 0 ? (
        <p className="text-xs text-gray-400 py-3 text-center">플랜이 없습니다. 지금처럼 강의 가격 하나로 판매합니다.</p>
      ) : (
        <div className="space-y-3">
          {plans.map((p, idx) => (
            <div key={p.id ?? `new-${idx}`} className={`bg-white border rounded-lg p-3 ${p.dirty ? 'border-amber-300' : 'border-gray-200'}`}>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="w-[140px] max-sm:w-full">
                  <label className="text-xs font-bold text-gray-600 block mb-1">플랜 이름</label>
                  <input className={inputCls} value={p.name} placeholder="베이직" onChange={(e) => patch(idx, { name: e.target.value })} />
                </div>
                <div className="w-[120px] max-sm:w-[calc(50%-4px)]">
                  <label className="text-xs font-bold text-gray-600 block mb-1">정가 (원)</label>
                  <input type="number" min={0} className={inputCls} value={p.original_price} onChange={(e) => patch(idx, { original_price: e.target.value })} />
                </div>
                <div className="w-[120px] max-sm:w-[calc(50%-4px)]">
                  <label className="text-xs font-bold text-gray-600 block mb-1">할인가 (원)</label>
                  <input type="number" min={0} className={inputCls} value={p.sale_price} placeholder="없음" onChange={(e) => patch(idx, { sale_price: e.target.value })} />
                </div>
                <div className="w-[90px] max-sm:w-[calc(33%-6px)]">
                  <label className="text-xs font-bold text-gray-600 block mb-1">할부 (개월)</label>
                  <input type="number" min={0} className={inputCls} value={p.installment_months} onChange={(e) => patch(idx, { installment_months: e.target.value })} />
                </div>
                <div className="w-[100px] max-sm:w-[calc(33%-6px)]">
                  <label className="text-xs font-bold text-gray-600 block mb-1">모집 인원</label>
                  <input type="number" min={0} className={inputCls} value={p.max_enrollments} placeholder="무제한" onChange={(e) => patch(idx, { max_enrollments: e.target.value })} />
                </div>
                <div className="w-[100px] max-sm:w-[calc(33%-6px)]">
                  <label className="text-xs font-bold text-gray-600 block mb-1">수강 기간 (일)</label>
                  <input type="number" min={0} className={inputCls} value={p.duration_days} placeholder="강의 설정" onChange={(e) => patch(idx, { duration_days: e.target.value })} />
                </div>
              </div>
              <div className="mt-2">
                <input className={inputCls} value={p.description} placeholder="플랜 설명 (선택) — 예: 1:1 코칭 2회 포함" onChange={(e) => patch(idx, { description: e.target.value })} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={p.is_active} onChange={(e) => patch(idx, { is_active: e.target.checked })} /> 판매 중
                  </label>
                  {p.id && <span>판매 {p.sold.toLocaleString()}명{p.max_enrollments ? ` / ${Number(p.max_enrollments).toLocaleString()}명` : ''}</span>}
                  {p.dirty && <span className="text-amber-600 font-medium">저장 안 됨</span>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => remove(idx)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-500 cursor-pointer hover:text-red-500 hover:border-red-200">
                    삭제
                  </button>
                  <button type="button" onClick={() => save(idx)} disabled={savingIdx === idx}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border-none bg-[#2ED573] text-white cursor-pointer disabled:opacity-50">
                    {savingIdx === idx ? '저장 중...' : '플랜 저장'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
