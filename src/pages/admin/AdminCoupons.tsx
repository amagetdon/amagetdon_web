import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import { couponService } from '../../services/couponService'
import type { Coupon } from '../../types'

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const data = await withTimeout(couponService.getAll())
      setCoupons(data)
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])
  useVisibilityRefresh(fetchData)

  const handleSave = async () => {
    if (!editing || !editing.title || !editing.code) {
      toast.error('제목과 쿠폰 코드는 필수입니다.')
      return
    }
    try {
      setSaving(true)
      if (editing.id) {
        const { id, created_at, ...updates } = editing
        void created_at
        await couponService.update(id as number, updates as Partial<Coupon>)
        toast.success('쿠폰이 수정되었습니다.')
      } else {
        await couponService.create({
          title: editing.title as string,
          description: (editing.description as string) || null,
          discount_type: (editing.discount_type as 'fixed' | 'percent') || 'fixed',
          discount_value: Number(editing.discount_value) || 0,
          min_purchase: Number(editing.min_purchase) || 0,
          max_discount: editing.max_discount ? Number(editing.max_discount) : null,
          brand_name: (editing.brand_name as string) || null,
          banner_image_url: (editing.banner_image_url as string) || null,
          banner_bg_color: (editing.banner_bg_color as string) || null,
          banner_text_color: (editing.banner_text_color as string) || null,
          code: editing.code as string,
          max_claims: editing.max_claims ? Number(editing.max_claims) : null,
          expires_at: (editing.expires_at as string) || null,
          is_published: editing.is_published !== false,
        })
        toast.success('새 쿠폰이 등록되었습니다.')
      }
      setEditing(null)
      await fetchData()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await couponService.delete(deleteTarget)
      toast.success('쿠폰이 삭제되었습니다.')
      setDeleteTarget(null)
      await fetchData()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">쿠폰 관리</h1>
          <p className="text-sm text-gray-500 mt-1">전자책 페이지 하단에 표시되는 쿠폰을 관리합니다.</p>
        </div>
        <button
          onClick={() => setEditing({
            title: '',
            description: '',
            discount_type: 'fixed',
            discount_value: 1000,
            min_purchase: 0,
            max_discount: null,
            brand_name: '',
            banner_image_url: '',
            banner_bg_color: '#c0e3d1',
            banner_text_color: '#171717',
            code: generateCode(),
            max_claims: null,
            expires_at: '',
            is_published: true,
          })}
          className="bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20 flex items-center gap-1.5"
        >
          <i className="ti ti-plus text-sm" /> 쿠폰 추가
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-16 bg-gray-100 rounded" />)}
        </div>
      ) : coupons.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">등록된 쿠폰이 없습니다.</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600">쿠폰</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">할인</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">조건</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">코드</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">발급</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">기간</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">상태</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.map((c) => {
                const expired = c.expires_at && new Date(c.expires_at) < new Date()
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-900">{c.title}</p>
                      {c.brand_name && <p className="text-xs text-gray-400">{c.brand_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-center max-sm:hidden">
                      <span className="font-bold text-gray-900">{c.discount_type === 'percent' ? `${c.discount_value}%` : `${c.discount_value.toLocaleString()}원`}</span>
                      {c.discount_type === 'percent' && c.max_discount && (
                        <p className="text-[10px] text-gray-400">최대 {c.max_discount.toLocaleString()}원</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400 max-sm:hidden">
                      {c.min_purchase > 0 ? `${c.min_purchase.toLocaleString()}P 이상` : '제한 없음'}
                    </td>
                    <td className="px-4 py-3 text-center max-sm:hidden">
                      <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{c.code}</code>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">
                      {c.claims_count}{c.max_claims ? `/${c.max_claims}` : ''}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400 max-sm:hidden">
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString('ko-KR') : '무기한'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        expired ? 'bg-red-100 text-red-600' :
                        c.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {expired ? '만료' : c.is_published ? '공개' : '비공개'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditing(c as unknown as Record<string, unknown>)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="수정">
                          <i className="ti ti-pencil text-sm" />
                        </button>
                        <button onClick={() => setDeleteTarget(c.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="삭제">
                          <i className="ti ti-trash text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 쿠폰 편집 모달 */}
      <AdminFormModal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? '쿠폰 수정' : '새 쿠폰 등록'} onSubmit={handleSave} loading={saving}>
        {editing && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="col-span-2 max-sm:col-span-1">
              <label className="text-sm font-bold block mb-1">쿠폰 제목 *</label>
              <textarea value={(editing.title as string) || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="고객님을 위한 혜택&#10;10원 이상 결제 시 사용 가능" rows={2}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all resize-none" />
              <p className="text-xs text-gray-400 mt-1">줄바꿈으로 제목을 구분할 수 있습니다.</p>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">브랜드명</label>
              <input value={(editing.brand_name as string) || ''} onChange={(e) => setEditing({ ...editing, brand_name: e.target.value })}
                placeholder="아마겟돈"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">설명</label>
              <input value={(editing.description as string) || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="알림받기 동의 고객 상품중복할인"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">할인 타입</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing({ ...editing, discount_type: 'fixed' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${
                    (editing.discount_type || 'fixed') === 'fixed' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'
                  }`}>
                  정액 (원)
                </button>
                <button type="button" onClick={() => setEditing({ ...editing, discount_type: 'percent' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${
                    editing.discount_type === 'percent' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'
                  }`}>
                  정률 (%)
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">할인 금액/비율 *</label>
              <input type="number" value={(editing.discount_value as number) ?? 0} onChange={(e) => setEditing({ ...editing, discount_value: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">최소 결제 금액</label>
              <input type="number" value={(editing.min_purchase as number) ?? 0} onChange={(e) => setEditing({ ...editing, min_purchase: Number(e.target.value) })}
                placeholder="0"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              <p className="text-xs text-gray-400 mt-1">0이면 제한 없음</p>
            </div>
            <div>
              <label className={`text-sm font-bold block mb-1 ${editing.discount_type !== 'percent' ? 'text-gray-300' : ''}`}>최대 할인 금액</label>
              <input type="number" value={(editing.max_discount as number) ?? ''} onChange={(e) => setEditing({ ...editing, max_discount: e.target.value ? Number(e.target.value) : null })}
                placeholder="무제한"
                disabled={editing.discount_type !== 'percent'}
                className={`w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all ${editing.discount_type !== 'percent' ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : ''}`} />
              <p className="text-xs text-gray-400 mt-1">정률 할인 시 최대 할인 상한 (비워두면 무제한)</p>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">쿠폰 코드 *</label>
              <div className="flex gap-2">
                <input value={(editing.code as string) || ''} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all font-mono" />
                <button type="button" onClick={() => setEditing({ ...editing, code: generateCode() })}
                  className="px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-500 bg-white hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                  자동생성
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">최대 발급 수</label>
              <input type="number" value={(editing.max_claims as number) ?? ''} onChange={(e) => setEditing({ ...editing, max_claims: e.target.value ? Number(e.target.value) : null })}
                placeholder="무제한"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              <p className="text-xs text-gray-400 mt-1">비워두면 무제한</p>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">만료일</label>
              <input type="date" value={(editing.expires_at as string)?.split('T')[0] || ''} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value ? `${e.target.value}T23:59:59` : null })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              <p className="text-xs text-gray-400 mt-1">비워두면 무기한</p>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">배너 배경색</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={(editing.banner_bg_color as string) || '#c0e3d1'}
                  onChange={(e) => setEditing({ ...editing, banner_bg_color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer" />
                <input value={(editing.banner_bg_color as string) || '#c0e3d1'}
                  onChange={(e) => setEditing({ ...editing, banner_bg_color: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all font-mono" />
              </div>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">텍스트 색상</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={(editing.banner_text_color as string) || '#171717'}
                  onChange={(e) => setEditing({ ...editing, banner_text_color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer" />
                <input value={(editing.banner_text_color as string) || '#171717'}
                  onChange={(e) => setEditing({ ...editing, banner_text_color: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all font-mono" />
              </div>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">배너 이미지</label>
              <ImageUploader bucket="coupons" path={`${editing.id || 'new'}-${Date.now()}`}
                currentUrl={editing.banner_image_url as string} onUpload={(url) => setEditing({ ...editing, banner_image_url: url })} className="h-[100px]" />
            </div>
            <div className="col-span-2 max-sm:col-span-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editing.is_published !== false} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-[#2ED573]" />
                공개
              </label>
            </div>

            {/* 미리보기 */}
            <div className="col-span-2 max-sm:col-span-1">
              <p className="text-xs text-gray-400 mb-2">미리보기</p>
              <div className="rounded-xl overflow-hidden flex" style={{ backgroundColor: (editing.banner_bg_color as string) || '#c0e3d1' }}>
                <div className="flex-1 flex items-center gap-4 p-5">
                  <div className="bg-white rounded-xl p-4 text-center shrink-0 shadow-sm min-w-[120px]">
                    {(editing.brand_name as string) && <p className="text-[10px] font-bold text-gray-500 mb-0.5">{editing.brand_name as string}</p>}
                    <p className="text-xl font-black text-gray-900">
                      {editing.discount_type === 'percent' ? `${editing.discount_value}%` : `${Number(editing.discount_value || 0).toLocaleString()}원`}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5">{(editing.description as string) || '할인 쿠폰'}</p>
                    <div className="mt-2 px-3 py-1 bg-[#2ED573] text-white text-[10px] font-bold rounded-full inline-block">쿠폰 받기</div>
                  </div>
                  <p className="text-base font-black leading-snug whitespace-pre-line" style={{ color: (editing.banner_text_color as string) || '#171717' }}>{(editing.title as string) || '쿠폰 제목'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="쿠폰 삭제"
        message="이 쿠폰을 삭제하시겠습니까?"
      />
    </AdminLayout>
  )
}
