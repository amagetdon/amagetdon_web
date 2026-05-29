import { supabase } from '../lib/supabase'
import type { BoardPost, BoardPostPublic } from '../types'

// 관리자가 작성/수정 시 보내는 편집 가능 필드 (id/share_token/타임스탬프 제외)
export type BoardPostInput = Omit<BoardPost, 'id' | 'share_token' | 'created_at' | 'updated_at'>

// 티저(CTA) 항목을 비워두면 공유 페이지에서 사용할 기본값.
// 관리자 입력칸 placeholder 와 공유 페이지 fallback 이 항상 동일하도록 한 곳에서 관리.
export const BOARD_CTA_DEFAULTS = {
  previewHeight: 450,
  lockedText: '멤버에게만 공개된 게시글입니다.',
  title: '로그인하고 전체 내용을 확인해 보세요.',
  subtitle: '회원에게만 공개되는 콘텐츠입니다.',
  buttonText: '로그인하고 전체 보기',
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

  // 공유 링크(토큰) 공개 단건 조회 — anon 포함 누구나. RLS 우회 RPC.
  async getByToken(token: string) {
    const { data, error } = await supabase
      .rpc('get_board_post_by_token', { p_token: token } as never)
    if (error) throw error
    const rows = (data as BoardPostPublic[] | null) ?? []
    return rows[0] ?? null
  },
}

// 공유 링크 절대 URL 생성
export function buildShareUrl(token: string) {
  return `${window.location.origin}/board/p/${token}`
}
