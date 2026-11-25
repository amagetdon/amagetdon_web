// 통합 대시보드 '인터뷰 채널 영상' 영역.
// 관리자가 유튜브 인터뷰 영상 링크와, 그 영상 설명란에 넣은 신청 링크(UTM)를 등록한다.
//  - 조회수·댓글·좋아요: /api/youtube-video-stats 가 YouTube Data API 로 받아 product_interview_videos 에 저장
//  - 방문·신청·가입·결제: 대시보드가 이미 받은 매체×캠페인×소재×세트 줄(지금 보는 기수 기준)에서 이 UTM 과 맞는 줄을 더한다
// UTM 은 비어 있는 값은 따지지 않는다. 캠페인만 넣으면 그 캠페인 전체가 이 영상 몫이 된다.
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

/** 영상 UTM 과 대시보드 줄이 맞는지 — 영상 쪽 빈 값은 따지지 않는다 */
function matches(v: Video, r: { channel: string; campaign: string; content: string; term: string }) {
  if (v.utm_source && normChannel(v.utm_source) !== r.channel) return false
  if (v.utm_campaign && !same(r.campaign, v.utm_campaign)) return false
  if (v.utm_content && !same(r.content, v.utm_content)) return false
  if (v.utm_term && !same(r.term, v.utm_term)) return false
  return true
}

const hasUtm = (v: Pick<Video, 'utm_campaign' | 'utm_content' | 'utm_term'>) => !!(v.utm_campaign || v.utm_content || v.utm_term)
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
  const [edit, setEdit] = useState<Utm & { memo: string }>({ utm_source: '', utm_campaign: '', utm_content: '', utm_term: '', memo: '' })
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
    setEdit({ utm_source: v.utm_source ?? '', utm_campaign: v.utm_campaign ?? '', utm_content: v.utm_content ?? '', utm_term: v.utm_term ?? '', memo: v.memo ?? '' })
  }
  const saveEdit = async () => {
    if (editId == null) return
    const t = (s: string) => s.trim() || null
    const { error } = await supabase.from('product_interview_videos' as never).update({
      utm_source: t(edit.utm_source), utm_campaign: t(edit.utm_campaign), utm_content: t(edit.utm_content), utm_term: t(edit.utm_term), memo: t(edit.memo),
    } as never).eq('id', editId)
    if (error) return toast.error(`저장 실패: ${error.message}`)
    setEditId(null)
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
      if (hasUtm(v)) {
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
    const seen = new Set<string>()
    for (const v of videos) {
      t.views += v.view_count ?? 0; t.comments += v.comment_count ?? 0; t.likes += v.like_count ?? 0
      const s = stats.get(v.id)
      // 같은 UTM 을 쓴 영상은 신청을 한 번만 더한다
      if (s && hasUtm(v) && !seen.has(utmKey(v))) {
        seen.add(utmKey(v))
        t.visitors += s.visitors; t.applicants += s.applicants; t.new_signups += s.new_signups; t.payers += s.payers
      }
    }
    return t
  }, [videos, stats])

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
                          <input value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} placeholder="메모" className="px-2 py-1 border border-gray-200 rounded text-xs" />
                          <div className="flex gap-1">
                            <button type="button" onClick={saveEdit} className="px-2 py-1 rounded bg-[#2ED573] text-white border-none cursor-pointer">저장</button>
                            <button type="button" onClick={() => setEditId(null)} className="px-2 py-1 rounded bg-white border border-gray-200 cursor-pointer">취소</button>
                          </div>
                        </div>
                      ) : hasUtm(v) ? (
                        <div className="space-y-0.5 text-gray-600 max-w-[200px] break-all">
                          {v.utm_source && <div><span className="text-gray-400">source</span> {v.utm_source}</div>}
                          {v.utm_campaign && <div><span className="text-gray-400">campaign</span> {v.utm_campaign}</div>}
                          {v.utm_content && <div><span className="text-gray-400">content</span> {v.utm_content}</div>}
                          {v.utm_term && <div><span className="text-gray-400">term</span> {v.utm_term}</div>}
                          {s.shared && <div className="text-amber-600">다른 영상과 UTM 이 같아 신청이 합쳐집니다</div>}
                        </div>
                      ) : (
                        <button type="button" onClick={() => startEdit(v)} className="text-red-500 bg-transparent border-none p-0 cursor-pointer underline">UTM 연결 필요</button>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right font-medium">{n(v.view_count)}</td>
                    <td className="py-2.5 px-2 text-right">{v.view_count != null && v.comment_count == null ? <span className="text-gray-400" title="댓글 사용 중지">막힘</span> : n(v.comment_count)}</td>
                    <td className="py-2.5 px-2 text-right">{n(v.like_count)}</td>
                    <td className="py-2.5 px-2 text-right">{hasUtm(v) ? n(s.visitors) : '-'}</td>
                    <td className="py-2.5 px-2 text-right font-bold">{hasUtm(v) ? n(s.applicants) : '-'}</td>
                    <td className="py-2.5 px-2 text-right">{hasUtm(v) ? pct(s.applicants, v.view_count) : '-'}</td>
                    <td className="py-2.5 px-2 text-right">{hasUtm(v) ? n(s.new_signups) : '-'}</td>
                    <td className="py-2.5 px-2 text-right">{hasUtm(v) ? n(s.payers) : '-'}</td>
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
    </section>
  )
}
