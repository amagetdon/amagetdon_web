import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { communityService } from '../../services/communityService'
import { courseLinkFor, useIsPc } from '../../lib/communityUtils'
import { Pager, PcSearchBar, PostTable } from '../../components/community/CommunityPc'
import { PinnedRows, PostList, Spinner, WriteFab } from '../../components/community/CommunityParts'
import { useCommunity } from './communityState'
import type { CommunityBanner, CommunityPin, CommunityPostView, CommunityTile } from '../../types/community'

type HomeTab = 'all' | 'notice'

// 커뮤니티 홈: 제목 줄 · 탭(홈·인기·MY구독·전체공지) · 배너 · 바로가기 · 진행 중 강의 · 고정 · 추천/최신
export default function CommunityHome() {
  const pc = useIsPc()
  return pc ? <HomePc /> : <HomeMobile />
}

function HomeMobile() {
  const { boards, readable, setDrawerOpen, unread, boardById } = useCommunity()
  const [params, setParams] = useSearchParams()
  const tab: HomeTab = params.get('t') === 'notice' ? 'notice' : 'all'
  const [pill, setPill] = useState<'rec' | 'new'>('rec')
  const [banners, setBanners] = useState<CommunityBanner[]>([])
  const [tiles, setTiles] = useState<CommunityTile[]>([])
  const [pins, setPins] = useState<(CommunityPin & { post: CommunityPostView })[]>([])
  const [posts, setPosts] = useState<CommunityPostView[] | null>(null)
  const [more, setMore] = useState(true)

  const listBoardIds = useMemo(
    () => boards.filter((b) => b.enabled && readable.has(b.id) && (tab === 'notice' ? b.kind === 'notice' : true)).map((b) => b.id),
    [boards, readable, tab],
  )

  useEffect(() => {
    Promise.all([communityService.banners(), communityService.tiles(), communityService.pins('home')])
      .then(([b, t, p]) => { setBanners(b); setTiles(t); setPins(p) })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (tab === 'all' && pill === 'rec') {
        // 추천: 이번 주 인기 → 부족하면 최신으로 채움
        const hot = await communityService.hot('week')
        const rest = hot.posts.length < 20 ? await communityService.listPosts({ boardIds: listBoardIds, limit: 20 }) : []
        const seen = new Set(hot.posts.map((p) => p.id))
        return { list: [...hot.posts, ...rest.filter((p) => !seen.has(p.id))].slice(0, 20), more: false }
      }
      const list = await communityService.listPosts({ boardIds: listBoardIds, limit: 20 })
      return { list, more: list.length === 20 }
    }
    load()
      .then((r) => { if (alive) { setPosts(r.list); setMore(r.more) } })
      .catch((e) => { if (alive) { setPosts([]); toast.error(e instanceof Error ? e.message : '글을 불러오지 못했어요.') } })
    return () => { alive = false }
  }, [tab, pill, listBoardIds])

  const loadMore = async () => {
    if (!posts?.length) return
    const last = posts[posts.length - 1]
    const list = await communityService.listPosts({ boardIds: listBoardIds, limit: 20, before: { created_at: last.created_at, id: last.id } })
    setPosts([...posts, ...list])
    setMore(list.length === 20)
  }

  const linkOf = (x: { link_board_id: number | null; link_url: string | null }) => {
    if (x.link_board_id) { const b = boardById(x.link_board_id); return b ? `/community/b/${b.slug}` : null }
    return x.link_url
  }
  const switchTab = (t: HomeTab) => { setPosts(null); setParams(t === 'notice' ? { t } : {}, { replace: true }) }
  const switchPill = (p: 'rec' | 'new') => { if (p !== pill) { setPosts(null); setPill(p) } }
  const tabLink = { flex: 1, textAlign: 'center' as const, height: 46, lineHeight: '46px', fontSize: 15, fontWeight: 600, color: 'var(--g5)' }

  return (
    <>
      <div className="ctitle">
        <div className="nm"><h1>아마 돈 벌고 있을걸요?</h1><p>아마겟돈 클래스 수강생 커뮤니티</p></div>
        <Link to="/community/search" aria-label="검색"><i className="ti ti-search" /></Link>
        <Link to="/community/news" className={`bd2${unread ? '' : ' off'}`} aria-label="알림"><i className="ti ti-bell" /></Link>
        <button onClick={() => setDrawerOpen(true)} aria-label="게시판 메뉴"><i className="ti ti-layout-list" /></button>
      </div>
      <div className="tabs6">
        <button className={tab === 'all' ? 'on' : ''} onClick={() => switchTab('all')}>홈</button>
        <Link to="/community/hot" style={tabLink}>인기</Link>
        <Link to="/community/sub" style={tabLink}>MY구독</Link>
        <button className={tab === 'notice' ? 'on' : ''} onClick={() => switchTab('notice')}>전체공지</button>
      </div>

      {tab === 'all' && (
        <>
          {banners.length > 0 && <BannerSlides banners={banners} linkOf={linkOf} />}
          {tiles.length > 0 && (
            <div className="tiles">
              {tiles.map((t) => {
                const to = linkOf(t)
                const inner = (<>
                  <span className="ic"><i className={`ti ${t.icon || 'ti-point'}`} /></span>
                  <span style={{ minWidth: 0 }}><b>{t.title}</b>{t.subtitle && <span>{t.subtitle}</span>}</span>
                </>)
                return to?.startsWith('http')
                  ? <a key={t.id} className={`tile${t.highlight ? ' g' : ''}`} href={to} target="_blank" rel="noreferrer">{inner}</a>
                  : <Link key={t.id} className={`tile${t.highlight ? ' g' : ''}`} to={to || '/community'}>{inner}</Link>
              })}
            </div>
          )}
          <MyCourses />
        </>
      )}

      <PinnedRows pins={pins} />

      {tab === 'all' && (
        <div className="pills">
          <button className={pill === 'rec' ? 'on' : ''} onClick={() => switchPill('rec')}>추천글</button>
          <button className={pill === 'new' ? 'on' : ''} onClick={() => switchPill('new')}>최신글</button>
        </div>
      )}
      {posts === null ? <Spinner /> : <PostList posts={posts} showBoard empty={tab === 'notice' ? '아직 공지가 없어요.' : '아직 글이 없어요. 첫 글을 남겨 보세요!'} />}
      {posts && more && posts.length > 0 && <button className="cm-load" onClick={() => void loadMore()}>더보기</button>}
      <WriteFab />
    </>
  )
}

/** 배너 슬라이드: 이미지 배너(비율 그대로, 모바일 이미지 따로 가능)와 글자 배너. 여러 장이면 5초마다 넘어감 */
function BannerSlides({ banners, linkOf }: { banners: CommunityBanner[]; linkOf: (b: CommunityBanner) => string | null }) {
  const [idx, setIdx] = useState(0)
  const [hold, setHold] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cls = { a: 'dk', b: 'lt', c: 'gy' } as const
  const n = banners.length

  const goTo = (i: number) => {
    const el = ref.current
    if (!el) return
    const slide = el.children[i] as HTMLElement | undefined
    if (slide) el.scrollTo({ left: slide.offsetLeft - el.offsetLeft, behavior: 'smooth' })
  }

  // 자동으로 넘기기(누르고 있거나 마우스를 올리면 멈춤)
  useEffect(() => {
    if (n < 2 || hold) return
    const t = window.setTimeout(() => goTo((idx + 1) % n), 5000)
    return () => window.clearTimeout(t)
  }, [idx, n, hold])

  return (
    <div className="bn-wrap" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}
      onTouchStart={() => setHold(true)} onTouchEnd={() => setHold(false)}>
      <div className="slides" ref={ref} onScroll={(e) => {
        const el = e.currentTarget
        setIdx(Math.min(n - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth + 8))))
      }}>
        {banners.map((b) => {
          const to = linkOf(b)
          const image = !!b.image_url
          const body = image ? (
            <picture>
              {b.image_url_mobile && <source media="(max-width: 1023px)" srcSet={b.image_url_mobile} />}
              <img src={b.image_url!} alt={b.title} loading="lazy" />
            </picture>
          ) : (<>
            <span className="tx">
              <span>{b.eyebrow && <small>{b.eyebrow}</small>}<b>{b.title}</b>{b.subtitle && <span>{b.subtitle}</span>}</span>
              {b.button_text && <span className="go">{b.button_text}<i className="ti ti-chevron-right" style={{ fontSize: 15 }} /></span>}
            </span>
            {b.icon && <span className="art"><i className={`ti ${b.icon}`} /></span>}
          </>)
          const className = image ? 'slimg' : `sl ${cls[b.color]}`
          if (!to) return <div key={b.id} className={className}>{body}</div>
          return to.startsWith('http')
            ? <a key={b.id} className={className} href={to} target="_blank" rel="noreferrer">{body}</a>
            : <Link key={b.id} className={className} to={to}>{body}</Link>
        })}
      </div>
      {n > 1 && (
        <div className="dots">
          {banners.map((b, i) => <button key={b.id} type="button" aria-label={`${i + 1}번째 배너`} className={i === idx ? 'on' : ''} onClick={() => goTo(i)} />)}
        </div>
      )}
    </div>
  )
}

/** 진행 중 강의(수강 기간이 남은 유료 강의) — 누르면 그 기수 방 또는 강의실 */
function MyCourses() {
  const { user } = useAuth()
  const { boards } = useCommunity()
  const [rows, setRows] = useState<{ course_id: number; title: string; expires_at: string | null }[]>([])
  useEffect(() => {
    if (!user) return
    supabase.from('purchases').select('course_id, title, expires_at, price').eq('user_id', user.id).not('course_id', 'is', null).gt('price', 0)
      .order('purchased_at', { ascending: false }).limit(5)
      .then(({ data }) => {
        const now = Date.now()
        setRows(((data ?? []) as { course_id: number; title: string; expires_at: string | null }[])
          .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now).slice(0, 2))
      })
  }, [user])
  if (!rows.length) return null
  return (
    <>
      <div className="sec-h"><b>진행 중 강의</b><Link to="/my-classroom?tab=course"><span>내 강의실</span></Link></div>
      {rows.map((r) => {
        const to = courseLinkFor(boards, r.course_id)
        return (
          <Link key={r.course_id} className="course" to={to}>
            <span className="cv"><i className="ti ti-school" /></span>
            <span style={{ minWidth: 0 }}><b>{r.title}</b><span>{to.startsWith('/community') ? '기수 방 가기' : '강의실 가기'}</span></span>
            <i className="ti ti-chevron-right ar" />
          </Link>
        )
      })}
      <div className="divider8" />
    </>
  )
}

const PC_PAGE_SIZE = 20

/** PC 홈: 배너 · 바로가기 · 전체글보기 표(홈 고정 글 맨 위) · 페이지 번호 · 검색 */
function HomePc() {
  const { boards, readable, boardById } = useCommunity()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const notice = params.get('t') === 'notice'
  const [banners, setBanners] = useState<CommunityBanner[]>([])
  const [tiles, setTiles] = useState<CommunityTile[]>([])
  const [pins, setPins] = useState<(CommunityPin & { post: CommunityPostView })[]>([])
  const [data, setData] = useState<{ posts: CommunityPostView[]; total: number } | null>(null)
  const boardIds = useMemo(
    () => boards.filter((b) => b.enabled && readable.has(b.id) && (notice ? b.kind === 'notice' : true)).map((b) => b.id),
    [boards, readable, notice],
  )

  useEffect(() => {
    Promise.all([communityService.banners(), communityService.tiles(), communityService.pins('home')])
      .then(([b, t, p]) => { setBanners(b); setTiles(t); setPins(p) })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    let alive = true
    communityService.listPage({ boardIds, page, pageSize: PC_PAGE_SIZE })
      .then((r) => { if (alive) setData(r) })
      .catch((e) => { if (alive) { setData({ posts: [], total: 0 }); toast.error(e instanceof Error ? e.message : '글을 불러오지 못했어요.') } })
    return () => { alive = false }
  }, [boardIds, page])

  const linkOf = (x: { link_board_id: number | null; link_url: string | null }) => {
    if (x.link_board_id) { const b = boardById(x.link_board_id); return b ? `/community/b/${b.slug}` : null }
    return x.link_url
  }
  const go = (next: { page?: number; notice?: boolean }) => {
    const p = new URLSearchParams()
    const n = next.notice ?? notice
    if (n) p.set('t', 'notice')
    if (next.page && next.page > 1) p.set('page', String(next.page))
    setData(null)
    setParams(p)
    window.scrollTo(0, 0)
  }

  return (
    <>
      {!notice && page === 1 && banners.length > 0 && <BannerSlides banners={banners} linkOf={linkOf} />}
      {!notice && page === 1 && tiles.length > 0 && (
        <div className="tiles">
          {tiles.map((t) => {
            const to = linkOf(t)
            const inner = (<>
              <span className="ic"><i className={`ti ${t.icon || 'ti-point'}`} /></span>
              <span style={{ minWidth: 0 }}><b>{t.title}</b>{t.subtitle && <span>{t.subtitle}</span>}</span>
            </>)
            return to?.startsWith('http')
              ? <a key={t.id} className={`tile${t.highlight ? ' g' : ''}`} href={to} target="_blank" rel="noreferrer">{inner}</a>
              : <Link key={t.id} className={`tile${t.highlight ? ' g' : ''}`} to={to || '/community'}>{inner}</Link>
          })}
        </div>
      )}
      <div className="pc-head" style={{ marginTop: 8 }}>
        <h2>{notice ? '전체공지' : '전체글보기'}</h2>
        {data && <p>{data.total.toLocaleString()}개의 글</p>}
        <span className="sp" />
        <button className="opt" onClick={() => go({ notice: !notice })}>{notice ? '전체글 보기' : '공지만 보기'}</button>
      </div>
      {data === null ? <Spinner /> : (
        <>
          <PostTable posts={data.posts} pins={page === 1 && !notice ? pins : []} showBoard />
          <Pager page={page} total={data.total} pageSize={PC_PAGE_SIZE} onPage={(n) => go({ page: n })} />
        </>
      )}
      <PcSearchBar />
    </>
  )
}
