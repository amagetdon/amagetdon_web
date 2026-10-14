import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ManualPaymentSection from '../../components/admin/ManualPaymentSection'
import { supabase } from '../../lib/supabase'
import { courseService } from '../../services/courseService'
import { linkpayService, type LinkpayLink, type LinkpayPayment, type TossProduct } from '../../services/linkpayService'
import type { CourseWithInstructor } from '../../types'

interface MemberHit { id: string; name: string | null; phone: string | null; email: string | null }
type CourseSortKey = 'title' | 'instructor' | 'price' | 'created'

/** 강의 마감일·수강기간 기준 수강권 만료일 (AdminMembers 수동 부여와 동일 규칙) */
function courseExpiry(course: CourseWithInstructor | undefined): string | null {
  if (!course) return null
  const c = course as unknown as { enrollment_deadline: string | null; duration_days: number | null }
  // 마감일이 있으면 마감일부터, 없으면 지금부터 다시보기 일수 (0 이면 무제한)
  if (c.duration_days && c.duration_days > 0) {
    const base = c.enrollment_deadline ? new Date(c.enrollment_deadline).getTime() : Date.now()
    return new Date(base + c.duration_days * 86400000).toISOString()
  }
  return null
}

// 상품명 강의 번호 규칙 — 개인결제 상품 이름에 [C112](강의) / [E5](전자책)를 넣으면 갱신·결제 때 자동 연결된다.
const ITEM_CODE_RE = /\[(C|E)(\d+)\]/i
function itemCodeFromName(name: string | null | undefined): { courseId: number | null; ebookId: number | null } | null {
  const m = name ? ITEM_CODE_RE.exec(name) : null
  if (!m) return null
  const id = Number(m[2])
  return m[1].toUpperCase() === 'C' ? { courseId: id, ebookId: null } : { courseId: null, ebookId: id }
}

// 상품명("권승미_[프리미엄] N억 버는 자사몰…")으로 강의 추천 — 고객 이름 접두어를 떼고 제목 단어가 가장 많이 겹치는 강의(2단어 이상)
function guessCourseId(orderName: string | null, courses: CourseWithInstructor[]): number | null {
  if (!orderName) return null
  const code = itemCodeFromName(orderName)
  if (code?.courseId && courses.some((c) => c.id === code.courseId)) return code.courseId
  const name = orderName.includes('_') ? orderName.slice(orderName.indexOf('_') + 1) : orderName
  const words = (t: string) => new Set(t.replace(/[[\]()'"·\-_/]/g, ' ').split(/\s+/).filter((w) => w.length >= 2))
  const target = words(name)
  let best: { id: number; score: number } | null = null
  for (const c of courses) {
    let score = 0
    for (const w of words(c.title)) if (target.has(w)) score++
    if (score >= 2 && (!best || score > best.score)) best = { id: c.id, score }
  }
  return best?.id ?? null
}

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

  // 수동 부여 모달
  const [grantTarget, setGrantTarget] = useState<LinkpayPayment | null>(null)
  const [grantSaving, setGrantSaving] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberHits, setMemberHits] = useState<MemberHit[]>([])
  const [grantUserId, setGrantUserId] = useState('')
  const [grantCourseId, setGrantCourseId] = useState<number | ''>('')
  const [grantCourseSearch, setGrantCourseSearch] = useState('')

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

  const searchMembers = async (q: string) => {
    setMemberQuery(q)
    if (!q.trim()) { setMemberHits([]); return }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, phone, email')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(20)
      setMemberHits((data ?? []) as MemberHit[])
    } catch {
      setMemberHits([])
    }
  }

  // 수동 부여 창에서 고른 수강생 이름 (검색 결과에서 고른 경우)
  const [selectedMemberLabel, setSelectedMemberLabel] = useState('')

  const openGrant = (p: LinkpayPayment) => {
    setSelectedMemberLabel('')
    setGrantTarget(p)
    setGrantUserId(p.matched_user_id ?? '')
    setGrantCourseId(p.course_id ?? guessCourseId(p.order_name, courses) ?? '')
    setMemberQuery('')
    setMemberHits([])
    setGrantCourseSearch('')
  }

  const handleManualGrant = async () => {
    if (!grantTarget) return
    if (!grantUserId) { toast.error('회원을 선택해주세요.'); return }
    if (grantCourseId === '') { toast.error('강의를 선택해주세요.'); return }
    const course = courses.find((c) => c.id === grantCourseId)
    try {
      setGrantSaving(true)
      const { mode } = await linkpayService.manualGrant(grantTarget, {
        userId: grantUserId,
        courseId: grantCourseId as number,
        ebookId: null,
        title: course?.title || grantTarget.order_name || '링크페이 결제',
        expiresAt: courseExpiry(course),
      })
      toast.success(
        mode === 'attached' ? '기존 0원 수강권에 결제를 연결했습니다. (수강 기간 유지, 매출 반영)'
          : mode === 'top_up' ? '이미 결제한 구매에 추가 결제 금액을 더했습니다. (차액·분할 결제)'
            : '수강권이 부여되었습니다.',
      )
      setGrantTarget(null)
      await fetchData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '부여에 실패했습니다.')
    } finally {
      setGrantSaving(false)
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

  const filteredGrantCourses = [...courses]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter((c) => !grantCourseSearch || c.title.includes(grantCourseSearch) || (c.instructor?.name || '').includes(grantCourseSearch))

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">링크페이·무통장 결제</h1>
        <p className="text-sm text-gray-400 mt-0.5">링크페이 결제와 무통장 입금을 수강생 계정·강의에 연결해 수강권과 매출을 함께 기록합니다.</p>
      </div>

      {/* 결제 내역 */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">링크페이 결제 내역 <span className="text-gray-400 font-normal">({payments.length})</span></h2>
        </div>
        {(() => {
          const pending = payments.filter((p) => !p.granted && p.status === 'DONE')
          if (pending.length === 0) return null
          const sum = pending.reduce((s, p) => s + (p.amount ?? 0), 0)
          return (
            <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-relaxed">
              <p className="font-bold text-sm mb-1"><i className="ti ti-alert-triangle" /> 수강권 미부여 결제 {pending.length}건 · {sum.toLocaleString()}원 (매출 미반영)</p>
              <p>아래 표에서 <b>수동 부여</b> → <b>수강생 계정</b> 확인(결제자와 다르면 검색해서 변경) → <b>강의</b> 확인 → 부여하기.</p>
              <p className="mt-1">수강생이 아직 회원이 아니면 <a href="/admin/members" className="font-bold text-amber-900 underline">회원 관리</a>에서 회원을 먼저 만든 뒤 부여하세요. 결제는 그동안 여기 그대로 남아 있습니다.</p>
              <p className="mt-1 text-amber-700">회원 관리에서 0원 수강권을 따로 주지 마세요 — 결제 금액이 매출에 잡히지 않습니다. 이미 0원으로 준 회원도 여기서 부여하면 그 수강권에 금액이 채워집니다(기간 유지, 분할 결제는 합산).</p>
            </div>
          )
        })()}
        {payments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">아직 링크페이 결제 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-gray-600">결제일</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600">구매자</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600">상품/강의</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-600">금액</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">상태</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">수강권</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(p.approved_at ?? p.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-800">{p.customer_name || '-'}</span>
                      <span className="block text-xs text-gray-400">{p.customer_phone || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {p.course_id ? courseTitle(p.course_id) : (p.order_name || '-')}
                      {!p.course_id && <span className="block text-[11px] text-amber-600">미매핑 링크</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{(p.amount ?? 0).toLocaleString()}원</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'DONE' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                        {p.status === 'DONE' ? '결제완료' : p.status === 'CANCELED' ? '취소' : p.status || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.granted ? (
                        <span className="text-xs text-emerald-600 font-bold"><i className="ti ti-check" /> 부여됨</span>
                      ) : p.status === 'DONE' ? (
                        <button
                          onClick={() => openGrant(p)}
                          className="text-xs font-bold text-white bg-[#2ED573] hover:bg-[#25B866] px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors"
                        >
                          수동 부여
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
            <p className="text-xs text-gray-400 mt-0.5">① 토스 상품 선택 → ② 아래 강의 표에서 연결할 강의의 "연결" 클릭</p>
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

        {/* 토스 상품 목록 — 판매상품 / 개인결제창 좌우 분리 */}
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
            <div className={`grid ${showPersonal ? 'grid-cols-2' : 'grid-cols-1'} max-md:grid-cols-1 gap-3 mb-4`}>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <p className="px-3 py-2 bg-orange-50 text-xs font-bold text-orange-600">판매상품 {sales.length}개</p>
                <div className="max-h-[320px] overflow-y-auto divide-y divide-gray-50">
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

        {selectedProduct && (
          <div className="flex items-center gap-2 mb-3 bg-[#2ED573]/10 border border-[#2ED573]/30 rounded-lg px-3 py-2">
            <i className="ti ti-arrow-down text-[#2ED573]" />
            <span className="text-sm text-gray-700">선택됨: <b>{selectedProduct.name}</b> — 아래 강의 표에서 연결할 강의를 고르세요</span>
            <button onClick={() => setSelectedProduct(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer">선택 해제</button>
          </div>
        )}

        {/* 강의 테이블 */}
        <div className="relative mb-2 max-w-xs">
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
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-20">
                <tr>
                  <th className="px-3 py-2.5 text-left font-bold text-gray-600 w-[56px] bg-gray-50">썸네일</th>
                  <th onClick={() => toggleSort('title')} className="px-3 py-2.5 text-left font-bold text-gray-600 cursor-pointer select-none bg-gray-50">강의명{sortArrow('title')}</th>
                  <th onClick={() => toggleSort('instructor')} className="px-3 py-2.5 text-left font-bold text-gray-600 cursor-pointer select-none max-sm:hidden bg-gray-50">강사{sortArrow('instructor')}</th>
                  <th onClick={() => toggleSort('price')} className="px-3 py-2.5 text-right font-bold text-gray-600 cursor-pointer select-none max-sm:hidden bg-gray-50">가격{sortArrow('price')}</th>
                  <th onClick={() => toggleSort('created')} className="px-3 py-2.5 text-center font-bold text-gray-600 cursor-pointer select-none max-sm:hidden bg-gray-50">등록일{sortArrow('created')}</th>
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
                      <td className="px-3 py-2 text-gray-500 max-sm:hidden whitespace-nowrap">{c.instructor?.name || '-'}</td>
                      <td className="px-3 py-2 text-right text-gray-600 max-sm:hidden whitespace-nowrap">{coursePrice(c).toLocaleString()}원</td>
                      <td className="px-3 py-2 text-center text-gray-400 text-xs max-sm:hidden whitespace-nowrap">{new Date(c.created_at).toLocaleDateString('ko-KR')}</td>
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

      {/* 등록된 매핑 */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">등록된 매핑 <span className="text-gray-400 font-normal">({links.length})</span></h2>
        </div>
        {links.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">등록된 링크 매핑이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600">상품(링크)</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600">연결 강의</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 max-sm:hidden">productKey</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 w-[80px]">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {links.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{l.label || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{courseTitle(l.course_id)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-gray-400 max-sm:hidden">{l.product_key}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setDeleteLinkId(l.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors mx-auto" aria-label="삭제">
                      <i className="ti ti-trash text-sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

        </div>
      </details>

      {/* 수동 부여 모달 */}
      <AdminFormModal
        isOpen={!!grantTarget}
        onClose={() => setGrantTarget(null)}
        title="수강권 수동 부여"
        onSubmit={handleManualGrant}
        loading={grantSaving}
        submitText="부여하기"
      >
        {grantTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
              <p className="text-gray-800 font-medium">{grantTarget.customer_name || '-'} · {grantTarget.customer_phone || '-'}</p>
              <p className="text-xs text-gray-400 mt-0.5">{grantTarget.order_name || '-'} · {(grantTarget.amount ?? 0).toLocaleString()}원</p>
            </div>
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 leading-relaxed">
              위는 <b>결제한 사람</b> 정보입니다. 수업 듣는 사람이 다르면 아래에서 <b>수강생 계정</b>을 검색해 바꾸세요. 수강생이 회원이 아니면 회원 관리에서 회원을 먼저 만들어 주세요.
            </p>
            <div>
              <label className="text-sm font-bold block mb-1">회원 선택 *</label>
              <input
                value={memberQuery}
                onChange={(e) => searchMembers(e.target.value)}
                placeholder="이름 또는 전화번호로 검색"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]"
              />
              {memberHits.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 max-h-[160px] overflow-y-auto">
                  {memberHits.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setGrantUserId(m.id); setSelectedMemberLabel(`${m.name || '(이름없음)'} ${m.phone || ''}`.trim()) }}
                      className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer flex items-center justify-between ${grantUserId === m.id ? 'bg-[#2ED573]/10' : 'bg-white hover:bg-gray-50'}`}
                    >
                      <span>{m.name || '(이름없음)'} <span className="text-xs text-gray-400">{m.phone || ''}</span></span>
                      {grantUserId === m.id && <i className="ti ti-check text-[#2ED573]" />}
                    </button>
                  ))}
                </div>
              )}
              {grantUserId && (
                <p className="text-[11px] text-emerald-600 mt-1">
                  수강생 계정: <b>{selectedMemberLabel || '결제 전화번호로 찾은 회원'}</b>
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">연결할 강의 *</label>
              <div className="border border-gray-300 rounded-xl overflow-hidden">
                <input
                  value={grantCourseSearch}
                  onChange={(e) => setGrantCourseSearch(e.target.value)}
                  placeholder="강의 검색..."
                  className="w-full px-3 py-2 text-sm border-none outline-none"
                  style={{ borderBottom: '1px solid #e5e7eb' }}
                />
                <div className="max-h-[180px] overflow-y-auto">
                  {filteredGrantCourses.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setGrantCourseId(grantCourseId === c.id ? '' : c.id)}
                      className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer flex items-center justify-between ${grantCourseId === c.id ? 'bg-[#2ED573]/10 text-gray-900' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      <span>{c.instructor?.name && <span className="text-xs text-gray-400 mr-1">[{c.instructor.name}]</span>}{c.title}</span>
                      {grantCourseId === c.id && <i className="ti ti-check text-[#2ED573]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminFormModal>

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
