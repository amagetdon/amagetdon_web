import imageCompression from 'browser-image-compression'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type {
  CommunityAccess, CommunityBanner, CommunityBoard, CommunityBoardGroup, CommunityComment, CommunityMember,
  CommunityMyStats, CommunityNotification, CommunityPin, CommunityPost, CommunityPostImage, CommunityPostView,
  CommunityReportReason, CommunityTile,
} from '../types/community'

// 커뮤니티 표는 database.ts 타입에 없어서 타입 없는 클라이언트로 부른다(행 모양은 types/community.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const cdb = supabase as unknown as SupabaseClient<any, 'public', any>

export const COMMUNITY_BUCKET = 'community'
export const MAX_IMAGES = 5
const POST_COLS = 'id, board_id, author_id, head, title, body, revenue, spend, verify_status, is_hidden, hidden_reason, deleted_at, comment_count, reaction_count, view_count, image_count, instructor_answered_at, created_at, updated_at'

function fail(error: { message?: string } | null): never {
  throw new Error(error?.message || '요청을 처리하지 못했어요.')
}

/** 작성자 닉네임·배지·등급과 첫 사진을 붙인다 */
async function decoratePosts(posts: CommunityPost[]): Promise<CommunityPostView[]> {
  if (!posts.length) return []
  const authorIds = [...new Set(posts.map((p) => p.author_id))]
  const withImg = posts.filter((p) => p.image_count > 0).map((p) => p.id)
  const [{ data: members }, { data: imgs }] = await Promise.all([
    cdb.from('community_members').select('user_id, nickname, badge, grade').in('user_id', authorIds),
    withImg.length
      ? cdb.from('community_post_images').select('post_id, path, sort_order').in('post_id', withImg).order('sort_order')
      : Promise.resolve({ data: [] as { post_id: number; path: string }[] }),
  ])
  const mm = new Map(((members ?? []) as ({ user_id: string } & NonNullable<CommunityPostView["author"]>)[]).map((m) => [m.user_id, m]))
  const firstImg = new Map<number, string>()
  for (const i of (imgs ?? []) as { post_id: number; path: string }[]) if (!firstImg.has(i.post_id)) firstImg.set(i.post_id, i.path)
  return posts.map((p) => ({
    ...p,
    author: mm.get(p.author_id) ?? null,
    thumb_path: firstImg.get(p.id) ?? null,
  }))
}

async function decorateComments(rows: CommunityComment[]): Promise<CommunityComment[]> {
  if (!rows.length) return rows
  const ids = [...new Set(rows.map((c) => c.author_id))]
  const { data } = await cdb.from('community_members').select('user_id, nickname, badge, grade').in('user_id', ids)
  const mm = new Map(((data ?? []) as ({ user_id: string } & NonNullable<CommunityComment['author']>)[]).map((m) => [m.user_id, m]))
  return rows.map((c) => ({ ...c, author: mm.get(c.author_id) ?? null }))
}

export interface ListPostsOptions {
  boardId?: number
  boardIds?: number[]
  head?: string
  authorId?: string
  ids?: number[]
  q?: string
  limit?: number
  /** 이 글보다 오래된 글(더보기) */
  before?: { created_at: string; id: number }
  includeDeleted?: boolean
}

// 서명 주소는 1시간짜리라 같은 화면에서 다시 쓰도록 잠깐 기억
const signedCache = new Map<string, { url: string; exp: number }>()

export const communityService = {
  // ───── 입장·회원 ─────
  async access(): Promise<CommunityAccess> {
    const { data, error } = await cdb.rpc('community_my_access')
    if (error) fail(error)
    return data as CommunityAccess
  },

  async me(userId: string): Promise<CommunityMember | null> {
    const { data, error } = await cdb.from('community_members').select('*').eq('user_id', userId).maybeSingle()
    if (error) fail(error)
    return data as CommunityMember | null
  },

  async saveNickname(userId: string, nickname: string): Promise<CommunityMember> {
    const nick = nickname.trim()
    if (nick.length < 2 || nick.length > 12) throw new Error('닉네임은 2~12자로 정해 주세요.')
    const { data, error } = await cdb.from('community_members')
      .upsert({ user_id: userId, nickname: nick, onboarded_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select('*').single()
    if (error) {
      if (error.code === '23505') throw new Error('이미 쓰는 닉네임이에요. 다른 닉네임을 정해 주세요.')
      fail(error)
    }
    return data as CommunityMember
  },

  // ───── 게시판·홈 설정 ─────
  async boards(): Promise<{ groups: CommunityBoardGroup[]; boards: CommunityBoard[] }> {
    const [g, b] = await Promise.all([
      cdb.from('community_board_groups').select('*').order('sort_order'),
      cdb.from('community_boards').select('*').order('sort_order'),
    ])
    if (g.error) fail(g.error)
    if (b.error) fail(b.error)
    return { groups: g.data as CommunityBoardGroup[], boards: b.data as CommunityBoard[] }
  },

  /** 이 회원이 읽을 수 있는 게시판 id */
  async readableBoardIds(boardIds: number[]): Promise<Set<number>> {
    const res = await Promise.all(boardIds.map((id) => cdb.rpc('community_can_read_board', { p_board_id: id })))
    return new Set(boardIds.filter((_, i) => res[i].data === true))
  },

  async canWrite(boardId: number): Promise<boolean> {
    const { data } = await cdb.rpc('community_can_write_board', { p_board_id: boardId })
    return data === true
  },

  async banners(): Promise<CommunityBanner[]> {
    const { data, error } = await cdb.from('community_banners').select('*').eq('enabled', true).order('sort_order')
    if (error) fail(error)
    return data as CommunityBanner[]
  },

  async tiles(): Promise<CommunityTile[]> {
    const { data, error } = await cdb.from('community_tiles').select('*').eq('enabled', true).order('sort_order')
    if (error) fail(error)
    return data as CommunityTile[]
  },

  /** 고정글(홈 전체 또는 그 게시판) — 읽을 수 있는 글만 돌아옴 */
  async pins(scope: 'home' | 'board', boardId?: number): Promise<(CommunityPin & { post: CommunityPostView })[]> {
    const { data, error } = await cdb.from('community_pins').select('*').eq('scope', scope).order('sort_order')
    if (error) fail(error)
    const pins = data as CommunityPin[]
    if (!pins.length) return []
    const posts = await this.listPosts({ ids: pins.map((p) => p.post_id), boardId: scope === 'board' ? boardId : undefined, limit: 50 })
    const pm = new Map(posts.map((p) => [p.id, p]))
    return pins.filter((p) => pm.has(p.post_id)).map((p) => ({ ...p, post: pm.get(p.post_id)! }))
  },

  // ───── 글 ─────
  async listPosts(o: ListPostsOptions = {}): Promise<CommunityPostView[]> {
    let q = cdb.from('community_posts').select(POST_COLS)
    if (o.boardId) q = q.eq('board_id', o.boardId)
    if (o.boardIds) q = q.in('board_id', o.boardIds.length ? o.boardIds : [-1])
    if (o.head) q = q.eq('head', o.head)
    if (o.authorId) q = q.eq('author_id', o.authorId)
    if (o.ids) q = q.in('id', o.ids.length ? o.ids : [-1])
    if (!o.includeDeleted) q = q.is('deleted_at', null)
    if (o.q) {
      const term = o.q.replace(/[%_,()]/g, ' ').trim()
      if (term) {
        const { data: mem } = await cdb.from('community_members').select('user_id').ilike('nickname', `%${term}%`).limit(50)
        const authorIds = (mem ?? []).map((m: { user_id: string }) => m.user_id)
        const ors = [`title.ilike.%${term}%`, `body.ilike.%${term}%`]
        if (authorIds.length) ors.push(`author_id.in.(${authorIds.join(',')})`)
        q = q.or(ors.join(','))
      }
    }
    if (o.before) q = q.or(`created_at.lt.${o.before.created_at},and(created_at.eq.${o.before.created_at},id.lt.${o.before.id})`)
    q = q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(o.limit ?? 20)
    const { data, error } = await q
    if (error) fail(error)
    return decoratePosts(data as CommunityPost[])
  },

  async getPost(id: number): Promise<CommunityPostView | null> {
    const { data, error } = await cdb.from('community_posts').select(POST_COLS).eq('id', id).maybeSingle()
    if (error) fail(error)
    if (!data) return null
    return (await decoratePosts([data as CommunityPost]))[0]
  },

  async viewPost(id: number): Promise<void> {
    await cdb.rpc('community_view_post', { p_post_id: id })
  },

  async createPost(input: { board_id: number; head: string | null; title: string; body: string; revenue: number | null; spend: number | null }): Promise<CommunityPost> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인이 필요해요.')
    const { data, error } = await cdb.from('community_posts').insert({ ...input, author_id: user.id }).select(POST_COLS).single()
    if (error) {
      if (error.code === '42501') throw new Error('이 게시판에는 글을 쓸 수 없어요.')
      fail(error)
    }
    return data as CommunityPost
  },

  async updatePost(id: number, input: { head: string | null; title: string; body: string; revenue: number | null; spend: number | null }): Promise<void> {
    const { error } = await cdb.from('community_posts').update(input).eq('id', id)
    if (error) fail(error)
  },

  /** 댓글이 있으면 '삭제된 글입니다'로 자리만 남음 */
  async deletePost(id: number): Promise<'soft' | 'hard'> {
    const { data: imgs } = await cdb.from('community_post_images').select('path').eq('post_id', id)
    const { data, error } = await cdb.rpc('community_delete_post', { p_post_id: id })
    if (error) fail(error)
    const paths = (imgs ?? []).map((i: { path: string }) => i.path)
    if (paths.length) await supabase.storage.from(COMMUNITY_BUCKET).remove(paths).catch(() => undefined)
    return data as 'soft' | 'hard'
  },

  // ───── 사진 ─────
  /** 사진을 줄여(가로 1600px·WebP) 비공개 버킷에 올리고 경로를 돌려준다 */
  async uploadImage(file: File): Promise<{ path: string; width: number | null; height: number | null }> {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('사진은 JPG·PNG·WebP·GIF만 올릴 수 있어요.')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인이 필요해요.')
    let out: File = file
    if (file.type !== 'image/gif') {
      try {
        const c = await imageCompression(file, { maxWidthOrHeight: 1600, maxSizeMB: 1.2, fileType: 'image/webp', initialQuality: 0.82, useWebWorker: true })
        out = new File([c], 'photo.webp', { type: 'image/webp' })
      } catch { /* 줄이기 실패 시 원본 */ }
    }
    if (out.size > 5 * 1024 * 1024) throw new Error('사진 한 장은 5MB 이하만 올릴 수 있어요.')
    const size = await new Promise<{ w: number; h: number } | null>((resolve) => {
      const img = new Image()
      img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(img.src) }
      img.onerror = () => resolve(null)
      img.src = URL.createObjectURL(out)
    })
    const ext = out.type === 'image/gif' ? 'gif' : out.type === 'image/webp' ? 'webp' : out.type === 'image/png' ? 'png' : 'jpg'
    const path = `${user.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    const { error } = await supabase.storage.from(COMMUNITY_BUCKET).upload(path, out, { contentType: out.type, upsert: false })
    if (error) fail(error)
    return { path, width: size?.w ?? null, height: size?.h ?? null }
  },

  async attachImages(postId: number, items: { path: string; width: number | null; height: number | null }[], startOrder = 0): Promise<void> {
    if (!items.length) return
    const { data: { user } } = await supabase.auth.getUser()
    const rows = items.map((it, i) => ({ post_id: postId, user_id: user!.id, path: it.path, width: it.width, height: it.height, sort_order: startOrder + i }))
    const { error } = await cdb.from('community_post_images').insert(rows)
    if (error) fail(error)
  },

  async removeImage(imageId: number, path: string): Promise<void> {
    const { error } = await cdb.from('community_post_images').delete().eq('id', imageId)
    if (error) fail(error)
    await supabase.storage.from(COMMUNITY_BUCKET).remove([path]).catch(() => undefined)
  },

  /** 올렸지만 글에 붙이지 못한 사진 지우기 */
  async discardUploads(paths: string[]): Promise<void> {
    if (paths.length) await supabase.storage.from(COMMUNITY_BUCKET).remove(paths).catch(() => undefined)
  },

  async images(postId: number): Promise<CommunityPostImage[]> {
    const { data, error } = await cdb.from('community_post_images').select('*').eq('post_id', postId).order('sort_order')
    if (error) fail(error)
    return data as CommunityPostImage[]
  },

  /** 비공개 사진의 1시간짜리 주소 */
  async signedUrls(paths: string[]): Promise<Record<string, string>> {
    const now = Date.now()
    const out: Record<string, string> = {}
    const need = paths.filter((p) => {
      const c = signedCache.get(p)
      if (c && c.exp > now + 60_000) { out[p] = c.url; return false }
      return true
    })
    if (need.length) {
      const { data } = await supabase.storage.from(COMMUNITY_BUCKET).createSignedUrls(need, 3600)
      for (const d of data ?? []) {
        if (d.signedUrl && d.path) {
          out[d.path] = d.signedUrl
          signedCache.set(d.path, { url: d.signedUrl, exp: now + 3600_000 })
        }
      }
    }
    return out
  },

  // ───── 댓글 ─────
  async comments(postId: number): Promise<CommunityComment[]> {
    const { data, error } = await cdb.from('community_comments').select('*').eq('post_id', postId).order('created_at')
    if (error) fail(error)
    return decorateComments(data as CommunityComment[])
  },

  async addComment(postId: number, body: string, parentId: number | null = null): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인이 필요해요.')
    const { error } = await cdb.from('community_comments').insert({ post_id: postId, body: body.trim(), parent_id: parentId, author_id: user.id })
    if (error) {
      if (error.code === '42501') throw new Error('이 글에는 댓글을 달 수 없어요.')
      fail(error)
    }
  },

  async updateComment(id: number, body: string): Promise<void> {
    const { error } = await cdb.from('community_comments').update({ body: body.trim() }).eq('id', id)
    if (error) fail(error)
  },

  async deleteComment(id: number): Promise<void> {
    const { error } = await cdb.rpc('community_delete_comment', { p_comment_id: id })
    if (error) fail(error)
  },

  async pinComment(id: number, pinned: boolean): Promise<void> {
    const { error } = await cdb.from('community_comments').update({ is_pinned: pinned }).eq('id', id)
    if (error) fail(error)
  },

  /** 내가 댓글 단 글 id(최근순) */
  async myCommentedPostIds(userId: string, limit = 50): Promise<number[]> {
    const { data } = await cdb.from('community_comments').select('post_id, created_at').eq('author_id', userId)
      .is('deleted_at', null).order('created_at', { ascending: false }).limit(200)
    return [...new Set((data ?? []).map((r: { post_id: number }) => r.post_id))].slice(0, limit)
  },

  // ───── 반응·저장·신고 ─────
  async myLikes(postIds: number[]): Promise<Set<number>> {
    if (!postIds.length) return new Set()
    const { data } = await cdb.from('community_reactions').select('post_id').eq('kind', 'like').in('post_id', postIds)
    return new Set((data ?? []).map((r: { post_id: number }) => r.post_id))
  },

  async setLike(postId: number, on: boolean): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인이 필요해요.')
    const r = on
      ? await cdb.from('community_reactions').insert({ post_id: postId, user_id: user.id, kind: 'like' })
      : await cdb.from('community_reactions').delete().eq('post_id', postId).eq('user_id', user.id).eq('kind', 'like')
    if (r.error && r.error.code !== '23505') fail(r.error)
  },

  async myLikedPostIds(userId: string, limit = 50): Promise<number[]> {
    const { data } = await cdb.from('community_reactions').select('post_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
    return [...new Set((data ?? []).map((r: { post_id: number }) => r.post_id))]
  },

  async isSaved(postId: number): Promise<boolean> {
    const { data } = await cdb.from('community_saves').select('post_id').eq('post_id', postId).maybeSingle()
    return !!data
  },

  async setSaved(postId: number, on: boolean): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인이 필요해요.')
    const r = on
      ? await cdb.from('community_saves').insert({ post_id: postId, user_id: user.id })
      : await cdb.from('community_saves').delete().eq('post_id', postId).eq('user_id', user.id)
    if (r.error && r.error.code !== '23505') fail(r.error)
  },

  async mySavedPostIds(userId: string, limit = 50): Promise<number[]> {
    const { data } = await cdb.from('community_saves').select('post_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
    return (data ?? []).map((r: { post_id: number }) => r.post_id)
  },

  async report(input: { target_type: 'post' | 'comment'; target_id: number; post_id: number; reason: CommunityReportReason; detail?: string }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인이 필요해요.')
    const { error } = await cdb.from('community_reports').insert({ ...input, detail: input.detail?.trim() || null, reporter_id: user.id })
    if (error) {
      if (error.code === '23505') throw new Error('이미 신고한 글이에요.')
      fail(error)
    }
  },

  // ───── 인기·구독·새 글 ─────
  async hot(kind: 'now' | 'week'): Promise<{ posts: CommunityPostView[]; computedAt: string | null }> {
    const { data, error } = await cdb.rpc('community_get_hot', { p_kind: kind })
    if (error) fail(error)
    const rows = (data ?? []) as { rank: number; post_id: number; computed_at: string }[]
    if (!rows.length) return { posts: [], computedAt: null }
    const posts = await this.listPosts({ ids: rows.map((r) => r.post_id), limit: 50 })
    const pm = new Map(posts.map((p) => [p.id, p]))
    return { posts: rows.map((r) => pm.get(r.post_id)).filter(Boolean) as CommunityPostView[], computedAt: rows[0].computed_at }
  },

  async favorites(): Promise<number[]> {
    const { data } = await cdb.from('community_favorites').select('board_id').order('created_at')
    return (data ?? []).map((r: { board_id: number }) => r.board_id)
  },

  async setFavorite(boardId: number, on: boolean): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인이 필요해요.')
    const r = on
      ? await cdb.from('community_favorites').insert({ user_id: user.id, board_id: boardId })
      : await cdb.from('community_favorites').delete().eq('user_id', user.id).eq('board_id', boardId)
    if (r.error && r.error.code !== '23505') fail(r.error)
  },

  async markBoardRead(boardId: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await cdb.from('community_board_reads').upsert({ user_id: user.id, board_id: boardId, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,board_id' })
  },

  async newCounts(): Promise<Record<number, number>> {
    const { data } = await cdb.rpc('community_board_new_counts')
    const out: Record<number, number> = {}
    for (const r of (data ?? []) as { board_id: number; new_count: number }[]) out[r.board_id] = r.new_count
    return out
  },

  /** 이 글들 중 내가 이미 본 글 id */
  async seenPostIds(postIds: number[]): Promise<Set<number>> {
    if (!postIds.length) return new Set()
    const { data } = await cdb.from('community_post_views').select('post_id').in('post_id', postIds)
    return new Set((data ?? []).map((r: { post_id: number }) => r.post_id))
  },

  // ───── 알림·내정보 ─────
  async notifications(limit = 50): Promise<CommunityNotification[]> {
    const { data, error } = await cdb.from('community_notifications').select('*').order('created_at', { ascending: false }).limit(limit)
    if (error) fail(error)
    return data as CommunityNotification[]
  },

  async unreadCount(): Promise<number> {
    const { count } = await cdb.from('community_notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
    return count ?? 0
  },

  async markNotificationsRead(ids?: number[]): Promise<void> {
    let q = cdb.from('community_notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    if (ids?.length) q = q.in('id', ids)
    await q
  },

  async myStats(): Promise<CommunityMyStats> {
    const { data, error } = await cdb.rpc('community_my_stats')
    if (error) fail(error)
    return data as CommunityMyStats
  },
}
