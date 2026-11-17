import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

// 관리자 강의·전자책 상세의 '통합 대시보드' 탭.
// 집계는 서버 함수 get_product_dashboard(관리자 전용)가 하고, 여기서는 표시·연결 상품·광고비 입력만 한다.
//  - 유입 → 가입 → 신청 → 결제 : 가입·신청·결제는 전체 기간, 유입(방문)은 product_visits 기록 시작 후부터
//  - D-14 ~ 당일 : 라이브(진행일) 기준 신청일별 결제율
//  - 매체별 성별·연령대, 광고비·DB당 단가·결제당 비용·ROAS
//  - 기수: [마감 처리] 시각을 경계로 방문·신청·결제·광고비를 기수별로 나눠 본다 (product_cohorts). 기수가 없으면 전체 기간.

type Kind = 'course' | 'ebook'
type Dim = 'campaign' | 'content' | 'term'

/** 신청자 행 — 매체 × 캠페인 × 소재 × 세트 */
interface AppRow {
  channel: string; campaign: string; content: string; term: string
  // purchase = 이번 신청 직전 경로로 분류, free = (유료 상품) 그 기록이 없어 무료 강의 신청 때 경로로 분류, signup = 둘 다 없어 회원가입 때 경로로 분류
  basis?: 'purchase' | 'free' | 'signup'
  applicants: number; new_signups: number; payers: number; revenue: number
  male: number; female: number; gender_unknown: number; ages: Record<string, number>
}
/** 방문 행 (10/12~) */
interface VisitRow { channel: string; campaign: string; content: string; term: string; visitors: number; visit_applicants: number }
interface DdayRow { label: string; applicants: number; payers: number; revenue: number }
/** 기수 — starts_at 이상 ~ ends_at 미만. starts_at null = 처음부터, ends_at null = 진행 중 */
interface Cohort { id: number; no: number; name: string; starts_at: string | null; ends_at: string | null; live_at: string | null; has_links: boolean }
interface Dashboard {
  cohorts?: Cohort[]
  product: {
    kind: Kind; id: number; title: string; is_free: boolean; live_at: string | null; linked_default: boolean
    cohort?: number | null; cohort_from?: string | null; cohort_to?: string | null
    linked_courses: { id: number; title: string }[]; linked_ebooks: { id: number; title: string }[]
  }
  totals: { applicants: number; new_signups: number; payers: number; revenue: number; spend: number }
  visits: {
    since: string | null; visitors: number; applicants: number; payers: number
    // Umami 로 채운 과거 방문 (자체 기록 시작 전)
    history_visitors: number; history_imported_at: string | null; history_cutoff: string | null
  }
  visit_rows: VisitRow[]
  rows: AppRow[]
  spend: Record<string, number>
  dday: DdayRow[] | null
  /** 무료 ↔ 본 강의 맞춰 보기 (서버 함수가 예전 것이면 없음) */
  match?: FreeMatch | PaidMatch | null
  free_rows?: FreeRouteRow[]
}
/** 무료 상품: 다른 계정(같은 전화번호)으로 결제한 사람 수, 무료 신청 기록과 이어지지 않은 연결 상품 결제 */
interface FreeMatch { mode: 'free'; phone_payers: number; unmatched_payers: number; unmatched_revenue: number }
/** 유료 상품: 무료 상품을 거친 결제 / 거치지 않은 결제 */
interface PaidMatch {
  mode: 'paid'; feeders: { kind: Kind; id: number; title: string }[]
  via_free_payers: number; via_free_revenue: number; phone_payers: number; no_free_payers: number; no_free_revenue: number
}
/** 유료 상품의 결제를 무료 상품 신청 경로로 다시 묶은 줄 — 무료 상품(kind·id) × 매체 × 캠페인 × 소재 × 세트 */
interface FreeRouteRow { kind: Kind; id: number; channel: string; campaign: string; content: string; term: string; payers: number; phone_payers: number; revenue: number }
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
const SIGNUP_MARK = ' (가입 경로)'
const FREE_MARK = ' (무료 신청 경로)'
const AGE_ORDER = ['10대', '20대', '30대', '40대', '50대', '60대+', '미상']

const label = (c: string) => CHANNEL_LABEL[c] ?? c
const n = (v: number) => Math.round(v).toLocaleString('ko-KR')
const won = (v: number) => `${n(v)}원`
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '-')
const per = (spend: number, cnt: number) => (spend > 0 && cnt > 0 ? won(spend / cnt) : '-')
const roas = (rev: number, spend: number) => (spend > 0 ? `${Math.round((rev / spend) * 100).toLocaleString('ko-KR')}%` : '-')
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
const kstDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
/** datetime-local 입력값 ↔ ISO (관리자 PC 시간 기준) */
const toInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso); const z = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
}
const fromInput = (v: string) => (v ? new Date(v).toISOString() : null)
const kstDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

const emptyAgg = (key: string): Agg => ({
  key, applicants: 0, new_signups: 0, payers: 0, revenue: 0, male: 0, female: 0, gender_unknown: 0, ages: {},
  visitors: 0, visit_applicants: 0, spend: 0,
})

/** 신청자 행·방문 행을 keyFn 값별로 합친다 */
function aggregate(rows: AppRow[], visits: VisitRow[], keyFn: (r: { channel: string; campaign: string; content: string; term: string; basis?: string }) => string) {
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
  const [importing, setImporting] = useState(false)
  const autoImported = useRef(false)
  // 보고 있는 기수 번호. undefined = 아직 안 정함(처음 열면 진행 중인 기수), null = 전체 기간
  const cohortRef = useRef<number | null | undefined>(undefined)
  const [cohortOpen, setCohortOpen] = useState(false)
  const [closing, setClosing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let c = cohortRef.current
    if (c === undefined) {
      const { data: ks } = await supabase.from('product_cohorts').select('no')
        .eq('kind', kind).eq('product_id', productId).order('no', { ascending: false }).limit(1)
      c = (ks as { no: number }[] | null)?.[0]?.no ?? null
      cohortRef.current = c
    }
    // 전체 기간은 기수 인자 없이 부른다 (기수 기능 적용 전 서버 함수와도 맞게)
    const args = c == null ? { p_kind: kind, p_id: productId } : { p_kind: kind, p_id: productId, p_cohort: c }
    const [dash, sp] = await Promise.all([
      supabase.rpc('get_product_dashboard', args as never),
      supabase.from('product_ad_spend').select('id, channel, spend_date, amount, source, external_id, note')
        .eq('kind', kind).eq('product_id', productId).order('spend_date', { ascending: false }).order('id', { ascending: false }),
    ])
    if (dash.error) toast.error(`대시보드를 불러오지 못했습니다: ${dash.error.message}`)
    setData((dash.data as unknown as Dashboard | null) ?? null)
    setSpends((sp.data as SpendRow[]) ?? [])
    setLoading(false)
  }, [kind, productId])

  useEffect(() => { cohortRef.current = undefined; load() }, [load])

  const pickCohort = (no: number | null) => { cohortRef.current = no; load() }

  // 마감 처리 — 지금 기수를 닫고 다음 기수를 연다. 이후 기록은 다음 기수로 집계된다.
  const closeCohort = async () => {
    const list = data?.cohorts ?? []
    const cur = list.find((k) => !k.ends_at)
    if (list.length && !cur) return toast.error('진행 중인 기수가 없습니다.')
    const curName = cur?.name ?? '1기'
    const nextNo = (cur?.no ?? 1) + 1
    if (!confirm(`지금 시각으로 ${curName}를 마감하고 ${nextNo}기를 시작할까요?\n\n이 시각 이후의 방문·신청·결제·광고비는 ${nextNo}기로 집계됩니다.\n마감 시각은 [기수 관리]에서 고치거나 취소할 수 있습니다.`)) return
    setClosing(true)
    const { error } = await supabase.rpc('close_product_cohort', { p_kind: kind, p_id: productId } as never)
    setClosing(false)
    if (error) return toast.error(`마감 처리 실패: ${error.message}`)
    toast.success(`${curName}를 마감하고 ${nextNo}기를 시작했습니다.`)
    cohortRef.current = undefined
    load()
  }

  // 과거 방문(Umami) 가져오기 — 아직 한 번도 안 가져왔으면 대시보드를 열 때 자동으로 1회
  const importHistory = useCallback(async (silent = false) => {
    setImporting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/umami-import', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ kind, product_id: productId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      if (!silent) toast.success(`과거 방문 ${Number(body.visitors ?? 0).toLocaleString('ko-KR')}명을 Umami 에서 가져왔습니다.`)
      await load()
    } catch (e) {
      toast.error(`과거 방문 가져오기 실패: ${(e as Error).message}`)
    } finally {
      setImporting(false)
    }
  }, [kind, productId, load])

  useEffect(() => {
    // 과거 방문은 전체 보기에서만 자동으로 가져온다 (기수 보기에서는 첫 기수 외엔 과거 방문이 원래 비어 있음)
    if (!data || autoImported.current || data.visits?.history_imported_at || data.product.cohort != null) return
    autoImported.current = true
    importHistory(true)
  }, [data, importHistory])

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
      // 가입 경로로 분류된 신청자는 같은 값이라도 따로 묶어 '(가입 경로)' 로 표시 — 방문(이번 경로)과 섞이지 않게
      (r) => ('basis' in r && r[dim] ? (r.basis === 'signup' ? `${r[dim]}${SIGNUP_MARK}` : r.basis === 'free' ? `${r[dim]}${FREE_MARK}` : r[dim]) : r[dim]),
    )
  }, [data, dim])

  const toggle = (ch: string) => setOpen((prev) => { const s = new Set(prev); if (s.has(ch)) s.delete(ch); else s.add(ch); return s })

  if (loading && !data) {
    return <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="animate-pulse h-16 bg-gray-100 rounded" />)}</div>
  }
  if (!data) return <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400 text-sm">대시보드 데이터를 불러오지 못했습니다.</div>

  const { product, totals, visits } = data
  const hasHistory = !!visits.history_imported_at
  const allVisitors = visits.visitors + (visits.history_visitors ?? 0)
  // 과거 방문은 회원과 연결할 수 없어 '방문→신청' 을 신청 수 ÷ 방문자 수로 본다 (과거를 안 가져왔으면 자체 기록끼리만)
  const visitRate = (a: { applicants: number; visit_applicants: number; visitors: number }) =>
    a.visitors ? (hasHistory ? pct(a.applicants, a.visitors) : pct(a.visit_applicants, a.visitors)) : '-'
  const cohorts = data.cohorts ?? []
  const curCohort = cohorts.find((k) => k.no === product.cohort) ?? null
  // 광고비 목록도 보고 있는 기수 날짜만 (서버 합계와 같은 기준: 시작일 포함, 마감일 제외)
  const spendRows = spends.filter((r) =>
    (!product.cohort_from || r.spend_date >= kstDate(product.cohort_from)) && (!product.cohort_to || r.spend_date < kstDate(product.cohort_to)))
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
                    <td className="pl-8 pr-3 py-1.5 text-xs max-w-[260px] truncate" title={s.key}>
                      {!s.key ? <span className="text-gray-400">(값 없음)</span>
                        : s.key.endsWith(SIGNUP_MARK) ? <>{s.key.slice(0, -SIGNUP_MARK.length)}<span className="text-gray-400" title="이번 신청 경로 기록이 없어(10/12 이전 신청) 회원가입 때 UTM 으로 분류">{SIGNUP_MARK}</span></>
                        : s.key.endsWith(FREE_MARK) ? <>{s.key.slice(0, -FREE_MARK.length)}<span className="text-gray-400" title="결제 직전 경로 기록이 없어(링크페이·무통장·부여 등) 무료 강의 신청 때 경로로 분류">{FREE_MARK}</span></>
                        : s.key}
                    </td>
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
      {/* 기수 */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-400 mb-2">기수</p>
            {cohorts.length === 0 ? (
              <p className="text-sm text-gray-700">기수 구분 없이 전체 기간을 보고 있습니다. 이번 기수가 끝나면 <b>마감 처리</b>를 눌러 주세요. 그 뒤 기록은 다음 기수로 따로 집계됩니다.</p>
            ) : (
              <>
                <div className="flex items-center gap-1 flex-wrap">
                  {[{ no: null as number | null, name: '전체', open: false }, ...cohorts.map((k) => ({ no: k.no as number | null, name: k.name, open: !k.ends_at }))].map((k) => (
                    <button key={k.no ?? 'all'} onClick={() => pickCohort(k.no)} disabled={loading}
                      className={`px-3 py-1.5 rounded-lg text-sm border-none cursor-pointer disabled:cursor-wait ${(product.cohort ?? null) === k.no ? 'bg-[#2ED573] text-white font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {k.name}{k.open ? ' · 진행 중' : ''}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {curCohort
                    ? `${curCohort.starts_at ? kstDateTime(curCohort.starts_at) : '처음'}부터 ${curCohort.ends_at ? `${kstDateTime(curCohort.ends_at)} 마감까지` : '지금까지 (진행 중)'}의 방문·신청·결제·광고비입니다.`
                    : '모든 기수를 합친 전체 기간입니다.'}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {cohorts.length > 0 && (
              <button onClick={() => setCohortOpen(true)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-50 flex items-center gap-1.5">
                <i className="ti ti-settings text-sm" /> 기수 관리
              </button>
            )}
            <button onClick={closeCohort} disabled={closing || loading} className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold border-none cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
              <i className="ti ti-flag text-sm" /> {closing ? '처리 중…' : '마감 처리'}
            </button>
          </div>
        </div>
      </section>

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
                {curCohort?.has_links && <span className="ml-1 text-xs text-gray-400">({curCohort.name}에만 적용되는 연결)</span>}
              </p>
            ) : (
              <p className="text-sm text-gray-700">유료 상품 — 이 상품 구매가 곧 결제입니다.</p>
            )}
            {data.match?.mode === 'free' && (data.match.phone_payers > 0 || data.match.unmatched_payers > 0) && (
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {data.match.phone_payers > 0 && <>결제 {n(totals.payers)}명 가운데 <b>{n(data.match.phone_payers)}명</b>은 신청한 계정과 다른 계정(같은 전화번호)으로 결제했습니다. </>}
                {data.match.unmatched_payers > 0 && <>이 밖에 무료 신청 기록 없이(또는 신청 전에) 연결 상품을 결제한 <b>{n(data.match.unmatched_payers)}명 · {won(data.match.unmatched_revenue)}</b>은 위 결제·매출에 들어 있지 않습니다. 매출 {won(totals.revenue)} + {won(data.match.unmatched_revenue)} = 연결 상품 매출 <b>{won(Number(totals.revenue) + Number(data.match.unmatched_revenue))}</b>.</>}
              </p>
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
            <p className="text-xl font-bold text-gray-900">{n(allVisitors)}</p>
            <p className="text-xs text-gray-400">
              {importing ? 'Umami 에서 과거 방문 가져오는 중…'
                : hasHistory ? <>과거 {n(visits.history_visitors)} (Umami) + 최근 {n(visits.visitors)} (자체 기록) <button onClick={() => importHistory()} className="ml-1 underline bg-transparent border-none p-0 text-gray-400 cursor-pointer text-xs">다시 가져오기</button></>
                : visits.since ? `${kstDateTime(visits.since)}부터 · 브라우저 1개 = 1명` : '방문 기록 없음'}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">신규 가입</p>
            <p className="text-xl font-bold text-gray-900">{n(totals.new_signups)}</p>
            <p className="text-xs text-[#2ED573] font-bold">신청자 중 {pct(totals.new_signups, totals.applicants)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">신청</p>
            <p className="text-xl font-bold text-gray-900">{n(totals.applicants)}</p>
            <p className="text-xs text-[#2ED573] font-bold">방문 대비 {hasHistory ? pct(totals.applicants, allVisitors) : pct(visits.applicants, visits.visitors)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">결제</p>
            <p className="text-xl font-bold text-gray-900">{n(totals.payers)}</p>
            <p className="text-xs text-[#2ED573] font-bold">신청 대비 {pct(totals.payers, totals.applicants)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          가입·신청·결제는 전체 기간. 신규 가입 = 신청 전 24시간 안에 가입한 회원. 유입 = 이 상품 상세 페이지를 연 사람 수(사이트 전체 방문 아님). 10/12 밤 이전은 Umami, 이후는 자체 기록. 방문→신청 = 신청 수 ÷ 방문자 수(과거 방문은 회원과 연결할 수 없어 근사치). 매체 줄을 누르면 {DIM_LABEL[dim]}별로 펼쳐집니다.
        </p>
        <ChannelTable
          headers={['매체', '페이지 방문', '방문→신청', '신규 가입', '신청', '신규 비율', '결제', '결제율']}
          cells={(a) => [
            a.visitors ? n(a.visitors) : '-',
            visitRate(a),
            n(a.new_signups), n(a.applicants), pct(a.new_signups, a.applicants), n(a.payers), pct(a.payers, a.applicants),
          ]}
        />
      </section>

      {/* 게시글 경유 (강의만) */}
      {kind === 'course' && <BoardFunnelSection courseId={productId} />}

      {/* D-14 ~ 당일 */}
      {data.dday && <DdaySection rows={data.dday} />}

      {/* 매체별 성과 — 무료 상품을 거쳐 오는 유료 상품은 아래 '무료 강의 신청 경로' 표만 보여 준다(경로 표가 둘이면 헷갈림) */}
      {!(data.match?.mode === 'paid' && data.match.feeders.length > 0) && <section className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
          <h3 className="text-base font-bold text-gray-900">매체별 광고 성과</h3>
          <DimPicker />
        </div>
        <p className="text-xs text-gray-400 mb-4">
          {product.is_free
            ? '매체 = 이번 신청 직전 유입 경로(UTM) → 없으면 회원가입 때 경로.'
            : '매체 = 결제 직전 유입 경로(UTM) → 없으면(링크페이·무통장·부여 등) 무료 강의 신청 때 경로 → 그것도 없으면 회원가입 때 경로.'}
          {' '}광고비는 매체 단위(펼친 줄에는 없음).
        </p>
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
      </section>}

      {/* 무료 강의 신청 경로로 본 결제 (유료 상품) */}
      {data.match?.mode === 'paid' && (
        <FreeRouteSection match={data.match} rows={data.free_rows ?? []} dim={dim} dimPicker={<DimPicker />} totalPayers={totals.payers} />
      )}

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

      <SpendSection kind={kind} productId={productId} rows={spendRows} onChanged={load} />

      {cohortOpen && (
        <CohortModal kind={kind} productId={productId} cohorts={cohorts} onClose={() => setCohortOpen(false)}
          onSaved={(reset) => { setCohortOpen(false); if (reset) cohortRef.current = undefined; load() }} />
      )}
      {linkOpen && (
        <LinkModal kind={kind} productId={productId} current={product} cohort={curCohort} onClose={() => setLinkOpen(false)} onSaved={() => { setLinkOpen(false); load() }} />
      )}
    </div>
  )
}

const feederKey = (f: { kind: Kind; id: number }) => `${f.kind}:${f.id}`
/** 무료 신청 경로 줄을 keyFn 값별로 합친다 */
function sumFreeRoutes(list: FreeRouteRow[], keyFn: (r: FreeRouteRow) => string) {
  const m = new Map<string, { key: string; payers: number; phone: number; revenue: number }>()
  for (const r of list) {
    const k = keyFn(r)
    const a = m.get(k) ?? { key: k, payers: 0, phone: 0, revenue: 0 }
    a.payers += r.payers; a.phone += r.phone_payers; a.revenue += Number(r.revenue)
    m.set(k, a)
  }
  return [...m.values()].sort((x, y) => y.payers - x.payers || y.revenue - x.revenue)
}

/** 유료 상품: 결제를 '무료 강의 신청 때 경로'로 다시 묶어 본다 — 무료 강의 대시보드의 매체별 결제와 같은 기준 */
function FreeRouteSection({ match, rows, dim, dimPicker, totalPayers }: { match: PaidMatch; rows: FreeRouteRow[]; dim: Dim; dimPicker: ReactNode; totalPayers: number }) {
  // 무료 상품별 결제자 수 (많은 순)
  const feeders = useMemo(() => match.feeders
    .map((f) => ({ ...f, payers: rows.filter((r) => feederKey(r) === feederKey(f)).reduce((s, r) => s + r.payers, 0) }))
    .sort((a, b) => b.payers - a.payers), [match.feeders, rows])
  const [picked, setPicked] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const cur = feeders.find((f) => feederKey(f) === picked) ?? feeders[0] ?? null
  const curKey = cur ? feederKey(cur) : null
  const mine = useMemo(() => (curKey ? rows.filter((r) => feederKey(r) === curKey) : []), [rows, curKey])
  const channels = sumFreeRoutes(mine, (r) => r.channel)
  const total = channels.reduce((s, c) => ({ payers: s.payers + c.payers, revenue: s.revenue + c.revenue }), { payers: 0, revenue: 0 })
  const toggle = (ch: string) => setOpen((prev) => { const s = new Set(prev); if (s.has(ch)) s.delete(ch); else s.add(ch); return s })

  return (
    <section className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
        <h3 className="text-base font-bold text-gray-900">무료 강의 신청 경로로 본 결제</h3>
        {dimPicker}
      </div>
      <p className="text-xs text-gray-400 mb-3 leading-relaxed">
        결제자가 그 전에 신청한 무료 강의·전자책의 유입 경로로 결제를 다시 묶었습니다. 무료 쪽 통합 대시보드의 매체별 결제·매출과 같은 기준이라 서로 맞춰 볼 수 있습니다.
        신청한 계정과 결제한 계정이 달라도 전화번호가 같으면 같은 사람으로 봅니다.
      </p>
      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-3 mb-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">무료 강의·전자책을 거친 결제</p>
          <p className="text-xl font-bold text-gray-900">{n(match.via_free_payers)}명 <span className="text-xs font-normal text-gray-400">{pct(match.via_free_payers, totalPayers)}</span></p>
          <p className="text-xs text-gray-500">{won(match.via_free_revenue)}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">그중 다른 계정(같은 전화번호)으로 결제</p>
          <p className="text-xl font-bold text-gray-900">{n(match.phone_payers)}명</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">무료 신청 기록 없이 결제</p>
          <p className="text-xl font-bold text-gray-900">{n(match.no_free_payers)}명</p>
          <p className="text-xs text-gray-500">{won(match.no_free_revenue)}</p>
        </div>
      </div>
      {!cur ? (
        <p className="text-sm text-gray-400">이 상품으로 이어진 무료 강의·전자책 신청 기록이 없습니다.</p>
      ) : (
        <>
          <div className="flex items-center gap-1 flex-wrap mb-3">
            {feeders.map((f) => (
              <button key={feederKey(f)} onClick={() => { setPicked(feederKey(f)); setOpen(new Set()) }} title={f.title}
                className={`px-3 py-1.5 rounded-lg text-xs border-none cursor-pointer max-w-[280px] truncate ${feederKey(f) === curKey ? 'bg-[#2ED573] text-white font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                [{f.kind === 'course' ? '강의' : '전자책'} {f.id}] {f.title} · {n(f.payers)}명
              </button>
            ))}
          </div>
          {feeders.length > 1 && <p className="text-xs text-gray-400 mb-2">한 사람이 무료 상품을 여러 개 신청했으면 각 무료 상품에 모두 잡힙니다(무료 쪽 대시보드와 같게). 그래서 무료 상품별 합은 위 '거친 결제'보다 클 수 있습니다.</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                {['무료 신청 때 매체', '결제', '그중 다른 계정', '매출', '매출 비중'].map((h, i) => <th key={i} className="px-3 py-2 text-right first:text-left font-bold text-gray-600 whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {channels.map((c) => {
                  const isOpen = open.has(c.key)
                  return (
                    <Fragment key={c.key}>
                      <tr className="border-t border-gray-100 cursor-pointer hover:bg-gray-50" onClick={() => toggle(c.key)}>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">
                          <i className={`ti ${isOpen ? 'ti-chevron-down' : 'ti-chevron-right'} text-xs text-gray-400 mr-1`} />{label(c.key)}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{n(c.payers)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{c.phone ? n(c.phone) : '-'}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{won(c.revenue)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{pct(c.revenue, total.revenue)}</td>
                      </tr>
                      {isOpen && sumFreeRoutes(mine.filter((r) => r.channel === c.key), (r) => r[dim]).map((s) => (
                        <tr key={`${c.key}:${s.key}`} className="bg-gray-50/60 text-gray-600">
                          <td className="pl-8 pr-3 py-1.5 text-xs max-w-[260px] truncate" title={s.key}>{s.key || <span className="text-gray-400">(값 없음)</span>}</td>
                          <td className="px-3 py-1.5 text-right text-xs whitespace-nowrap">{n(s.payers)}</td>
                          <td className="px-3 py-1.5 text-right text-xs whitespace-nowrap">{s.phone ? n(s.phone) : '-'}</td>
                          <td className="px-3 py-1.5 text-right text-xs whitespace-nowrap">{won(s.revenue)}</td>
                          <td className="px-3 py-1.5 text-right text-xs whitespace-nowrap">{pct(s.revenue, c.revenue)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
                <tr className="border-t border-gray-200 font-bold">
                  <td className="px-3 py-2">합계</td>
                  <td className="px-3 py-2 text-right">{n(total.payers)}</td>
                  <td className="px-3 py-2 text-right" />
                  <td className="px-3 py-2 text-right">{won(total.revenue)}</td>
                  <td className="px-3 py-2 text-right" />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
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

// 기수 관리 — 이름·마감 시각·라이브 일시 고치기, 마지막 마감 처리 취소.
// 마감 시각을 고치면 다음 기수의 시작도 같은 시각으로 맞춘다 (기수 사이에 빈 구간·겹침이 없게).
function CohortModal({ kind, productId, cohorts, onClose, onSaved }: {
  kind: Kind; productId: number; cohorts: Cohort[]; onClose: () => void; onSaved: (reset: boolean) => void
}) {
  const [rows, setRows] = useState(() => cohorts.map((k) => ({ ...k, name_in: k.name, ends_in: toInput(k.ends_at), live_in: toInput(k.live_at) })))
  const [busy, setBusy] = useState(false)
  const set = (no: number, patch: Partial<{ name_in: string; ends_in: string; live_in: string }>) =>
    setRows((rs) => rs.map((r) => (r.no === no ? { ...r, ...patch } : r)))

  const save = async () => {
    // 바뀐 마감 시각만 반영한 경계로 검사
    const ends = rows.map((r) => (r.ends_at && r.ends_in !== toInput(r.ends_at) ? fromInput(r.ends_in) : r.ends_at))
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.name_in.trim()) return toast.error('기수 이름을 입력해주세요.')
      if (r.ends_at && !r.ends_in) return toast.error(`${r.name} 마감 시각을 입력해주세요.`)
      const start = i === 0 ? r.starts_at : ends[i - 1]
      if (ends[i] && start && new Date(ends[i]!) <= new Date(start)) return toast.error(`${r.name} 마감 시각이 시작보다 빠릅니다.`)
      if (ends[i] && new Date(ends[i]!).getTime() > Date.now()) return toast.error(`${r.name} 마감 시각은 지금보다 뒤일 수 없습니다.`)
    }
    setBusy(true)
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const patch: Record<string, unknown> = {}
        if (r.name_in.trim() !== r.name) patch.name = r.name_in.trim()
        if (r.live_in !== toInput(r.live_at)) patch.live_at = fromInput(r.live_in)
        if (ends[i] !== r.ends_at) patch.ends_at = ends[i]
        if (i > 0 && ends[i - 1] !== rows[i - 1].ends_at) patch.starts_at = ends[i - 1]
        if (!Object.keys(patch).length) continue
        const { error } = await supabase.from('product_cohorts').update(patch as never).eq('id', r.id)
        if (error) throw new Error(error.message)
      }
      toast.success('기수 정보를 저장했습니다.')
      onSaved(false)
    } catch (e) {
      toast.error(`저장 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    const last = rows[rows.length - 1]
    const prev = rows[rows.length - 2]
    if (!prev) return
    if (!confirm(`${prev.name} 마감 처리를 취소할까요?\n\n${last.name}가 없어지고, ${last.name}에 쌓인 기록은 다시 ${prev.name}로 집계됩니다. (신청·결제 데이터는 지워지지 않습니다)`)) return
    setBusy(true)
    const { error } = await supabase.rpc('reopen_product_cohort', { p_kind: kind, p_id: productId } as never)
    setBusy(false)
    if (error) return toast.error(`취소 실패: ${error.message}`)
    toast.success('마감 처리를 취소했습니다.')
    onSaved(true)
  }

  const inputCls = 'w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm'
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-[760px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100">
          <h4 className="font-bold">기수 관리</h4>
          <p className="text-xs text-gray-400 mt-1">마감 시각을 고치면 다음 기수의 시작도 같은 시각으로 바뀝니다. 신청·결제 데이터는 바뀌지 않고, 어느 기수로 집계할지만 달라집니다.</p>
        </div>
        <div className="p-5 overflow-y-auto flex-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500">
              <th className="pb-2 pr-2 font-bold">이름</th><th className="pb-2 pr-2 font-bold">시작</th>
              <th className="pb-2 pr-2 font-bold">마감</th><th className="pb-2 font-bold">라이브 일시</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="py-2 pr-2 w-[110px]"><input value={r.name_in} onChange={(e) => set(r.no, { name_in: e.target.value })} className={inputCls} /></td>
                  <td className="py-2 pr-2 text-gray-500 whitespace-nowrap">{i === 0 ? (r.starts_at ? kstDateTime(r.starts_at) : '처음부터') : '앞 기수 마감과 같음'}</td>
                  <td className="py-2 pr-2">
                    {r.ends_at
                      ? <input type="datetime-local" value={r.ends_in} onChange={(e) => set(r.no, { ends_in: e.target.value })} className={inputCls} />
                      : <span className="text-[#2ED573] font-bold">진행 중</span>}
                  </td>
                  <td className="py-2"><input type="datetime-local" value={r.live_in} onChange={(e) => set(r.no, { live_in: e.target.value })} className={inputCls} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-3">라이브 일시는 D-14 ~ 당일 표의 기준입니다. 비워 두면 강의에 등록된 진행일을 씁니다.</p>
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-between gap-2 flex-wrap">
          <button onClick={undo} disabled={busy || rows.length < 2} className="px-4 py-2 rounded-xl text-sm bg-white border border-gray-200 text-red-500 cursor-pointer disabled:opacity-40">마지막 마감 처리 취소</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm bg-gray-100 border-none cursor-pointer">닫기</button>
            <button onClick={save} disabled={busy} className="px-4 py-2 rounded-xl text-sm bg-[#2ED573] text-white font-bold border-none cursor-pointer disabled:opacity-50">저장</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function LinkModal({ kind, productId, current, cohort, onClose, onSaved }: {
  kind: Kind; productId: number; current: Dashboard['product']; cohort: Cohort | null; onClose: () => void; onSaved: () => void
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
    // 기수를 보고 있으면 그 기수에만 저장한다 (다른 기수 숫자는 그대로). 아무것도 안 고르면 기수 지정을 풀어 상품 공통 설정을 따른다.
    const none = selC.length + selE.length === 0
    const { error } = cohort
      ? await supabase.from('product_cohorts').update({ linked_course_ids: none ? null : selC, linked_ebook_ids: none ? null : selE } as never).eq('id', cohort.id)
      : await supabase.from('product_funnel_settings')
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
          <h4 className="font-bold">결제로 볼 상품 선택{cohort ? ` — ${cohort.name}` : ''}</h4>
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

// 게시글 경유 퍼널 — 본문에 이 강의 링크가 있는 게시글별 방문자 → 같은 방문자의 강의 페이지 방문 → 신청 (RPC get_course_board_funnel)
// 방문자는 브라우저 방문자 ID 기준(UTM 이 빠져도 이어짐), 신청은 로그인으로 연결된 방문자만. 게시글 방문 기록은 적용일부터 쌓인다.
function BoardFunnelSection({ courseId }: { courseId: number }) {
  const [rows, setRows] = useState<{ post_id: number; title: string; visitors: number; moved: number; enrolled: number }[] | null>(null)
  useEffect(() => {
    let active = true
    supabase.rpc('get_course_board_funnel', { p_course_id: courseId } as never).then(({ data, error }) => {
      if (active) setRows(error ? [] : ((data ?? []) as typeof rows & object))
    })
    return () => { active = false }
  }, [courseId])
  if (!rows || rows.length === 0) return null
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '-')
  return (
    <section className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-base font-bold text-gray-900 mb-1">게시글 경유 (게시글 방문 → 강의 이동 → 신청)</h3>
      <p className="text-xs text-gray-400 mb-4">본문에 이 강의 링크가 있는 게시글만. 같은 브라우저 방문자 기준이며, 신청은 로그인으로 연결된 방문자만 셉니다.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-bold text-gray-600">게시글</th>
              <th className="px-3 py-2 text-right font-bold text-gray-600">방문자</th>
              <th className="px-3 py-2 text-right font-bold text-gray-600">강의 이동</th>
              <th className="px-3 py-2 text-right font-bold text-gray-600">신청</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.post_id}>
                <td className="px-3 py-2 text-gray-800 max-w-[320px] truncate">{r.title}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.visitors.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.moved.toLocaleString()} <span className="text-xs text-gray-400">{pct(r.moved, r.visitors)}</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{r.enrolled.toLocaleString()} <span className="text-xs text-gray-400">{pct(r.enrolled, r.visitors)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
