import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { boardService } from '../services/boardService'
import { useAuth } from '../contexts/AuthContext'
import Pagination from '../components/Pagination'
import { InstructorAvatar, PaidBadge, VerifiedBadge, membershipPriceLabel } from '../components/BoardNewsletterBits'
import BoardCheckoutModal, { type BoardCheckoutItem } from '../components/BoardCheckoutModal'
import { encodePostId } from '../utils/postHash'
import type { BoardPostListItem, BoardInstructor } from '../types'

const PER_PAGE = 10
type PaidFilter = 'all' | 'free' | 'paid'

// 강사 뉴스레터 페이지 (bcave 크리에이터 페이지 참조) —
// 상단 프로필 히어로(칼럼 수·경력 배지·구독자·가격·구독 버튼) + №순번 글 목록(전체/무료/유료 필터).
export default function BoardInstructorPage() {
  const { id } = useParams<{ id: string }>()
  const instructorId = id && /^\d+$/.test(id) ? Number(id) : null
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const filter = (searchParams.get('filter') as PaidFilter) || 'all'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [instructor, setInstructor] = useState<BoardInstructor | null>(null)
  const [insStatus, setInsStatus] = useState<'loading' | 'ok' | 'notfound'>('loading')
  const [posts, setPosts] = useState<BoardPostListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [checkout, setCheckout] = useState<BoardCheckoutItem | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (instructor?.name) {
      const prev = document.title
      document.title = `${instructor.name} 뉴스레터`
      return () => { document.title = prev }
    }
  }, [instructor?.name])

  useEffect(() => {
    let active = true
    if (authLoading) return
    if (!instructorId) { setInsStatus('notfound'); return }
    setInsStatus('loading')
    boardService.getBoardInstructors()
      .then((list) => {
        if (!active) return
        const found = list.find((i) => i.id === instructorId) ?? null
        setInstructor(found)
        setInsStatus(found ? 'ok' : 'notfound')
      })
      .catch(() => { if (active) setInsStatus('notfound') })
    return () => { active = false }
  }, [instructorId, authLoading, user?.id, reloadKey])

  useEffect(() => {
    let active = true
    if (authLoading || !instructorId) return
    setLoading(true)
    boardService.getListed({
      instructorId,
      page,
      perPage: PER_PAGE,
      paid: filter === 'all' ? null : filter === 'paid',
    })
      .then(({ posts, totalCount }) => {
        if (!active) return
        setPosts(posts)
        setTotalCount(totalCount)
      })
      .catch(() => { if (active) { setPosts([]); setTotalCount(0) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [instructorId, page, filter, authLoading, user?.id, reloadKey])

  const setFilter = (f: PaidFilter) => {
    const next = new URLSearchParams()
    if (f !== 'all') next.set('filter', f)
    setSearchParams(next)
  }

  const changePage = (p: number) => {
    const next = new URLSearchParams(searchParams)
    if (p > 1) next.set('page', String(p))
    else next.delete('page')
    setSearchParams(next)
    window.scrollTo(0, 0)
  }

  if (insStatus === 'loading' || authLoading) {
    return (
      <section className="w-full bg-white min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
      </section>
    )
  }

  if (insStatus === 'notfound' || !instructor) {
    return (
      <section className="w-full bg-white min-h-[60vh] flex items-center justify-center px-5">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-user-off text-gray-400 text-2xl" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">강사를 찾을 수 없습니다</h1>
          <p className="text-sm text-gray-500 mb-5">발행된 뉴스레터가 없거나 삭제된 강사입니다.</p>
          <Link to="/board" className="text-sm text-[#2ED573] font-semibold no-underline hover:underline">← 아마겟돈 뉴스레터</Link>
        </div>
      </section>
    )
  }

  const price = membershipPriceLabel(instructor.sub_price, instructor.sub_days)
  const badges = (instructor.careers ?? []).filter((c) => c.trim())
  const totalPages = Math.ceil(totalCount / PER_PAGE)

  const openSubscribe = () => {
    if (!instructor.sub_price) return
    setCheckout({
      kind: 'subscription',
      id: instructor.id,
      title: `${instructor.name} 뉴스레터 구독`,
      price: instructor.sub_price,
      subDays: instructor.sub_days,
    })
  }

  return (
    <section className="w-full bg-white py-12 max-sm:py-8 min-h-[60vh]">
      <div className="max-w-[1200px] mx-auto px-5">
        <Link to="/board" className="inline-flex items-center gap-1 text-sm text-gray-400 no-underline hover:text-gray-600 mb-8 transition-colors">
          <i className="ti ti-chevron-left text-base" /> 아마겟돈 뉴스레터
        </Link>

        {/* 프로필 히어로 */}
        <div className="flex items-start gap-6 max-sm:gap-4 pb-10 mb-2 border-b border-gray-200">
          <InstructorAvatar src={instructor.image_url} name={instructor.name} className="w-24 h-24 max-sm:w-16 max-sm:h-16 border border-gray-100" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1faf5c] mb-1.5">
              Newsletter · {instructor.post_count}개의 칼럼
            </p>
            <h1 className="text-3xl max-sm:text-2xl font-bold text-gray-900 leading-tight flex items-center flex-wrap gap-2">
              {instructor.name}
              <VerifiedBadge className="w-6 h-6 max-sm:w-5 max-sm:h-5" />
              {instructor.title && <span className="text-base max-sm:text-sm font-medium text-gray-400">{instructor.title}</span>}
            </h1>
            {badges.length > 0 && (
              // 넓은 화면에서 칩이 한 줄로 길게 늘어지지 않도록 폭을 제한해 2개 안팎씩 줄바꿈
              <div className="flex flex-wrap gap-1.5 mt-3 max-w-xl">
                {badges.map((c, idx) => (
                  <span key={idx} className="inline-block max-w-full truncate text-xs bg-[#2ED573]/10 text-[#1faf5c] px-2 py-0.5 rounded-full" title={c}>{c}</span>
                ))}
              </div>
            )}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-4 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1.5"><i className="ti ti-users text-base" /> 구독자 <b className="text-gray-900">{instructor.subscriber_count.toLocaleString()}</b>명</span>
              {price && <span className="font-semibold text-gray-700">{price}</span>}
            </div>
            {instructor.sub_price ? (
              <div className="mt-5">
                {instructor.is_subscribed ? (
                  <span className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2ED573]/10 text-[#1faf5c] text-sm font-bold">
                    <i className="ti ti-circle-check text-base" /> 구독 중
                  </span>
                ) : (
                  <button
                    onClick={openSubscribe}
                    className="inline-block px-6 py-3 bg-[#2ED573] text-white text-sm font-bold rounded-xl border-none cursor-pointer hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20"
                  >
                    {price ? `${price} 구독하기` : '구독하기'}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* 필터 바 */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 py-3 flex items-center gap-3">
          <div className="flex gap-1.5">
            {([['all', '전체'], ['free', '무료'], ['paid', '유료']] as [PaidFilter, string][]).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full border cursor-pointer transition-colors ${
                  filter === f
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-gray-400">{totalCount}건</span>
        </div>

        {/* №순번 글 목록 */}
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-5 py-6 border-b border-gray-100">
                <div className="w-24 h-[68px] bg-gray-100 rounded-lg shrink-0 max-sm:w-16 max-sm:h-12" />
                <div className="flex-1"><div className="h-3 bg-gray-100 rounded w-32 mb-2.5" /><div className="h-5 bg-gray-200 rounded w-2/3" /></div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-gray-500 text-sm">{filter === 'all' ? '아직 등록된 글이 없습니다.' : '해당하는 글이 없습니다.'}</p>
          </div>
        ) : (
          <div>
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/board/${encodePostId(post.id)}`}
                className="flex items-center gap-5 max-sm:gap-3.5 py-6 max-sm:py-5 border-b border-gray-100 no-underline group transition-colors hover:bg-gray-50/70 -mx-3 px-3 rounded-lg"
              >
                <div className="hidden md:block w-14 shrink-0 text-[22px] font-bold tracking-tight text-[#1faf5c]">
                  {String(post.seq).padStart(3, '0')}
                </div>
                {post.thumbnail ? (
                  <img src={post.thumbnail} alt="" loading="lazy"
                    className="w-24 h-[68px] max-sm:w-20 max-sm:h-14 rounded-lg object-cover bg-gray-100 shrink-0" />
                ) : (
                  <div className="w-24 h-[68px] max-sm:w-20 max-sm:h-14 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                    <i className="ti ti-news text-gray-300 text-xl" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-gray-400 mb-1 tracking-wide">
                    <span className="md:hidden">{String(post.seq).padStart(3, '0')} · </span>
                    {new Date(post.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </div>
                  <h3 className="font-bold text-base max-sm:text-[15px] text-gray-900 leading-snug line-clamp-2 group-hover:text-[#25B866] transition-colors">
                    {post.is_locked && <i className="ti ti-lock text-gray-400 text-sm mr-1" aria-label="멤버 전용" />}
                    {post.title}
                  </h3>
                  <div className="md:hidden mt-1.5"><PaidBadge paid={post.is_paid} price={post.price} /></div>
                </div>
                <div className="hidden md:block shrink-0"><PaidBadge paid={post.is_paid} price={post.price} /></div>
                <i className="hidden md:block ti ti-arrow-right text-gray-300 shrink-0 transition-transform group-hover:translate-x-1 group-hover:text-[#2ED573]" />
              </Link>
            ))}

            <Pagination current={page} total={totalPages} onPageChange={changePage} />
          </div>
        )}
      </div>

      <BoardCheckoutModal
        item={checkout}
        onClose={() => setCheckout(null)}
        onPurchased={() => setReloadKey((k) => k + 1)}
      />
    </section>
  )
}
