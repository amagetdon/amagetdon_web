// 검색엔진·AI 용 공개 데이터 조회 (Edge 함수 공용) — 사이트맵·llms.txt.
// anon 키로 공개 정책이 허용하는 값만 읽는다. 비공개 강의·전자책·랜딩, 유료 본문, 회원 정보는 다루지 않는다.

export const SITE = 'https://amag-class.com'

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''

async function sb<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        accept: 'application/json',
        'content-type': 'application/json',
        ...(init?.headers || {}),
      },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export interface PublicCourse { id: number; title: string; updated_at: string | null; course_type: string | null; seo: { description?: string } | null; instructor: { name: string } | null }
export interface PublicEbook { id: number; title: string; updated_at: string | null; is_free: boolean | null; seo: { description?: string } | null }
export interface PublicInstructor { id: number; name: string; headline: string | null; updated_at: string | null }
export interface PublicBoardPost { id: number; title: string; created_at: string | null; instructor_name: string | null }
export interface PublicFaq { question: string; answer: string | null }

/** 지금 열려 있는 공개 페이지 데이터 — 마감된 강의·전자책은 화면에서 목록으로 돌려보내므로 제외 */
export async function getPublicData() {
  const now = new Date().toISOString()
  const [courses, ebooks, instructors, board, faqs, settings] = await Promise.all([
    // 오픈 전(enrollment_start 미래, 사전알림 제외) 강의는 화면에서 '아직 오픈되지 않은 강의'라 제외
    sb<PublicCourse[]>(`courses?is_published=eq.true&and=(or(enrollment_deadline.is.null,enrollment_deadline.gt.${now}),or(enrollment_start.is.null,enrollment_start.lte.${now},course_type.eq.pre_alert))&select=id,title,updated_at,course_type,seo,instructor:instructors(name)&order=id.desc`),
    sb<PublicEbook[]>(`ebooks?is_published=eq.true&or=(close_date.is.null,close_date.gt.${now})&select=id,title,updated_at,is_free,seo&order=id.desc`),
    sb<PublicInstructor[]>(`instructors?is_published=eq.true&select=id,name,headline,updated_at&order=sort_order.asc`),
    sb<PublicBoardPost[]>('rpc/get_board_posts_listed', {
      method: 'POST',
      body: JSON.stringify({ p_instructor_id: null, p_limit: 500, p_offset: 0, p_paid: null }),
    }),
    sb<PublicFaq[]>('faqs?select=question,answer&order=id.asc'),
    sb<{ key: string; value: Record<string, string> }[]>('site_settings?key=in.(seo_settings,business_info)&select=key,value'),
  ])
  const setting = (k: string) => settings?.find((s) => s.key === k)?.value ?? {}
  return {
    courses: courses ?? [],
    ebooks: ebooks ?? [],
    instructors: instructors ?? [],
    board: board ?? [],
    faqs: faqs ?? [],
    seo: setting('seo_settings'),
    business: setting('business_info'),
  }
}

/** HTML 태그·엔티티를 걷어낸 한 줄 텍스트 */
export function plain(html: string | null | undefined, max = 160): string {
  const text = (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}
