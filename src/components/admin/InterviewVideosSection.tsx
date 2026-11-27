// 통합 대시보드 '인터뷰 채널 영상' 영역.
// 관리자가 유튜브 인터뷰 영상 링크와, 그 영상 설명란에 넣은 신청 링크(UTM)를 등록한다.
//  - 조회수·댓글·좋아요: /api/youtube-video-stats 가 YouTube Data API 로 받아 product_interview_videos 에 저장
//  - 방문·신청·가입·결제: 대시보드가 이미 받은 매체×캠페인×소재×세트 줄(지금 보는 기수 기준)에서 이 UTM 과 맞는 줄을 더한다
// UTM 은 비어 있는 값은 따지지 않는다. 캠페인만 넣으면 그 캠페인 전체가 이 영상 몫이 된다.
// 설명란 링크가 중간에 바뀌는 일이 있어(129 1기 min_jobkitchen → min1_jobkitchen) 영상 하나에 링크를 여러 개 묶을 수 있다.
//  - 대표 UTM = utm_source·utm_campaign·utm_content·utm_term 칸, 추가 링크 = utm_link 의 둘째 줄부터(한 줄에 하나). DB 칸 추가 없음
//  - 유튜브로 들어왔는데 어느 영상에도 안 묶인 UTM 은 표 아래 '등록 안 된 유튜브 UTM' 에 보여 주고 영상에 바로 묶는다
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

type Kind = 'course' | 'ebook'

/** 대시보드 신청자 줄·방문 줄 중 여기서 쓰는 값 */
export interface InterviewAppRow { channel: string; campaign: string; content: string; term: string; applicants: number; new_signups: number; payers: number; revenue: number | string }
export interface InterviewVisitRow { channel: string; campaign: string; content: string; term: string; visitors: number; visit_applicants: number }

interface Video {
  id: number; video_url: string; video_id: string
  utm_link: string | null; utm_source: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null
  memo: string | null; title: string | null; channel_title: string | null; thumbnail: string | null; published_at: string | null
  view_count: number | null; comment_count: number | null; like_count: number | null
  stats_updated_at: string | null; stats_error: string | null; sort_order: number
}

type Utm = { utm_source: string; utm_campaign: string; utm_content: string; utm_term: string }

const n = (v: number | null | undefined) => (v == null ? '-' : Math.round(v).toLocaleString('ko-KR'))
const pct = (a: number, b: number | null) => (b && b > 0 ? `${((a / b) * 100).toFixed(2)}%` : '-')
const kstDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
const kstDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: '2-digit', month: 'numeric', day: 'numeric' }) : ''

/** youtube.com/watch?v=, youtu.be/, /shorts/, /live/, /embed/ → 11자리 영상 ID */
function youtubeId(url: string): string | null {
  const m = url.trim().match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

/** 신청 링크(또는 utm_...=... 조각)에서 UTM 값을 뽑는다 */
function parseUtm(link: string): Utm {
  const out: Utm = { utm_source: '', utm_campaign: '', utm_content: '', utm_term: '' }
  const s = link.trim()
  if (!s) return out
  const q = s.includes('?') ? s.slice(s.indexOf('?') + 1) : s
  const params = new URLSearchParams(q.split('#')[0])
  for (const k of Object.keys(out) as (keyof Utm)[]) out[k] = (params.get(k) ?? '').trim()
  return out
}

/** 서버 norm_channel 과 같은 규칙 (utm_source → 매체) */
function normChannel(src: string | null | undefined): string {
  const s = (src ?? '').trim().toLowerCase()
  if (!s || ['(direct)', 'direct', '(none)', 'none', '(not set)'].includes(s)) return 'direct'
  if (/(^|[^a-z])(fb|facebook|ig|instagram|meta|threads)([^a-z]|$)/.test(s)) return 'meta'
  if (s.includes('youtube') || s === 'yt' || s === 'youtu.be') return 'youtube'
  if (s.includes('kakao') || s.includes('daum')) return 'kakao'
  if (s.includes('naver')) return 'naver'
  if (s.includes('google') || ['gdn', 'gads', 'adwords'].includes(s)) return 'google'
  if (s.includes('dable')) return 'dable'
  if (s.includes('taboola')) return 'taboola'
  if (s.includes('tiktok')) return 'tiktok'
  if (s.includes('karrot') || s.includes('daangn')) return 'karrot'
  return 'other'
}

const same = (a: string, b: string | null) => a.trim().toLowerCase() === (b ?? '').trim().toLowerCase()

type RowKey = { channel: string; campaign: string; content: string; term: string }
type UtmLike = { utm_source: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null }

const hasUtm = (v: Pick<UtmLike, 'utm_campaign' | 'utm_content' | 'utm_term'>) => !!(v.utm_campaign || v.utm_content || v.utm_term)

/** UTM 한 묶음과 대시보드 줄이 맞는지 — 빈 값은 따지지 않는다 */
function matchOne(u: UtmLike, r: RowKey) {
  if (!hasUtm(u)) return false
  if (u.utm_source && normChannel(u.utm_source) !== r.channel) return false
  if (u.utm_campaign && !same(r.campaign, u.utm_campaign)) return false
  if (u.utm_content && !same(r.content, u.utm_content)) return false
  if (u.utm_term && !same(r.term, u.utm_term)) return false
  return true
}

/** utm_link 둘째 줄부터 = 추가로 묶은 링크 */
const extraLinks = (v: Pick<Video, 'utm_link'>) => (v.utm_link ?? '').split('\n').slice(1).map((s) => s.trim()).filter(Boolean)

/** 이 영상 몫으로 보는 UTM 묶음 전체 (대표 + 추가) */
function utmSets(v: Video): UtmLike[] {
  const sets: UtmLike[] = hasUtm(v) ? [v] : []
  for (const l of extraLinks(v)) {
    const u = parseUtm(l)
    if (hasUtm(u)) sets.push({ utm_source: u.utm_source || null, utm_campaign: u.utm_campaign || null, utm_content: u.utm_content || null, utm_term: u.utm_term || null })
  }
  return sets
}

/** 영상과 대시보드 줄이 맞는지 — 묶인 링크 중 하나라도 맞으면 그 영상 몫 (한 줄은 한 번만 센다) */
const matches = (v: Video, r: RowKey) => utmSets(v).some((u) => matchOne(u, r))
const linked = (v: Video) => utmSets(v).length > 0

/** 추가 링크 한 줄로 보여 줄 짧은 글 */
const utmLabel = (u: Utm) => [u.utm_source && `source=${u.utm_source}`, u.utm_campaign && `campaign=${u.utm_campaign}`, u.utm_content && `content=${u.utm_content}`, u.utm_term && `term=${u.utm_term}`].filter(Boolean).join(' · ')
const utmKey = (v: Video) => [normChannel(v.utm_source), v.utm_campaign, v.utm_content, v.utm_term].map((x) => (x ?? '').toLowerCase()).join('|')

const STALE_MS = 6 * 3600 * 1000

export default function InterviewVideosSection({ kind, productId, rows, visitRows, cohortName }: {
  kind: Kind; productId: number; rows: InterviewAppRow[]; visitRows: InterviewVisitRow[]; cohortName: string | null
}) {
  const [videos, setVideos] = useState<Video[]>([])
  const [unavailable, setUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [form, setForm] = useState({ video_url: '', utm_link: '', memo: '' })
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [edit, setEdit] = useState<Utm & { memo: string; extras: string }>({ utm_source: '', utm_campaign: '', utm_content: '', utm_term: '', memo: '', extras: '' })
  const [attachTo, setAttachTo] = useState<Record<string, string>>({})
  // '등록 안 된 유튜브 UTM' 에서 제외한 키 (다른 강사 영상 링크 등) — product_funnel_settings.interview_utm_excluded. null = 칸 없음(SQL 전)
  const [excluded, setExcluded] = useState<string[] | null>(null)
  const [showExcluded, setShowExcluded] = useState(false)
  useEffect(() => {
    supabase.from('product_funnel_settings' as never).select('interview_utm_excluded').eq('kind', kind).eq('product_id', productId).maybeSingle()
      .then(({ data, error }) => setExcluded(error ? null : (((data as { interview_utm_excluded?: string[] } | null)?.interview_utm_excluded) ?? [])))
  }, [kind, productId])
  const saveExcluded = async (next: string[]) => {
    const { error } = await supabase.from('product_funnel_settings' as never)
      .upsert({ kind, product_id: productId, interview_utm_excluded: next, updated_at: new Date().toISOString() } as never, { onConflict: 'kind,product_id' })
    if (error) return toast.error(`저장 실패: ${error.message}`)
    setExcluded(next)
  }
  const autoRefreshed = useRef(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('product_interview_videos' as never)
      .select('*').eq('kind', kind).eq('product_id', productId).order('sort_order').order('id')
    if (error) { setUnavailable(true); setLoading(false); return }
    setVideos((data ?? []) as Video[])
    setLoading(false)
  }, [kind, productId])

  useEffect(() => { load() }, [load])

  const refreshStats = useCallback(async (silent = false) => {
    setRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/youtube-video-stats', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ kind, product_id: productId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      if (!silent) toast.success(body.missing ? `조회수를 갱신했습니다. 찾지 못한 영상 ${body.missing}개` : '조회수·댓글 수를 갱신했습니다.')
      await load()
    } catch (e) {
      if (!silent) toast.error(`조회수 갱신 실패: ${(e as Error).message}`)
    } finally {
      setRefreshing(false)
    }
  }, [kind, productId, load])

  // 열 때 6시간 넘게 지난 영상이 있으면 한 번 조용히 갱신
  useEffect(() => {
    if (loading || autoRefreshed.current || videos.length === 0) return
    const stale = videos.some((v) => !v.stats_updated_at || Date.now() - new Date(v.stats_updated_at).getTime() > STALE_MS)
    if (!stale) return
    autoRefreshed.current = true
    refreshStats(true)
  }, [loading, videos, refreshStats])

  const add = async () => {
    const vid = youtubeId(form.video_url)
    if (!vid) return toast.error('유튜브 영상 링크를 확인하세요. (youtube.com/watch?v=… 또는 youtu.be/…)')
    const utm = parseUtm(form.utm_link)
    if (form.utm_link.trim() && !hasUtm(utm)) return toast.error('신청 링크에서 utm_campaign·utm_content·utm_term 을 찾지 못했습니다.')
    if (videos.some((v) => v.video_id === vid)) return toast.error('이미 등록한 영상입니다.')
    setAdding(true)
    const { error } = await supabase.from('product_interview_videos' as never).insert({
      kind, product_id: productId, video_url: form.video_url.trim(), video_id: vid,
      utm_link: form.utm_link.trim() || null,
      utm_source: utm.utm_source || null, utm_campaign: utm.utm_campaign || null, utm_content: utm.utm_content || null, utm_term: utm.utm_term || null,
      memo: form.memo.trim() || null, sort_order: videos.length + 1,
    } as never)
    setAdding(false)
    if (error) return toast.error(`등록 실패: ${error.message}`)
    setForm({ video_url: '', utm_link: '', memo: '' })
    await load()
    refreshStats(true)
  }

  const startEdit = (v: Video) => {
    setEditId(v.id)
    setEdit({ utm_source: v.utm_source ?? '', utm_campaign: v.utm_campaign ?? '', utm_content: v.utm_content ?? '', utm_term: v.utm_term ?? '', memo: v.memo ?? '', extras: extraLinks(v).join('\n') })
  }
  const saveEdit = async () => {
    if (editId == null) return
    const t = (s: string) => s.trim() || null
    const v = videos.find((x) => x.id === editId)
    const extras = edit.extras.split('\n').map((s) => s.trim()).filter(Boolean)
    const bad = extras.find((l) => !hasUtm(parseUtm(l)))
    if (bad) return toast.error(`추가 링크에서 utm_campaign·utm_content·utm_term 을 찾지 못했습니다: ${bad}`)
    const first = (v?.utm_link ?? '').split('\n')[0].trim()
    const { error } = await supabase.from('product_interview_videos' as never).update({
      utm_source: t(edit.utm_source), utm_campaign: t(edit.utm_campaign), utm_content: t(edit.utm_content), utm_term: t(edit.utm_term), memo: t(edit.memo),
      utm_link: [first, ...extras].join('\n').trim() ? [first, ...extras].join('\n') : null,
    } as never).eq('id', editId)
    if (error) return toast.error(`저장 실패: ${error.message}`)
    setEditId(null)
    load()
  }
  /** 등록 안 된 UTM 을 영상의 추가 링크로 묶는다 */
  const attach = async (key: string, u: Utm) => {
    const v = videos.find((x) => String(x.id) === attachTo[key])
    if (!v) return toast.error('묶을 영상을 고르세요.')
    const q = new URLSearchParams()
    for (const k of ['utm_source', 'utm_campaign', 'utm_content', 'utm_term'] as const) if (u[k]) q.set(k, u[k])
    const lines = (v.utm_link ?? '').split('\n')
    const link = [lines[0] ?? '', ...lines.slice(1), q.toString()].join('\n')
    const { error } = await supabase.from('product_interview_videos' as never).update({ utm_link: link } as never).eq('id', v.id)
    if (error) return toast.error(`연결 실패: ${error.message}`)
    toast.success(`'${v.memo ?? v.title ?? '영상'}' 에 묶었습니다.`)
    load()
  }

  const remove = async (v: Video) => {
    if (!confirm(`'${v.title ?? v.video_url}' 영상을 목록에서 뺄까요? (신청 기록은 그대로 남습니다)`)) return
    const { error } = await supabase.from('product_interview_videos' as never).delete().eq('id', v.id)
    if (error) return toast.error(`삭제 실패: ${error.message}`)
    load()
  }

  // 영상별 방문·신청·가입·결제 (지금 보는 기수 기준)
  const stats = useMemo(() => {
    const dup = new Map<string, number>()
    for (const v of videos) if (hasUtm(v)) dup.set(utmKey(v), (dup.get(utmKey(v)) ?? 0) + 1)
    return new Map(videos.map((v) => {
      const s = { visitors: 0, applicants: 0, new_signups: 0, payers: 0, revenue: 0, shared: hasUtm(v) && (dup.get(utmKey(v)) ?? 0) > 1 }
      if (linked(v)) {
        for (const r of rows) if (matches(v, r)) {
          s.applicants += r.applicants; s.new_signups += r.new_signups; s.payers += r.payers; s.revenue += Number(r.revenue)
        }
        for (const r of visitRows) if (matches(v, r)) s.visitors += r.visitors
      }
      return [v.id, s]
    }))
  }, [videos, rows, visitRows])

  const total = useMemo(() => {
    const t = { views: 0, comments: 0, likes: 0, visitors: 0, applicants: 0, new_signups: 0, payers: 0 }
    for (const v of videos) { t.views += v.view_count ?? 0; t.comments += v.comment_count ?? 0; t.likes += v.like_count ?? 0 }
    // 신청·방문은 대시보드 줄 기준으로 한 번만 더한다 (같은 UTM 을 여러 영상에 묶어도 겹치지 않게)
    for (const r of rows) if (videos.some((v) => matches(v, r))) { t.applicants += r.applicants; t.new_signups += r.new_signups; t.payers += r.payers }
    for (const r of visitRows) if (videos.some((v) => matches(v, r))) t.visitors += r.visitors
    return t
  }, [videos, rows, visitRows])

  // 유튜브로 들어왔는데 어느 영상에도 안 묶인 UTM (지금 보는 기수 기준)
  const allOrphans = useMemo(() => {
    const m = new Map<string, { utm: Utm; visitors: number; applicants: number; payers: number }>()
    const put = (r: RowKey) => {
      const key = [r.campaign, r.content, r.term].join('\u0001')
      let o = m.get(key)
      if (!o) { o = { utm: { utm_source: 'youtube', utm_campaign: r.campaign, utm_content: r.content, utm_term: r.term }, visitors: 0, applicants: 0, payers: 0 }; m.set(key, o) }
      return o
    }
    for (const r of rows) if (r.channel === 'youtube' && !videos.some((v) => matches(v, r))) { const o = put(r); o.applicants += r.applicants; o.payers += r.payers }
    for (const r of visitRows) if (r.channel === 'youtube' && !videos.some((v) => matches(v, r))) put(r).visitors += r.visitors
    return [...m.entries()].filter(([, o]) => o.applicants > 0 || o.visitors > 0)
      .sort((a, b) => b[1].applicants - a[1].applicants || b[1].visitors - a[1].visitors)
  }, [videos, rows, visitRows])
  const exKey = (u: Utm) => [u.utm_campaign, u.utm_content, u.utm_term].map((x) => x.trim().toLowerCase()).join('|')
  const orphans = useMemo(() => allOrphans.filter(([, o]) => !(excluded ?? []).includes(exKey(o.utm))), [allOrphans, excluded])
  const excludedOrphans = useMemo(() => allOrphans.filter(([, o]) => (excluded ?? []).includes(exKey(o.utm))), [allOrphans, excluded])

  if (unavailable) return null

  const lastUpdated = videos.map((v) => v.stats_updated_at).filter(Boolean).sort().pop() ?? null
  const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]'

  return (
    <section className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
        <h3 className="text-base font-bold text-gray-900">
          <i className="ti ti-brand-youtube text-red-500 mr-1" />인터뷰 채널 영상
        </h3>
        {videos.length > 0 && (
          <button type="button" onClick={() => refreshStats(false)} disabled={refreshing}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] disabled:opacity-50">
            <i className={`ti ti-refresh text-xs ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? '갱신 중…' : '조회수 갱신'}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-4">
        영상 링크와 그 영상 설명란에 넣은 신청 링크(UTM)를 등록하면, 조회수·댓글 수는 유튜브에서 받아 오고 신청 수는 그 UTM 으로 들어온 신청을 셉니다.
        {' '}조회수·댓글은 영상 전체 누적, 방문·신청·결제는 {cohortName ? `${cohortName} 기간` : '전체 기간'} 기준입니다.
        {lastUpdated && <> 조회수 기준 {kstDateTime(lastUpdated)}.</>}
      </p>

      {/* 등록 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })}
          placeholder="유튜브 영상 링크" className={`${inputCls} flex-1 min-w-[220px]`} />
        <input value={form.utm_link} onChange={(e) => setForm({ ...form, utm_link: e.target.value })}
          placeholder="설명란 신청 링크 (UTM 포함)" className={`${inputCls} flex-1 min-w-[260px]`} />
        <input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })}
          placeholder="메모 (선택)" className={`${inputCls} w-[160px] max-sm:w-full`} />
        <button type="button" onClick={add} disabled={adding || !form.video_url.trim()}
          className="px-4 py-2 rounded-lg text-sm font-bold border-none bg-[#2ED573] text-white cursor-pointer disabled:opacity-50">
          {adding ? '등록 중…' : '영상 추가'}
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse h-16 bg-gray-100 rounded-lg" />
      ) : videos.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">등록한 인터뷰 영상이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left py-2 pr-3 font-medium">영상</th>
                <th className="text-left py-2 px-2 font-medium">UTM</th>
                <th className="text-right py-2 px-2 font-medium">조회수</th>
                <th className="text-right py-2 px-2 font-medium">댓글</th>
                <th className="text-right py-2 px-2 font-medium">좋아요</th>
                <th className="text-right py-2 px-2 font-medium">방문</th>
                <th className="text-right py-2 px-2 font-medium">신청</th>
                <th className="text-right py-2 px-2 font-medium" title="신청 ÷ 조회수">조회→신청</th>
                <th className="text-right py-2 px-2 font-medium">신규 가입</th>
                <th className="text-right py-2 px-2 font-medium">결제</th>
                <th className="py-2 pl-2" />
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => {
                const s = stats.get(v.id)!
                return (
                  <tr key={v.id} className="border-b border-gray-50 align-top">
                    <td className="py-2.5 pr-3">
                      <div className="flex gap-2.5 min-w-[240px]">
                        <a href={v.video_url} target="_blank" rel="noreferrer" className="shrink-0">
                          <img src={v.thumbnail ?? `https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg`} alt="" className="w-[96px] h-[54px] object-cover rounded" />
                        </a>
                        <div className="min-w-0">
                          <a href={v.video_url} target="_blank" rel="noreferrer" className="font-medium text-gray-900 hover:underline line-clamp-2">
                            {v.title ?? v.video_url}
                          </a>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {[v.channel_title, kstDate(v.published_at), v.memo].filter(Boolean).join(' · ')}
                          </p>
                          {v.stats_error && <p className="text-xs text-red-500 mt-0.5">{v.stats_error}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-xs">
                      {editId === v.id ? (
                        <div className="grid gap-1 w-[200px]">
                          {(['utm_source', 'utm_campaign', 'utm_content', 'utm_term'] as const).map((k) => (
                            <input key={k} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                              placeholder={`${k.replace('utm_', '')} (비우면 안 따짐)`} className="px-2 py-1 border border-gray-200 rounded text-xs" />
                          ))}
                          <textarea value={edit.extras} onChange={(e) => setEdit({ ...edit, extras: e.target.value })} rows={3}
                            placeholder={'추가 신청 링크 (한 줄에 하나)\n설명란 링크가 바뀌었을 때 예전·새 링크를 함께 묶습니다'} className="px-2 py-1 border border-gray-200 rounded text-xs resize-y" />
                          <input value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} placeholder="메모" className="px-2 py-1 border border-gray-200 rounded text-xs" />
                          <div className="flex gap-1">
                            <button type="button" onClick={saveEdit} className="px-2 py-1 rounded bg-[#2ED573] text-white border-none cursor-pointer">저장</button>
                            <button type="button" onClick={() => setEditId(null)} className="px-2 py-1 rounded bg-white border border-gray-200 cursor-pointer">취소</button>
                          </div>
                        </div>
                      ) : linked(v) ? (
                        <div className="space-y-0.5 text-gray-600 max-w-[200px] break-all">
                          {v.utm_source && <div><span className="text-gray-400">source</span> {v.utm_source}</div>}
                          {v.utm_campaign && <div><span className="text-gray-400">campaign</span> {v.utm_campaign}</div>}
                          {v.utm_content && <div><span className="text-gray-400">content</span> {v.utm_content}</div>}
                          {v.utm_term && <div><span className="text-gray-400">term</span> {v.utm_term}</div>}
                          {extraLinks(v).map((l, i) => (
                            <div key={i} className="text-gray-500"><span className="text-gray-400">+ 묶은 링크</span> {utmLabel(parseUtm(l))}</div>
                          ))}
                          {s.shared && <div className="text-amber-600">다른 영상과 UTM 이 같아 신청이 합쳐집니다</div>}
                        </div>
                      ) : (
                        <button type="button" onClick={() => startEdit(v)} className="text-red-500 bg-transparent border-none p-0 cursor-pointer underline">UTM 연결 필요</button>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right font-medium">{n(v.view_count)}</td>
                    <td className="py-2.5 px-2 text-right">{v.view_count != null && v.comment_count == null ? <span className="text-gray-400" title="댓글 사용 중지">막힘</span> : n(v.comment_count)}</td>
                    <td className="py-2.5 px-2 text-right">{n(v.like_count)}</td>
                    <td className="py-2.5 px-2 text-right">{linked(v) ? n(s.visitors) : '-'}</td>
                    <td className="py-2.5 px-2 text-right font-bold">{linked(v) ? n(s.applicants) : '-'}</td>
                    <td className="py-2.5 px-2 text-right">{linked(v) ? pct(s.applicants, v.view_count) : '-'}</td>
                    <td className="py-2.5 px-2 text-right">{linked(v) ? n(s.new_signups) : '-'}</td>
                    <td className="py-2.5 px-2 text-right">{linked(v) ? n(s.payers) : '-'}</td>
                    <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                      <button type="button" onClick={() => startEdit(v)} title="UTM·메모 고치기" className="text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer"><i className="ti ti-pencil" /></button>
                      <button type="button" onClick={() => remove(v)} title="목록에서 빼기" className="text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer"><i className="ti ti-trash" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {videos.length > 1 && (
              <tfoot>
                <tr className="text-sm font-bold bg-gray-50">
                  <td className="py-2 pr-3 pl-2" colSpan={2}>합계 ({videos.length}개)</td>
                  <td className="py-2 px-2 text-right">{n(total.views)}</td>
                  <td className="py-2 px-2 text-right">{n(total.comments)}</td>
                  <td className="py-2 px-2 text-right">{n(total.likes)}</td>
                  <td className="py-2 px-2 text-right">{n(total.visitors)}</td>
                  <td className="py-2 px-2 text-right">{n(total.applicants)}</td>
                  <td className="py-2 px-2 text-right">{pct(total.applicants, total.views)}</td>
                  <td className="py-2 px-2 text-right">{n(total.new_signups)}</td>
                  <td className="py-2 px-2 text-right">{n(total.payers)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* 등록 안 된 유튜브 UTM — 설명란 링크가 바뀌었거나 영상 등록을 빠뜨린 경우 */}
      {!loading && orphans.length === 0 && excludedOrphans.length > 0 && (
        <p className="mt-4 text-xs text-gray-400">
          등록 안 된 유튜브 UTM 없음 · 제외한 UTM {excludedOrphans.length}개{' '}
          <button type="button" onClick={() => setShowExcluded(!showExcluded)} className="underline bg-transparent border-none p-0 cursor-pointer text-gray-500">{showExcluded ? '접기' : '보기'}</button>
        </p>
      )}
      {!loading && orphans.length > 0 && (
        <div className="mt-5 border border-amber-200 bg-amber-50/50 rounded-lg p-3">
          <p className="text-sm font-bold text-amber-700 mb-0.5">
            <i className="ti ti-alert-triangle mr-1" />등록 안 된 유튜브 UTM {orphans.length}개 · 신청 {n(orphans.reduce((a, [, o]) => a + o.applicants, 0))}
          </p>
          <p className="text-xs text-gray-500 mb-2">
            유튜브로 들어왔는데 위 영상 어디에도 묶이지 않은 링크입니다. 설명란 링크가 바뀌었거나 영상 등록을 빠뜨린 경우가 많습니다. 맞는 영상을 골라 [묶기]를 누르면 그 영상 숫자에 합쳐집니다. 다른 강사 영상 링크처럼 묶을 영상이 없는 건 [제외]하면 여기서 빠집니다(되돌릴 수 있음).
            {excludedOrphans.length > 0 && <>{' '}제외한 UTM {excludedOrphans.length}개 <button type="button" onClick={() => setShowExcluded(!showExcluded)} className="underline bg-transparent border-none p-0 cursor-pointer text-gray-500">{showExcluded ? '접기' : '보기'}</button></>}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="text-gray-500 border-b border-amber-100">
                  <th className="text-left py-1.5 pr-2 font-medium">campaign</th>
                  <th className="text-left py-1.5 px-2 font-medium">content · term</th>
                  <th className="text-right py-1.5 px-2 font-medium">방문</th>
                  <th className="text-right py-1.5 px-2 font-medium">신청</th>
                  <th className="text-right py-1.5 px-2 font-medium">결제</th>
                  <th className="py-1.5 pl-2" />
                </tr>
              </thead>
              <tbody>
                {orphans.map(([key, o]) => (
                  <tr key={key} className="border-b border-amber-50">
                    <td className="py-1.5 pr-2 font-medium text-gray-800 break-all">{o.utm.utm_campaign || <span className="text-gray-400">(값 없음)</span>}</td>
                    <td className="py-1.5 px-2 text-gray-500 break-all">{[o.utm.utm_content, o.utm.utm_term].filter(Boolean).join(' · ') || '-'}</td>
                    <td className="py-1.5 px-2 text-right">{n(o.visitors)}</td>
                    <td className="py-1.5 px-2 text-right font-bold">{n(o.applicants)}</td>
                    <td className="py-1.5 px-2 text-right">{n(o.payers)}</td>
                    <td className="py-1.5 pl-2 text-right whitespace-nowrap">
                      {hasUtm(o.utm) && videos.length > 0 && (
                        <span className="inline-flex gap-1">
                          <select value={attachTo[key] ?? ''} onChange={(e) => setAttachTo({ ...attachTo, [key]: e.target.value })}
                            className="px-1.5 py-1 border border-gray-200 rounded text-xs max-w-[160px] bg-white">
                            <option value="">영상 고르기</option>
                            {videos.map((v) => <option key={v.id} value={v.id}>{v.memo || v.channel_title || v.title}</option>)}
                          </select>
                          <button type="button" onClick={() => attach(key, o.utm)} disabled={!attachTo[key]}
                            className="px-2 py-1 rounded bg-[#2ED573] text-white border-none cursor-pointer disabled:opacity-40">묶기</button>
                        </span>
                      )}
                      {excluded && (
                        <button type="button" onClick={() => saveExcluded([...excluded, exKey(o.utm)])} title="묶을 영상이 없는 링크(다른 강사 영상 등) — 이 경고에서 뺍니다"
                          className="ml-1 px-2 py-1 rounded bg-white border border-gray-200 text-gray-500 cursor-pointer hover:text-gray-800">제외</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && showExcluded && excludedOrphans.length > 0 && excluded && (
        <div className="mt-2 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-bold text-gray-500 mb-1">제외한 UTM (지금 보는 기수에서 들어온 것)</p>
          <table className="w-full text-xs">
            <tbody>
              {excludedOrphans.map(([key, o]) => (
                <tr key={key} className="border-b border-gray-50">
                  <td className="py-1 pr-2 text-gray-700 break-all">{o.utm.utm_campaign || '(값 없음)'}{(o.utm.utm_content || o.utm.utm_term) && <span className="text-gray-400"> · {[o.utm.utm_content, o.utm.utm_term].filter(Boolean).join(' · ')}</span>}</td>
                  <td className="py-1 px-2 text-right text-gray-500 whitespace-nowrap">방문 {n(o.visitors)} · 신청 {n(o.applicants)} · 결제 {n(o.payers)}</td>
                  <td className="py-1 pl-2 text-right">
                    <button type="button" onClick={() => saveExcluded(excluded.filter((k) => k !== exKey(o.utm)))}
                      className="px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-500 cursor-pointer hover:text-gray-800">되돌리기</button>
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
