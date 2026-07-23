import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { boardService } from '../services/boardService'
import { useAuth } from '../contexts/AuthContext'
import Pagination from '../components/Pagination'
import { InstructorAvatar, InstructorCard, PaidBadge } from '../components/BoardNewsletterBits'
import HeroSection from '../components/HeroSection'
import { encodePostId } from '../utils/postHash'
import type { BoardPostListItem, BoardInstructor } from '../types'

const PER_PAGE = 10

// 아마겟돈 뉴스레터 홈 — 강사 카드 그리드(강사별로 모아 보기) + 최신 글 피드.
// 강사 카드를 누르면 /board/instructor/:id (히어로 + №목록) 로 이동한다.
export default function BoardListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [posts, setPosts] = useState<BoardPostListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [instructors, setInstructors] = useState<BoardInstructor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const prev = document.title
    document.title = '아마겟돈 뉴스레터'
    return () => { document.title = prev }
  }, [])

  useEffect(() => {
    if (authLoading) return
    boardService.getBoardInstructors().then(setInstructors).catch(() => {})
  }, [authLoading, user?.id])

  useEffect(() => {
    let active = true
    // 세션 복원 전에 조회하면 구매자에게도 자물쇠가 떠 깜빡이므로 auth 로딩을 기다린다.
    if (authLoading) return
    setLoading(true)
    boardService.getListed({ page, perPage: PER_PAGE })
      .then(({ posts, totalCount }) => {
        if (!active) return
        setPosts(posts)
        setTotalCount(totalCount)
      })
      .catch(() => { if (active) { setPosts([]); setTotalCount(0) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, authLoading, user?.id])

  const changePage = (p: number) => {
    const next = new URLSearchParams(searchParams)
    if (p > 1) next.set('page', String(p))
    else next.delete('page')
    setSearchParams(next)
    window.scrollTo(0, 0)
  }

  const totalPages = Math.ceil(totalCount / PER_PAGE)

  return (
    <>
      {/* 페이지 상단 히어로 — 관리자 > 페이지 관리 > 히어로 배너 > 뉴스레터에서 편집 */}
      <HeroSection pageKey="board_hero" />
      <section className="w-full bg-white py-12 max-sm:py-8 min-h-[60vh]">
      <div className="max-w-[1200px] mx-auto px-5">
        <header className="mb-8">
          <h1 className="text-2xl max-sm:text-xl font-bold text-gray-900">아마겟돈 뉴스레터</h1>
          <p className="text-sm text-gray-500 mt-2">강사들이 직접 쓰는 인사이트를 만나보세요.</p>
        </header>

        {/* 강사 카드 그리드 — 공개 글이 있는 강사만 */}
        {instructors.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-bold text-gray-900 mb-4">뉴스레터 발행 강사</h2>
            <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-4">
              {instructors.map((ins) => <InstructorCard key={ins.id} ins={ins} />)}
            </div>
          </div>
        )}

        <h2 className="text-lg font-bold text-gray-900 mb-2">최신 글</h2>
        {loading || authLoading ? (
          <div className="space-y-6 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse border-b border-gray-100 pb-6">
                <div className="h-4 bg-gray-100 rounded w-28 mb-3" />
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-news text-gray-400 text-2xl" />
            </div>
            <p className="text-gray-500 text-sm">아직 등록된 글이 없습니다.</p>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-x-10">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/board/${encodePostId(post.id)}`}
                className="flex items-start gap-4 no-underline border-b border-gray-100 py-6 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {post.instructor_name && (
                      <>
                        <InstructorAvatar src={post.instructor_image} name={post.instructor_name} className="w-6 h-6" />
                        <span className="text-xs font-medium text-gray-600">{post.instructor_name}</span>
                        <span className="text-gray-300 text-xs">·</span>
                      </>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(post.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    <PaidBadge paid={post.is_paid} price={post.price} />
                  </div>
                  <h3 className="text-lg max-sm:text-base font-bold text-gray-900 leading-snug break-words group-hover:text-[#25B866] transition-colors flex items-start gap-1.5">
                    {post.is_locked && <i className="ti ti-lock text-gray-400 text-base relative top-[3px] shrink-0" aria-label="멤버 전용" />}
                    <span>{post.title}</span>
                  </h3>
                  {post.excerpt && (
                    <p className="text-sm text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{post.excerpt}</p>
                  )}
                </div>
                {post.thumbnail && (
                  <img src={post.thumbnail} alt="" loading="lazy"
                    className="w-28 h-20 max-sm:w-20 max-sm:h-16 rounded-lg object-cover bg-gray-100 shrink-0 mt-1" />
                )}
              </Link>
            ))}
            </div>

            <Pagination current={page} total={totalPages} onPageChange={changePage} />
          </div>
        )}
      </div>
      </section>
    </>
  )
}
