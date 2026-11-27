// 통합 대시보드 '광고비' — 매체 캠페인 연결·자동 가져오기 (메타·네이버 검색광고·구글 Ads·네이버 GFA)
// 서버: /api/ad-spend-sync. 매체별 캠페인 일별 비용(ad_campaign_daily) 중 이 상품에 고른 캠페인만 광고비(product_ad_spend)로 들어간다.
//  - 메타·네이버 검색광고: 매일 새벽 4시 자동(최근 35일) + [지금 가져오기](전체 기간·네이버는 90일)
//  - 구글 Ads: 구글 Ads 계정의 스크립트가 매일 비용을 보내 준다(아래 안내)
//  - 네이버 GFA: 공개 API 가 없어 GFA 보고서 파일(엑셀·CSV)을 올린다
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { COURSE_VARIANTS } from '../../lib/courseVariants'

/** 랜딩 주소(호스트+경로)가 이 상품 페이지인지 — /course/N, /ebook/N, 미노출 랜딩 /c/slug */
function isThisProduct(url: string, kind: Kind, productId: number) {
  const path = url.replace(/^[^/]*/, '')
  if (new RegExp(`^/${kind}/${productId}(/|$)`).test(path)) return true
  const m = path.match(/^\/c\/([^/]+)/)
  return kind === 'course' && !!m && COURSE_VARIANTS[m[1]]?.courseId === productId
}

type Kind = 'course' | 'ebook'
type Channel = 'meta' | 'naver_sa' | 'google' | 'gfa'
type Field = 'meta_campaign_ids' | 'naver_campaign_ids' | 'google_campaign_ids' | 'gfa_campaign_ids'
export interface AutoSpendRow { source: string; external_id: string | null; amount: number | string; spend_date: string }
interface Campaign { id: string; name: string; status: string; account: string; total?: number }

const CH: { ch: Channel; field: Field; label: string; color: string }[] = [
  { ch: 'meta', field: 'meta_campaign_ids', label: '메타', color: '#1877F2' },
  { ch: 'naver_sa', field: 'naver_campaign_ids', label: '네이버 검색광고', color: '#03C75A' },
  { ch: 'google', field: 'google_campaign_ids', label: '구글 Ads', color: '#EA4335' },
  { ch: 'gfa', field: 'gfa_campaign_ids', label: '네이버 GFA', color: '#00A85A' },
]

const won = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}원`

async function call(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/ad-spend-sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`)
  return out
}

export default function AdSpendSync({ kind, productId, rows, onChanged }: { kind: Kind; productId: number; rows: AutoSpendRow[]; onChanged: () => void }) {
  const [ids, setIds] = useState<Record<Field, string[]>>({ meta_campaign_ids: [], naver_campaign_ids: [], google_campaign_ids: [], gfa_campaign_ids: [] })
  const [picker, setPicker] = useState<Channel | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [guide, setGuide] = useState<'google' | 'gfa' | null>(null)

  const loadIds = () => {
    supabase.from('product_funnel_settings').select('*').eq('kind', kind).eq('product_id', productId).maybeSingle()
      .then(({ data }) => {
        const d = (data ?? {}) as Partial<Record<Field, string[]>>
        setIds({ meta_campaign_ids: d.meta_campaign_ids ?? [], naver_campaign_ids: d.naver_campaign_ids ?? [], google_campaign_ids: d.google_campaign_ids ?? [], gfa_campaign_ids: d.gfa_campaign_ids ?? [] })
      })
  }
  useEffect(loadIds, [kind, productId])

  const total = Object.values(ids).reduce((a, l) => a + l.length, 0)

  const sync = async () => {
    setSyncing(true)
    try {
      const out = await call({ action: 'sync', kind, product_id: productId })
      if (out.errors?.length) toast.error(`일부 실패: ${out.errors.join(' / ')}`)
      else toast.success(`광고비 ${out.days ?? 0}일치를 다시 만들었습니다.`)
      onChanged()
    } catch (e) {
      toast.error(`가져오기 실패: ${(e as Error).message}`)
    } finally {
      setSyncing(false)
    }
  }

  // 매체별 자동 합계
  const sums = useMemo(() => {
    const m = new Map<string, { total: number; days: number; camps: Set<string>; last: string }>()
    for (const r of rows) {
      if (r.source === 'manual') continue
      const s = m.get(r.source) ?? { total: 0, days: 0, camps: new Set<string>(), last: '' }
      s.total += Number(r.amount); s.days++; if (r.external_id) s.camps.add(r.external_id); if (r.spend_date > s.last) s.last = r.spend_date
      m.set(r.source, s)
    }
    return m
  }, [rows])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-gray-400 mr-1">자동 연결</span>
        {CH.map((c) => (
          <button key={c.ch} onClick={() => setPicker(c.ch)}
            className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-gray-50">
            <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: c.color }} />
            {c.label} {ids[c.field].length > 0 ? <b>{ids[c.field].length}</b> : <span className="text-gray-400">0</span>}
          </button>
        ))}
        <button onClick={sync} disabled={syncing || total === 0}
          className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold border-none cursor-pointer disabled:opacity-40">
          {syncing ? '가져오는 중…' : '지금 가져오기'}
        </button>
        <button onClick={() => setGuide(guide === 'google' ? null : 'google')} className="text-xs text-gray-500 underline bg-transparent border-none cursor-pointer">구글 Ads 설정</button>
        <button onClick={() => setGuide(guide === 'gfa' ? null : 'gfa')} className="text-xs text-gray-500 underline bg-transparent border-none cursor-pointer">GFA 파일 올리기</button>
      </div>
      <p className="text-xs text-gray-400">
        캠페인을 연결하면 그 캠페인 비용만 이 상품 광고비로 들어갑니다(부가세 별도). 메타·네이버 검색광고는 매일 새벽 4시에 최근 35일을 다시 받고, 구글은 구글 Ads 스크립트가 매일 보내며, GFA 는 보고서 파일을 올립니다.
        {' '}한 캠페인을 여러 상품에 연결하면 양쪽에 다 잡힙니다.
      </p>

      {sums.size > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
          {CH.filter((c) => sums.has(c.ch)).map((c) => {
            const s = sums.get(c.ch)!
            return <span key={c.ch}>{c.label}: 캠페인 {s.camps.size}개 · {s.days}일치 · <b>{won(s.total)}</b> <span className="text-xs text-gray-400">(~{s.last})</span></span>
          })}
        </div>
      )}

      {guide === 'google' && <GoogleGuide />}
      {guide === 'gfa' && <GfaUpload onDone={() => { onChanged(); setGuide(null) }} />}

      {picker && (
        <Picker kind={kind} productId={productId} channel={picker} current={ids[CH.find((c) => c.ch === picker)!.field]}
          onClose={() => setPicker(null)}
          onSaved={() => { setPicker(null); loadIds(); sync() }} />
      )}
    </div>
  )
}

function Picker({ kind, productId, channel, current, onClose, onSaved }: {
  kind: Kind; productId: number; channel: Channel; current: string[]; onClose: () => void; onSaved: () => void
}) {
  const meta = CH.find((c) => c.ch === channel)!
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<string[]>(current)
  const [q, setQ] = useState('')
  const [landings, setLandings] = useState<Record<string, string[] | null> | null>(null)
  const [onlyThis, setOnlyThis] = useState(false)

  useEffect(() => {
    call({ action: 'campaigns', channel }).then((o) => {
      const list: Campaign[] = o.campaigns ?? []
      setCampaigns(list)
      // 캠페인마다 광고가 보내는 랜딩 주소 — 이름 말고 주소로 어느 강의 캠페인인지 확인
      if ((channel === 'meta' || channel === 'naver_sa') && list.length) {
        setLandings(null)
        call({ action: 'landings', channel, ids: list.map((c) => c.id) })
          .then((r) => setLandings(r.landings ?? {}), () => setLandings({}))
      }
    }, (e) => setError((e as Error).message))
  }, [channel])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const all = campaigns ?? []
    // 이미 고른 캠페인이 목록에 없으면(오래돼 안 보이는 등) 그래도 보여 준다
    const missing: Campaign[] = current.filter((id) => !all.some((c) => c.id === id)).map((id) => ({ id, name: id, status: '목록에 없음', account: '' }))
    const mine = (c: Campaign) => (landings?.[c.id] ?? []).some((u) => isThisProduct(u, kind, productId))
    return [...missing, ...all]
      .filter((c) => !s || c.name.toLowerCase().includes(s) || c.id.includes(s) || c.account.toLowerCase().includes(s) || (landings?.[c.id] ?? []).some((u) => u.toLowerCase().includes(s)))
      .filter((c) => !onlyThis || mine(c) || current.includes(c.id))
      .sort((a, b) => Number(mine(b)) - Number(mine(a)))
  }, [campaigns, q, current, landings, onlyThis, kind, productId])

  const save = async () => {
    const { error: e } = await supabase.from('product_funnel_settings')
      .upsert({ kind, product_id: productId, [meta.field]: draft, updated_at: new Date().toISOString() } as never, { onConflict: 'kind,product_id' })
    if (e) return toast.error(`저장 실패: ${e.message}`)
    toast.success(`${meta.label} 캠페인 연결을 저장했습니다.`)
    onSaved()
  }

  const active = (s: string) => s === 'ACTIVE' || s === 'ELIGIBLE'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-[620px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 space-y-2">
          <h4 className="font-bold">이 상품에 쓴 {meta.label} 캠페인 선택</h4>
          <p className="text-xs text-gray-400">
            {channel === 'google' ? '구글 Ads 스크립트가 보내 준 캠페인만 보입니다. 비어 있으면 [구글 Ads 설정]부터 하세요.'
              : channel === 'gfa' ? '올린 GFA 보고서에 있던 캠페인만 보입니다. 비어 있으면 [GFA 파일 올리기]부터 하세요.'
              : '선택한 캠페인의 일별 비용이 이 상품 광고비로 들어갑니다.'}
          </p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="캠페인 이름·계정·랜딩 주소 검색" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          {(channel === 'meta' || channel === 'naver_sa') && (
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1 cursor-pointer text-gray-600">
                <input type="checkbox" checked={onlyThis} onChange={(e) => setOnlyThis(e.target.checked)} /> 이 {kind === 'course' ? '강의' : '전자책'}로 가는 캠페인만
              </label>
              {landings === null && campaigns && <span className="text-gray-400">랜딩 주소 확인 중…</span>}
            </div>
          )}
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {error ? <p className="text-sm text-red-500">{error}</p>
            : !campaigns ? <p className="text-sm text-gray-400">캠페인 목록을 불러오는 중…</p>
            : list.length === 0 ? <p className="text-sm text-gray-400">캠페인이 없습니다.</p>
            : list.map((c) => (
              <label key={c.id} className="flex items-center gap-2 py-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={draft.includes(c.id)} onChange={(e) => setDraft(e.target.checked ? [...draft, c.id] : draft.filter((x) => x !== c.id))} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{c.name}{c.account && <span className="text-xs text-gray-400 ml-1.5">{c.account}</span>}</span>
                  {landings && (() => {
                    const ls = landings[c.id]
                    if (ls === undefined) return null
                    if (ls === null) return <span className="block text-[11px] text-gray-400">랜딩 확인 실패</span>
                    if (!ls.length) return <span className="block text-[11px] text-gray-400">랜딩 주소 없음</span>
                    const hit = ls.some((u) => isThisProduct(u, kind, productId))
                    return (
                      <span className={`block text-[11px] truncate ${hit ? 'text-[#2ED573] font-medium' : 'text-amber-600'}`} title={ls.join('\n')}>
                        {hit ? '✓ 이 상품 · ' : '다른 주소 · '}{ls.slice(0, 2).join(', ')}{ls.length > 2 ? ` 외 ${ls.length - 2}개` : ''}
                      </span>
                    )
                  })()}
                </span>
                {c.total != null && <span className="text-xs text-gray-500">{won(c.total)}</span>}
                <span className={`text-xs whitespace-nowrap ${active(c.status) ? 'text-[#2ED573]' : 'text-gray-400'}`}>
                  {active(c.status) ? '진행 중' : c.status.startsWith('마지막') || c.status === '목록에 없음' ? c.status : '꺼짐'}
                </span>
              </label>
            ))}
        </div>
        <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500">{draft.length}개 선택</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm bg-gray-100 border-none cursor-pointer">취소</button>
            <button onClick={save} disabled={!!error && channel !== 'google' && channel !== 'gfa'} className="px-4 py-2 rounded-xl text-sm bg-[#2ED573] text-white font-bold border-none cursor-pointer disabled:opacity-40">저장</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const GOOGLE_SCRIPT = `// 아마겟돈 클래스 광고비 보내기 — 구글 Ads > 도구 > 대량 작업 > 스크립트 에 붙여 넣고 '매일' 실행으로 예약
var URL = 'https://amag-class.com/api/ad-spend-sync';
var SECRET = '여기에_AD_SYNC_SECRET_값';
var DAYS = 90; // 처음 한 번은 90일, 그다음부터는 35일로 줄여도 됩니다

function main() {
  var tz = 'Asia/Seoul';
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var since = Utilities.formatDate(new Date(Date.now() - DAYS * 86400000), tz, 'yyyy-MM-dd');
  var it = AdsApp.search(
    "SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros FROM campaign " +
    "WHERE segments.date BETWEEN '" + since + "' AND '" + today + "' AND metrics.cost_micros > 0");
  var rows = [];
  while (it.hasNext()) {
    var r = it.next();
    rows.push({ campaign_id: String(r.campaign.id), campaign_name: r.campaign.name, date: r.segments.date, cost: r.metrics.costMicros / 1000000 });
  }
  var res = UrlFetchApp.fetch(URL, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-ad-sync-secret': SECRET },
    payload: JSON.stringify({ action: 'push', channel: 'google', account_id: AdsApp.currentAccount().getCustomerId(), rows: rows })
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}`

function GoogleGuide() {
  const copy = () => navigator.clipboard.writeText(GOOGLE_SCRIPT).then(() => toast.success('스크립트를 복사했습니다.'), () => toast.error('복사 실패'))
  return (
    <div className="border border-gray-200 rounded-lg p-4 text-sm space-y-2 bg-gray-50">
      <p className="font-bold">구글 Ads 연결 (한 번만)</p>
      <ol className="list-decimal pl-5 space-y-1 text-gray-600 text-xs">
        <li>Vercel 환경변수 <code>AD_SYNC_SECRET</code> 에 아무도 모를 긴 문자열을 넣고 다시 배포합니다.</li>
        <li>구글 Ads → 도구 → 대량 작업 → <b>스크립트</b> → + 새 스크립트 → 아래 코드를 붙여 넣고, <code>SECRET</code> 자리에 1번 문자열을 넣습니다.</li>
        <li>[승인]으로 권한을 허용하고 [실행] → 로그에 <code>200</code> 이 나오면 성공입니다.</li>
        <li>스크립트 목록에서 실행 빈도를 <b>매일</b>로 바꿉니다.</li>
        <li>이 화면 [구글 Ads] 버튼에서 이 상품 캠페인을 고릅니다.</li>
      </ol>
      <div className="relative">
        <pre className="text-[11px] leading-snug bg-white border border-gray-200 rounded p-3 overflow-x-auto max-h-[220px]">{GOOGLE_SCRIPT}</pre>
        <button onClick={copy} className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-gray-900 text-white border-none cursor-pointer">복사</button>
      </div>
      <p className="text-xs text-gray-400">광고 계정이 여러 개면 계정마다 같은 스크립트를 넣습니다(관리자 계정이면 계정마다 따로).</p>
    </div>
  )
}

// ── GFA 보고서 파일 ───────────────────────────────────────────────────────────
interface GfaRow { campaign_id: string; campaign_name: string; date: string; cost: number }

/** 2026.11.20 · 2026-11-20 · 2026. 11. 20. · 20261120 · 엑셀 날짜 숫자 → YYYY-MM-DD */
function toDate(v: unknown): string | null {
  if (typeof v === 'number' && v > 30000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v)
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null
  }
  const s = String(v ?? '').trim()
  const m = s.match(/^(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/) || s.match(/^(\d{4})(\d{2})(\d{2})$/)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null
}
const num = (v: unknown) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)

function parseGfa(grid: unknown[][]): { rows: GfaRow[]; cols: string } {
  const norm = (x: unknown) => String(x ?? '').replace(/\s+/g, '').toLowerCase()
  for (let h = 0; h < Math.min(grid.length, 30); h++) {
    const head = (grid[h] ?? []).map(norm)
    const find = (re: RegExp, not?: RegExp) => head.findIndex((c) => re.test(c) && !(not && not.test(c)))
    const di = find(/^(일자|날짜|일|기간|date|day)$|일자|날짜/)
    const ci = find(/총비용|^비용$|광고비|집행금액|소진금액|^cost$|spend|비용\(/, /cpc|cpm|cpa|당|평균|전환/)
    const ni = find(/캠페인(이름|명)$|^캠페인$|campaignname/)
    const ii = find(/캠페인id|campaignid/)
    if (di < 0 || ci < 0 || (ni < 0 && ii < 0)) continue
    const agg = new Map<string, GfaRow>()
    for (const r of grid.slice(h + 1)) {
      const date = toDate(r?.[di])
      const name = String(r?.[ni] ?? '').trim()
      const id = ii >= 0 ? String(r?.[ii] ?? '').trim() : name
      if (!date || !id) continue
      const k = `${id}\u0001${date}`
      const cur = agg.get(k) ?? { campaign_id: id, campaign_name: name || id, date, cost: 0 }
      cur.cost += num(r[ci])
      agg.set(k, cur)
    }
    return { rows: [...agg.values()], cols: [grid[h][di], ni >= 0 ? grid[h][ni] : grid[h][ii], grid[h][ci]].map(String).join(' · ') }
  }
  return { rows: [], cols: '' }
}

function GfaUpload({ onDone }: { onDone: () => void }) {
  const [parsed, setParsed] = useState<{ rows: GfaRow[]; cols: string; file: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const read = async (f: File) => {
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true })
      const p = parseGfa(grid)
      if (!p.rows.length) return toast.error('날짜·캠페인·비용 열을 찾지 못했습니다. GFA 보고서를 "일별 + 캠페인" 기준으로 받아 주세요.')
      setParsed({ ...p, file: f.name })
    } catch (e) {
      toast.error(`파일을 읽지 못했습니다: ${(e as Error).message}`)
    }
  }

  const upload = async () => {
    if (!parsed) return
    setBusy(true)
    try {
      const out = await call({ action: 'upload', channel: 'gfa', rows: parsed.rows })
      toast.success(`GFA ${out.rows}줄 저장 · 상품 ${out.products}개 광고비 다시 만듦`)
      onDone()
    } catch (e) {
      toast.error(`올리기 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const camps = parsed ? new Set(parsed.rows.map((r) => r.campaign_id)).size : 0
  const sum = parsed ? parsed.rows.reduce((a, r) => a + r.cost, 0) : 0
  const range = parsed ? [parsed.rows.map((r) => r.date).sort()[0], parsed.rows.map((r) => r.date).sort().pop()].join(' ~ ') : ''

  return (
    <div className="border border-gray-200 rounded-lg p-4 text-sm space-y-2 bg-gray-50">
      <p className="font-bold">네이버 GFA 보고서 올리기</p>
      <p className="text-xs text-gray-600">
        GFA 광고 관리 → 보고서에서 기간을 정하고 <b>일별 · 캠페인</b> 기준으로 엑셀(또는 CSV)을 받아 그대로 올리세요. 같은 날짜·캠페인은 새 값으로 덮어써서 여러 번 올려도 겹치지 않습니다.
        올린 뒤 [네이버 GFA] 버튼에서 이 상품 캠페인을 고르면 광고비에 들어갑니다.
      </p>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} className="text-xs" />
      {parsed && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-600">{parsed.file}: 캠페인 {camps}개 · {range} · 합계 <b>{won(sum)}</b> <span className="text-gray-400">(읽은 열: {parsed.cols})</span></span>
          <button onClick={upload} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#00A85A] text-white border-none cursor-pointer disabled:opacity-40">
            {busy ? '저장 중…' : '이대로 저장'}
          </button>
        </div>
      )}
    </div>
  )
}
