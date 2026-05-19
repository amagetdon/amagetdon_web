import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// 실시간 구매 현황 — 최근 구매 내역을 세로 자동 롤링으로 노출.
// purchases → profiles(name, email) 을 조회해 클라이언트에서 마스킹 표시.
// 높이는 부모(영상 옆 컬럼)에 맞춰 h-full 로 채우고, 영상 높이만큼만 보이도록
// 마퀴 컨테이너를 overflow-hidden 처리한다.
interface FeedItem {
  key: string
  title: string
  purchasedAt: string
  link: string
  maskedName: string
  maskedEmail: string
}

function maskName(name: string | null | undefined): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return '익명'
  const chars = Array.from(trimmed)
  const stars = '*'.repeat(Math.max(3, Math.min(9, chars.length - 1)))
  return chars[0] + stars
}

function maskEmail(email: string | null | undefined): string {
  const e = (email || '').trim()
  if (!e || !e.includes('@')) return ''
  const [local, domain] = e.split('@')
  if (!local) return ''
  const stars = '*'.repeat(Math.max(3, Math.min(8, local.length - 1)))
  return `${local[0]}${stars}@${domain}`
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

export default function PurchaseFeed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase
        .from('purchases')
        .select('id, title, purchased_at, course_id, ebook_id, payment_method, profile:profiles(name, email)')
        .order('purchased_at', { ascending: false })
        .limit(30)
      if (!alive) return
      const rows = (data ?? []) as Array<{
        id: number
        title: string | null
        purchased_at: string
        course_id: number | null
        ebook_id: number | null
        payment_method: string | null
        profile: { name: string | null; email: string | null } | null
      }>
      setItems(
        rows
          // 어드민이 직접 부여한 구매는 마케팅 피드에서 제외
          .filter((r) => r.payment_method !== 'admin')
          .map((r) => ({
            key: `${r.id}`,
            title: r.title || '강의/전자책',
            purchasedAt: r.purchased_at,
            link: r.course_id ? `/course/${r.course_id}` : r.ebook_id ? `/ebook/${r.ebook_id}` : '/',
            maskedName: maskName(r.profile?.name ?? ''),
            maskedEmail: maskEmail(r.profile?.email ?? ''),
          })),
      )
      setLoading(false)
    })().catch(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  // 무한 루프를 위한 복제 (animate-applicants-roll 이 -50% 까지 이동)
  const loop = items.length > 0 ? [...items, ...items] : []

  return (
    <div className="h-full w-full flex flex-col bg-white rounded-2xl overflow-hidden min-w-0">
      {/* 헤더 — LIVE 배지(좌) + 구매현황 */}
      <div className="px-5 py-3.5 flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-500 rounded-md leading-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-[10px] font-bold text-white">LIVE</span>
        </span>
        <p className="text-base font-bold text-gray-900">구매현황</p>
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
          <div className="animate-applicants-roll">
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
