import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { reconcileService, type ReconcileResult, type ReconcileRow } from '../../services/reconcileService'

// 카드(토스) 결제 대조 — 토스 상점관리자에서 한 부분취소처럼 사이트에 반영되지 않은 금액 차이를 찾는다(10/21).
// 토스에는 조회만 한다. '맞추기'는 사이트 구매 금액만 바꾸고(수강권 그대로) 사유를 감사 로그에 남긴다.
const won = (n: number | null | undefined) => (n == null ? '-' : `${n.toLocaleString()}원`)
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-')

export default function TossReconcilePanel() {
  const [result, setResult] = useState<ReconcileResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)

  const run = async () => {
    if (loading) return
    setLoading(true)
    try {
      setResult(await reconcileService.run())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '대조에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const fix = async (r: ReconcileRow) => {
    if (r.expected == null || fixing) return
    const reason = window.prompt(
      `구매 ${r.purchase_id} 금액을 ${won(r.price)} → ${won(r.expected)}으로 맞춥니다.\n수강권·기간은 그대로이고, 사유가 기록됩니다.\n\n사유:`,
      r.toss_canceled ? `토스 부분취소 ${won(r.toss_canceled)} 반영(카드 결제 대조)` : '토스 결제 금액과 맞춤(카드 결제 대조)',
    )
    if (!reason || !reason.trim()) return
    setFixing(r.purchase_id)
    try {
      await reconcileService.setPrice(r.purchase_id, r.expected, reason.trim())
      toast.success(`구매 ${r.purchase_id} 금액을 ${won(r.expected)}으로 맞췄습니다.`)
      const again = await reconcileService.run([r.purchase_id])
      const nr = again.rows[0]
      setResult((prev) => {
        if (!prev || !nr) return prev
        const rows = prev.rows.map((x) => (x.purchase_id === nr.purchase_id ? nr : x))
        const failed = rows.filter((x) => x.error).length
        const mismatched = rows.filter((x) => !x.error && x.diff !== 0).length
        return { ...prev, rows, failed, mismatched, matched: rows.length - failed - mismatched }
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '금액 수정에 실패했습니다.')
    } finally {
      setFixing(null)
    }
  }

  const shown = (result?.rows ?? []).filter((r) => showAll || r.error || r.diff !== 0)

  return (
    <section className="bg-white rounded-xl shadow-sm p-5 mt-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-bold text-gray-900">카드 결제 대조 (토스)</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            사이트 카드 결제 금액을 토스에 남은 금액(부분취소 반영)과 비교합니다. 맞아야 할 금액 = 토스 잔액 + 같은 구매에 더해진 링크페이·무통장. 토스에는 조회만 합니다.
          </p>
        </div>
        <button type="button" onClick={run} disabled={loading}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50">
          {loading ? '토스에 조회하는 중…' : result ? '다시 대조하기' : '토스와 대조하기'}
        </button>
      </div>

      {result && (
        <>
          <div className="flex items-center gap-3 flex-wrap mt-4 text-sm">
            <span className="text-gray-600">대조 <b>{result.checked}</b>건</span>
            <span className="text-[#2ED573]">일치 <b>{result.matched}</b></span>
            <span className={result.mismatched ? 'text-red-500' : 'text-gray-400'}>금액 다름 <b>{result.mismatched}</b></span>
            <span className={result.failed ? 'text-amber-600' : 'text-gray-400'}>조회 실패 <b>{result.failed}</b></span>
            <label className="ml-auto text-xs text-gray-500 flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> 일치한 건도 보기
            </label>
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">사이트 금액과 토스 금액이 모두 맞습니다.</p>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">구매</th>
                    <th className="px-3 py-2 text-left">상품</th>
                    <th className="px-3 py-2 text-center">결제일</th>
                    <th className="px-3 py-2 text-right">사이트 금액</th>
                    <th className="px-3 py-2 text-right">토스 결제</th>
                    <th className="px-3 py-2 text-right">토스 취소</th>
                    <th className="px-3 py-2 text-right">토스 잔액</th>
                    <th className="px-3 py-2 text-right">링크페이·무통장</th>
                    <th className="px-3 py-2 text-right">맞아야 할 금액</th>
                    <th className="px-3 py-2 text-right">차이</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shown.map((r) => (
                    <tr key={r.purchase_id}>
                      <td className="px-3 py-2">
                        <Link to={`/admin/members?user=${r.user_id}`} className="text-blue-600 no-underline">#{r.purchase_id}</Link>
                        <span className="text-gray-300 ml-1">…{r.payment_key_tail}</span>
                      </td>
                      <td className="px-3 py-2 max-w-[220px] truncate" title={r.title ?? ''}>{r.title || '-'}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{day(r.purchased_at)}</td>
                      <td className="px-3 py-2 text-right font-medium">{won(r.price)}</td>
                      {r.error ? (
                        <td colSpan={6} className="px-3 py-2 text-amber-600">토스 조회 실패: {r.error}</td>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right">{won(r.toss_total)}</td>
                          <td className="px-3 py-2 text-right text-red-500" title={r.toss_last_canceled_at ? `마지막 취소 ${day(r.toss_last_canceled_at)}` : ''}>
                            {r.toss_canceled ? `−${won(r.toss_canceled)}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right">{won(r.toss_balance)}{r.toss_status && r.toss_status !== 'DONE' ? <span className="text-gray-400 ml-1">({r.toss_status})</span> : null}</td>
                          <td className="px-3 py-2 text-right">{r.extra_linkpay || r.extra_manual ? `+${won(r.extra_linkpay + r.extra_manual)}` : '-'}</td>
                          <td className="px-3 py-2 text-right font-bold">{won(r.expected)}</td>
                          <td className={`px-3 py-2 text-right font-bold ${r.diff ? 'text-red-500' : 'text-gray-400'}`}>{r.diff ? `${r.diff > 0 ? '+' : ''}${r.diff.toLocaleString()}원` : '0'}</td>
                        </>
                      )}
                      <td className="px-3 py-2 text-right">
                        {!r.error && r.diff !== 0 && r.expected != null && (
                          <button type="button" onClick={() => fix(r)} disabled={fixing === r.purchase_id}
                            className="px-2.5 py-1 rounded-md bg-red-50 text-red-600 font-bold border-none cursor-pointer hover:bg-red-100 disabled:opacity-50">
                            {fixing === r.purchase_id ? '처리 중…' : `${won(r.expected)}으로 맞추기`}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
