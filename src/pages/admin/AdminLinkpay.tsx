import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ManualPaymentSection from '../../components/admin/ManualPaymentSection'
import LinkpayInbox from '../../components/admin/LinkpayInbox'
import BankDepositInbox from '../../components/admin/BankDepositInbox'
import { courseService } from '../../services/courseService'
import { linkpayService, type LinkpayLink, type LinkpayPayment, type TossProduct } from '../../services/linkpayService'
import type { CourseWithInstructor } from '../../types'
import { courseExpiry, itemCodeFromName } from '../../lib/linkpayMatch'

type CourseSortKey = 'title' | 'instructor' | 'price' | 'created'

function coursePrice(c: CourseWithInstructor): number {
  return c.sale_price ?? c.original_price ?? 0
}

// 개인결제창 상품은 토스 기본 플레이스홀더 이미지를 공유한다 (이미지를 직접 올리지 않음).
// 고유 이미지면 판매상품, 플레이스홀더(또는 이미지 없음)면 개인결제창으로 분류.
const PERSONAL_PLACEHOLDER = '8dbc0b796336418ba5cbcb6a07b3fcf5'
function isPersonalProduct(p: TossProduct): boolean {
  return !p.thumbnail || p.thumbnail.includes(PERSONAL_PLACEHOLDER)
}

export default function AdminLinkpay() {
  const [links, setLinks] = useState<LinkpayLink[]>([])
  const [payments, setPayments] = useState<LinkpayPayment[]>([])
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [loading, setLoading] = useState(true)

  // 매핑 만들기
  const [tossProducts, setTossProducts] = useState<TossProduct[]>([])
  const [loadingTossProducts, setLoadingTossProducts] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<TossProduct | null>(null)
  const [creatingLink, setCreatingLink] = useState(false)
  const [courseSearch, setCourseSearch] = useState('')
  const [courseSort, setCourseSort] = useState<{ key: CourseSortKey; dir: 'asc' | 'desc' }>({ key: 'created', dir: 'desc' })
  const [deleteLinkId, setDeleteLinkId] = useState<number | null>(null)
  const [linkInfoCourseId, setLinkInfoCourseId] = useState<number | null>(null)
  // 개인결제창 상품은 사람마다 따로라 자동 연결 이득이 없고 계정이 틀릴 위험만 있어 기본 숨김 (결제 내역에서 수동 부여)
  const [showPersonal, setShowPersonal] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [l, p, c, cached] = await withTimeout(Promise.all([
        linkpayService.getLinks(),
        linkpayService.getPayments(),
        courseService.getAll(),
        linkpayService.getCachedProducts(),
      ]))
      setLinks(l)
      setPayments(p)
      setCourses(c)
      setTossProducts(cached)
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])
  useVisibilityRefresh(fetchData)

  const courseTitle = (id: number | null) => courses.find((c) => c.id === id)?.title ?? (id ? `#${id}` : '-')

  const handleSyncProducts = async (full: boolean) => {
    try {
      setLoadingTossProducts(true)
      const { products, syncedCount } = await linkpayService.syncTossProducts(full)
      setTossProducts(products)
      // 상품명에 [C112] 규칙이 있고 아직 연결 안 된 상품은 자동 연결 (+ 그 상품의 지난 미부여 결제 부여)
      let autoMapped = 0
      for (const prod of products) {
        const code = itemCodeFromName(prod.name)
        if (!code?.courseId || links.some((l) => l.product_key === prod.productKey)) continue
        const course = courses.find((c) => c.id === code.courseId)
        if (!course) continue
        try {
          await linkpayService.createLink({ product_key: prod.productKey, course_id: course.id, ebook_id: null, label: prod.name || null })
          await attachPastPayments(prod.productKey, course)
          autoMapped++
        } catch { /* 개별 실패는 매핑 표에서 확인 */ }
      }
      toast.success(
        (full
          ? `전체 ${syncedCount}건 동기화 완료`
          : (syncedCount > 0 ? `신규 상품 ${syncedCount}건을 가져왔습니다.` : '신규 상품 없음 (이미 최신)'))
        + (autoMapped > 0 ? ` · [C번호] 상품 ${autoMapped}건 자동 연결` : ''),
      )
      if (autoMapped > 0) await fetchData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '토스 상품 동기화에 실패했습니다.')
    } finally {
      setLoadingTossProducts(false)
    }
  }

  // 상품을 강의에 연결하면, 연결 전에 들어온 그 상품의 미부여 결제(회원 확인된 결제완료 건)도 바로 부여한다
  const attachPastPayments = async (productKey: string, course: CourseWithInstructor): Promise<{ n: number; amount: number }> => {
    let n = 0
    let amount = 0
    const targets = payments.filter((p) => p.product_key === productKey && !p.granted && p.status === 'DONE' && p.matched_user_id)
    for (const p of targets) {
      try {
        await linkpayService.manualGrant(p, {
          userId: p.matched_user_id!,
          courseId: course.id,
          ebookId: null,
          title: course.title || p.order_name || '링크페이 결제',
          expiresAt: courseExpiry(course),
        })
        n++
        amount += p.amount ?? 0
      } catch { /* 이미 연결된 결제키 등 — 결제 내역에서 개별 확인 */ }
    }
    return { n, amount }
  }

  const createMapping = async (course: CourseWithInstructor) => {
    if (!selectedProduct) { toast.error('먼저 토스 상품을 선택하세요.'); return }
    try {
      setCreatingLink(true)
      await linkpayService.createLink({
        product_key: selectedProduct.productKey,
        course_id: course.id,
        ebook_id: null,
        label: selectedProduct.name || null,
      })
      const past = await attachPastPayments(selectedProduct.productKey, course)
      toast.success(`"${selectedProduct.name}" → "${course.title}" 매핑 완료${past.n > 0 ? ` · 지난 결제 ${past.n}건(${past.amount.toLocaleString()}원) 부여` : ''}`)
      setSelectedProduct(null)
      await fetchData()
    } catch {
      toast.error('매핑에 실패했습니다.')
    } finally {
      setCreatingLink(false)
    }
  }

  const handleDeleteLink = async () => {
    if (deleteLinkId == null) return
    try {
      await linkpayService.deleteLink(deleteLinkId)
      toast.success('매핑이 삭제되었습니다.')
      setDeleteLinkId(null)
      await fetchData()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  // 토스 상품 → 매핑된 강의
  const productMapping = (productKey: string) => links.find((l) => l.product_key === productKey)

  const displayCourses = [...courses]
    .filter((c) => !courseSearch || c.title.includes(courseSearch) || (c.instructor?.name || '').includes(courseSearch))
    .sort((a, b) => {
      const dir = courseSort.dir === 'asc' ? 1 : -1
      switch (courseSort.key) {
        case 'title': return dir * a.title.localeCompare(b.title)
        case 'instructor': return dir * (a.instructor?.name || '').localeCompare(b.instructor?.name || '')
        case 'price': return dir * (coursePrice(a) - coursePrice(b))
        default: return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      }
    })

  const toggleSort = (key: CourseSortKey) =>
    setCourseSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))

  const sortArrow = (key: CourseSortKey) => courseSort.key === key ? (courseSort.dir === 'asc' ? ' ▲' : ' ▼') : ''

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">링크페이·무통장 결제</h1>
        <p className="text-sm text-gray-400 mt-0.5">링크페이 결제와 무통장 입금을 수강생 계정·강의에 연결해 수강권과 매출을 함께 기록합니다.</p>
      </div>

      {/* 링크페이 결제 처리함: 왼쪽 목록 · 오른쪽 처리 패널 */}
      <LinkpayInbox payments={payments} courses={courses} onChanged={fetchData} />

      {/* 무통장 입금함: 은행 입금 자동 수집 → 회원·강의 지정해 등록 */}
      <BankDepositInbox courses={courses} />

      {/* 무통장(계좌이체·현금) 입금 수동 등록 */}
      <ManualPaymentSection courses={courses} courseExpiry={courseExpiry} />

      {/* 판매상품 자동 연결 (선택) — 같은 상품으로 여러 명이 결제하는 판매상품용. 개인결제창은 위 결제 내역에서 수동 부여 */}
      <details className="mb-8 group">
        <summary className="cursor-pointer list-none bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="font-bold text-gray-900">판매상품 자동 연결 <span className="text-xs font-normal text-gray-400">(선택)</span></span>
            <span className="block text-xs text-gray-400 mt-0.5">같은 상품으로 여러 명이 결제하는 <b>판매상품</b>만 한 번 연결해 두면, 이후 결제는 수동 부여 없이 자동 처리됩니다. 개인결제창은 연결하지 마세요.</span>
          </span>
          <i className="ti ti-chevron-down text-gray-400 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="mt-3">
      {/* 매핑 만들기 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="font-bold text-gray-900">링크 ↔ 강의 매핑 만들기</h2>
            <p className="text-xs text-gray-400 mt-0.5">① 왼쪽에서 상품 선택 → ② 오른쪽 강의 표에서 "연결" 클릭</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSyncProducts(false)}
              disabled={loadingTossProducts}
              className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <i className="ti ti-refresh text-sm" />
              {loadingTossProducts ? '동기화 중...' : '토스 상품 갱신하기'}
            </button>
            <button
              onClick={() => handleSyncProducts(true)}
              disabled={loadingTossProducts}
              className="bg-white text-gray-600 border border-gray-300 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors disabled:opacity-50 flex items-center gap-1.5"
              title="토스에서 전체를 다시 받아 캐시를 교체합니다 (수정·삭제 반영)"
            >
              <i className="ti ti-reload text-sm" />
              전체 재동기화
            </button>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-3 leading-relaxed">
          <b className="text-[#2ED573]">토스 상품 갱신하기</b> — 새로 만든 링크페이 상품만 빠르게 추가합니다 (평소 사용).<br />
          <b className="text-gray-600">전체 재동기화</b> — 토스 전체 상품을 다시 받아, 상품명·금액 <b>수정</b>이나 <b>삭제</b>된 항목까지 캐시에 반영합니다 (가끔 사용).
        </p>

        {selectedProduct && (
          <div className="flex items-center gap-2 mb-3 bg-[#2ED573]/10 border border-[#2ED573]/30 rounded-lg px-3 py-2">
            <i className="ti ti-arrow-right text-[#2ED573]" />
            <span className="text-sm text-gray-700">선택됨: <b>{selectedProduct.name}</b> — 오른쪽 강의 표에서 연결할 강의의 "연결"을 누르세요</span>
            <button onClick={() => setSelectedProduct(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer">선택 해제</button>
          </div>
        )}

        {/* 상품(왼쪽) ↔ 강의(오른쪽) 반반 — 고르고 바로 옆에서 연결 */}
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="min-w-0">
            {/* 왼쪽: 토스 상품 목록 (판매상품, 펼치면 개인결제창) */}
            {tossProducts.length > 0 && (() => {
              const renderBtn = (p: TossProduct) => {
                const mapped = productMapping(p.productKey)
                const selected = selectedProduct?.productKey === p.productKey
                return (
                  <button
                    key={p.productKey}
                    type="button"
                    onClick={() => setSelectedProduct(selected ? null : p)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left border-none cursor-pointer transition-colors ${selected ? 'bg-[#2ED573]/10' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <div className="w-9 h-9 rounded-md bg-gray-100 overflow-hidden shrink-0">
                      {p.thumbnail && <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{p.name}</p>
                      <p className="text-[11px] text-gray-400">{p.amount.toLocaleString()}원
                        {mapped && <span className="text-emerald-600 ml-2"><i className="ti ti-link" /> {courseTitle(mapped.course_id)}</span>}
                      </p>
                    </div>
                    {selected && <i className="ti ti-check text-[#2ED573] shrink-0" />}
                  </button>
                )
              }
              const sales = tossProducts.filter((p) => !isPersonalProduct(p))
              const personal = tossProducts.filter((p) => isPersonalProduct(p))
              return (
                <div className="grid grid-cols-1 gap-3">
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <p className="px-3 py-2 bg-orange-50 text-xs font-bold text-orange-600">판매상품 {sales.length}개</p>
                    <div className="max-h-[460px] overflow-y-auto divide-y divide-gray-50">
                      {sales.length === 0
                        ? <p className="px-3 py-5 text-xs text-gray-400 text-center">없음</p>
                        : sales.map(renderBtn)}
                    </div>
                  </div>
                  {!showPersonal ? (
                    <button type="button" onClick={() => setShowPersonal(true)} className="text-left text-xs text-gray-400 bg-transparent border-none cursor-pointer p-0 hover:text-gray-600">
                      개인결제창 상품 {personal.length}개 보기 — 개인결제창은 연결하지 말고 위 결제 내역에서 수동 부여하세요
                    </button>
                  ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <p className="px-3 py-2 bg-blue-50 text-xs font-bold text-blue-600">개인결제창 {personal.length}개 <span className="font-normal text-blue-500">· 결제자와 수강자가 다르면 계정이 틀릴 수 있어 권장하지 않음</span></p>
                    <div className="max-h-[320px] overflow-y-auto divide-y divide-gray-50">
                      {personal.length === 0
                        ? <p className="px-3 py-5 text-xs text-gray-400 text-center">없음</p>
                        : personal.map(renderBtn)}
                    </div>
                  </div>
                  )}
                </div>
              )
            })()}
          </div>
          <div className="min-w-0">
            {/* 오른쪽: 강의 표 */}
            <div className="relative mb-2">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="강의 검색..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573]"
              />
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="max-h-[460px] overflow-y-auto">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-20">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-bold text-gray-600 w-[56px] bg-gray-50">썸네일</th>
                      <th onClick={() => toggleSort('title')} className="px-3 py-2.5 text-left font-bold text-gray-600 cursor-pointer select-none bg-gray-50">강의명{sortArrow('title')}</th>
                      <th onClick={() => toggleSort('instructor')} className="px-3 py-2.5 text-left font-bold text-gray-600 cursor-pointer select-none bg-gray-50">강사{sortArrow('instructor')}</th>
                      <th onClick={() => toggleSort('price')} className="px-3 py-2.5 text-right font-bold text-gray-600 cursor-pointer select-none bg-gray-50">가격{sortArrow('price')}</th>
                      <th onClick={() => toggleSort('created')} className="px-3 py-2.5 text-center font-bold text-gray-600 cursor-pointer select-none max-2xl:hidden bg-gray-50">등록일{sortArrow('created')}</th>
                      <th className="px-3 py-2.5 text-center font-bold text-gray-600 w-[90px] bg-gray-50">연결</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">불러오는 중...</td></tr>
                    ) : displayCourses.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">강의가 없습니다.</td></tr>
                    ) : displayCourses.map((c) => {
                      const mappedCount = links.filter((l) => l.course_id === c.id).length
                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="w-10 h-10 rounded-md bg-gray-100 overflow-hidden">
                              {c.thumbnail_url && <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-800">
                            {c.title}
                            {mappedCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setLinkInfoCourseId(c.id)}
                                aria-label={`연동된 링크페이 상품 ${mappedCount}개 보기`}
                                title="연동된 링크페이 상품 보기"
                                className="ml-1.5 text-[11px] text-emerald-600 whitespace-nowrap bg-transparent border-none cursor-pointer hover:underline inline-flex items-center gap-0.5"
                              >
                                <i className="ti ti-link" />{mappedCount}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{c.instructor?.name || '-'}</td>
                          <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">{coursePrice(c).toLocaleString()}원</td>
                          <td className="px-3 py-2 text-center text-gray-400 text-xs max-2xl:hidden whitespace-nowrap">{new Date(c.created_at).toLocaleDateString('ko-KR')}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => createMapping(c)}
                              disabled={!selectedProduct || creatingLink}
                              className="text-xs font-bold text-white bg-[#2ED573] hover:bg-[#25B866] px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              연결
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 등록된 매핑 */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">등록된 매핑 <span className="text-gray-400 font-normal">({links.length})</span></h2>
        </div>
        {links.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">등록된 링크 매핑이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600">상품(링크)</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600">연결 강의</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600">productKey</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 w-[80px]">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {links.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{l.label || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{courseTitle(l.course_id)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-gray-400">{l.product_key}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setDeleteLinkId(l.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors mx-auto" aria-label="삭제">
                      <i className="ti ti-trash text-sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

        </div>
      </details>


      <ConfirmDialog
        isOpen={deleteLinkId != null}
        onClose={() => setDeleteLinkId(null)}
        onConfirm={handleDeleteLink}
        title="링크 매핑 삭제"
        message="이 매핑을 삭제하시겠습니까? 이후 이 링크로 결제하면 강의가 자동 식별되지 않습니다."
      />

      {/* 강의에 연동된 링크페이 상품 목록 */}
      {linkInfoCourseId != null && (() => {
        const course = courses.find((c) => c.id === linkInfoCourseId)
        const linked = links.filter((l) => l.course_id === linkInfoCourseId)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setLinkInfoCourseId(null)}
            role="dialog"
            aria-modal="true"
            aria-label="연동된 링크페이 상품"
          >
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">연동된 링크페이 상품 <span className="text-gray-400 font-normal">({linked.length})</span></h3>
                <button
                  onClick={() => setLinkInfoCourseId(null)}
                  aria-label="닫기"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 bg-transparent border-none cursor-pointer transition-colors"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <p className="px-5 pt-3 text-xs text-gray-500 truncate">강의: <span className="text-gray-800 font-medium">{course?.title ?? `#${linkInfoCourseId}`}</span></p>
              <div className="p-5 pt-3">
                {linked.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">연동된 상품이 없습니다.</p>
                ) : (
                  <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                    {linked.map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 truncate">{l.label || '(이름 없음)'}</p>
                          <p className="font-mono text-[11px] text-gray-400 truncate">{l.product_key}</p>
                        </div>
                        <button
                          onClick={() => { setLinkInfoCourseId(null); setDeleteLinkId(l.id) }}
                          aria-label="이 매핑 삭제"
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors"
                        >
                          <i className="ti ti-trash text-sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </AdminLayout>
  )
}
