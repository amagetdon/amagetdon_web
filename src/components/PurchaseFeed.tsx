import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// 실시간 구매 현황 — 최근 실제 구매 + 더미 구매를 섞어 시간순 정렬한 세로 자동 롤링.
// 더미는 실제 강의/전자책 제목을 사용해 클릭 시 해당 상세로 이동 가능.
// 표시 이름은 첫 글자만 + 별표 / 이메일은 앞 3글자만 + 별표, 내부 도메인 키워드(min-company, amag-class)는 ***로 치환.
interface FeedItem {
  key: string
  title: string
  purchasedAt: string
  link: string
  maskedName: string
  maskedEmail: string
}

// 이름은 첫 글자만 노출하고 나머지는 모두 마스킹 — "이상민" → "이**", "김미" → "김*"
function maskName(name: string | null | undefined): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return '익명'
  const chars = Array.from(trimmed)
  if (chars.length <= 1) return chars[0] + '**'
  return chars[0] + '*'.repeat(chars.length - 1)
}

// 도메인 내부 키워드만 별표로 치환 (.co.kr 등 나머지는 유지)
const INTERNAL_EMAIL_KEYWORDS = /min-company|amag-class/gi

// 로컬파트는 앞 3글자 노출 + 별표
function maskEmail(email: string | null | undefined): string {
  const e = (email || '').trim()
  if (!e || !e.includes('@')) return ''
  const [local, domain] = e.split('@')
  if (!local || !domain) return ''
  const chars = Array.from(local)
  const visible = chars.slice(0, 3).join('')
  const stars = '*'.repeat(Math.max(3, Math.min(8, chars.length - 3)))
  const maskedLocal = visible + stars
  const maskedDomain = domain.replace(INTERNAL_EMAIL_KEYWORDS, '***')
  return `${maskedLocal}@${maskedDomain}`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return '방금 전'
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}일 전`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}개월 전`
  return `${Math.floor(mo / 12)}년 전`
}

// 더미 데이터 생성 — 실제 강의/전자책 제목을 무작위로 골라 사용
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전', '홍', '고', '문', '양', '손', '배', '백', '허', '유', '남']
const GIVEN_NAMES = ['민수', '지원', '서윤', '하준', '도윤', '예준', '시우', '주원', '지호', '하은', '서연', '지우', '서아', '하윤', '윤서', '시연', '수아', '나은', '예원', '지안', '소율', '채원', '지유', '윤아', '은서', '서현', '유진', '민서', '예린', '소이', '현우', '재윤', '태윤', '준서', '건우', '우진', '서준', '연우']
const DOMAINS = ['gmail.com', 'naver.com', 'kakao.com', 'daum.net', 'nate.com']

// 성씨 로마자 (kim, lee, ...) — 이메일을 자연스럽게 만들기 위한 사전
const SURNAME_ROMAN: Record<string, string> = {
  '김': 'kim', '이': 'lee', '박': 'park', '최': 'choi', '정': 'jung', '강': 'kang',
  '조': 'cho', '윤': 'yoon', '장': 'jang', '임': 'lim', '한': 'han', '오': 'oh',
  '서': 'seo', '신': 'shin', '권': 'kwon', '황': 'hwang', '안': 'ahn', '송': 'song',
  '류': 'ryu', '전': 'jeon', '홍': 'hong', '고': 'ko', '문': 'moon', '양': 'yang',
  '손': 'son', '배': 'bae', '백': 'baek', '허': 'heo', '유': 'yoo', '남': 'nam',
}

// 한글 → QWERTY (영문 자판으로 한글 칠 때 나오는 영문) 변환 — 예: 김 → rla, 박 → qkr
const QWERTY_CHO = ['r','R','s','e','E','f','a','q','Q','t','T','d','w','W','c','z','x','v','g']
const QWERTY_JUNG = ['k','o','i','O','j','p','u','P','h','hk','ho','hl','y','n','nj','np','nl','b','m','ml','l']
const QWERTY_JONG = ['', 'r','R','rt','s','sw','sg','e','f','fr','fa','fq','ft','fx','fv','fg','a','q','qt','t','T','d','w','c','z','x','v','g']

function hangulToQwerty(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const offset = code - 0xAC00
      out += QWERTY_CHO[Math.floor(offset / 588)]
        + QWERTY_JUNG[Math.floor((offset % 588) / 28)]
        + QWERTY_JONG[offset % 28]
    } else {
      out += ch
    }
  }
  return out.toLowerCase()
}

function generateDummies(products: { link: string; title: string }[], count: number): FeedItem[] {
  if (products.length === 0) return []
  const now = Date.now()
  const items: FeedItem[] = []
  for (let i = 0; i < count; i++) {
    const product = products[Math.floor(Math.random() * products.length)]
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)]
    const given = GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)]
    const fullName = surname + given
    // 최근 7일 내, 최근으로 갈수록 분포 가중 (power=1.5)
    const minutesAgo = Math.floor(Math.pow(Math.random(), 1.5) * 7 * 24 * 60)
    const purchasedAt = new Date(now - minutesAgo * 60_000).toISOString()
    const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)]
    // 50% 확률로 이름 기반 이메일, 50% 확률로 랜덤 — 더미가 가짜 같지 않도록.
    let local: string
    const r = Math.random()
    if (r < 0.25) {
      // (1/4) 풀네임 한글 → QWERTY (예: 김민수 → rlaalstn) + 가끔 숫자
      local = hangulToQwerty(fullName)
      if (Math.random() < 0.4) local += String(Math.floor(Math.random() * 99) + 1)
    } else if (r < 0.5) {
      // (1/4) 성씨 로마자 + 숫자 (예: kim2847)
      const roman = SURNAME_ROMAN[surname] ?? hangulToQwerty(surname)
      local = roman + String(Math.floor(Math.random() * 9000 + 100))
    } else {
      // (1/2) 기존처럼 무작위 로컬파트
      const c1 = String.fromCharCode(97 + Math.floor(Math.random() * 26))
      const c2 = String.fromCharCode(97 + Math.floor(Math.random() * 26))
      const num = Math.floor(Math.random() * 9000 + 1000)
      local = `${c1}${c2}${num}`
    }
    items.push({
      key: `d-${i}`,
      title: product.title,
      purchasedAt,
      link: product.link,
      maskedName: maskName(fullName),
      maskedEmail: maskEmail(`${local}@${domain}`),
    })
  }
  return items
}

// 항목 수와 무관하게 일정한 롤링 속도를 유지하기 위한 기준 속도 (픽셀/초)
const ROLL_SPEED_PX_PER_SEC = 100

export default function PurchaseFeed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const rollRef = useRef<HTMLDivElement>(null)
  const [rollDuration, setRollDuration] = useState(25)

  useEffect(() => {
    let alive = true
    ;(async () => {
      // 실구매 + 현재 판매 중인 강의·전자책 목록 병렬 조회.
      // 더미가 종료/비공개 상품을 가리키지 않도록 "공개 + 판매 중 + 등록기간/오픈기간 유효" 필터링.
      const nowIso = new Date().toISOString()
      const [purchasesRes, coursesRes, ebooksRes] = await Promise.all([
        supabase
          .from('purchases')
          .select('id, title, purchased_at, course_id, ebook_id, payment_method, profile:profiles(name, email, role)')
          .order('purchased_at', { ascending: false })
          .limit(100),
        supabase
          .from('courses')
          .select('id, title')
          .eq('is_published', true)
          .eq('is_on_sale', true)
          .or(`enrollment_start.is.null,enrollment_start.lte.${nowIso}`)
          .or(`enrollment_deadline.is.null,enrollment_deadline.gt.${nowIso}`)
          // 강의일시가 가장 최근인 것부터 — 시리즈가 있을 때 최신 기수 위주로 더미가 만들어짐
          .order('scheduled_at', { ascending: false, nullsFirst: false })
          .limit(6),
        supabase
          .from('ebooks')
          .select('id, title')
          .eq('is_published', true)
          .eq('is_on_sale', true)
          .or(`open_date.is.null,open_date.lte.${nowIso}`)
          .or(`close_date.is.null,close_date.gt.${nowIso}`),
      ])
      if (!alive) return

      // 실구매 매핑 — 어드민/관리자 본인 구매 제외
      const realItems: FeedItem[] = ((purchasesRes.data ?? []) as Array<{
        id: number
        title: string | null
        purchased_at: string
        course_id: number | null
        ebook_id: number | null
        payment_method: string | null
        profile: { name: string | null; email: string | null; role: string | null } | null
      }>)
        .filter((r) => r.payment_method !== 'admin' && r.profile?.role !== 'admin')
        .map((r) => ({
          key: `r-${r.id}`,
          title: r.title || '강의/전자책',
          purchasedAt: r.purchased_at,
          link: r.course_id ? `/course/${r.course_id}` : r.ebook_id ? `/ebook/${r.ebook_id}` : '/',
          maskedName: maskName(r.profile?.name ?? ''),
          maskedEmail: maskEmail(r.profile?.email ?? ''),
        }))

      // 더미용 상품 풀 (실제 강의/전자책)
      const products: { link: string; title: string }[] = [
        ...((coursesRes.data ?? []) as { id: number; title: string }[]).map((c) => ({ link: `/course/${c.id}`, title: c.title })),
        ...((ebooksRes.data ?? []) as { id: number; title: string }[]).map((e) => ({ link: `/ebook/${e.id}`, title: e.title })),
      ]
      const dummies = generateDummies(products, 40)

      // 실구매 + 더미 병합 후 최신순 정렬
      const merged = [...realItems, ...dummies].sort(
        (a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime(),
      )

      setItems(merged)
      setLoading(false)
    })().catch(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  // 항목 높이(=총량)에 비례해 애니메이션 시간을 조정 → 항목 수와 무관하게 일정한 속도(px/초) 유지.
  // 기존엔 고정 25s 였기에 항목이 많을수록 더 긴 거리를 같은 시간에 이동해 빨라지는 문제가 있었다.
  useEffect(() => {
    const el = rollRef.current
    if (!el || items.length === 0) return
    const measure = () => {
      // el 은 동일 세트를 2번 담으므로(loop) 한 세트 높이 = 전체 높이 / 2
      const oneSetHeight = el.scrollHeight / 2
      if (oneSetHeight > 0) setRollDuration(oneSetHeight / ROLL_SPEED_PX_PER_SEC)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [items])

  // 무한 루프를 위한 복제 (animate-applicants-roll 이 -50% 까지 이동)
  const loop = items.length > 0 ? [...items, ...items] : []

  return (
    <div className="h-full w-full flex flex-col bg-white rounded-2xl overflow-hidden min-w-0">
      {/* 헤더 — LIVE 배지(좌) + 구매현황 */}
      <div className="px-5 py-3.5 flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500 rounded-md leading-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white live-pulse-dot" />
          <span className="text-xs font-bold text-white">LIVE</span>
        </span>
        <p className="text-base font-bold text-gray-900 relative -top-px">구매현황</p>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          불러오는 중…
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          최근 구매 내역이 없습니다.
        </div>
      ) : (
        <div
          className="flex-1 min-h-0 relative overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
          }}
        >
          <div
            ref={rollRef}
            className="animate-applicants-roll"
            style={{ animationDuration: `${rollDuration}s` }}
          >
            {loop.map((p, i) => (
              <Link
                key={`${p.key}-${i}`}
                to={p.link}
                className="block px-5 py-3 hover:bg-gray-50 no-underline transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <p className="text-sm font-bold text-gray-900 shrink-0">{p.maskedName}</p>
                    {p.maskedEmail && (
                      <p className="text-xs text-gray-400 truncate">{p.maskedEmail}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                    <span className="text-gray-900">{timeAgo(p.purchasedAt)}</span> 업데이트
                  </p>
                </div>
                <p className="text-sm text-gray-600 truncate mt-1">{p.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
