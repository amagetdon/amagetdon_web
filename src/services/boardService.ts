import { supabase } from '../lib/supabase'
import type { BoardPost, BoardPostPublic, BoardPostListItem, BoardInstructor } from '../types'

// 관리자가 작성/수정 시 보내는 편집 가능 필드 (id/share_token/타임스탬프 제외)
export type BoardPostInput = Omit<BoardPost, 'id' | 'share_token' | 'created_at' | 'updated_at'>

// 티저(CTA) 항목을 비워두면 공유 페이지에서 사용할 기본값.
// 관리자 입력칸 placeholder 와 공유 페이지 fallback 이 항상 동일하도록 한 곳에서 관리.
export const BOARD_CTA_DEFAULTS = {
  previewHeight: 400,
  lockedText: '멤버에게만 공개된 게시글입니다.',
  title: '<p>카카오로 3초만에 로그인 하고,</p><p><span style="color: rgb(15, 224, 0);">[아마겟돈] 뉴스레터</span>를</p><p>확인하세요.</p>',
  subtitle: '회원에게만 공개되는 콘텐츠 입니다.',
  buttonText: '3초 만에 가입하기',
} as const

// 유료(멤버십) 글 전용 기본값 — 잠금 해제 상품이 있는 글은 로그인이 아니라 결제로 유도한다.
export const BOARD_MEMBER_CTA_DEFAULTS = {
  lockedText: '멤버에게만 공개된 게시글입니다.',
  title: '멤버십에 가입하고 전체 내용을 확인해 보세요.',
  subtitle: '멤버 전용으로 공개되는 콘텐츠입니다.',
  buttonText: '멤버십 가입하고 전체 보기',
} as const

export const boardService = {
  // 관리자 목록 — RLS 로 admin 만 조회 가능
  async getAll() {
    const { data, error } = await supabase
      .from('board_posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as BoardPost[]
  },

  async create(post: BoardPostInput) {
    const { data, error } = await supabase
      .from('board_posts')
      .insert(post as never)
      .select()
      .single()
    if (error) throw error
    return data as BoardPost
  },

  async update(id: number, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('board_posts')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as BoardPost
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('board_posts')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  // 공유 링크 재발급 — 기존 링크 즉시 무효화
  async regenerateToken(id: number) {
    const token = crypto.randomUUID().replace(/-/g, '')
    return this.update(id, { share_token: token })
  },

  // 공개 단건 조회 — 토큰(비밀 링크) 또는 id(공개 목록 글). anon 포함 누구나.
  // 잠금 판정과 본문 자르기는 서버(RPC)가 수행 — is_locked=TRUE 면 content 는 미리보기 분량뿐.
  async getPublic(params: { token?: string; id?: number }) {
    const { data, error } = await supabase
      .rpc('get_board_post_public', {
        p_token: params.token ?? null,
        p_id: params.id ?? null,
      } as never)
    if (error) throw error
    const rows = (data as BoardPostPublic[] | null) ?? []
    return rows[0] ?? null
  },

  // 공개 목록 (is_listed 글만). excerpt/잠금·유료 여부/썸네일/순번 포함.
  // 강사 필터 + 무료/유료 필터(paid: true 유료만, false 무료만) + 페이지네이션.
  async getListed(params: { instructorId?: number | null; page?: number; perPage?: number; paid?: boolean | null } = {}) {
    const perPage = params.perPage ?? 10
    const page = Math.max(1, params.page ?? 1)
    const { data, error } = await supabase
      .rpc('get_board_posts_listed', {
        p_instructor_id: params.instructorId ?? null,
        p_limit: perPage,
        p_offset: (page - 1) * perPage,
        p_paid: params.paid ?? null,
      } as never)
    if (error) throw error
    const rows = (data as BoardPostListItem[] | null) ?? []
    return { posts: rows, totalCount: rows[0]?.total_count ?? 0 }
  },

  // 목록 상단 강사 탭 — 공개 글이 있는 강사만.
  async getBoardInstructors() {
    const { data, error } = await supabase.rpc('get_board_instructors', {} as never)
    if (error) throw error
    return (data as BoardInstructor[] | null) ?? []
  },

  // 포인트로 뉴스레터 글 단건 구매 — 서버 함수 purchase_with_points(board_post)가 가격 검증·포인트 차감·구매 행·로그를
  // 한 트랜잭션으로 처리. 구독(강사)은 카드 정기결제 전용이라 포인트 구매를 받지 않는다.
  async purchaseWithPoints(item: { postId?: number; instructorId?: number }): Promise<void> {
    if (!item.postId) throw new Error('구독은 카드 정기결제만 가능합니다.')
    const { error } = await supabase.rpc('purchase_with_points' as never, { p_kind: 'board_post', p_id: item.postId, p_coupon_id: null } as never)
    if (error) throw new Error(error.message || '구매에 실패했습니다.')
  },

}

// 공유 링크 절대 URL 생성
export function buildShareUrl(token: string) {
  return `${window.location.origin}/board/p/${token}`
}
