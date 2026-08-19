import { useEffect, useState, type ReactNode } from 'react'
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

      {/* 환불규정 — 뉴스레터는 정기결제(구독) 상품이라 빌링/해지 조항을 노출한다. 기본 접힘. */}
      <RefundPolicySection />
    </>
  )
}

// 이용약관 제23조 전문을 접이식으로 보여주는 섹션 — 강의/전자책 상세의 환불규정 아코디언과 동일한 패턴.
function RefundPolicySection() {
  return (
    <section className="w-full bg-white py-4 border-t border-gray-100">
      <div className="max-w-[1200px] mx-auto px-5">
        <details className="group">
          <summary className="list-none cursor-pointer flex items-center justify-between gap-3 py-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ED573] focus-visible:ring-offset-2">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <i className="ti ti-receipt-refund text-[#2ED573]" aria-hidden="true" /> 환불규정
            </h2>
            <i className="ti ti-chevron-down text-gray-400 text-base transition-transform group-open:rotate-180 shrink-0" aria-hidden="true" />
          </summary>

          <div className="mt-4 p-5 max-sm:p-4 bg-gray-50 border border-gray-100 rounded-xl">
            <h3 className="text-base font-bold text-gray-900 mb-3">제23조 (빌링서비스 및 정기결제)</h3>

            <ol className="space-y-2 text-sm text-gray-700 leading-relaxed">
              <Clause no="①">회사는 회원이 정기적으로 강의, 콘텐츠 또는 기타 서비스를 이용할 수 있도록 신용카드, 간편결제 기타 결제수단을 이용한 자동결제 방식의 빌링서비스를 제공할 수 있습니다.</Clause>
              <Clause no="②">빌링서비스를 이용하는 경우 회원이 최초 결제 시 등록한 결제수단을 통하여 회사가 별도로 안내한 결제주기 및 결제일에 이용대금이 자동으로 결제될 수 있으며, 회원은 빌링서비스 신청 시 자동결제에 동의한 것으로 봅니다.</Clause>
              <Clause no="③">
                회사는 빌링서비스 신청 또는 결제 전에 다음 각 호의 사항을 회원이 확인할 수 있도록 안내합니다.
                {/* 가~바 각 호 — 항 본문보다 한 단 들여쓴다 */}
                <ul className="mt-1.5 space-y-1 pl-4 max-sm:pl-2">
                  <SubClause no="가.">이용상품 또는 서비스의 주요 내용</SubClause>
                  <SubClause no="나.">결제금액</SubClause>
                  <SubClause no="다.">결제주기 및 결제예정일</SubClause>
                  <SubClause no="라.">이용기간 또는 자동갱신 여부</SubClause>
                  <SubClause no="마.">해지 및 환불에 관한 사항</SubClause>
                  <SubClause no="바.">기타 관계 법령에서 고지를 요구하는 사항</SubClause>
                </ul>
              </Clause>
              <Clause no="④">별도의 이용기간이 정해져 있지 않거나 자동갱신 방식으로 제공되는 빌링서비스는 회원이 해지하기 전까지 동일한 조건으로 갱신될 수 있습니다. 다만, 회사는 관계 법령에서 별도의 동의 또는 고지를 요구하는 경우 해당 절차를 따릅니다.</Clause>
              <Clause no="⑤">회원은 회사가 지정한 고객센터, 카카오 상담 채널, 서비스 내 해지 기능 또는 기타 회사가 안내한 방법을 통해 언제든지 빌링서비스의 다음 회차 자동결제를 해지할 수 있습니다.</Clause>
              <Clause no="⑥">회원이 다음 결제일 이전에 빌링서비스의 자동결제를 해지한 경우 해당 해지는 다음 결제일부터 적용되는 것을 원칙으로 하며, 해지 이전에 이미 정상적으로 결제된 이용기간의 서비스는 해당 이용기간 종료일까지 이용할 수 있습니다.</Clause>
              <Clause no="⑦">빌링서비스의 자동결제 해지는 장래의 자동결제를 중단하는 절차이며, 이미 결제가 완료된 회차에 대한 결제취소 또는 환불을 의미하지 않습니다.</Clause>
              <Clause no="⑧">이미 결제가 완료된 빌링서비스에 대하여 회원이 환불을 요청하는 경우, 해당 서비스가 강의 또는 교습서비스에 해당하는 때에는 본 약관 제18조부터 제22조까지의 교습비등 반환기준 및 관계 법령에 따라 반환금액을 산정합니다.</Clause>
              <Clause no="⑨">강의 외 디지털 콘텐츠, 구독서비스 또는 기타 상품에 대한 환불 및 청약철회는 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관계 법령 및 해당 상품의 개별 이용조건에 따라 처리합니다.</Clause>
              <Clause no="⑩">회원이 단순히 빌링서비스의 해지를 신청하지 않았거나 서비스 이용을 하지 않았다는 사유만으로 이미 정상적으로 이루어진 자동결제가 당연히 취소되거나 전액 환불되는 것은 아닙니다. 다만, 관계 법령에 따른 청약철회 또는 환불사유가 인정되는 경우에는 해당 법령에서 정한 기준에 따라 처리합니다.</Clause>
              <Clause no="⑪">회원이 결제수단의 한도초과, 사용정지, 정보오류, 잔액부족, 유효기간 만료 또는 기타 사유로 자동결제가 정상적으로 이루어지지 않은 경우 회사는 회원에게 결제 실패 사실을 안내하고 결제를 다시 시도하거나 결제수단 변경을 요청할 수 있습니다.</Clause>
              <Clause no="⑫">자동결제가 정상적으로 이루어지지 않고 상당한 기간 내 결제가 완료되지 않는 경우 회사는 해당 빌링서비스의 이용을 일시적으로 제한하거나 종료할 수 있습니다.</Clause>
              <Clause no="⑬">회사가 빌링서비스의 이용금액, 결제주기 또는 기타 회원의 결제와 관련된 중요한 사항을 변경하고자 하는 경우 관계 법령 및 약관에서 정한 방법에 따라 사전에 회원에게 안내하며, 관계 법령상 회원의 별도 동의가 필요한 경우 해당 동의를 받습니다.</Clause>
              <Clause no="⑭">회사가 무료 또는 할인된 조건으로 제공하던 빌링서비스를 유료로 전환하거나 기존 결제금액을 증액하는 경우에는 관계 법령에서 정한 고지 및 동의절차를 준수합니다.</Clause>
              <Clause no="⑮">신용카드사, 간편결제사 또는 결제대행사(PG사)의 시스템 장애, 점검 기타 사유로 자동결제 시점 또는 결제처리 시점이 달라질 수 있습니다.</Clause>
              <Clause no="⑯">빌링서비스의 해지, 결제취소 및 환불과 관련하여 본 조에서 정하지 않은 사항은 본 약관의 교습비등 반환규정, 개별 서비스 이용조건 및 관계 법령에 따릅니다.</Clause>
            </ol>
          </div>
        </details>
      </div>
    </section>
  )
}

// 약관 「항」 한 줄 — 원문자(①…)를 본문과 분리해 두 줄 이상 접혀도 번호 기준선이 유지되게 한다.
function Clause({ no, children }: { no: string; children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="shrink-0 text-gray-400">{no}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  )
}

// 약관 「호」 한 줄 (가. ~ 바.)
function SubClause({ no, children }: { no: string; children: ReactNode }) {
  return (
    <li className="flex gap-2 text-gray-600">
      <span className="shrink-0 text-gray-400">{no}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  )
}
