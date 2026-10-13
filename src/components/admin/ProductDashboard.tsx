import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

// 관리자 강의·전자책 상세의 '통합 대시보드' 탭.
// 집계는 서버 함수 get_product_dashboard(관리자 전용)가 하고, 여기서는 표시·연결 상품·광고비 입력만 한다.
//  - 유입 → 가입 → 신청 → 결제 : 가입·신청·결제는 전체 기간, 유입(방문)은 product_visits 기록 시작 후부터
//  - D-14 ~ 당일 : 라이브(진행일) 기준 신청일별 결제율
//  - 매체별 성별·연령대, 광고비·DB당 단가·결제당 비용·ROAS

type Kind = 'course' | 'ebook'
type Dim = 'campaign' | 'content' | 'term'

/** 신청자 행 — 매체 × 캠페인 × 소재 × 세트 */
interface AppRow {
  channel: string; campaign: string; content: string; term: string
  applicants: number; new_signups: number; payers: number; revenue: number
  male: number; female: number; gender_unknown: number; ages: Record<string, number>
}
/** 방문 행 (10/12~) */
interface VisitRow { channel: string; campaign: string; content: string; term: string; visitors: number; visit_applicants: number }
interface DdayRow { label: string; applicants: number; payers: number; revenue: number }
interface Dashboard {
  product: {
    kind: Kind; id: number; title: string; is_free: boolean; live_at: string | null; linked_default: boolean
    linked_courses: { id: number; title: string }[]; linked_ebooks: { id: number; title: string }[]
  }
  totals: { applicants: number; new_signups: number; payers: number; revenue: number; spend: number }
  visits: { since: string | null; visitors: number; applicants: number; payers: number }
  visit_rows: VisitRow[]
  rows: AppRow[]
  spend: Record<string, number>
  dday: DdayRow[] | null
}
interface SpendRow { id: number; channel: string; spend_date: string; amount: number; source: 'manual' | 'meta'; external_id: string | null; note: string | null }

/** 표 한 줄 (매체 또는 그 아래 파라미터 값) */
interface Agg {
  key: string; applicants: number; new_signups: number; payers: number; revenue: number
  male: number; female: number; gender_unknown: number; ages: Record<string, number>
  visitors: number; visit_applicants: number; spend: number
}

const CHANNEL_LABEL: Record<string, string> = {
  meta: '메타', naver: '네이버', kakao: '카카오', google: '구글', youtube: '유튜브', dable: '데이블',
  taboola: '타불라', tiktok: '틱톡', karrot: '당근', direct: '직접·미확인', other: '기타',
}
const DIM_LABEL: Record<Dim, string> = { campaign: '캠페인', content: '소재(content)', term: '세트(term)' }
const SPEND_CHANNELS = ['meta', 'kakao', 'naver', 'google', 'youtube', 'dable', 'taboola', 'tiktok', 'karrot', 'other']
const AGE_ORDER = ['10대', '20대', '30대', '40대', '50대', '60대+', '미상']

const label = (c: string) => CHANNEL_LABEL[c] ?? c
const n = (v: number) => Math.round(v).toLocaleString('ko-KR')
const won = (v: number) => `${n(v)}원`
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '-')
const per = (spend: number, cnt: number) => (spend > 0 && cnt > 0 ? won(spend / cnt) : '-')
const roas = (rev: number, spend: number) => (spend > 0 ? `${Math.round((rev / spend) * 100).toLocaleString('ko-KR')}%` : '-')
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
const kstDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

const emptyAgg = (key: string): Agg => ({
  key, applicants: 0, new_signups: 0, payers: 0, revenue: 0, male: 0, female: 0, gender_unknown: 0, ages: {},
  visitors: 0, visit_applicants: 0, spend: 0,
})

/** 신청자 행·방문 행을 keyFn 값별로 합친다 */
function aggregate(rows: AppRow[], visits: VisitRow[], keyFn: (r: { channel: string; campaign: string; content: string; term: string }) => string) {
  const m = new Map<string, Agg>()
  const get = (k: string) => { let a = m.get(k); if (!a) { a = emptyAgg(k); m.set(k, a) } return a }
  for (const r of rows) {
    const a = get(keyFn(r))
    a.applicants += r.applicants; a.new_signups += r.new_signups; a.payers += r.payers; a.revenue += Number(r.revenue)
    a.male += r.male; a.female += r.female; a.gender_unknown += r.gender_unknown
    for (const [age, c] of Object.entries(r.ages ?? {})) a.ages[age] = (a.ages[age] ?? 0) + c
  }
  for (const v of visits) {
    const a = get(keyFn(v))
    a.visitors += v.visitors; a.visit_applicants += v.visit_applicants
  }
  return [...m.values()].sort((x, y) => y.applicants - x.applicants || y.visitors - x.visitors)
}

export default function ProductDashboard({ kind, productId }: { kind: Kind; productId: number }) {
  const [data, setData] = useState<Dashboard | null>(null)
  const [spends, setSpends] = useState<SpendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [linkOpen, setLinkOpen] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [dim, setDim] = useState<Dim>('campaign')

  const load = useCallback(async () => {
    setLoading(true)
    const [dash, sp] = await Promise.all([
      supabase.rpc('get_product_dashboard', { p_kind: kind, p_id: productId } as never),
      supabase.from('product_ad_spend').select('id, channel, spend_date, amount, source, external_id, note')
        .eq('kind', kind).eq('product_id', productId).order('spend_date', { ascending: false }).order('id', { ascending: false }),
    ])
    if (dash.error) toast.error(`대시보드를 불러오지 못했습니다: ${dash.error.message}`)
    setData((dash.data as unknown as Dashboard | null) ?? null)
    setSpends((sp.data as SpendRow[]) ?? [])
    setLoading(false)
  }, [kind, productId])

  useEffect(() => { load() }, [load])

  // 매체별 합계 (광고비는 매체 단위로만 있음)
  const channels = useMemo(() => {
    if (!data) return []
    const list = aggregate(data.rows ?? [], data.visit_rows ?? [], (r) => r.channel)
    for (const [ch, s] of Object.entries(data.spend ?? {})) {
      let a = list.find((x) => x.key === ch)
      if (!a) { a = emptyAgg(ch); list.push(a) }
      a.spend = Number(s)
    }
    return list
  }, [data])

  // 펼친 매체의 파라미터별 줄
  const subRows = useCallback((ch: string) => {
    if (!data) return []
    return aggregate(
      (data.rows ?? []).filter((r) => r.channel === ch),
      (data.visit_rows ?? []).filter((v) => v.channel === ch),
      (r) => r[dim],
    )
  }, [data, dim])

  const toggle = (ch: string) => setOpen((prev) => { const s = new Set(prev); if (s.has(ch)) s.delete(ch); else s.add(ch); return s })

  if (loading && !data) {
    return <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="animate-pulse h-16 bg-gray-100 rounded" />)}</div>
  }
  if (!data) return <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400 text-sm">대시보드 데이터를 불러오지 못했습니다.</div>

  const { product, totals, visits } = data
  const linked = [...product.linked_courses.map((c) => ({ ...c, k: '강의' })), ...product.linked_ebooks.map((e) => ({ ...e, k: '전자책' }))]

  /** 매체 줄 + 펼친 하위 줄을 그리는 공용 표 */
  const ChannelTable = ({ headers, cells }: { headers: string[]; cells: (a: Agg, isChannel: boolean) => ReactNode[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50"><tr>
          {headers.map((h, i) => <th key={i} className="px-3 py-2 text-right first:text-left font-bold text-gray-600 whitespace-nowrap">{h}</th>)}
        </tr></thead>
        <tbody>
          {channels.map((c) => {
            const isOpen = open.has(c.key)
            return (
              <Fragment key={c.key}>
                <tr className="border-t border-gray-100 cursor-pointer hover:bg-gray-50" onClick={() => toggle(c.key)}>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                    <i className={`ti ${isOpen ? 'ti-chevron-down' : 'ti-chevron-right'} text-xs text-gray-400 mr-1`} />
                    {label(c.key)}
                  </td>
                  {cells(c, true).map((v, i) => <td key={i} className="px-3 py-2 text-right whitespace-nowrap">{v}</td>)}
                </tr>
                {isOpen && subRows(c.key).map((s) => (
                  <tr key={`${c.key}:${s.key}`} className="bg-gray-50/60 text-gray-600">
                    <td className="pl-8 pr-3 py-1.5 text-xs max-w-[260px] truncate" title={s.key}>{s.key || <span className="text-gray-400">(값 없음)</span>}</td>
                    {cells(s, false).map((v, i) => <td key={i} className="px-3 py-1.5 text-right text-xs whitespace-nowrap">{v}</td>)}
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  const DimPicker = () => (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-gray-400 mr-1">펼쳐 보기 기준</span>
      {(Object.keys(DIM_LABEL) as Dim[]).map((d) => (
        <button key={d} onClick={() => setDim(d)}
          className={`px-2.5 py-1 rounded-md border-none cursor-pointer ${dim === d ? 'bg-[#2ED573] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {DIM_LABEL[d]}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 결제 기준 */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-400 mb-1">결제 기준</p>
            {product.is_free ? (
              <p className="text-sm text-gray-700">
                이 {kind === 'course' ? '강의' : '전자책'}를 신청한 뒤{' '}
                {linked.length ? <b>{linked.map((l) => `[${l.k}] ${l.title}`).join(', ')}</b> : <b className="text-red-500">연결 상품 없음</b>}
                {' '}을(를) 구매하면 결제로 셉니다.
                {product.linked_default && <span className="ml-1 text-xs text-gray-400">(지정하지 않아 같은 강사의 유료 강의로 자동 적용)</span>}
              </p>
            ) : (
              <p className="text-sm text-gray-700">유료 상품 — 이 상품 구매가 곧 결제입니다.</p>
            )}
          </div>
          {product.is_free && (
            <button onClick={() => setLinkOpen(true)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-50 flex items-center gap-1.5">
              <i className="ti ti-link text-sm" /> 연결 상품 지정
            </button>
          )}
        </div>
      </section>

      {/* 핵심 숫자 */}
      <section className="grid grid-cols-4 max-md:grid-cols-2 gap-3">
        {[
          ['신청(DB)', `${n(totals.applicants)}명`],
          ['결제', `${n(totals.payers)}명 · ${pct(totals.payers, totals.applicants)}`],
          ['매출', won(totals.revenue)],
          ['광고비', won(totals.spend)],
          ['DB당 단가', per(totals.spend, totals.applicants)],
          ['결제당 비용', per(totals.spend, totals.payers)],
          ['ROAS', roas(totals.revenue, totals.spend)],
          ['라이브', product.live_at ? kstDateTime(product.live_at) : '-'],
        ].map(([k, v]) => (
          <div key={k} className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">{k}</p>
            <p className="text-lg font-bold text-gray-900">{v}</p>
          </div>
        ))}
      </section>

      {/* 퍼널 */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap mb-4">
          <h3 className="text-base font-bold text-gray-900">UTM 유입 → 가입 → 신청 → 결제</h3>
          <DimPicker />
        </div>
        <div className="grid grid-cols-4 max-md:grid-cols-2 gap-3 mb-2">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">유입 (이 페이지 방문자)</p>
            <p className="text-xl font-bold text-gray-900">{n(visits.visitors)}</p>
            <p className="text-xs text-gray-400">{visits.since ? `${kstDateTime(visits.since)}부터 · 브라우저 1개 = 1명` : '방문 기록 없음'}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">신규 가입</p>
            <p className="text-xl font-bold text-gray-900">{n(totals.new_signups)}</p>
            <p className="text-xs text-[#2ED573] font-bold">신청자 중 {pct(totals.new_signups, totals.applicants)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">신청</p>
            <p className="text-xl font-bold text-gray-900">{n(totals.applicants)}</p>
            <p className="text-xs text-[#2ED573] font-bold">방문 대비 {pct(visits.applicants, visits.visitors)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">결제</p>
            <p className="text-xl font-bold text-gray-900">{n(totals.payers)}</p>
            <p className="text-xs text-[#2ED573] font-bold">신청 대비 {pct(totals.payers, totals.applicants)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          가입·신청·결제는 전체 기간. 신규 가입 = 신청 전 24시간 안에 가입한 회원. 유입 = 이 상품 상세 페이지를 연 브라우저 수(사이트 전체 방문 아님, 기록 시작 후부터). 방문→신청 = 그 방문 이후에 신청한 비율(이미 신청한 사람의 재방문은 제외). 매체 줄을 누르면 {DIM_LABEL[dim]}별로 펼쳐집니다.
        </p>
        <ChannelTable
          headers={['매체', '페이지 방문', '방문→신청', '신규 가입', '신청', '신규 비율', '결제', '결제율']}
          cells={(a) => [
            a.visitors ? n(a.visitors) : '-',
            a.visitors ? pct(a.visit_applicants, a.visitors) : '-',
            n(a.new_signups), n(a.applicants), pct(a.new_signups, a.applicants), n(a.payers), pct(a.payers, a.applicants),
          ]}
        />
      </section>

      {/* D-14 ~ 당일 */}
      {data.dday && <DdaySection rows={data.dday} />}

      {/* 매체별 성과 */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
          <h3 className="text-base font-bold text-gray-900">매체별 광고 성과</h3>
          <DimPicker />
        </div>
        <p className="text-xs text-gray-400 mb-4">매체 = 이번 신청 직전 유입 경로(UTM) → 없으면 회원가입 때 경로. 광고비는 매체 단위(펼친 줄에는 없음).</p>
        <ChannelTable
          headers={['매체', '신청(DB)', '결제', '결제율', '매출', '광고비', 'DB당 단가', '결제당 비용', 'ROAS']}
          cells={(a, isChannel) => [
            n(a.applicants), n(a.payers), pct(a.payers, a.applicants), won(a.revenue),
            isChannel && a.spend ? won(a.spend) : '-',
            isChannel ? per(a.spend, a.applicants) : '-',
            isChannel ? per(a.spend, a.payers) : '-',
            isChannel ? <b>{roas(a.revenue, a.spend)}</b> : '-',
          ]}
        />
      </section>

      {/* 매체별 성별·연령대 */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap mb-4">
          <h3 className="text-base font-bold text-gray-900">매체별 성별·연령대 (신청자 기준)</h3>
          <DimPicker />
        </div>
        <ChannelTable
          headers={['매체', '신청', '남', '여', '미상', ...AGE_ORDER]}
          cells={(a) => [
            n(a.applicants),
            ...[a.male, a.female, a.gender_unknown].map((v) => <>{n(v)} <span className="text-xs text-gray-400">{pct(v, a.applicants)}</span></>),
            ...AGE_ORDER.map((age) => {
              const v = a.ages?.[age] ?? 0
              const share = a.applicants ? v / a.applicants : 0
              return v
                ? <span className="inline-block px-1.5 rounded" style={{ background: `rgba(46,213,115,${Math.min(0.08 + share * 0.7, 0.75)})` }}>{n(v)} <span className="text-xs text-gray-500">{pct(v, a.applicants)}</span></span>
                : <span className="text-gray-300">-</span>
            }),
          ]}
        />
      </section>

      <SpendSection kind={kind} productId={productId} rows={spends} onChanged={load} />

      {linkOpen && (
        <LinkModal kind={kind} productId={productId} current={product} onClose={() => setLinkOpen(false)} onSaved={() => { setLinkOpen(false); load() }} />
      )}
    </div>
  )
}

function DdaySection({ rows }: { rows: DdayRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.applicants))
  return (
    <section className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-base font-bold text-gray-900 mb-1">라이브 D-14 ~ 당일 신청일별 결제율</h3>
      <p className="text-xs text-gray-400 mb-4">신청한 날(한국 시간)이 라이브 며칠 전인지로 나눈 뒤, 그 신청자 중 결제한 비율</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>
            {['신청일', '신청', '', '결제', '결제율', '매출'].map((h, i) => <th key={i} className="px-3 py-2 text-right first:text-left font-bold text-gray-600 whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-gray-100">
                <td className="px-3 py-1.5 font-medium whitespace-nowrap">{r.label}</td>
                <td className="px-3 py-1.5 text-right">{n(r.applicants)}</td>
                <td className="px-3 py-1.5 w-[40%]">
                  <div className="h-3 bg-gray-100 rounded relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-gray-300" style={{ width: `${(r.applicants / max) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 bg-[#2ED573]" style={{ width: `${(r.payers / max) * 100}%` }} />
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right">{n(r.payers)}</td>
                <td className="px-3 py-1.5 text-right font-bold">{pct(r.payers, r.applicants)}</td>
                <td className="px-3 py-1.5 text-right text-gray-500">{r.revenue ? won(r.revenue) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SpendSection({ kind, productId, rows, onChanged }: { kind: Kind; productId: number; rows: SpendRow[]; onChanged: () => void }) {
  const [form, setForm] = useState({ channel: 'meta', spend_date: kstToday(), amount: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const metaRows = rows.filter((r) => r.source === 'meta')
  const manualRows = rows.filter((r) => r.source === 'manual')

  const add = async () => {
    const amount = Number(form.amount.replace(/[^\d.]/g, ''))
    if (!form.spend_date || !amount) return toast.error('날짜와 금액을 입력해주세요.')
    setSaving(true)
    const { error } = await supabase.from('product_ad_spend').insert({
      kind, product_id: productId, channel: form.channel, spend_date: form.spend_date, amount, note: form.note || null, source: 'manual',
    } as never)
    setSaving(false)
    if (error) return toast.error(`저장 실패: ${error.message}`)
    setForm((f) => ({ ...f, amount: '', note: '' }))
    onChanged()
  }

  const remove = async (id: number) => {
    if (!confirm('이 광고비 기록을 삭제할까요?')) return
    const { error } = await supabase.from('product_ad_spend').delete().eq('id', id)
    if (error) return toast.error(`삭제 실패: ${error.message}`)
    onChanged()
  }

  const syncMeta = async () => {
    setSyncing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/meta-ad-sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ action: 'sync', kind, product_id: productId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      toast.success(`메타 광고비 ${body.days ?? 0}일치를 가져왔습니다.`)
      onChanged()
    } catch (e) {
      toast.error(`메타 가져오기 실패: ${(e as Error).message}`)
    } finally {
      setSyncing(false)
    }
  }

  const metaTotal = useMemo(() => metaRows.reduce((s, r) => s + Number(r.amount), 0), [metaRows])

  return (
    <section className="bg-white rounded-xl shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-bold text-gray-900">광고비</h3>
        <MetaCampaignPicker kind={kind} productId={productId} onSync={syncMeta} syncing={syncing} />
      </div>

      {metaRows.length > 0 && (
        <p className="text-sm text-gray-600">메타 자동: 캠페인 {new Set(metaRows.map((r) => r.external_id)).size}개 · {metaRows.length}일치 · 합계 <b>{won(metaTotal)}</b></p>
      )}

      <div>
        <p className="text-xs font-bold text-gray-400 mb-2">직접 입력 (메타 외 매체, 또는 자동으로 못 가져오는 비용)</p>
        <div className="flex gap-2 flex-wrap items-end">
          <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            {SPEND_CHANNELS.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
          <input type="date" value={form.spend_date} onChange={(e) => setForm({ ...form, spend_date: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="금액(원)" inputMode="numeric" className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-[140px]" />
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="메모 (예: 카카오 비즈보드 10/1~10/7)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex-1 min-w-[200px]" />
          <button onClick={add} disabled={saving} className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold border-none cursor-pointer disabled:opacity-50">추가</button>
        </div>
      </div>

      {manualRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              {['날짜', '매체', '금액', '메모', ''].map((h, i) => <th key={i} className="px-3 py-2 text-left font-bold text-gray-600">{h}</th>)}
            </tr></thead>
            <tbody>
              {manualRows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 whitespace-nowrap">{r.spend_date}</td>
                  <td className="px-3 py-2">{label(r.channel)}</td>
                  <td className="px-3 py-2">{won(Number(r.amount))}</td>
                  <td className="px-3 py-2 text-gray-500">{r.note}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => remove(r.id)} className="text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer"><i className="ti ti-trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function MetaCampaignPicker({ kind, productId, onSync, syncing }: { kind: Kind; productId: number; onSync: () => void; syncing: boolean }) {
  const [ids, setIds] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; status: string }[] | null>(null)
  const [draft, setDraft] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('product_funnel_settings').select('meta_campaign_ids').eq('kind', kind).eq('product_id', productId).maybeSingle()
      .then(({ data }) => setIds(((data as { meta_campaign_ids?: string[] } | null)?.meta_campaign_ids) ?? []))
  }, [kind, productId])

  const openPicker = async () => {
    setOpen(true); setDraft(ids); setError('')
    if (campaigns) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/meta-ad-sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ action: 'campaigns' }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return setError(body.error || `HTTP ${res.status}`)
    setCampaigns(body.campaigns ?? [])
  }

  const save = async () => {
    const { error: e } = await supabase.from('product_funnel_settings')
      .upsert({ kind, product_id: productId, meta_campaign_ids: draft, updated_at: new Date().toISOString() } as never, { onConflict: 'kind,product_id' })
    if (e) return toast.error(`저장 실패: ${e.message}`)
    setIds(draft); setOpen(false)
    toast.success('메타 캠페인 연결을 저장했습니다.')
    if (draft.length) onSync()
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">메타 캠페인 {ids.length}개 연결</span>
      <button onClick={openPicker} className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-gray-50">캠페인 연결</button>
      <button onClick={onSync} disabled={syncing || ids.length === 0} className="bg-[#1877F2] text-white px-3 py-1.5 rounded-lg text-xs font-bold border-none cursor-pointer disabled:opacity-40">
        {syncing ? '가져오는 중…' : '메타 광고비 가져오기'}
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-[560px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <h4 className="font-bold">이 상품에 쓴 메타 캠페인 선택</h4>
              <p className="text-xs text-gray-400 mt-1">선택한 캠페인의 일별 지출이 이 상품 광고비로 들어갑니다. 한 캠페인을 여러 상품에 연결하면 중복으로 잡히니 주의하세요.</p>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {error ? <p className="text-sm text-red-500">{error}</p>
                : !campaigns ? <p className="text-sm text-gray-400">캠페인 목록을 불러오는 중…</p>
                : campaigns.length === 0 ? <p className="text-sm text-gray-400">캠페인이 없습니다.</p>
                : campaigns.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={draft.includes(c.id)} onChange={(e) => setDraft(e.target.checked ? [...draft, c.id] : draft.filter((x) => x !== c.id))} />
                    <span className="flex-1 min-w-0 truncate">{c.name}</span>
                    <span className={`text-xs ${c.status === 'ACTIVE' ? 'text-[#2ED573]' : 'text-gray-400'}`}>{c.status === 'ACTIVE' ? '진행 중' : '꺼짐'}</span>
                  </label>
                ))}
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm bg-gray-100 border-none cursor-pointer">취소</button>
              <button onClick={save} disabled={!!error || !campaigns} className="px-4 py-2 rounded-xl text-sm bg-[#2ED573] text-white font-bold border-none cursor-pointer disabled:opacity-40">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LinkModal({ kind, productId, current, onClose, onSaved }: {
  kind: Kind; productId: number; current: Dashboard['product']; onClose: () => void; onSaved: () => void
}) {
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([])
  const [ebooks, setEbooks] = useState<{ id: number; title: string }[]>([])
  const [selC, setSelC] = useState<number[]>(current.linked_default ? [] : current.linked_courses.map((c) => c.id))
  const [selE, setSelE] = useState<number[]>(current.linked_default ? [] : current.linked_ebooks.map((e) => e.id))
  const [q, setQ] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('courses').select('id, title').order('id', { ascending: false }),
      supabase.from('ebooks').select('id, title').order('id', { ascending: false }),
    ]).then(([c, e]) => {
      setCourses(((c.data ?? []) as { id: number; title: string }[]).filter((x) => !(kind === 'course' && x.id === productId)))
      setEbooks(((e.data ?? []) as { id: number; title: string }[]).filter((x) => !(kind === 'ebook' && x.id === productId)))
    })
  }, [kind, productId])

  const save = async () => {
    const { error } = await supabase.from('product_funnel_settings')
      .upsert({ kind, product_id: productId, linked_course_ids: selC, linked_ebook_ids: selE, updated_at: new Date().toISOString() } as never, { onConflict: 'kind,product_id' })
    if (error) return toast.error(`저장 실패: ${error.message}`)
    toast.success('연결 상품을 저장했습니다.')
    onSaved()
  }

  const match = (t: string) => !q || t.toLowerCase().includes(q.toLowerCase())
  const list = (items: { id: number; title: string }[], sel: number[], set: (v: number[]) => void) =>
    items.filter((i) => match(i.title) || sel.includes(i.id)).map((i) => (
      <label key={i.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
        <input type="checkbox" checked={sel.includes(i.id)} onChange={(e) => set(e.target.checked ? [...sel, i.id] : sel.filter((x) => x !== i.id))} />
        <span className="truncate">{i.title}</span>
      </label>
    ))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-[640px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100">
          <h4 className="font-bold">결제로 볼 상품 선택</h4>
          <p className="text-xs text-gray-400 mt-1">신청자가 신청 이후 이 상품들 중 하나라도 구매하면 결제로 셉니다. 아무것도 고르지 않으면 같은 강사의 유료 강의로 자동 적용됩니다.</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품명 검색" className="mt-3 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div className="p-5 overflow-y-auto flex-1 grid grid-cols-2 max-sm:grid-cols-1 gap-4">
          <div><p className="text-xs font-bold text-gray-500 mb-1">강의</p>{list(courses, selC, setSelC)}</div>
          <div><p className="text-xs font-bold text-gray-500 mb-1">전자책</p>{list(ebooks, selE, setSelE)}</div>
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm bg-gray-100 border-none cursor-pointer">취소</button>
          <button onClick={save} className="px-4 py-2 rounded-xl text-sm bg-[#2ED573] text-white font-bold border-none cursor-pointer">저장 ({selC.length + selE.length}개)</button>
        </div>
      </div>
    </div>
  )
}
