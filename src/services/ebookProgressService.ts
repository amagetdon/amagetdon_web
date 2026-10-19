import { supabase } from '../lib/supabase'

// 전자책 읽음 기록 (2026-10-19) — 표: ebook_reading_progress, 저장: save_ebook_progress()
// 읽음 기록은 사이트(어드민) 안에서만 쓴다. 외부 분석 도구로 페이지 번호를 보내지 않는다.
// 표·함수가 아직 없거나 실패해도 뷰어는 그대로 열려야 하므로 오류는 모두 조용히 넘긴다.

export interface EbookReadingProgress {
  user_id: string
  ebook_id: number
  last_page: number
  max_page: number
  total_pages: number
  open_count: number
  first_opened_at: string
  last_read_at: string
}

const COLUMNS = 'user_id, ebook_id, last_page, max_page, total_pages, open_count, first_opened_at, last_read_at'

/** 진도율(가장 멀리 간 페이지 ÷ 전체, 0~100 정수) */
export const progressPercent = (p: Pick<EbookReadingProgress, 'max_page' | 'total_pages'> | null | undefined) =>
  p && p.total_pages > 0 ? Math.min(100, Math.round((p.max_page / p.total_pages) * 100)) : 0

/** 어드민 화면 공통 안내 */
export const READING_LOG_NOTE = '읽음 기록은 이 기능을 배포한 뒤부터 쌓입니다. 그 전에 읽은 기록은 없습니다.'

export const ebookProgressService = {
  async getMine(userId: string, ebookId: number): Promise<EbookReadingProgress | null> {
    try {
      const { data, error } = await supabase
        .from('ebook_reading_progress')
        .select(COLUMNS)
        .eq('user_id', userId)
        .eq('ebook_id', ebookId)
        .maybeSingle()
      if (error) return null
      return (data as EbookReadingProgress | null) ?? null
    } catch {
      return null
    }
  },

  async save(ebookId: number, page: number, total: number, opened = false): Promise<void> {
    try {
      await supabase.rpc('save_ebook_progress' as never, { p_ebook_id: ebookId, p_page: page, p_total: total, p_opened: opened } as never)
    } catch {
      // 저장 실패는 읽기를 막지 않는다
    }
  },

  /** 관리자: 한 전자책의 읽음 기록 전체 */
  async listForEbook(ebookId: number): Promise<EbookReadingProgress[]> {
    const { data, error } = await supabase.from('ebook_reading_progress').select(COLUMNS).eq('ebook_id', ebookId)
    if (error) return []
    return (data ?? []) as EbookReadingProgress[]
  },

  /** 관리자: 한 회원의 전자책 읽음 기록 */
  async listForUser(userId: string): Promise<EbookReadingProgress[]> {
    const { data, error } = await supabase.from('ebook_reading_progress').select(COLUMNS).eq('user_id', userId)
    if (error) return []
    return (data ?? []) as EbookReadingProgress[]
  },
}
