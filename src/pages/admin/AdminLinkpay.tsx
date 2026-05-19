import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { supabase } from '../../lib/supabase'
import { courseService } from '../../services/courseService'
import { linkpayService, type LinkpayLink, type LinkpayPayment } from '../../services/linkpayService'
import type { CourseWithInstructor } from '../../types'

interface MemberHit { id: string; name: string | null; phone: string | null; email: string | null }

/** 강의 마감일·수강기간 기준 수강권 만료일 (AdminMembers 수동 부여와 동일 규칙) */
function courseExpiry(course: CourseWithInstructor | undefined): string | null {
  if (!course) return null
  const c = course as unknown as { enrollment_deadline: string | null; duration_days: number | null }
  if (c.enrollment_deadline && c.duration_days && c.duration_days > 0) {
    return new Date(new Date(c.enrollment_deadline).getTime() + c.duration_days * 86400000).toISOString()
  }
  return null
}

export default function AdminLinkpay() {
  const [links, setLinks] = useState<LinkpayLink[]>([])
  const [payments, setPayments] = useState<LinkpayPayment[]>([])
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [loading, setLoading] = useState(true)

  // 링크 매핑 추가 모달
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkSaving, setLinkSaving] = useState(false)
  const [newProductKey, setNewProductKey] = useState('')
  const [newCourseId, setNewCourseId] = useState<number | ''>('')
  const [newLabel, setNewLabel] = useState('')
  const [linkCourseSearch, setLinkCourseSearch] = useState('')
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

  const handleCreateLink = async () => {
    if (!newProductKey.trim()) { toast.error('productKey를 입력해주세요.'); return }
    if (newCourseId === '') { toast.error('강의를 선택해주세요.'); return }
    try {
      setLinkSaving(true)
      await linkpayService.createLink({
        product_key: newProductKey.trim(),
        course_id: newCourseId as number,
        ebook_id: null,
        label: newLabel.trim() || null,
      })
      toast.success('링크 매핑이 추가되었습니다.')
      setLinkModalOpen(false)
      setNewProductKey(''); setNewCourseId(''); setNewLabel(''); setLinkCourseSearch('')
      await fetchData()
    } catch {
      toast.error('추가에 실패했습니다. (productKey 중복 여부 확인)')
    } finally {
      setLinkSaving(false)
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

  const filteredLinkCourses = [...courses]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter((c) => !linkCourseSearch || c.title.includes(linkCourseSearch) || (c.instructor?.name || '').includes(linkCourseSearch))
  const filteredGrantCourses = [...courses]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter((c) => !grantCourseSearch || c.title.includes(grantCourseSearch) || (c.instructor?.name || '').includes(grantCourseSearch))

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">링크페이 연동</h1>
        <p className="text-sm text-gray-400 mt-0.5">토스 링크페이로 결제하면 수강권이 자동 부여됩니다. 링크별 강의 매핑을 등록하세요.</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-900">
        <p className="font-bold mb-1"><i className="ti ti-info-circle mr-1" />동작 방식</p>
        <p className="text-xs text-blue-800/80 leading-relaxed">
          링크페이 결제 완료 → 웹훅 수신 → <b>productKey로 강의 식별</b> → <b>결제자 전화번호로 회원 매칭</b> → 수강권 자동 부여.
          강의 매핑이 없거나 전화번호가 일치하는 회원이 없으면 아래 "결제 내역"에 미부여로 남고, 수동 부여할 수 있습니다.
        </p>
      </div>

      {/* 링크 매핑 */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">링크 ↔ 강의 매핑 <span className="text-gray-400 font-normal">({links.length})</span></h2>
          <button
            onClick={() => setLinkModalOpen(true)}
            className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors flex items-center gap-1.5"
          >
            <i className="ti ti-plus text-sm" /> 매핑 추가
          </button>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : links.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">등록된 링크 매핑이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600">productKey</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600">연결 강의</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 max-sm:hidden">메모</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 w-[80px]">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {links.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{l.product_key}</td>
                  <td className="px-4 py-3 text-gray-800">{courseTitle(l.course_id)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-sm:hidden">{l.label || '-'}</td>
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
        {loading ? (
          <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : payments.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">아직 링크페이 결제 내역이 없습니다.</p>
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

      {/* 링크 매핑 추가 모달 */}
      <AdminFormModal
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        title="링크 ↔ 강의 매핑 추가"
        onSubmit={handleCreateLink}
        loading={linkSaving}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold block mb-1">productKey *</label>
            <input
              value={newProductKey}
              onChange={(e) => setNewProductKey(e.target.value)}
              placeholder="토스 링크페이 상품의 productKey"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-[#2ED573]"
            />
            <p className="text-[11px] text-gray-400 mt-1">토스 상점관리자의 링크페이 상품 상세에서 확인하거나, 아래 결제 내역의 "미매핑 링크"에서 확인할 수 있습니다.</p>
          </div>
          <div>
            <label className="text-sm font-bold block mb-1">연결할 강의 *</label>
            <div className="border border-gray-300 rounded-xl overflow-hidden">
              <input
                value={linkCourseSearch}
                onChange={(e) => setLinkCourseSearch(e.target.value)}
                placeholder="강의 검색..."
                className="w-full px-3 py-2 text-sm border-none outline-none border-b border-gray-200"
                style={{ borderBottom: '1px solid #e5e7eb' }}
              />
              <div className="max-h-[200px] overflow-y-auto">
                {filteredLinkCourses.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setNewCourseId(newCourseId === c.id ? '' : c.id)}
                    className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer flex items-center justify-between ${newCourseId === c.id ? 'bg-[#2ED573]/10 text-gray-900' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span>{c.instructor?.name && <span className="text-xs text-gray-400 mr-1">[{c.instructor.name}]</span>}{c.title}</span>
                    {newCourseId === c.id && <i className="ti ti-check text-[#2ED573]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-bold block mb-1">메모 (선택)</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="예: 5월 할인 링크"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573]"
            />
          </div>
        </div>
      </AdminFormModal>

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
