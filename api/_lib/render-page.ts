// 공개 페이지 HTML 채우기 (middleware.ts 에서 호출) — SEO 2단계 A′.
// 빌드된 index.html 을 받아 <head> 에 페이지별 메타·JSON-LD, <div id="root"> 안에 본문을 넣는다.
// 원칙: anon 키로 공개 정책이 허용하는 값만 쓴다. 유료 본문·영상·파일 주소·회원 정보는 절대 넣지 않는다.
//       (게시판 글은 제목과, 잠기지 않은 무료 글의 요약만)

import { SITE, plain } from './public-data'

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
const BYPASS = env.VERCEL_AUTOMATION_BYPASS_SECRET || ''

// ── 작은 메모리 캐시 (엣지 인스턴스별) — 매 요청마다 DB 를 치지 않게 ─────────────────
const memo = new Map<string, { t: number; v: unknown }>()
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key)
  if (hit && Date.now() - hit.t < ttlMs) return hit.v as T
  const v = await fn()
  if (v !== null && v !== undefined) memo.set(key, { t: Date.now(), v })
  return v
}
const DATA_TTL = 5 * 60 * 1000

async function sb<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 2500)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
const q = (path: string) => cached(path, DATA_TTL, () => sb<unknown[]>(path))

// ── 빌드된 index.html (껍데기) ─────────────────────────────────────────────────
async function getShell(request: Request): Promise<string | null> {
  const origin = new URL(request.url).origin
  return cached(`shell:${origin}`, 60 * 1000, async () => {
    const headers: Record<string, string> = {}
    // 미리보기(로그인 보호)에서는 방문자의 Vercel 로그인 쿠키·우회 토큰을 그대로 넘겨야 받아진다
    const cookie = request.headers.get('cookie')
    if (cookie) headers.cookie = cookie
    if (BYPASS) headers['x-vercel-protection-bypass'] = BYPASS
    const res = await fetch(`${origin}/index.html`, { headers })
    if (!res.ok) return null
    const html = await res.text()
    return html.includes('<div id="root"></div>') ? html : null
  })
}

// ── 공용 도우미 ────────────────────────────────────────────────────────────────
const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
const kstDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }) : ''
/** strengths·features 같은 배열 — 문자열이든 {title,text} 객체든 한 줄 텍스트로 */
const lines = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object'
          ? String((x as Record<string, unknown>).title ?? (x as Record<string, unknown>).text ?? (x as Record<string, unknown>).label ?? '')
          : ''))
        .map((s) => plain(s, 200))
        .filter(Boolean)
    : []
const ul = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '')
const link = (href: string, text: string) => `<a href="${esc(href)}">${esc(text)}</a>`
/** 후기 작성자 이름 가리기: 홍길동 → 홍** */
const maskName = (n: string | null) => (n ? n.slice(0, 1) + '*'.repeat(Math.max(1, n.length - 1)) : '수강생')

type Seo = { title?: string; description?: string; ogTitle?: string; ogDescription?: string; ogImage?: string }
interface Settings { seo: Seo & { author?: string; keywords?: string }; biz: Record<string, string>; verify: { google?: string; naver?: string }; sameAs: string[] }

async function getSettings(): Promise<Settings> {
  const rows = (await q('site_settings?key=in.(seo_settings,business_info,external_services,kakao_link)&select=key,value')) as
    | { key: string; value: Record<string, unknown> }[]
    | null
  const get = (k: string) => (rows?.find((r) => r.key === k)?.value ?? {}) as Record<string, unknown>
  const ext = get('external_services') as Record<string, { code?: string; enabled?: boolean }>
  const code = (k: string) => (ext[k]?.enabled && ext[k]?.code ? String(ext[k].code) : undefined)
  return {
    seo: get('seo_settings') as Settings['seo'],
    biz: get('business_info') as Record<string, string>,
    verify: { google: code('GOOGLE_SEARCH_CONSOLE'), naver: code('NAVER_SEARCH_ADVISOR') },
    // 회사 공식 채널 (Organization.sameAs) — 관리자에 저장된 카카오 채널
    sameAs: [get('kakao_link').url].filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u)).map((u) => u.replace(/^http:/, 'https:')),
  }
}

// ── 페이지 결과 ────────────────────────────────────────────────────────────────
interface Page {
  status?: number
  title: string
  description: string
  image?: string
  h1?: string
  body?: string
  jsonld?: object[]
  noindex?: boolean
  ogType?: string
}

const crumbs = (items: [string, string][]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + path })),
})

// 강의·전자책 공개 조건 (사이트맵과 동일) — 마감·오픈 전 강의는 화면에서 목록으로 돌려보낸다
const nowIso = () => new Date().toISOString()
const OPEN_COURSE = () =>
  `is_published=eq.true&and=(or(enrollment_deadline.is.null,enrollment_deadline.gt.${nowIso()}),or(enrollment_start.is.null,enrollment_start.lte.${nowIso()},course_type.eq.pre_alert))`
const OPEN_EBOOK = () => `is_published=eq.true&or=(close_date.is.null,close_date.gt.${nowIso()})`
const isFreeType = (t: string | null) => !!t && t.includes('free')

interface CourseRow {
  id: number; title: string; description: string | null; thumbnail_url: string | null; course_type: string | null
  original_price: number | null; sale_price: number | null; enrollment_start: string | null; enrollment_deadline: string | null
  scheduled_at: string | null; strengths: unknown; features: unknown; seo: Seo | null; updated_at: string | null
  instructor: { id: number; name: string; title: string | null } | null
}
const COURSE_COLS = 'id,title,description,thumbnail_url,course_type,original_price,sale_price,enrollment_start,enrollment_deadline,scheduled_at,strengths,features,seo,updated_at,instructor:instructors(id,name,title)'

const coursePrice = (c: Pick<CourseRow, 'course_type' | 'original_price' | 'sale_price'>) => {
  const price = c.sale_price ?? c.original_price
  if (isFreeType(c.course_type)) return { label: '무료', value: 0 }
  if (!price) return { label: '가격 공개 예정', value: null }
  return { label: c.original_price && c.sale_price && c.sale_price < c.original_price ? `${won(c.sale_price)} (정가 ${won(c.original_price)})` : won(price), value: price }
}

function courseList(rows: CourseRow[]) {
  if (!rows.length) return '<p>지금 모집 중인 강의가 없습니다.</p>'
  return `<ul>${rows
    .map((c) => `<li>${link(`/course/${c.id}`, c.title)}${c.instructor ? ` — ${esc(c.instructor.name)} 강사` : ''} · ${esc(coursePrice(c).label)}</li>`)
    .join('')}</ul>`
}

async function openCourses() {
  return ((await q(`courses?${OPEN_COURSE()}&select=${COURSE_COLS}&order=sort_order.asc,id.desc`)) ?? []) as CourseRow[]
}

interface EbookRow { id: number; title: string; thumbnail_url: string | null; is_free: boolean | null; original_price: number | null; sale_price: number | null; seo: Seo | null; features: unknown; strengths: unknown; updated_at: string | null; instructor: { id: number; name: string } | null }
const EBOOK_COLS = 'id,title,thumbnail_url,is_free,original_price,sale_price,seo,features,strengths,updated_at,instructor:instructors(id,name)'
const ebookPrice = (e: EbookRow) => (e.is_free || !(e.sale_price ?? e.original_price) ? '무료' : won((e.sale_price ?? e.original_price) as number))
async function openEbooks() {
  return ((await q(`ebooks?${OPEN_EBOOK()}&select=${EBOOK_COLS}&order=sort_order.asc,id.desc`)) ?? []) as EbookRow[]
}
const ebookList = (rows: EbookRow[]) =>
  rows.length ? `<ul>${rows.map((e) => `<li>${link(`/ebook/${e.id}`, e.title)} · ${esc(ebookPrice(e))}</li>`).join('')}</ul>` : '<p>등록된 전자책이 없습니다.</p>'

interface InstructorRow { id: number; name: string; title: string | null; headline: string | null; bio: string | null; bio_bullets: unknown; careers: unknown; image_url: string | null; thumbnail_url: string | null }
async function instructors() {
  return ((await q('instructors?is_published=eq.true&select=id,name,title,headline,bio,bio_bullets,careers,image_url,thumbnail_url&order=sort_order.asc')) ?? []) as InstructorRow[]
}

interface BoardRow { id: number; title: string; excerpt: string | null; instructor_id: number | null; instructor_name: string | null; is_locked: boolean; is_paid: boolean; created_at: string | null }
async function boardPosts(instructorId: number | null = null) {
  return cached(`board:${instructorId}`, DATA_TTL, () =>
    sb<BoardRow[]>('rpc/get_board_posts_listed', {
      method: 'POST',
      body: JSON.stringify({ p_instructor_id: instructorId, p_limit: 500, p_offset: 0, p_paid: null }),
    }),
  ).then((r) => r ?? [])
}

// ── 경로별 페이지 ──────────────────────────────────────────────────────────────
type Handler = (m: RegExpMatchArray, s: Settings) => Promise<Page | null>
const site = (s: Settings) => s.biz.siteTitle || s.seo.title || '아마겟돈 클래스'

const ROUTES: [RegExp, Handler][] = [
  [/^\/$/, async (_m, s) => {
    const [courses, ebooks, people] = await Promise.all([openCourses(), openEbooks(), instructors()])
    const name = site(s)
    return {
      title: s.seo.title || name,
      description: s.seo.description || `${name} — 실전 강사진의 온라인 강의와 전자책`,
      h1: name,
      body:
        `<p>${esc(s.seo.description || '')}</p>` +
        `<h2>모집 중인 강의</h2>${courseList(courses)}` +
        `<h2>강사진</h2><ul>${people.map((p) => `<li>${link(`/instructors/${p.id}`, p.name)}${p.headline ? ` — ${esc(plain(p.headline, 80))}` : ''}</li>`).join('')}</ul>` +
        `<h2>전자책</h2>${ebookList(ebooks)}`,
      jsonld: [
        {
          '@context': 'https://schema.org', '@type': 'Organization', name: s.biz.mallName || name, alternateName: name, url: SITE,
          logo: s.biz.logoUrl || undefined, email: s.biz.email || undefined, telephone: s.biz.phone || undefined,
          address: s.biz.address ? { '@type': 'PostalAddress', streetAddress: s.biz.address, addressCountry: 'KR' } : undefined,
          founder: s.biz.ceoName ? { '@type': 'Person', name: s.biz.ceoName } : undefined,
          sameAs: s.sameAs.length ? s.sameAs : undefined,
        },
        { '@context': 'https://schema.org', '@type': 'WebSite', name, url: SITE, inLanguage: 'ko-KR' },
      ],
    }
  }],

  [/^\/academy(?:\/(free|premium))?$/, async (m) => {
    const kind = m[1] as 'free' | 'premium' | undefined
    const all = await openCourses()
    const rows = kind === 'free' ? all.filter((c) => isFreeType(c.course_type)) : kind === 'premium' ? all.filter((c) => !isFreeType(c.course_type)) : all
    const h1 = kind === 'free' ? '무료 강의' : kind === 'premium' ? '프리미엄 강의' : '전체 강의'
    return {
      title: `${h1} | 아마겟돈 클래스`,
      description: `아마겟돈 클래스 ${h1} ${rows.length}개 — ${rows.slice(0, 3).map((c) => c.title).join(', ')}`,
      h1,
      body: courseList(rows),
      jsonld: [crumbs([['홈', '/'], [h1, m[0]]])],
    }
  }],

  [/^\/course\/(\d+)$/, async (m, s) => {
    const rows = (await q(`courses?id=eq.${m[1]}&is_published=eq.true&select=${COURSE_COLS},curriculum_items(week,label,description,sort_order)`)) as
      | (CourseRow & { curriculum_items: { week: number | null; label: string; description: string | null; sort_order: number }[] })[]
      | null
    const c = rows?.[0]
    if (!c) return { status: 404, title: '강의를 찾을 수 없습니다', description: '', noindex: true }
    const open = ((await q(`courses?id=eq.${m[1]}&${OPEN_COURSE()}&select=id`)) as unknown[] | null)?.length
    const seo = c.seo || {}
    const who = c.instructor?.name
    const price = coursePrice(c)
    const desc = seo.description || plain(c.description, 150) || `${who ? `${who} 강사의 ` : ''}${c.title} — 아마겟돈 클래스 온라인 강의`
    const curriculum = [...(c.curriculum_items || [])].sort((a, b) => a.sort_order - b.sort_order)
    const schedule = [
      c.enrollment_start && `신청 시작 ${kstDate(c.enrollment_start)}`,
      c.enrollment_deadline && `신청 마감 ${kstDate(c.enrollment_deadline)}`,
      c.scheduled_at && `진행일 ${kstDate(c.scheduled_at)}`,
    ].filter(Boolean) as string[]
    return {
      title: seo.title || `${c.title}${who ? ` | ${who}` : ''} - ${site(s)}`,
      description: desc,
      image: seo.ogImage || c.thumbnail_url || undefined,
      noindex: !open,
      h1: c.title,
      body:
        (who ? `<p>강사: ${link(`/instructors/${c.instructor!.id}`, who)}</p>` : '') +
        `<p>수강료: ${esc(price.label)}</p>` +
        ul(schedule) +
        (plain(c.description, 2000) ? `<h2>강의 소개</h2><p>${esc(plain(c.description, 2000))}</p>` : '') +
        (lines(c.strengths).length ? `<h2>이 강의의 강점</h2>${ul(lines(c.strengths))}` : '') +
        (lines(c.features).length ? `<h2>강의 특징</h2>${ul(lines(c.features))}` : '') +
        (curriculum.length
          ? `<h2>커리큘럼</h2><ol>${curriculum
              .map((i) => `<li>${i.week ? `${i.week}주차 · ` : ''}${esc(i.label)}${i.description ? ` — ${esc(plain(i.description, 200))}` : ''}</li>`)
              .join('')}</ol>`
          : '') +
        `<p>${link('/academy', '전체 강의 보기')}</p>`,
      jsonld: [
        {
          '@context': 'https://schema.org', '@type': 'Course', name: c.title, description: desc, url: `${SITE}/course/${c.id}`,
          ...(c.updated_at ? { dateModified: c.updated_at } : {}),
          image: c.thumbnail_url || undefined, inLanguage: 'ko',
          provider: { '@type': 'Organization', name: s.biz.mallName || site(s), sameAs: SITE },
          ...(price.value !== null
            ? { offers: { '@type': 'Offer', price: price.value, priceCurrency: 'KRW', category: price.value ? 'Paid' : 'Free', url: `${SITE}/course/${c.id}` } }
            : {}),
          hasCourseInstance: {
            '@type': 'CourseInstance', courseMode: 'Online',
            ...(c.scheduled_at ? { startDate: c.scheduled_at } : {}),
            ...(who ? { instructor: { '@type': 'Person', name: who, url: `${SITE}/instructors/${c.instructor!.id}` } } : {}),
          },
        },
        crumbs([['홈', '/'], ['강의', '/academy'], [c.title, `/course/${c.id}`]]),
      ],
      ogType: 'product',
    }
  }],

  [/^\/instructors$/, async () => {
    const people = await instructors()
    return {
      title: '강사진 | 아마겟돈 클래스',
      description: `아마겟돈 클래스 강사 ${people.length}명 — ${people.map((p) => p.name).join(', ')}`,
      h1: '강사진',
      body: `<ul>${people.map((p) => `<li>${link(`/instructors/${p.id}`, p.name)}${p.headline ? ` — ${esc(plain(p.headline, 100))}` : ''}</li>`).join('')}</ul>`,
      jsonld: [crumbs([['홈', '/'], ['강사진', '/instructors']])],
    }
  }],

  [/^\/instructors\/(\d+)$/, async (m, s) => {
    const p = (await instructors()).find((x) => String(x.id) === m[1])
    if (!p) return { status: 404, title: '강사를 찾을 수 없습니다', description: '', noindex: true }
    const mine = (await openCourses()).filter((c) => c.instructor?.id === p.id)
    const bio = plain(p.bio, 1000)
    const desc = plain(p.headline, 80) ? `${p.name} 강사 — ${plain(p.headline, 120)}` : `${p.name} 강사 소개와 강의 — 아마겟돈 클래스`
    return {
      title: `${p.name} 강사 | 아마겟돈 클래스`,
      description: desc,
      image: p.image_url || p.thumbnail_url || undefined,
      h1: `${p.name} 강사`,
      body:
        (p.headline ? `<p>${esc(plain(p.headline, 200))}</p>` : '') +
        (bio ? `<h2>소개</h2><p>${esc(bio)}</p>` : '') +
        (lines(p.bio_bullets).length ? ul(lines(p.bio_bullets)) : '') +
        (lines(p.careers).length ? `<h2>경력</h2>${ul(lines(p.careers))}` : '') +
        `<h2>강의</h2>${courseList(mine)}`,
      jsonld: [
        {
          '@context': 'https://schema.org', '@type': 'Person', name: p.name, jobTitle: p.title || '강사', description: desc,
          image: p.image_url || p.thumbnail_url || undefined, url: `${SITE}/instructors/${p.id}`,
          worksFor: { '@type': 'Organization', name: s.biz.mallName || site(s), url: SITE },
        },
        crumbs([['홈', '/'], ['강사진', '/instructors'], [p.name, `/instructors/${p.id}`]]),
      ],
      ogType: 'profile',
    }
  }],

  [/^\/ebooks\/(free|secret)$/, async (m) => {
    const free = m[1] === 'free'
    const rows = (await openEbooks()).filter((e) => !!e.is_free === free)
    const h1 = free ? '무료 전자책' : '프리미엄 전자책'
    return {
      title: `${h1} | 아마겟돈 클래스`,
      description: `아마겟돈 클래스 ${h1} ${rows.length}권 — ${rows.slice(0, 3).map((e) => e.title).join(', ')}`,
      h1,
      body: ebookList(rows),
      jsonld: [crumbs([['홈', '/'], [h1, m[0]]])],
    }
  }],

  [/^\/ebook\/(\d+)$/, async (m, s) => {
    const rows = (await q(`ebooks?id=eq.${m[1]}&is_published=eq.true&select=${EBOOK_COLS}`)) as EbookRow[] | null
    const e = rows?.[0]
    if (!e) return { status: 404, title: '전자책을 찾을 수 없습니다', description: '', noindex: true }
    const open = ((await q(`ebooks?id=eq.${m[1]}&${OPEN_EBOOK()}&select=id`)) as unknown[] | null)?.length
    const seo = e.seo || {}
    const who = e.instructor?.name
    const desc = seo.description || `${who ? `${who} 강사의 ` : ''}${e.title} — 아마겟돈 클래스 전자책 (${ebookPrice(e)})`
    return {
      title: seo.title || `${e.title}${who ? ` | ${who}` : ''} - ${site(s)}`,
      description: desc,
      image: seo.ogImage || e.thumbnail_url || undefined,
      noindex: !open,
      h1: e.title,
      body:
        (who ? `<p>저자: ${link(`/instructors/${e.instructor!.id}`, who)}</p>` : '') +
        `<p>가격: ${esc(ebookPrice(e))}</p>` +
        (lines(e.strengths).length ? `<h2>이 책의 강점</h2>${ul(lines(e.strengths))}` : '') +
        (lines(e.features).length ? `<h2>특징</h2>${ul(lines(e.features))}` : '') +
        `<p>${link(e.is_free ? '/ebooks/free' : '/ebooks/secret', '전자책 목록 보기')}</p>`,
      jsonld: [
        {
          '@context': 'https://schema.org', '@type': 'Book', name: e.title, description: desc, url: `${SITE}/ebook/${e.id}`,
          ...(e.updated_at ? { dateModified: e.updated_at } : {}),
          image: e.thumbnail_url || undefined, inLanguage: 'ko', bookFormat: 'https://schema.org/EBook',
          ...(who ? { author: { '@type': 'Person', name: who } } : {}),
          publisher: { '@type': 'Organization', name: s.biz.mallName || site(s) },
          offers: { '@type': 'Offer', price: e.is_free ? 0 : (e.sale_price ?? e.original_price ?? 0), priceCurrency: 'KRW', url: `${SITE}/ebook/${e.id}` },
        },
        crumbs([['홈', '/'], ['전자책', e.is_free ? '/ebooks/free' : '/ebooks/secret'], [e.title, `/ebook/${e.id}`]]),
      ],
      ogType: 'product',
    }
  }],

  [/^\/reviews$/, async () => {
    const rows = ((await q('reviews?is_published=eq.true&select=author_name,title,content,rating,created_at,course:courses(title)&order=created_at.desc&limit=30')) ?? []) as
      { author_name: string | null; title: string | null; content: string | null; rating: number | null; created_at: string | null; course: { title: string } | null }[]
    return {
      title: '수강 후기 | 아마겟돈 클래스',
      description: `아마겟돈 클래스 수강생들이 남긴 실제 후기 — ${rows.slice(0, 2).map((r) => plain(r.title, 40)).join(' · ')}`,
      h1: '수강 후기',
      body: rows.length
        ? `<ul>${rows.map((r) => `<li><strong>${esc(plain(r.title, 80))}</strong>${r.rating ? ` (${r.rating}/5)` : ''} — ${esc(maskName(r.author_name))}${r.course ? `, ${esc(r.course.title)}` : ''}<p>${esc(plain(r.content, 300))}</p></li>`).join('')}</ul>`
        : '',
      jsonld: [crumbs([['홈', '/'], ['수강 후기', '/reviews']])],
    }
  }],

  [/^\/faq$/, async () => {
    const rows = ((await q('faqs?is_published=eq.true&select=question,answer&order=sort_order.asc,id.asc')) ?? []) as { question: string; answer: string | null }[]
    return {
      title: '자주 묻는 질문 | 아마겟돈 클래스',
      description: `아마겟돈 클래스 자주 묻는 질문 — ${rows.slice(0, 3).map((f) => plain(f.question, 40)).join(' · ')}`,
      h1: '자주 묻는 질문',
      body: rows.map((f) => `<h2>${esc(plain(f.question, 200))}</h2><p>${esc(plain(f.answer, 1500))}</p>`).join(''),
      jsonld: rows.length
        ? [{
            '@context': 'https://schema.org', '@type': 'FAQPage',
            mainEntity: rows.map((f) => ({ '@type': 'Question', name: plain(f.question, 300), acceptedAnswer: { '@type': 'Answer', text: plain(f.answer, 3000) } })),
          }, crumbs([['홈', '/'], ['자주 묻는 질문', '/faq']])]
        : [],
    }
  }],

  [/^\/board(?:\/instructor\/(\d+))?$/, async (m) => {
    const posts = await boardPosts(m[1] ? Number(m[1]) : null)
    const who = m[1] ? posts.find((p) => p.instructor_name)?.instructor_name : null
    const h1 = who ? `${who} 강사 뉴스레터` : '뉴스레터'
    return {
      title: `${h1} | 아마겟돈 클래스`,
      description: `아마겟돈 클래스 ${h1} — ${posts.slice(0, 3).map((p) => p.title).join(', ')}`,
      h1,
      body: posts.length ? `<ul>${posts.map((p) => `<li>${link(`/board/${p.id}`, p.title)}${p.instructor_name ? ` — ${esc(p.instructor_name)}` : ''}</li>`).join('')}</ul>` : '',
      jsonld: [crumbs([['홈', '/'], [h1, m[0]]])],
    }
  }],

  [/^\/board\/(\d+)$/, async (m) => {
    const p = (await boardPosts()).find((x) => String(x.id) === m[1])
    if (!p) return null // 목록에 없는 글(비공개·잠김 처리 등)은 원래 화면 그대로
    const showExcerpt = !p.is_locked && !p.is_paid && p.excerpt
    return {
      title: `${p.title} | 아마겟돈 클래스`,
      description: showExcerpt ? plain(p.excerpt, 150) : `${p.instructor_name ? `${p.instructor_name} 강사의 ` : ''}뉴스레터 — ${p.title}`,
      h1: p.title,
      body: (p.instructor_name ? `<p>작성: ${esc(p.instructor_name)}${p.created_at ? ` · ${esc(kstDate(p.created_at))}` : ''}</p>` : '') +
        (showExcerpt ? `<p>${esc(plain(p.excerpt, 500))}</p>` : ''),
      jsonld: [crumbs([['홈', '/'], ['뉴스레터', '/board'], [p.title, `/board/${p.id}`]])],
      ogType: 'article',
    }
  }],

  [/^\/landing\/([^/]+)$/, async (m, s) => {
    const rows = (await q(`landing_categories?slug=eq.${encodeURIComponent(decodeURIComponent(m[1]))}&is_published=eq.true&select=name,seo,content_html`)) as
      { name: string; seo: Seo | null; content_html: string | null }[] | null
    const l = rows?.[0]
    if (!l) return null // 비공개 랜딩(광고 전용 등)은 원래 화면 그대로
    const seo = l.seo || {}
    return {
      title: seo.title || `${l.name} - ${site(s)}`,
      description: seo.description || plain(l.content_html, 150) || l.name,
      image: seo.ogImage,
      h1: l.name,
      body: plain(l.content_html, 2000) ? `<p>${esc(plain(l.content_html, 2000))}</p>` : '',
    }
  }],

  [/^\/results$/, async () => {
    const rows = ((await q('results?is_published=eq.true&select=title,preview,author_name&order=sort_order.asc,created_at.desc&limit=50')) ?? []) as
      { title: string | null; preview: string | null; author_name: string | null }[]
    return {
      title: '수강생 성과 | 아마겟돈 클래스',
      description: `아마겟돈 클래스 강사·수강생이 만든 성과 — ${rows.slice(0, 3).map((r) => plain(r.title, 40)).join(' · ')}`,
      h1: '수강생 성과',
      body: rows.length
        ? `<ul>${rows.map((r) => `<li><strong>${esc(plain(r.title, 100))}</strong>${r.preview ? ` — ${esc(plain(r.preview, 150))}` : ''}${r.author_name ? ` (${esc(plain(r.author_name, 40))})` : ''}</li>`).join('')}</ul>`
        : '',
      jsonld: [crumbs([['홈', '/'], ['수강생 성과', '/results']])],
    }
  }],

  [/^\/(privacy|terms)$/, async (m) => {
    const h1 = m[1] === 'privacy' ? '개인정보처리방침' : '이용약관'
    const rows = (await q(`site_settings?key=eq.${m[1]}_html&select=value`)) as { value: { html?: string } }[] | null
    const text = plain(rows?.[0]?.value?.html, 4000)
    return {
      title: `${h1} | 아마겟돈 클래스`,
      description: text ? plain(text, 150) : `아마겟돈 클래스 ${h1}`,
      h1,
      body: text ? `<p>${esc(text)}</p>` : '',
      jsonld: [crumbs([['홈', '/'], [h1, m[0]]])],
    }
  }],

  [/^\/notice$/, async () => ({
    title: '공지사항 | 아마겟돈 클래스',
    description: '아마겟돈 클래스 공지사항',
    h1: '공지사항',
    jsonld: [crumbs([['홈', '/'], ['공지사항', '/notice']])],
  })],
]

// 앱에 있지만 손대지 않는 경로 (회원·관리자·결제·검색) — 원래 SPA 그대로
const PASS_THROUGH = [
  /^\/(login|signup|reset-password|mypage|my-classroom|onboarding|search)$/,
  /^\/admin(\/.*)?$/,
  /^\/payment\/(success|billing-success|fail)$/,
  /^\/my-ebooks\/[^/]+\/read$/,
  /^\/board\/p\/[^/]+$/,
  // vercel.json 리라이트(Umami 프록시 /u/*)·Vercel 내부 경로 — 미들웨어가 리라이트보다 먼저 돌기 때문에 반드시 통과
  /^\/(u|_vercel|\.well-known)(\/.*)?$/,
]

// ── HTML 조립 ──────────────────────────────────────────────────────────────────
function headTags(page: Page, s: Settings, path: string): string {
  const url = SITE + (path === '/' ? '' : path)
  const image = page.image || s.seo.ogImage || ''
  const siteName = site(s)
  const t = [
    `<meta name="description" content="${esc(page.description)}" />`,
    page.noindex || page.status === 404 ? '<meta name="robots" content="noindex" />' : '',
    page.status === 404 ? '' : `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="${esc(page.ogType || 'website')}" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:locale" content="ko_KR" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    image ? `<meta name="twitter:image" content="${esc(image)}" />` : '',
    s.verify.google ? `<meta name="google-site-verification" content="${esc(s.verify.google.replace(/^google-site-verification=/, ''))}" />` : '',
    s.verify.naver ? `<meta name="naver-site-verification" content="${esc(s.verify.naver.replace(/^naver-site-verification=/, ''))}" />` : '',
    // 화면 쪽 SeoHead 가 첫 로드 때 이 값들을 사이트 기본값으로 덮어쓰지 않게 하는 표시
    `<meta name="x-ssr-path" content="${esc(path)}" />`,
    ...(page.jsonld || []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
  ]
  return t.filter(Boolean).join('\n    ')
}

function footer(s: Settings): string {
  const b = s.biz
  const parts = [
    b.companyName || b.mallName, b.ceoName && `대표 ${b.ceoName}`, b.bizNumber && `사업자등록번호 ${b.bizNumber}`,
    b.ecommerceNumber && `통신판매업 ${b.ecommerceNumber}`, b.remoteAcademyNumber && `원격평생교육시설 ${b.remoteAcademyNumber}`,
    b.address, b.phone && `고객센터 ${b.phone}`, b.email,
  ].filter(Boolean)
  return parts.length ? `<footer><p>운영: ${esc(parts.join(' · '))}</p></footer>` : ''
}

function nav(): string {
  return `<nav>${[
    ['/', '홈'], ['/academy', '강의'], ['/instructors', '강사진'], ['/ebooks/free', '무료 전자책'],
    ['/reviews', '수강 후기'], ['/board', '뉴스레터'], ['/faq', '자주 묻는 질문'],
  ].map(([h, t]) => link(h, t)).join(' · ')}</nav>`
}

function assemble(shell: string, page: Page, s: Settings, path: string): string {
  const title = page.status === 404 ? `페이지를 찾을 수 없습니다 - ${site(s)}` : page.title
  let html = shell.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
  html = html.replace('</head>', `    ${headTags({ ...page, title }, s, path)}\n  </head>`)
  if (page.h1) {
    const main = `${nav()}<main><h1>${esc(page.h1)}</h1>${page.body || ''}</main>${footer(s)}`
    html = html.replace('<div id="root"></div>', `<div id="root">${main}</div>`)
  }
  return html
}

/** 공개 페이지면 채운 HTML 응답, 손대지 않을 경로면 null (호출 쪽에서 next()) */
/** 주소 정리: 끝의 / 제거 (루트는 그대로) */
export const normalizePath = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : '/')

/** 이 주소를 채워서 내보낼지 — false 면 미들웨어가 원래 SPA 를 그대로 보낸다 */
export function shouldRender(path: string): boolean {
  if (PASS_THROUGH.some((r) => r.test(path))) return false
  // 확장자가 있는 주소는 실제 파일(PDF 뷰어용 .bcmap·.pfb 등) — 손대지 않는다
  if (/\.[A-Za-z0-9]+$/.test(path.split('/').pop() || '')) return false
  return true
}

const CACHE_OK = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400'

/** /api/page 에서 호출 — 채운 HTML. 채울 수 없으면 원래 index.html 그대로(사이트는 항상 뜬다) */
export async function renderPage(request: Request, rawPath: string): Promise<Response> {
  const path = normalizePath(rawPath)
  const settingsP = getSettings()
  const shellP = getShell(request)

  let page: Page | null = null
  let matched = false
  try {
    for (const [re, handler] of ROUTES) {
      const m = path.match(re)
      if (!m) continue
      matched = true
      page = await handler(m, await settingsP)
      break
    }
    if (!matched) page = { status: 404, title: '', description: '', noindex: true } // 앱에 없는 주소 → 진짜 404 (화면은 앱의 404 페이지)
  } catch {
    page = null
  }

  const shell = await shellP
  if (!shell) return new Response('일시적인 오류입니다. 새로고침해 주세요.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
  const html = page ? assemble(shell, page, await settingsP, path) : shell
  return new Response(request.method === 'HEAD' ? null : html, {
    status: page?.status || 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // CDN 이 5분간 보관(그동안은 즉시 응답), 지난 뒤엔 옛 사본을 주면서 뒤에서 새로 만든다
      'cache-control': page ? CACHE_OK : 'public, max-age=0, s-maxage=30',
      'x-page-render': page ? 'edge' : 'fallback',
    },
  })
}
