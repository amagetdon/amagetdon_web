import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
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
  if (c.enrollment_deadline && c.duration_days && c.duration_days > 0) {
    return new Date(new Date(c.enrollment_deadline).getTime() + c.duration_days * 86400000).toISOString()
  }
  return null
}

function coursePrice(c: CourseWithInstructor): number {
  return c.sale_price ?? c.original_price ?? 0
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
      const [l, p, c] = await withTimeout(Promise.all([
        linkpayService.getLinks(),
        linkpayService.getPayments(),
        courseService.getAll(),
      ]))
      setLinks(l)
      setPayments(p)
      setCourses(c)
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])
  useVisibilityRefresh(fetchData)

  const courseTitle = (id: number | null) => courses.find((c) => c.id === id)?.title ?? (id ? `#${id}` : '-')

  const loadTossProducts = async () => {
    try {
      setLoadingTossProducts(true)
      const products = await linkpayService.fetchTossProducts()
      products.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      setTossProducts(products)
      if (products.length === 0) toast('불러올 토스 상품이 없습니다.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '토스 상품을 불러오지 못했습니다.')
    } finally {
      setLoadingTossProducts(false)
    }
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
      toast.success(`"${selectedProduct.name}" → "${course.title}" 매핑 완료`)
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

  const openGrant = (p: LinkpayPayment) => {
    setGrantTarget(p)
    setGrantUserId(p.matched_user_id ?? '')
    setGrantCourseId(p.course_id ?? '')
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
      await linkpayService.manualGrant(grantTarget, {
        userId: grantUserId,
        courseId: grantCourseId as number,
        ebookId: null,
        title: course?.title || grantTarget.order_name || '링크페이 결제',
        expiresAt: courseExpiry(course),
      })
      toast.success('수강권이 부여되었습니다.')
      setGrantTarget(null)
      await fetchData()
    } catch {
      toast.error('부여에 실패했습니다.')
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
        <h1 className="text-2xl font-bold text-gray-900">링크페이 연동</h1>
        <p className="text-sm text-gray-400 mt-0.5">토스 링크페이로 결제하면 수강권이 자동 부여됩니다. 링크별 강의 매핑을 등록하세요.</p>
      </div>

      {/* 매핑 만들기 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="font-bold text-gray-900">링크 ↔ 강의 매핑 만들기</h2>
            <p className="text-xs text-gray-400 mt-0.5">① 토스 상품 선택 → ② 아래 강의 표에서 연결할 강의의 "연결" 클릭</p>
          </div>
          <button
            onClick={loadTossProducts}
            disabled={loadingTossProducts}
            className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <i className="ti ti-download text-sm" />
            {loadingTossProducts ? '불러오는 중...' : '토스 상품 불러오기'}
          </button>
        </div>

        {/* 토스 상품 목록 */}
        {tossProducts.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
            <p className="px-3 py-2 bg-gray-50 text-xs font-bold text-gray-500">토스 상품 {tossProducts.length}개 — 매핑할 상품을 선택하세요 (최신순)</p>
            <div className="max-h-[280px] overflow-y-auto divide-y divide-gray-50">
              {tossProducts.map((p) => {
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
              })}
            </div>
          </div>
        )}

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
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-left font-bold text-gray-600 w-[56px]">썸네일</th>
                  <th onClick={() => toggleSort('title')} className="px-3 py-2.5 text-left font-bold text-gray-600 cursor-pointer select-none">강의명{sortArrow('title')}</th>
                  <th onClick={() => toggleSort('instructor')} className="px-3 py-2.5 text-left font-bold text-gray-600 cursor-pointer select-none max-sm:hidden">강사{sortArrow('instructor')}</th>
                  <th onClick={() => toggleSort('price')} className="px-3 py-2.5 text-right font-bold text-gray-600 cursor-pointer select-none max-sm:hidden">가격{sortArrow('price')}</th>
                  <th onClick={() => toggleSort('created')} className="px-3 py-2.5 text-center font-bold text-gray-600 cursor-pointer select-none max-sm:hidden">등록일{sortArrow('created')}</th>
                  <th className="px-3 py-2.5 text-center font-bold text-gray-600 w-[90px]">연결</th>
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
                        {mappedCount > 0 && <span className="ml-1.5 text-[11px] text-emerald-600 whitespace-nowrap"><i className="ti ti-link" />{mappedCount}</span>}
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

      {/* 결제 내역 */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">링크페이 결제 내역 <span className="text-gray-400 font-normal">({payments.length})</span></h2>
        </div>
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
                      onClick={() => setGrantUserId(m.id)}
                      className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer flex items-center justify-between ${grantUserId === m.id ? 'bg-[#2ED573]/10' : 'bg-white hover:bg-gray-50'}`}
                    >
                      <span>{m.name || '(이름없음)'} <span className="text-xs text-gray-400">{m.phone || ''}</span></span>
                      {grantUserId === m.id && <i className="ti ti-check text-[#2ED573]" />}
                    </button>
                  ))}
                </div>
              )}
              {grantUserId && <p className="text-[11px] text-emerald-600 mt-1">회원 선택됨</p>}
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
    </AdminLayout>
  )
}
