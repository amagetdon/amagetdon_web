import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { communityService, type ListPostsOptions } from '../../../services/communityService'
import type { CommunityPostView } from '../../../types/community'

// 보조 화면(인기글·구독·내소식·내정보·검색·내 글)이 같이 쓰는 불러오기 도구

export function errMsg(e: unknown, fallback = '불러오지 못했어요. 잠시 후 다시 시도해 주세요.'): string {
  return e instanceof Error && e.message ? e.message : fallback
}

/**
 * key 가 바뀔 때마다 load 를 한 번 부른다(key 가 null 이면 부르지 않음).
 * 지금 key 의 결과가 아직 없으면 loading=true.
 */
export function useKeyedLoad<T>(key: string | null, load: (key: string) => Promise<T>) {
  const [st, setSt] = useState<{ key: string; data?: T; error?: string } | null>(null)
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => {
    if (key === null) return
    let alive = true
    loadRef.current(key)
      .then((data) => { if (alive) setSt({ key, data }) })
      .catch((e) => {
        if (!alive) return
        const msg = errMsg(e)
        toast.error(msg)
        setSt({ key, error: msg })
      })
    return () => { alive = false }
  }, [key])
  const cur = st && st.key === key ? st : null
  return { data: cur?.data, error: cur?.error ?? null, loading: key !== null && !cur }
}

/** listPosts 를 '더보기'(before 커서)로 이어 불러오기 */
export function usePagedPosts(key: string | null, base: Omit<ListPostsOptions, 'before' | 'limit'>, pageSize = 20) {
  const [st, setSt] = useState<{ key: string; posts: CommunityPostView[]; more: boolean; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const baseRef = useRef(base)
  useEffect(() => { baseRef.current = base })

  useEffect(() => {
    if (key === null) return
    let alive = true
    communityService.listPosts({ ...baseRef.current, limit: pageSize })
      .then((posts) => { if (alive) setSt({ key, posts, more: posts.length === pageSize }) })
      .catch((e) => {
        if (!alive) return
        const msg = errMsg(e)
        toast.error(msg)
        setSt({ key, posts: [], more: false, error: msg })
      })
    return () => { alive = false }
  }, [key, pageSize])

  const cur = st && st.key === key ? st : null

  const loadMore = useCallback(async () => {
    if (!cur || !cur.more || busy || !cur.posts.length) return
    const last = cur.posts[cur.posts.length - 1]
    setBusy(true)
    try {
      const next = await communityService.listPosts({ ...baseRef.current, limit: pageSize, before: { created_at: last.created_at, id: last.id } })
      setSt((prev) => {
        if (!prev || prev.key !== cur.key) return prev
        const seen = new Set(prev.posts.map((p) => p.id))
        return { ...prev, posts: [...prev.posts, ...next.filter((p) => !seen.has(p.id))], more: next.length === pageSize }
      })
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }, [cur, busy, pageSize])

  return {
    posts: cur?.posts ?? [],
    more: !!cur?.more,
    error: cur?.error ?? null,
    loading: key !== null && !cur,
    busy,
    loadMore,
  }
}

/** ids 순서를 지켜 글을 불러온다(지워졌거나 못 읽는 글은 빠짐) */
export async function postsInOrder(ids: number[], includeDeleted = false): Promise<CommunityPostView[]> {
  if (!ids.length) return []
  const posts = await communityService.listPosts({ ids, limit: ids.length, includeDeleted })
  const pm = new Map(posts.map((p) => [p.id, p]))
  return ids.map((id) => pm.get(id)).filter((p): p is CommunityPostView => !!p)
}

// ───── 최근 검색어(이 브라우저에만 저장) ─────
const RECENT_KEY = 'cmty_recent_search'

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 5) : []
  } catch {
    return []
  }
}

export function writeRecent(list: string[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5))) } catch { /* 저장 못 해도 검색은 됨 */ }
}

/** '오후 7시' · '내일 오전 9시 30분' · '10.24. 오후 7시' */
export function hourLabel(d: Date, now = new Date()): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const t = `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시${m ? ` ${m}분` : ''}`
  if (d.toDateString() === now.toDateString()) return t
  const tm = new Date(now); tm.setDate(now.getDate() + 1)
  if (d.toDateString() === tm.toDateString()) return `내일 ${t}`
  const yd = new Date(now); yd.setDate(now.getDate() - 1)
  if (d.toDateString() === yd.toDateString()) return `어제 ${t}`
  return `${d.getMonth() + 1}.${d.getDate()}. ${t}`
}
