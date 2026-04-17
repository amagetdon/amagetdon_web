import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ImageUploader from '../../components/admin/ImageUploader'
import { ebookService } from '../../services/ebookService'
import { instructorService } from '../../services/instructorService'
import { storageService } from '../../services/storageService'
import { supabase } from '../../lib/supabase'
import type { EbookWithInstructor, Instructor } from '../../types'

interface EbookSeoShape {
  title?: string
  author?: string
  description?: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
}

const toKstDatetimeLocal = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 16)
}

type DetailTab = 'info' | 'buyers'

const TABS: { key: DetailTab; label: string; icon: string }[] = [
  { key: 'info', label: '기본 정보', icon: 'ti-info-circle' },
  { key: 'buyers', label: '구매자', icon: 'ti-users' },
]

export default function AdminEbookDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const ebookId = isNew ? null : id ? Number(id) : null
  const [ebook, setEbook] = useState<EbookWithInstructor | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [stats, setStats] = useState<{ buyerCount: number }>({ buyerCount: 0 })
  const [tab, setTab] = useState<DetailTab>('info')

  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [allEbooks, setAllEbooks] = useState<{ id: number; title: string }[]>([])

  const [pdfUploading, setPdfUploading] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // 구매자
  interface BuyerRow {
    purchase_id: number
    purchased_at: string
    expires_at: string | null
    price: number
    original_price: number | null
    payment_method: string | null
    user_id: string
    user_name: string | null
    user_email: string | null
    user_phone: string | null
  }
  const BUYERS_PER_PAGE = 10
  const [buyers, setBuyers] = useState<BuyerRow[]>([])
  const [buyersLoading, setBuyersLoading] = useState(false)
  const [buyersPage, setBuyersPage] = useState(1)
  const [buyersSearch, setBuyersSearch] = useState('')

  const loadEbook = useCallback(async () => {
    if (!ebookId) return
    setLoading(true)
    try {
      const data = await ebookService.getById(ebookId)
      setEbook(data)
      setEditing(data as unknown as Record<string, unknown>)
    } catch {
      toast.error('전자책을 불러오는데 실패했습니다.')
      navigate('/admin/ebooks')
    } finally {
      setLoading(false)
    }
  }, [ebookId, navigate])

  useEffect(() => {
    if (isNew) {
      setEditing({
        title: '',
        instructor_id: null,
        is_free: false,
        is_hot: false,
        original_price: null,
        sale_price: null,
        is_published: true,
        is_on_sale: true,
        duration_days: 0,
        strengths: [],
        features: [],
        seo: {},
        reward_points: 0,
        related_ebook_ids: [],
      })
      return
    }
    loadEbook()
  }, [isNew, loadEbook])

  useEffect(() => {
    Promise.all([
      instructorService.getAll(),
      supabase.from('ebooks').select('id, title').order('sort_order'),
    ])
      .then(([ins, ebooksRes]) => {
        setInstructors(ins)
        setAllEbooks(((ebooksRes.data ?? []) as { id: number; title: string }[]).filter((e) => e.id !== ebookId))
      })
      .catch(() => {})
  }, [ebookId])

  useEffect(() => {
    if (!ebookId) return
    let cancelled = false
    supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('ebook_id', ebookId)
      .then(({ count }) => { if (!cancelled) setStats({ buyerCount: count ?? 0 }) })
    return () => { cancelled = true }
  }, [ebookId])

  const fetchBuyers = useCallback(async () => {
    if (!ebookId) return
    setBuyersLoading(true)
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('id, purchased_at, expires_at, price, original_price, payment_method, user_id, profile:profiles(id, name, email, phone)')
        .eq('ebook_id', ebookId)
        .order('purchased_at', { ascending: false })
      if (error) throw error

      const rows: BuyerRow[] = (data ?? []).map((p) => {
        const purchase = p as unknown as {
          id: number; purchased_at: string; expires_at: string | null; price: number
          original_price: number | null; payment_method: string | null; user_id: string
          profile: { id: string; name: string | null; email: string | null; phone: string | null } | null
        }
        return {
          purchase_id: purchase.id,
          purchased_at: purchase.purchased_at,
          expires_at: purchase.expires_at,
          price: purchase.price,
          original_price: purchase.original_price,
          payment_method: purchase.payment_method,
          user_id: purchase.user_id,
          user_name: purchase.profile?.name ?? null,
          user_email: purchase.profile?.email ?? null,
          user_phone: purchase.profile?.phone ?? null,
        }
      })
      setBuyers(rows)
    } catch {
      toast.error('구매자 목록을 불러오는데 실패했습니다.')
    } finally {
      setBuyersLoading(false)
    }
  }, [ebookId])

  useEffect(() => {
    if (tab === 'buyers' && ebookId) fetchBuyers()
  }, [tab, ebookId, fetchBuyers])

  const filteredBuyers = buyers.filter((b) => {
    if (!buyersSearch.trim()) return true
    const q = buyersSearch.toLowerCase()
    return (b.user_name ?? '').toLowerCase().includes(q)
      || (b.user_email ?? '').toLowerCase().includes(q)
      || (b.user_phone ?? '').includes(q)
  })
  const buyersTotalPages = Math.max(1, Math.ceil(filteredBuyers.length / BUYERS_PER_PAGE))
  const pagedBuyers = filteredBuyers.slice((buyersPage - 1) * BUYERS_PER_PAGE, buyersPage * BUYERS_PER_PAGE)

  const formatKoDate = (iso: string | null | undefined) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('ko-KR')
  }

  const handleTypeChange = (val: string) => {
    if (!editing) return
    const isFree = val === 'free'
    setEditing({ ...editing, is_free: isFree, ...(isFree ? { original_price: 0, sale_price: 0 } : {}) })
  }

  const handlePdfUpload = async (file: File) => {
    if (!editing) return
    if (file.type !== 'application/pdf') {
      toast.error('PDF 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('파일 크기는 50MB 이하만 업로드할 수 있습니다.')
      return
    }
    try {
      setPdfUploading(true)
      const target = editing.id || `new-${Date.now()}`
      const ext = file.name.split('.').pop() || 'pdf'
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const uploadPath = `${target}/${fileName}`
      const resultPath = await storageService.uploadFile('ebooks', uploadPath, file)
      const publicUrl = storageService.getPublicUrl('ebooks', resultPath)
      setEditing({ ...editing, file_url: publicUrl })
      toast.success('PDF 파일이 업로드되었습니다.')
    } catch {
      toast.error('PDF 업로드에 실패했습니다.')
    } finally {
      setPdfUploading(false)
    }
  }

  const handleInfoSave = async () => {
    if (!editing) return
    const title = (editing.title as string)?.trim()
    if (!title) { toast.error('제목은 필수입니다.'); return }
    try {
      setSaving(true)
      const payload: Record<string, unknown> = {
        title,
        instructor_id: editing.instructor_id ?? null,
        is_free: !!editing.is_free,
        is_hot: !!editing.is_hot,
        original_price: editing.original_price ?? null,
        sale_price: editing.sale_price ?? null,
        thumbnail_url: editing.thumbnail_url ?? null,
        landing_image_url: editing.landing_image_url ?? null,
        file_url: editing.file_url ?? null,
        open_date: editing.open_date ?? null,
        close_date: editing.close_date ?? null,
        duration_days: editing.duration_days ?? 0,
        is_published: editing.is_published !== false,
        is_on_sale: editing.is_on_sale !== false,
        search_keywords: editing.search_keywords ?? null,
        strengths: ((editing.strengths as string[]) || []).filter((s) => s.trim()),
        features: ((editing.features as string[]) || []).filter((s) => s.trim()),
        seo: editing.seo ?? {},
        reward_points: editing.reward_points ?? 0,
        max_purchases: editing.max_purchases ?? null,
        discount_start: editing.discount_start ?? null,
        discount_end: editing.discount_end ?? null,
        related_ebook_ids: (editing.related_ebook_ids as number[]) ?? [],
        sort_order: editing.sort_order ?? 0,
      }
      if (isNew) {
        const created = await ebookService.create(payload) as { id: number }
        toast.success('새 전자책이 등록되었습니다.')
        navigate(`/admin/ebooks/${created.id}`, { replace: true })
        return
      }
      if (!ebookId) return
      await ebookService.update(ebookId, payload)
      toast.success('전자책이 수정되었습니다.')
      await loadEbook()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleEbookDelete = async () => {
    if (!ebookId) return
    try {
      setDeleting(true)
      await ebookService.delete(ebookId)
      toast.success('전자책이 삭제되었습니다.')
      navigate('/admin/ebooks')
    } catch {
      toast.error('삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  if (!ebookId && !isNew) return null
  const visibleTabs = isNew ? TABS.filter((t) => t.key === 'info') : TABS
  const isFree = editing?.is_free === true

  return (
    <AdminLayout>
      <div className="mb-6">
        <Link to="/admin/ebooks" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 no-underline mb-3">
          <i className="ti ti-arrow-left text-sm" /> 전자책 목록
        </Link>
        {isNew ? (
          <div>
            <h1 className="text-2xl font-bold text-gray-900">새 전자책 등록</h1>
            <p className="text-sm text-gray-400 mt-0.5">기본 정보를 입력하고 저장하면 구매자 관리 탭이 활성화됩니다.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-4">
            <div className="w-[80px] h-[108px] bg-gray-200 rounded-lg animate-pulse" />
            <div className="flex-1">
              <div className="h-6 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
              <div className="h-3 bg-gray-200 rounded w-32 animate-pulse" />
            </div>
          </div>
        ) : ebook ? (
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-[80px] h-[108px] bg-gray-100 rounded-lg overflow-hidden shrink-0">
              {ebook.thumbnail_url ? (
                <img src={ebook.thumbnail_url} alt={ebook.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">표지</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{ebook.title}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {ebook.instructor?.name ? `강사 ${ebook.instructor.name}` : '강사 미지정'}
                {' · '}
                {ebook.is_free ? '무료' : '유료'}
                {' · '}
                <span className={ebook.is_published ? 'text-emerald-600' : 'text-gray-400'}>
                  {ebook.is_published ? '공개' : '비공개'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <div className="text-center">
                <div className="text-[10px] text-gray-400 mb-0.5">구매자</div>
                <div className="text-sm font-bold text-gray-900">{stats.buyerCount.toLocaleString()}명</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {visibleTabs.length > 1 && (
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1.5 w-fit mb-6 flex-wrap">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all flex items-center gap-1.5 ${
                tab === t.key ? 'bg-[#2ED573] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'
              }`}
            >
              <i className={`ti ${t.icon} text-sm`} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'info' ? (
        editing ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex flex-wrap gap-4">
              <div className="w-full">
                <label className="text-sm font-bold block mb-1">제목 *</label>
                <input value={(editing.title as string) || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
              </div>
              <div className="w-[240px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">강사</label>
                <select value={(editing.instructor_id as number) || ''} onChange={(e) => setEditing({ ...editing, instructor_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all">
                  <option value="">선택</option>
                  {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div className="w-[140px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">유형</label>
                <select value={isFree ? 'free' : 'paid'} onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all">
                  <option value="free">무료</option>
                  <option value="paid">유료</option>
                </select>
              </div>
              <div className="w-[180px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">정가 (원)</label>
                <input type="number" value={isFree ? 0 : (editing.original_price as number) || ''} disabled={isFree}
                  onChange={(e) => setEditing({ ...editing, original_price: e.target.value ? Number(e.target.value) : null })}
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none ${isFree ? 'bg-gray-100 text-gray-400' : 'focus:border-[#2ED573]'}`} />
              </div>
              <div className="w-[180px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">할인가 (원)</label>
                <input type="number" value={isFree ? 0 : (editing.sale_price as number) || ''} disabled={isFree}
                  onChange={(e) => setEditing({ ...editing, sale_price: e.target.value ? Number(e.target.value) : null })}
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none ${isFree ? 'bg-gray-100 text-gray-400' : 'focus:border-[#2ED573]'}`} />
              </div>
              <div className="w-[140px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">정원 (명)</label>
                <input type="number" min={0} value={(editing.max_purchases as number) ?? ''}
                  onChange={(e) => setEditing({ ...editing, max_purchases: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="무제한"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">비우면 무제한</p>
              </div>
              <div className="w-[140px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">수강 적립 포인트</label>
                <input type="number" min={0} value={(editing.reward_points as number) ?? 0}
                  onChange={(e) => setEditing({ ...editing, reward_points: e.target.value === '' ? 0 : Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">0 = 미지급</p>
              </div>
              <div className="w-[140px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">열람 기간 (일)</label>
                <input type="number" min={0} value={(editing.duration_days as number) ?? 0}
                  onChange={(e) => setEditing({ ...editing, duration_days: e.target.value === '' ? 0 : Number(e.target.value) })}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">0 = 무제한</p>
              </div>
              <div className="flex gap-3 max-sm:w-full max-sm:flex-col">
                <div className="w-[220px] max-sm:w-full">
                  <label className="text-sm font-bold block mb-1">할인 시작일시</label>
                  <input type="datetime-local" value={toKstDatetimeLocal(editing.discount_start as string)} disabled={isFree}
                    onChange={(e) => setEditing({ ...editing, discount_start: e.target.value ? e.target.value + ':00+09:00' : null })}
                    className={`w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none transition-all ${isFree ? 'bg-gray-100 text-gray-400' : 'focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10'}`} />
                  <p className="text-xs text-gray-400 mt-1">비우면 할인가 상시 적용</p>
                </div>
                <div className="w-[220px] max-sm:w-full">
                  <label className="text-sm font-bold block mb-1">할인 종료일시</label>
                  <input type="datetime-local" value={toKstDatetimeLocal(editing.discount_end as string)} disabled={isFree}
                    onChange={(e) => setEditing({ ...editing, discount_end: e.target.value ? e.target.value + ':00+09:00' : null })}
                    className={`w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none transition-all ${isFree ? 'bg-gray-100 text-gray-400' : 'focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10'}`} />
                  <p className="text-xs text-gray-400 mt-1">이후 정가로 판매</p>
                </div>
              </div>
              <div className="w-[220px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">오픈일시</label>
                <input type="datetime-local" value={toKstDatetimeLocal(editing.open_date as string)}
                  onChange={(e) => setEditing({ ...editing, open_date: e.target.value ? e.target.value + ':00+09:00' : null })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1">비우면 바로 오픈</p>
              </div>
              <div className="w-[220px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">마감일시</label>
                <input type="datetime-local" value={toKstDatetimeLocal(editing.close_date as string)}
                  onChange={(e) => setEditing({ ...editing, close_date: e.target.value ? e.target.value + ':00+09:00' : null })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1">비우면 계속 노출</p>
              </div>
              <div className="w-full">
                <label className="text-sm font-bold block mb-1">연관 키워드</label>
                <input value={(editing.search_keywords as string) || ''} onChange={(e) => setEditing({ ...editing, search_keywords: e.target.value })}
                  placeholder="쉼표로 구분"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
                <p className="text-xs text-gray-400 mt-1">사이트 검색 시 이 키워드로도 노출됩니다.</p>
              </div>
              <div className="w-[260px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">표지 이미지</label>
                <ImageUploader bucket="ebooks" path={`${ebookId ?? 'new'}/thumb-${Date.now()}`}
                  currentUrl={editing.thumbnail_url as string} onUpload={(url) => setEditing({ ...editing, thumbnail_url: url })} className="h-[140px]" />
              </div>
              <div className="w-[260px] max-sm:w-full">
                <label className="text-sm font-bold block mb-1">랜딩 이미지</label>
                <ImageUploader bucket="ebooks" path={`${ebookId ?? 'new'}/landing-${Date.now()}`}
                  currentUrl={editing.landing_image_url as string} onUpload={(url) => setEditing({ ...editing, landing_image_url: url })} className="h-[140px]" />
              </div>
              <div className="w-full">
                <label className="text-sm font-bold block mb-1">PDF 파일</label>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handlePdfUpload(file)
                    e.target.value = ''
                  }}
                  className="hidden"
                />
                {(editing.file_url as string) ? (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <i className="ti ti-file-type-pdf text-red-500 text-xl" />
                    <a href={editing.file_url as string} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:underline truncate flex-1">
                      {(editing.file_url as string).split('/').pop()}
                    </a>
                    <button type="button" onClick={() => pdfInputRef.current?.click()} disabled={pdfUploading}
                      className="text-xs bg-white border border-gray-300 rounded-lg px-3 py-1.5 hover:border-[#2ED573] cursor-pointer transition-colors">
                      {pdfUploading ? '업로드 중...' : '재업로드'}
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => !pdfUploading && pdfInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#2ED573] transition-colors"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') pdfInputRef.current?.click() }}
                  >
                    {pdfUploading ? (
                      <div className="w-6 h-6 border-2 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <i className="ti ti-file-upload text-2xl text-gray-400" />
                        <p className="text-xs text-gray-400 mt-1">PDF 파일 업로드</p>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="w-full">
                <label className="text-sm font-bold block mb-2">뱃지 / 옵션</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!editing.is_hot} onChange={(e) => setEditing({ ...editing, is_hot: e.target.checked })} className="accent-[#2ED573]" /> HOT</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.is_published !== false} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-[#2ED573]" /> 공개</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.is_on_sale !== false} onChange={(e) => setEditing({ ...editing, is_on_sale: e.target.checked })} className="accent-[#2ED573]" /> 판매 중</label>
                </div>
                <p className="text-xs text-gray-400 mt-1">판매 중지 시 결제 버튼이 비활성화됩니다.</p>
              </div>
            </div>

            {/* 강점 / 특징 */}
            <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-2 max-sm:grid-cols-1 gap-6">
              <div>
                <label className="text-sm font-bold block mb-2">강점</label>
                <div className="space-y-2">
                  {((editing.strengths as string[]) || []).map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={s} onChange={(e) => {
                        const arr = [...((editing.strengths as string[]) || [])]
                        arr[idx] = e.target.value
                        setEditing({ ...editing, strengths: arr })
                      }}
                        placeholder="강점을 입력해 주세요"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
                      <button type="button" onClick={() => {
                        const arr = [...((editing.strengths as string[]) || [])]
                        arr.splice(idx, 1)
                        setEditing({ ...editing, strengths: arr })
                      }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border border-gray-200 cursor-pointer">
                        <i className="ti ti-x text-sm" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditing({ ...editing, strengths: [...((editing.strengths as string[]) || []), ''] })}
                    className="w-full py-2 rounded-lg text-xs font-medium border border-dashed border-gray-300 text-gray-500 bg-white cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors">
                    <i className="ti ti-plus text-xs" /> 강점 추가
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-bold block mb-2">특징</label>
                <div className="space-y-2">
                  {((editing.features as string[]) || []).map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={s} onChange={(e) => {
                        const arr = [...((editing.features as string[]) || [])]
                        arr[idx] = e.target.value
                        setEditing({ ...editing, features: arr })
                      }}
                        placeholder="특징을 입력해 주세요"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
                      <button type="button" onClick={() => {
                        const arr = [...((editing.features as string[]) || [])]
                        arr.splice(idx, 1)
                        setEditing({ ...editing, features: arr })
                      }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border border-gray-200 cursor-pointer">
                        <i className="ti ti-x text-sm" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditing({ ...editing, features: [...((editing.features as string[]) || []), ''] })}
                    className="w-full py-2 rounded-lg text-xs font-medium border border-dashed border-gray-300 text-gray-500 bg-white cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors">
                    <i className="ti ti-plus text-xs" /> 특징 추가
                  </button>
                </div>
              </div>
            </div>

            {/* 관련 전자책 */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-1">관련 전자책</h3>
              <p className="text-xs text-gray-400 mb-3">이 전자책 상세 페이지 하단에 추천 카드로 표시됩니다.</p>
              {allEbooks.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">다른 전자책이 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-xl bg-gray-50 max-h-[200px] overflow-y-auto">
                  {allEbooks.map((e) => {
                    const ids = (editing.related_ebook_ids as number[]) || []
                    const checked = ids.includes(e.id)
                    return (
                      <label key={e.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-colors ${
                        checked ? 'bg-[#2ED573] text-white border-[#2ED573]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}>
                        <input type="checkbox" checked={checked} onChange={(ev) => {
                          const next = ev.target.checked ? [...ids, e.id] : ids.filter((i) => i !== e.id)
                          setEditing({ ...editing, related_ebook_ids: next })
                        }} className="hidden" />
                        {e.title}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* SEO */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-1">SEO 태그 (이 전자책 전용)</h3>
              <p className="text-xs text-gray-400 mb-3">비워두면 사이트 기본 SEO가 사용됩니다.</p>
              <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
                {(() => {
                  const seo = (editing.seo as EbookSeoShape) || {}
                  const updateSeo = (patch: Partial<EbookSeoShape>) => setEditing({ ...editing, seo: { ...seo, ...patch } })
                  return (
                    <>
                      <div><label className="text-sm font-bold block mb-1">title</label>
                        <input value={seo.title || ''} onChange={(e) => updateSeo({ title: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div><label className="text-sm font-bold block mb-1">author</label>
                        <input value={seo.author || ''} onChange={(e) => updateSeo({ author: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div className="col-span-2 max-sm:col-span-1"><label className="text-sm font-bold block mb-1">description</label>
                        <input value={seo.description || ''} onChange={(e) => updateSeo({ description: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div className="col-span-2 max-sm:col-span-1"><label className="text-sm font-bold block mb-1">keywords</label>
                        <input value={seo.keywords || ''} onChange={(e) => updateSeo({ keywords: e.target.value })}
                          placeholder="쉼표로 구분"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div><label className="text-sm font-bold block mb-1">og:title</label>
                        <input value={seo.ogTitle || ''} onChange={(e) => updateSeo({ ogTitle: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div><label className="text-sm font-bold block mb-1">og:description</label>
                        <input value={seo.ogDescription || ''} onChange={(e) => updateSeo({ ogDescription: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div className="col-span-2 max-sm:col-span-1">
                        <label className="text-sm font-bold block mb-1">og:image</label>
                        <p className="text-xs text-gray-400 mb-1">권장 크기: 1200 × 627</p>
                        <ImageUploader bucket="ebooks" path={`${ebookId ?? 'new'}/seo-og-${Date.now()}`}
                          currentUrl={seo.ogImage || ''} onUpload={(url) => updateSeo({ ogImage: url })} className="h-[140px]" />
                      </div>
                      <div><label className="text-sm font-bold block mb-1">twitter:title</label>
                        <input value={seo.twitterTitle || ''} onChange={(e) => updateSeo({ twitterTitle: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div><label className="text-sm font-bold block mb-1">twitter:description</label>
                        <input value={seo.twitterDescription || ''} onChange={(e) => updateSeo({ twitterDescription: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" /></div>
                      <div className="col-span-2 max-sm:col-span-1">
                        <label className="text-sm font-bold block mb-1">twitter:image</label>
                        <p className="text-xs text-gray-400 mb-1">권장 크기: 1200 × 627</p>
                        <ImageUploader bucket="ebooks" path={`${ebookId ?? 'new'}/seo-tw-${Date.now()}`}
                          currentUrl={seo.twitterImage || ''} onUpload={(url) => updateSeo({ twitterImage: url })} className="h-[140px]" />
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={handleInfoSave}
                disabled={saving}
                className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50"
              >
                {saving ? '저장 중...' : isNew ? '전자책 등록' : '기본 정보 저장'}
              </button>
              {!isNew && ebookId && (
                <button
                  onClick={() => setDeleteTarget(ebookId)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium border border-red-200 text-red-500 bg-white cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-1.5"
                >
                  <i className="ti ti-trash text-sm" /> 전자책 삭제
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400 text-sm">불러오는 중...</div>
        )
      ) : tab === 'buyers' ? (
        <div>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <p className="text-sm text-gray-500">
              전체 구매자 {buyers.length}명{buyersSearch && ` · 검색 결과 ${filteredBuyers.length}명`}
            </p>
            <div className="relative max-w-xs">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                value={buyersSearch}
                onChange={(e) => { setBuyersSearch(e.target.value); setBuyersPage(1) }}
                placeholder="이름/이메일/전화 검색..."
                className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573] w-[280px]"
              />
            </div>
          </div>

          {buyersLoading ? (
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}
            </div>
          ) : pagedBuyers.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400 text-sm">
              {buyersSearch ? '검색 결과가 없습니다.' : '아직 구매자가 없습니다.'}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-gray-600">이름</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-600 max-sm:hidden">이메일</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-600 max-md:hidden">전화</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-600 max-md:hidden">구매일</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-600 max-sm:hidden">결제수단</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-600 max-md:hidden">금액</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-600 max-md:hidden">만료일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedBuyers.map((b) => (
                      <tr key={b.purchase_id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/admin/members?user=${b.user_id}`)}>
                        <td className="px-4 py-3 font-medium">{b.user_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-500 max-sm:hidden">{b.user_email || '-'}</td>
                        <td className="px-4 py-3 text-gray-500 max-md:hidden">{b.user_phone || '-'}</td>
                        <td className="px-4 py-3 text-center text-gray-400 text-xs max-md:hidden">{formatKoDate(b.purchased_at)}</td>
                        <td className="px-4 py-3 text-center max-sm:hidden">
                          {b.payment_method === 'toss' ? (
                            <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">카드</span>
                          ) : b.price > 0 ? (
                            <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full">포인트</span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">무료/부여</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500 max-md:hidden">
                          {b.price > 0 ? (
                            <>
                              {b.original_price && b.original_price !== b.price && (
                                <span className="text-[10px] text-gray-400 line-through mr-1">{b.original_price.toLocaleString()}</span>
                              )}
                              <span className="text-xs">{b.price.toLocaleString()}{b.payment_method === 'toss' ? '원' : 'P'}</span>
                            </>
                          ) : '무료'}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400 text-xs max-md:hidden">{b.expires_at ? formatKoDate(b.expires_at) : '무제한'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {buyersTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setBuyersPage(Math.max(1, buyersPage - 1))} disabled={buyersPage <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                <i className="ti ti-chevron-left" />
              </button>
              {Array.from({ length: buyersTotalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setBuyersPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-sm border-none cursor-pointer ${
                    p === buyersPage ? 'bg-[#2ED573] text-white' : 'bg-white text-gray-500 border border-gray-300'
                  }`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setBuyersPage(Math.min(buyersTotalPages, buyersPage + 1))} disabled={buyersPage >= buyersTotalPages}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                <i className="ti ti-chevron-right" />
              </button>
            </div>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={deleteTarget != null}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        onConfirm={handleEbookDelete}
        title="전자책 삭제"
        message="이 전자책을 삭제하시겠습니까?"
        loading={deleting}
      />
    </AdminLayout>
  )
}
