import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../types'

interface MemberWithPurchases extends Profile {
  purchaseCount: number
  totalSpent: number
}

export default function AdminMembers() {
  const [members, setMembers] = useState<MemberWithPurchases[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<MemberWithPurchases | null>(null)
  const [purchases, setPurchases] = useState<{ id: number; title: string; price: number; purchased_at: string; expires_at: string | null }[]>([])
  const [roleTarget, setRoleTarget] = useState<{ id: string; name: string; newRole: 'user' | 'admin' } | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (profileError) throw profileError

      const { data: purchaseData } = await supabase
        .from('purchases')
        .select('user_id, price')

      const purchaseMap = new Map<string, { count: number; total: number }>()
      if (purchaseData) {
        for (const p of purchaseData as { user_id: string; price: number }[]) {
          const prev = purchaseMap.get(p.user_id) || { count: 0, total: 0 }
          purchaseMap.set(p.user_id, { count: prev.count + 1, total: prev.total + p.price })
        }
      }

      const membersWithPurchases = (profiles as Profile[]).map((profile) => {
        const pData = purchaseMap.get(profile.id) || { count: 0, total: 0 }
        return { ...profile, purchaseCount: pData.count, totalSpent: pData.total }
      })

      setMembers(membersWithPurchases)
    } catch {
      toast.error('회원 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleViewMember = async (member: MemberWithPurchases) => {
    setViewing(member)
    const { data } = await supabase
      .from('purchases')
      .select('id, title, price, purchased_at, expires_at')
      .eq('user_id', member.id)
      .order('purchased_at', { ascending: false })
    setPurchases((data as typeof purchases) || [])
  }

  const handleRoleChange = async () => {
    if (!roleTarget) return
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: roleTarget.newRole } as never)
        .eq('id', roleTarget.id)
      if (error) throw error
      toast.success(`${roleTarget.name || '회원'}의 권한이 ${roleTarget.newRole === 'admin' ? '관리자' : '일반회원'}으로 변경되었습니다.`)
      setRoleTarget(null)
      await fetchData()
    } catch {
      toast.error('권한 변경에 실패했습니다.')
    }
  }

  const filtered = members.filter((m) =>
    (m.name || '').includes(search) ||
    (m.phone || '').includes(search) ||
    m.id.includes(search)
  )

  const exportToExcel = (data: MemberWithPurchases[]) => {
    const header = ['이름', '전화번호', '성별', '생년월일', '주소', '권한', '포인트', '구매 수', '총 결제액', '가입일']
    const rows = data.map((m) => [
      m.name || '',
      m.phone || '',
      m.gender === 'male' ? '남' : m.gender === 'female' ? '여' : '',
      m.birth_date || '',
      (m.address || '').replace(/\|/g, ' '),
      m.role === 'admin' ? '관리자' : '회원',
      m.points,
      m.purchaseCount,
      m.totalSpent,
      new Date(m.created_at).toLocaleDateString('ko-KR'),
    ])

    const BOM = '\uFEFF'
    const csv = BOM + [header, ...rows].map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `회원목록_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ko-KR')
  const formatGender = (g: string | null) => g === 'male' ? '남' : g === 'female' ? '여' : '-'

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
          <p className="text-sm text-gray-500 mt-1">전체 {members.length}명</p>
        </div>
        <button
          onClick={() => exportToExcel(filtered)}
          disabled={filtered.length === 0}
          className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <i className="ti ti-file-spreadsheet text-sm" />
          엑셀 내보내기
        </button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 전화번호 검색..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#04F87F]"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">이름</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">전화번호</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">성별</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">권한</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">구매</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">총 결제</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">가입일</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">{search ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}</td></tr>
                ) : filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewMember(m)}>
                    <td className="px-4 py-3 text-center font-medium">{m.name || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">{m.phone || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">{formatGender(m.gender)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        m.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {m.role === 'admin' ? '관리자' : '회원'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 max-sm:hidden">{m.purchaseCount}</td>
                    <td className="px-4 py-3 text-center text-gray-700 max-sm:hidden">{m.totalSpent > 0 ? `${m.totalSpent.toLocaleString()}원` : '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs max-sm:hidden">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setRoleTarget({
                            id: m.id,
                            name: m.name || '회원',
                            newRole: m.role === 'admin' ? 'user' : 'admin',
                          })
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-purple-500 hover:bg-purple-50 bg-transparent border-none cursor-pointer transition-colors mx-auto"
                        aria-label="권한 변경"
                      >
                        <i className="ti ti-shield text-sm" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 회원 상세 모달 */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[80vh] overflow-y-auto">
            {viewing && (
              <>
                <DialogTitle className="text-lg font-bold text-gray-900 mb-4">회원 정보</DialogTitle>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <InfoItem label="이름" value={viewing.name || '-'} />
                  <InfoItem label="전화번호" value={viewing.phone || '-'} />
                  <InfoItem label="성별" value={formatGender(viewing.gender)} />
                  <InfoItem label="생년월일" value={viewing.birth_date ? formatDate(viewing.birth_date) : '-'} />
                  <InfoItem label="주소" value={viewing.address || '-'} full />
                  <InfoItem label="포인트" value={`${viewing.points.toLocaleString()}P`} />
                  <InfoItem label="권한" value={viewing.role === 'admin' ? '관리자' : '일반회원'} />
                  <InfoItem label="가입일" value={formatDate(viewing.created_at)} />
                  <InfoItem label="총 구매" value={`${viewing.purchaseCount}건`} />
                  <InfoItem label="총 결제" value={`${viewing.totalSpent.toLocaleString()}원`} />
                </div>

                {purchases.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-2">구매 내역</h3>
                    <div className="space-y-2">
                      {purchases.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-700 truncate flex-1">{p.title}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="text-sm font-semibold text-gray-900">{p.price.toLocaleString()}원</span>
                            <span className="text-xs text-gray-400">{formatDate(p.purchased_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setViewing(null)}
                  className="mt-6 w-full py-2 bg-gray-100 text-gray-600 rounded-lg cursor-pointer border-none text-sm hover:bg-gray-200"
                >
                  닫기
                </button>
              </>
            )}
          </DialogPanel>
        </div>
      </Dialog>

      {/* 권한 변경 확인 */}
      <ConfirmDialog
        isOpen={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        onConfirm={handleRoleChange}
        title="권한 변경"
        message={roleTarget ? `${roleTarget.name}의 권한을 ${roleTarget.newRole === 'admin' ? '관리자' : '일반회원'}으로 변경하시겠습니까?` : ''}
      />
    </AdminLayout>
  )
}

function InfoItem({ label, value, full }: { label: string; value: string; full?: boolean }) {
  const formatted = value.includes('|') ? value.split('|').map((v) => v.trim()).join('\n') : value
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900 whitespace-pre-line">{formatted}</p>
    </div>
  )
}
