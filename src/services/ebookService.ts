import { supabase } from '../lib/supabase'
import { getCached, setCache, clearCache } from '../lib/cache'
import type { EbookWithInstructor } from '../types'

// PDF 주소(file_url)는 공개 조회 권한이 없다 — ebooks 는 select('*') 금지, 이 목록을 쓸 것.
// 주소가 필요하면 getFileUrl(구매자·관리자만 서버 함수로 받음), 존재 여부는 has_file.
export const EBOOK_PUBLIC_COLUMNS = 'id, instructor_id, title, thumbnail_url, original_price, sale_price, is_free, is_hot, is_published, duration_days, sort_order, created_at, updated_at, landing_image_url, is_on_sale, search_keywords, strengths, features, seo, reward_points, max_purchases, discount_start, discount_end, related_ebook_ids, open_date, close_date, refund_policy, default_webhooks_seeded, landing_image_urls, landing_image_links, has_file'

export const ebookService = {
  // includeUnpublished 는 관리자 목록 전용. 공개 화면은 RLS 의 "관리자 전체 읽기" 정책 때문에 관리자 계정에서
  // 비공개 전자책이 노출되므로 기본값(false)에서 is_published 를 명시 필터.
  async getAll(options?: { isFree?: boolean; limit?: number; includeUnpublished?: boolean }) {
    const key = `ebooks:${options?.isFree ?? 'all'}:${options?.limit ?? 'all'}:${options?.includeUnpublished ? 'all' : 'pub'}`
    const cached = getCached<EbookWithInstructor[]>(key)
    if (cached) return cached
    let query = supabase
      .from('ebooks')
      .select(`${EBOOK_PUBLIC_COLUMNS}, instructor:instructors(id, name)`)
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (!options?.includeUnpublished) query = query.eq('is_published', true)
    if (options?.isFree !== undefined) query = query.eq('is_free', options.isFree)
    if (options?.limit) query = query.limit(options.limit)
    const { data, error } = await query
    if (error) throw error
    return setCache(key, data as EbookWithInstructor[])
  },

  async getById(id: number) {
    const { data, error } = await supabase
      .from('ebooks')
      .select(`${EBOOK_PUBLIC_COLUMNS}, instructor:instructors(id, name)`)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as EbookWithInstructor
  },

  async getByInstructor(instructorId: number) {
    const { data, error } = await supabase
      .from('ebooks')
      .select(`${EBOOK_PUBLIC_COLUMNS}, instructor:instructors(id, name)`)
      .eq('instructor_id', instructorId)
      .eq('is_published', true)
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as EbookWithInstructor[]
  },

  /** 구매자(만료 전)·관리자만 PDF 주소를 받는다. 권한이 없거나 파일이 없으면 null */
  async getFileUrl(id: number): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_ebook_file_url', { p_ebook_id: id } as never)
    if (error) throw error
    return (data as string | null) ?? null
  },

  invalidate() { clearCache('ebooks') },

  async create(ebook: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('ebooks')
      .insert(ebook as never)
      .select(EBOOK_PUBLIC_COLUMNS)
      .single()
    if (error) throw error
    this.invalidate()
    return data
  },

  async update(id: number, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('ebooks')
      .update(updates as never)
      .eq('id', id)
      .select(EBOOK_PUBLIC_COLUMNS)
      .single()
    if (error) throw error
    this.invalidate()
    return data
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('ebooks')
      .delete()
      .eq('id', id)
    if (error) throw error
    this.invalidate()
  },
}
