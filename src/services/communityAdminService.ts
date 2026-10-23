// 커뮤니티 어드민 화면용 데이터 함수.
// 커뮤니티 표는 database.ts 타입에 없어서 communityService 의 타입 없는 클라이언트(cdb)를 쓴다.
// 관리자는 RLS 의 is_admin() 으로 모든 커뮤니티 표를 읽고 쓸 수 있다.
import { cdb } from './communityService'
import type {
  CommunityBadge, CommunityBanner, CommunityBlockItem, CommunityBoard, CommunityBoardGroup, CommunityComment,
  CommunityMember, CommunityPin, CommunityPinLabel, CommunityPinScope, CommunityPost,
  CommunityReport, CommunityReportStatus, CommunitySanction, CommunityTile,
} from '../types/community'

function fail(error: { message?: string; code?: string } | null): never {
  const msg = error?.message || ''
  if (error?.code === '23505' || /duplicate key/i.test(msg)) {
    if (/nickname/i.test(msg)) throw new Error('이미 쓰는 닉네임이에요.')
    if (/instructor_id/i.test(msg)) throw new Error('이 강사는 이미 다른 회원과 연결돼 있어요.')
    if (/slug/i.test(msg)) throw new Error('이미 쓰는 주소(slug)예요.')
    throw new Error('이미 같은 값이 있어요.')
  }
  if (error?.code === '23503') throw new Error('다른 곳에서 쓰고 있어서 처리할 수 없어요.')
  if (error?.code === '23514') throw new Error('입력값 형식을 확인해 주세요.')
  throw new Error(msg || '요청을 처리하지 못했어요.')
}

/** PostgREST or() 필터에 넣을 검색어: 구분 문자 제거 */
function cleanQuery(q: string) {
  return q.trim().replace(/[,()*%\\"]/g, ' ').replace(/\s+/g, ' ').trim()
}

type MemberLite = Pick<CommunityMember, 'user_id' | 'nickname' | 'badge' | 'grade'>

async function membersByIds(ids: string[]): Promise<Map<string, MemberLite>> {
  const uniq = [...new Set(ids)].filter(Boolean)
  if (!uniq.length) return new Map()
  const { data, error } = await cdb.from('community_members').select('user_id, nickname, badge, grade').in('user_id', uniq)
  if (error) fail(error)
  return new Map(((data ?? []) as MemberLite[]).map((m) => [m.user_id, m]))
}

/** 순서 칸을 목록 순서(1부터)대로 다시 적는다. 바뀐 행만 저장. */
async function writeOrder(table: string, rows: { id: number; sort_order: number }[]) {
  const changes = rows.map((r, i) => ({ id: r.id, want: i + 1, now: r.sort_order })).filter((r) => r.want !== r.now)
  for (const c of changes) {
    const { error } = await cdb.from(table).update({ sort_order: c.want }).eq('id', c.id)
    if (error) fail(error)
  }
}

/** 목록에서 index 행을 위(-1)·아래(+1)로 옮긴 순서로 저장 */
export async function moveRow(table: string, rows: { id: number; sort_order: number }[], index: number, dir: -1 | 1) {
  const j = index + dir
  if (j < 0 || j >= rows.length) return
  const next = [...rows]
  ;[next[index], next[j]] = [next[j], next[index]]
  await writeOrder(table, next)
}

export type PostStatusFilter = 'all' | 'pinned' | 'hidden' | 'reported' | 'deleted'

export interface AdminPostRow extends CommunityPost {
  author: MemberLite | null
  report_count: number
  pins: CommunityPin[]
}

export interface AdminPinRow extends CommunityPin {
  post: Pick<CommunityPost, 'id' | 'title' | 'board_id' | 'is_hidden' | 'deleted_at'> | null
}

export interface ReportGroup {
  key: string
  target_type: 'post' | 'comment'
  target_id: number
  post_id: number
  reports: CommunityReport[]
  reasons: Record<string, number>
  statuses: CommunityReportStatus[]
  latest_at: string
  /** 대상 내용 미리보기 */
  title: string | null
  body: string | null
  board_id: number | null
  author: MemberLite | null
  is_hidden: boolean
  deleted: boolean
  missing: boolean
}

export interface UnansweredQuestion {
  id: number
  board_id: number
  title: string
  created_at: string
  comment_count: number
  is_hidden: boolean
  author: MemberLite | null
}

export interface AdminMemberRow extends CommunityMember {
  post_count: number
  sanction: CommunitySanction | null
}

const POST_COLS = 'id, board_id, author_id, head, title, body, revenue, spend, verify_status, is_hidden, hidden_reason, deleted_at, comment_count, reaction_count, view_count, image_count, instructor_answered_at, created_at, updated_at'
const OPEN_STATUSES: CommunityReportStatus[] = ['open', 'hidden']
const DONE_STATUSES: CommunityReportStatus[] = ['dismissed', 'deleted', 'restored']

export const communityAdminService = {
  // ───────── 공통 목록 ─────────
  async groups(): Promise<CommunityBoardGroup[]> {
    const { data, error } = await cdb.from('community_board_groups').select('id, name, sort_order').order('sort_order').order('id')
    if (error) fail(error)
    return (data ?? []) as CommunityBoardGroup[]
  },

  async boards(): Promise<CommunityBoard[]> {
    const { data, error } = await cdb.from('community_boards').select('*').order('sort_order').order('id')
    if (error) fail(error)
    return (data ?? []) as CommunityBoard[]
  },

  async courses(): Promise<{ id: number; title: string }[]> {
    const { data, error } = await cdb.from('courses').select('id, title').order('id', { ascending: false })
    if (error) fail(error)
    return (data ?? []) as { id: number; title: string }[]
  },

  async instructors(): Promise<{ id: number; name: string }[]> {
    const { data, error } = await cdb.from('instructors').select('id, name').order('name')
    if (error) fail(error)
    return (data ?? []) as { id: number; name: string }[]
  },

  // ───────── 게시판·묶음 ─────────
  async saveGroup(g: { id?: number; name: string; sort_order?: number }) {
    const name = g.name.trim()
    if (!name) throw new Error('묶음 이름을 적어 주세요.')
    if (g.id) {
      const { error } = await cdb.from('community_board_groups').update({ name }).eq('id', g.id)
      if (error) fail(error)
    } else {
      const { error } = await cdb.from('community_board_groups').insert({ name, sort_order: g.sort_order ?? 0 })
      if (error) fail(error)
    }
  },

  async deleteGroup(id: number) {
    const { error } = await cdb.from('community_board_groups').delete().eq('id', id)
    if (error) fail(error)
  },

  async saveBoard(b: Partial<CommunityBoard> & { id?: number }) {
    const row = {
      group_id: b.group_id ?? null,
      slug: (b.slug ?? '').trim(),
      name: (b.name ?? '').trim(),
      description: b.description?.trim() || null,
      icon: b.icon?.trim() || null,
      kind: b.kind ?? 'normal',
      read_level: b.read_level ?? 'buyer',
      write_level: b.write_level ?? 'buyer',
      course_ids: b.course_ids ?? [],
      heads: b.heads ?? [],
      allow_images: b.allow_images ?? true,
      enabled: b.enabled ?? true,
    }
    if (b.id) {
      const { error } = await cdb.from('community_boards').update(row).eq('id', b.id)
      if (error) fail(error)
    } else {
      const { error } = await cdb.from('community_boards').insert({ ...row, sort_order: b.sort_order ?? 0 })
      if (error) fail(error)
    }
  },

  async setBoardEnabled(id: number, enabled: boolean) {
    const { error } = await cdb.from('community_boards').update({ enabled }).eq('id', id)
    if (error) fail(error)
  },

  async boardPostCount(boardId: number): Promise<number> {
    const { count, error } = await cdb.from('community_posts').select('id', { count: 'exact', head: true })
      .eq('board_id', boardId).is('deleted_at', null)
    if (error) fail(error)
    return count ?? 0
  },

  /** 게시판별 최근 7일 새 글 수 */
  async boardNewCounts(boardIds: number[]): Promise<Record<number, number>> {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const out: Record<number, number> = {}
    await Promise.all(boardIds.map(async (id) => {
      const { count } = await cdb.from('community_posts').select('id', { count: 'exact', head: true })
        .eq('board_id', id).gt('created_at', since)
      out[id] = count ?? 0
    }))
    return out
  },

  // ───────── 글 관리 ─────────
  async listPosts(opts: { boardId?: number; status: PostStatusFilter; q?: string; page: number; perPage: number }): Promise<{ rows: AdminPostRow[]; total: number }> {
    let query = cdb.from('community_posts').select(POST_COLS, { count: 'exact' })
    if (opts.boardId) query = query.eq('board_id', opts.boardId)

    if (opts.status === 'deleted') query = query.not('deleted_at', 'is', null)
    else if (opts.status === 'all') query = query.is('deleted_at', null)
    if (opts.status === 'hidden') query = query.eq('is_hidden', true)
    if (opts.status === 'pinned' || opts.status === 'reported') {
      let ids: number[] = []
      if (opts.status === 'pinned') {
        const { data, error } = await cdb.from('community_pins').select('post_id')
        if (error) fail(error)
        ids = ((data ?? []) as { post_id: number }[]).map((r) => r.post_id)
      } else {
        const { data, error } = await cdb.from('community_reports').select('post_id').eq('target_type', 'post')
        if (error) fail(error)
        ids = ((data ?? []) as { post_id: number }[]).map((r) => r.post_id)
      }
      ids = [...new Set(ids)]
      if (!ids.length) return { rows: [], total: 0 }
      query = query.in('id', ids)
    }

    const q = cleanQuery(opts.q ?? '')
    if (q) {
      const { data: mem } = await cdb.from('community_members').select('user_id').ilike('nickname', `%${q}%`).limit(200)
      const userIds = ((mem ?? []) as { user_id: string }[]).map((m) => m.user_id)
      const ors = [`title.ilike.%${q}%`]
      if (userIds.length) ors.push(`author_id.in.(${userIds.join(',')})`)
      query = query.or(ors.join(','))
    }

    const from = (opts.page - 1) * opts.perPage
    const { data, error, count } = await query.order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(from, from + opts.perPage - 1)
    if (error) fail(error)
    const posts = (data ?? []) as CommunityPost[]
    if (!posts.length) return { rows: [], total: count ?? 0 }

    const ids = posts.map((p) => p.id)
    const [authors, repRes, pinRes] = await Promise.all([
      membersByIds(posts.map((p) => p.author_id)),
      cdb.from('community_reports').select('target_id').eq('target_type', 'post').in('target_id', ids),
      cdb.from('community_pins').select('*').in('post_id', ids),
    ])
    if (repRes.error) fail(repRes.error)
    if (pinRes.error) fail(pinRes.error)
    const repCount = new Map<number, number>()
    for (const r of (repRes.data ?? []) as { target_id: number }[]) repCount.set(r.target_id, (repCount.get(r.target_id) ?? 0) + 1)
    const pins = (pinRes.data ?? []) as CommunityPin[]
    return {
      total: count ?? posts.length,
      rows: posts.map((p) => ({
        ...p,
        author: authors.get(p.author_id) ?? null,
        report_count: repCount.get(p.id) ?? 0,
        pins: pins.filter((x) => x.post_id === p.id),
      })),
    }
  },

  async setPostHidden(postId: number, hidden: boolean, adminId: string, reason?: string) {
    const { error } = await cdb.from('community_posts').update(hidden
      ? { is_hidden: true, hidden_reason: reason?.trim() || '운영자 숨김', hidden_by: adminId }
      : { is_hidden: false, hidden_reason: null, hidden_by: null }).eq('id', postId)
    if (error) fail(error)
  },

  async pins(): Promise<AdminPinRow[]> {
    const { data, error } = await cdb.from('community_pins').select('*').order('sort_order').order('id')
    if (error) fail(error)
    const pins = (data ?? []) as CommunityPin[]
    if (!pins.length) return []
    const { data: posts, error: e2 } = await cdb.from('community_posts').select('id, title, board_id, is_hidden, deleted_at')
      .in('id', [...new Set(pins.map((p) => p.post_id))])
    if (e2) fail(e2)
    const pm = new Map(((posts ?? []) as AdminPinRow['post'][]).map((p) => [p!.id, p]))
    return pins.map((p) => ({ ...p, post: pm.get(p.post_id) ?? null }))
  },

  async addPin(postId: number, scope: CommunityPinScope, label: CommunityPinLabel, sortOrder: number) {
    const { error } = await cdb.from('community_pins').upsert({ post_id: postId, scope, label, sort_order: sortOrder }, { onConflict: 'post_id,scope' })
    if (error) fail(error)
  },

  async removePin(id: number) {
    const { error } = await cdb.from('community_pins').delete().eq('id', id)
    if (error) fail(error)
  },

  async myMember(userId: string): Promise<CommunityMember | null> {
    const { data, error } = await cdb.from('community_members').select('*').eq('user_id', userId).maybeSingle()
    if (error) fail(error)
    return data as CommunityMember | null
  },

  /** 운영자로 글쓰기. 닉네임이 없으면 먼저 스탭 배지로 회원 줄을 만든다. */
  async writeAsAdmin(input: { adminId: string; nickname?: string; boardId: number; head: string | null; title: string; body: string }): Promise<number> {
    const me = await this.myMember(input.adminId)
    if (!me) {
      const nick = (input.nickname ?? '').trim()
      if (nick.length < 2 || nick.length > 12) throw new Error('닉네임은 2~12자로 적어 주세요.')
      const { error } = await cdb.from('community_members').insert({ user_id: input.adminId, nickname: nick, badge: 'staff' })
      if (error) fail(error)
    }
    const { data, error } = await cdb.from('community_posts').insert({
      board_id: input.boardId,
      author_id: input.adminId,
      head: input.head || null,
      title: input.title.trim(),
      body: input.body,
    }).select('id').single()
    if (error) fail(error)
    return (data as { id: number }).id
  },

  // ───────── 홈 꾸미기 ─────────
  async banners(): Promise<CommunityBanner[]> {
    const { data, error } = await cdb.from('community_banners').select('*').order('sort_order').order('id')
    if (error) fail(error)
    return (data ?? []) as CommunityBanner[]
  },

  async saveBanner(b: Partial<CommunityBanner>): Promise<number> {
    const row = {
      eyebrow: b.eyebrow?.trim() || null,
      title: (b.title ?? '').trim(),
      subtitle: b.subtitle?.trim() || null,
      button_text: b.button_text?.trim() || null,
      link_board_id: b.link_board_id ?? null,
      link_url: b.link_url?.trim() || null,
      icon: b.icon?.trim() || null,
      color: b.color ?? 'a',
      image_url: b.image_url?.trim() || null,
      image_url_mobile: b.image_url ? b.image_url_mobile?.trim() || null : null,
      enabled: b.enabled ?? true,
    }
    if (b.id) {
      const { error } = await cdb.from('community_banners').update(row).eq('id', b.id)
      if (error) fail(error)
      return b.id
    }
    const { data, error } = await cdb.from('community_banners').insert({ ...row, sort_order: b.sort_order ?? 0 }).select('id').single()
    if (error) fail(error)
    return (data as { id: number }).id
  },

  async setBannerEnabled(id: number, enabled: boolean) {
    const { error } = await cdb.from('community_banners').update({ enabled }).eq('id', id)
    if (error) fail(error)
  },

  async deleteBanner(id: number) {
    const { error } = await cdb.from('community_banners').delete().eq('id', id)
    if (error) fail(error)
  },

  async tiles(): Promise<CommunityTile[]> {
    const { data, error } = await cdb.from('community_tiles').select('*').order('sort_order').order('id')
    if (error) fail(error)
    return (data ?? []) as CommunityTile[]
  },

  async saveTile(t: Partial<CommunityTile>) {
    const row = {
      title: (t.title ?? '').trim(),
      subtitle: t.subtitle?.trim() || null,
      icon: t.icon?.trim() || null,
      link_board_id: t.link_board_id ?? null,
      link_url: t.link_url?.trim() || null,
      highlight: t.highlight ?? false,
      enabled: t.enabled ?? true,
    }
    if (t.id) {
      const { error } = await cdb.from('community_tiles').update(row).eq('id', t.id)
      if (error) fail(error)
    } else {
      const { error } = await cdb.from('community_tiles').insert({ ...row, sort_order: t.sort_order ?? 0 })
      if (error) fail(error)
    }
  },

  async setTileEnabled(id: number, enabled: boolean) {
    const { error } = await cdb.from('community_tiles').update({ enabled }).eq('id', id)
    if (error) fail(error)
  },

  async deleteTile(id: number) {
    const { error } = await cdb.from('community_tiles').delete().eq('id', id)
    if (error) fail(error)
  },

  // ───────── 운영 대기열 ─────────
  async reportGroups(done: boolean): Promise<ReportGroup[]> {
    const { data, error } = await cdb.from('community_reports').select('*')
      .in('status', done ? DONE_STATUSES : OPEN_STATUSES)
      .order('created_at', { ascending: false }).limit(500)
    if (error) fail(error)
    const reports = (data ?? []) as CommunityReport[]
    const map = new Map<string, ReportGroup>()
    for (const r of reports) {
      const key = `${r.target_type}:${r.target_id}`
      let g = map.get(key)
      if (!g) {
        g = {
          key, target_type: r.target_type, target_id: r.target_id, post_id: r.post_id, reports: [], reasons: {}, statuses: [],
          latest_at: r.created_at, title: null, body: null, board_id: null, author: null, is_hidden: false, deleted: false, missing: true,
        }
        map.set(key, g)
      }
      g.reports.push(r)
      g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1
      if (!g.statuses.includes(r.status)) g.statuses.push(r.status)
      if (r.created_at > g.latest_at) g.latest_at = r.created_at
    }
    const groups = [...map.values()]
    if (!groups.length) return []

    const postIds = [...new Set(groups.map((g) => g.post_id))]
    const commentIds = groups.filter((g) => g.target_type === 'comment').map((g) => g.target_id)
    const [postRes, comRes] = await Promise.all([
      cdb.from('community_posts').select('id, board_id, author_id, title, body, is_hidden, deleted_at').in('id', postIds),
      commentIds.length
        ? cdb.from('community_comments').select('id, post_id, author_id, body, is_hidden, deleted_at').in('id', commentIds)
        : Promise.resolve({ data: [] as CommunityComment[], error: null }),
    ])
    if (postRes.error) fail(postRes.error)
    if (comRes.error) fail(comRes.error)
    type PostLite = Pick<CommunityPost, 'id' | 'board_id' | 'author_id' | 'title' | 'body' | 'is_hidden' | 'deleted_at'>
    const posts = new Map(((postRes.data ?? []) as PostLite[]).map((p) => [p.id, p]))
    const comments = new Map(((comRes.data ?? []) as CommunityComment[]).map((c) => [c.id, c]))
    const authorIds: string[] = []
    for (const g of groups) {
      const p = posts.get(g.post_id)
      if (g.target_type === 'post' && p) {
        Object.assign(g, { title: p.title, body: p.body, board_id: p.board_id, is_hidden: p.is_hidden, deleted: !!p.deleted_at, missing: false })
        authorIds.push(p.author_id)
      } else if (g.target_type === 'comment') {
        const c = comments.get(g.target_id)
        g.title = p?.title ?? null
        g.board_id = p?.board_id ?? null
        if (c) {
          Object.assign(g, { body: c.body, is_hidden: c.is_hidden, deleted: !!c.deleted_at, missing: false })
          authorIds.push(c.author_id)
        }
      }
    }
    const authors = await membersByIds(authorIds)
    for (const g of groups) {
      const authorId = g.target_type === 'post' ? posts.get(g.post_id)?.author_id : comments.get(g.target_id)?.author_id
      g.author = authorId ? authors.get(authorId) ?? null : null
    }
    return groups.sort((a, b) => (b.reports.length - a.reports.length) || b.latest_at.localeCompare(a.latest_at))
  },

  async markReports(g: Pick<ReportGroup, 'target_type' | 'target_id'>, status: CommunityReportStatus, adminId: string) {
    const { error } = await cdb.from('community_reports')
      .update({ status, handled_by: adminId, handled_at: new Date().toISOString() })
      .eq('target_type', g.target_type).eq('target_id', g.target_id)
    if (error) fail(error)
  },

  async setTargetHidden(g: Pick<ReportGroup, 'target_type' | 'target_id'>, hidden: boolean, adminId: string) {
    if (g.target_type === 'post') {
      await this.setPostHidden(g.target_id, hidden, adminId, hidden ? '신고 처리 숨김' : undefined)
    } else {
      const { error } = await cdb.from('community_comments').update({ is_hidden: hidden }).eq('id', g.target_id)
      if (error) fail(error)
    }
  },

  async handleReport(g: Pick<ReportGroup, 'target_type' | 'target_id'>, action: 'hide' | 'delete' | 'restore' | 'dismiss', adminId: string) {
    if (action === 'hide') {
      await this.setTargetHidden(g, true, adminId)
      await this.markReports(g, 'hidden', adminId)
    } else if (action === 'restore') {
      await this.setTargetHidden(g, false, adminId)
      await this.markReports(g, 'restored', adminId)
    } else if (action === 'dismiss') {
      await this.markReports(g, 'dismissed', adminId)
    } else {
      // 글을 완전히 지우면 신고 줄도 같이 지워지므로(외래키) 신고 상태를 먼저 기록한다.
      await this.markReports(g, 'deleted', adminId)
      const { error } = g.target_type === 'post'
        ? await cdb.rpc('community_delete_post', { p_post_id: g.target_id })
        : await cdb.rpc('community_delete_comment', { p_comment_id: g.target_id })
      if (error) fail(error)
    }
  },

  async unansweredQuestions(): Promise<UnansweredQuestion[]> {
    const { data: qb, error: e1 } = await cdb.from('community_boards').select('id').eq('kind', 'qna')
    if (e1) fail(e1)
    const boardIds = ((qb ?? []) as { id: number }[]).map((b) => b.id)
    if (!boardIds.length) return []
    const before = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    const { data, error } = await cdb.from('community_posts')
      .select('id, board_id, author_id, title, created_at, comment_count, is_hidden')
      .in('board_id', boardIds).is('instructor_answered_at', null).is('deleted_at', null).lt('created_at', before)
      .order('created_at').limit(200)
    if (error) fail(error)
    const rows = (data ?? []) as (Omit<UnansweredQuestion, 'author'> & { author_id: string })[]
    const authors = await membersByIds(rows.map((r) => r.author_id))
    return rows.map(({ author_id, ...r }) => ({ ...r, author: authors.get(author_id) ?? null }))
  },

  async remindInstructor(postId: number): Promise<number> {
    const { data, error } = await cdb.rpc('community_remind_instructor', { p_post_id: postId })
    if (error) fail(error)
    return Number(data ?? 0)
  },

  // ───────── 회원·차단 ─────────
  async listMembers(opts: { q?: string; page: number; perPage: number }): Promise<{ rows: AdminMemberRow[]; total: number }> {
    let query = cdb.from('community_members').select('*', { count: 'exact' })
    const q = cleanQuery(opts.q ?? '')
    if (q) query = query.ilike('nickname', `%${q}%`)
    const from = (opts.page - 1) * opts.perPage
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + opts.perPage - 1)
    if (error) fail(error)
    const members = (data ?? []) as CommunityMember[]
    if (!members.length) return { rows: [], total: count ?? 0 }
    const ids = members.map((m) => m.user_id)
    const [counts, sanRes] = await Promise.all([
      Promise.all(ids.map(async (id) => {
        const { count: c } = await cdb.from('community_posts').select('id', { count: 'exact', head: true })
          .eq('author_id', id).is('deleted_at', null)
        return [id, c ?? 0] as const
      })),
      cdb.from('community_sanctions').select('user_id, suspended_until, reason').in('user_id', ids),
    ])
    if (sanRes.error) fail(sanRes.error)
    const cm = new Map(counts)
    const sm = new Map(((sanRes.data ?? []) as CommunitySanction[]).map((s) => [s.user_id, s]))
    return {
      total: count ?? members.length,
      rows: members.map((m) => ({ ...m, post_count: cm.get(m.user_id) ?? 0, sanction: sm.get(m.user_id) ?? null })),
    }
  },

  async updateMember(userId: string, patch: { nickname: string; badge: CommunityBadge | null; instructor_id: number | null }) {
    const nick = patch.nickname.trim()
    if (nick.length < 2 || nick.length > 12) throw new Error('닉네임은 2~12자로 적어 주세요.')
    const { error } = await cdb.from('community_members').update({
      nickname: nick,
      badge: patch.badge,
      instructor_id: patch.badge === 'instructor' ? patch.instructor_id : null,
    }).eq('user_id', userId)
    if (error) fail(error)
  },

  async setSanction(userId: string, until: Date, reason: string, adminId: string) {
    const { error } = await cdb.from('community_sanctions').upsert({
      user_id: userId, suspended_until: until.toISOString(), reason: reason.trim() || null, created_by: adminId,
    }, { onConflict: 'user_id' })
    if (error) fail(error)
  },

  async clearSanction(userId: string) {
    const { error } = await cdb.from('community_sanctions').delete().eq('user_id', userId)
    if (error) fail(error)
  },

  async blocklist(): Promise<CommunityBlockItem[]> {
    const { data, error } = await cdb.from('community_blocklist').select('id, kind, value').order('kind').order('value')
    if (error) fail(error)
    return (data ?? []) as CommunityBlockItem[]
  },

  async addBlock(kind: 'word' | 'domain', value: string) {
    let v = value.trim()
    if (kind === 'domain') v = v.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
    if (!v) throw new Error('값을 적어 주세요.')
    const { error } = await cdb.from('community_blocklist').insert({ kind, value: v })
    if (error) fail(error)
  },

  async deleteBlock(id: number) {
    const { error } = await cdb.from('community_blocklist').delete().eq('id', id)
    if (error) fail(error)
  },
}

