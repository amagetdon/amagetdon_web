import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from '@headlessui/react'
import toast from 'react-hot-toast'
import Pagination from '../components/Pagination'
import { supabase } from '../lib/supabase'
import HeroSection from '../components/HeroSection'
import EventBanner from '../components/EventBanner'
import { achievementService } from '../services/achievementService'
import { purchaseService } from '../services/purchaseService'
import { storageService } from '../services/storageService'
import { useAuth } from '../contexts/AuthContext'
import type { AchievementWithCourse } from '../types'

interface MyPurchasedCourse {
  course_id: number | null
  course: { id: number; title: string } | null
}

function ReviewResultsPage() {
  const { user, profile } = useAuth()
  const [currentPage, setCurrentPage] = useState(1)
  const [achievements, setAchievements] = useState<AchievementWithCourse[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementWithCourse | null>(null)
  const [likedIds, setLikedIds] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('liked_achievements')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })

  // 작성/수정 모달
  const [writeOpen, setWriteOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [writeTitle, setWriteTitle] = useState('')
  const [writeContent, setWriteContent] = useState('')
  const [writeCourseId, setWriteCourseId] = useState<number | null>(null)
  const [writeImage, setWriteImage] = useState<File | null>(null)
  const [writeImagePreview, setWriteImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [myCourses, setMyCourses] = useState<MyPurchasedCourse[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pageBanners, setPageBanners] = useState<import('../types').Banner[]>([])
  const [eventBanners, setEventBanners] = useState<import('../types').Banner[]>([])
  const [bannerLoading, setBannerLoading] = useState(true)

  const perPage = 4
  const totalPages = Math.ceil(totalCount / perPage)

  const fetchAchievements = async () => {
    try {
      setLoading(true)
      const { data, count } = await achievementService.getAll({ page: currentPage, perPage })
      setAchievements(data)
      setTotalCount(count)
    } catch {
      toast.error('성과를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAchievements() }, [currentPage])

  useEffect(() => {
    Promise.all([
      supabase.from('banners').select('*').eq('page_key', 'results').eq('is_published', true).order('sort_order'),
      supabase.from('banners').select('*').eq('page_key', 'results_event').eq('is_published', true).order('sort_order'),
    ]).then(([bannerRes, eventRes]) => {
      setPageBanners((bannerRes.data ?? []) as import('../types').Banner[])
      setEventBanners((eventRes.data ?? []) as import('../types').Banner[])
    }).finally(() => setBannerLoading(false))
  }, [])

  // 작성 모달 열 때 내 강의 로드
  useEffect(() => {
    if (!writeOpen || !user) return
    purchaseService.getMyClassroom(user.id).then((data) => {
      setMyCourses((data as MyPurchasedCourse[]).filter((p) => p.course_id))
    }).catch(() => {})
  }, [writeOpen, user])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setWriteImage(file)
    const reader = new FileReader()
    reader.onloadend = () => setWriteImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const resetWriteForm = () => {
    setEditingId(null)
    setWriteTitle('')
    setWriteContent('')
    setWriteCourseId(null)
    setWriteImage(null)
    setWriteImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const openEdit = (item: AchievementWithCourse) => {
    setEditingId(item.id)
    setWriteTitle(item.title)
    setWriteContent(item.content)
    setWriteCourseId(item.course_id)
    setWriteImagePreview(item.image_url)
    setSelectedAchievement(null)
    setWriteOpen(true)
  }

  const handleSubmit = async () => {
    if (!writeTitle.trim() || !writeContent.trim()) {
      toast.error('제목과 내용을 입력해주세요.')
      return
    }
    if (!writeCourseId) {
      toast.error('강의를 선택해주세요.')
      return
    }
    if (!user || !profile?.name) {
      toast.error('로그인이 필요합니다.')
      return
    }
    try {
      setSubmitting(true)
      let imageUrl: string | null = writeImagePreview && !writeImage ? writeImagePreview : null
      if (writeImage) {
        const ext = writeImage.name.split('.').pop() || 'png'
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
        const path = `user/${fileName}`
        await storageService.uploadFile('achievements', path, writeImage)
        imageUrl = storageService.getPublicUrl('achievements', path)
      }
      if (editingId) {
        await achievementService.update(editingId, {
          title: writeTitle.trim(),
          content: writeContent.trim(),
          image_url: imageUrl,
          course_id: writeCourseId,
        })
      } else {
        await achievementService.create({
          user_id: user.id,
          author_name: profile.name,
          title: writeTitle.trim(),
          content: writeContent.trim(),
          image_url: imageUrl,
          course_id: writeCourseId,
        })
      }
      toast.success(editingId ? '성과가 수정되었습니다.' : '성과가 등록되었습니다.')
      setWriteOpen(false)
      resetWriteForm()
      setCurrentPage(1)
      await fetchAchievements()
    } catch {
      toast.error('등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLike = async (id: number) => {
    const isLiked = likedIds.has(id)
    const newLikedIds = new Set(likedIds)
    if (isLiked) newLikedIds.delete(id)
    else newLikedIds.add(id)
    setLikedIds(newLikedIds)
    localStorage.setItem('liked_achievements', JSON.stringify([...newLikedIds]))

    // optimistic update
    setAchievements((prev) => prev.map((a) => a.id === id ? { ...a, likes_count: a.likes_count + (isLiked ? -1 : 1) } : a))
    if (selectedAchievement?.id === id) {
      setSelectedAchievement((prev) => prev ? { ...prev, likes_count: prev.likes_count + (isLiked ? -1 : 1) } : prev)
    }

    try {
      await achievementService.toggleLike(id, !isLiked)
    } catch {
      // rollback
      if (isLiked) newLikedIds.add(id)
      else newLikedIds.delete(id)
      setLikedIds(new Set(newLikedIds))
      setAchievements((prev) => prev.map((a) => a.id === id ? { ...a, likes_count: a.likes_count + (isLiked ? 1 : -1) } : a))
    }
  }

  return (
    <section className="w-full bg-white">
      <HeroSection banners={pageBanners} loading={bannerLoading} />
      {eventBanners.length > 0 && <EventBanner banner={eventBanners[0]} />}

      <div className="max-w-[1200px] mx-auto px-5 pb-16">
        <div className="flex items-center justify-between mt-10 mb-8">
          <h1 className="text-2xl font-bold text-gray-900">어떤 성과가 나왔는지 확인해보세요</h1>
          {user && profile?.name && (
            <button
              onClick={() => setWriteOpen(true)}
              className="bg-[#04F87F] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors shadow-sm shadow-[#04F87F]/20 flex items-center gap-1.5"
            >
              <i className="ti ti-pencil-plus text-sm" /> 성과 작성하기
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-200 h-[280px]" />
                <div className="p-5"><div className="h-3 bg-gray-200 rounded w-32 mb-2" /><div className="h-5 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-3 bg-gray-200 rounded w-full" /></div>
              </div>
            ))}
          </div>
        ) : achievements.length === 0 ? (
          <div className="text-center text-gray-400 py-20">등록된 성과가 없습니다.</div>
        ) : (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5">
            {achievements.map((item) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedAchievement(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedAchievement(item) }}
              >
                <div className="bg-gray-50 h-[280px] flex items-center justify-center overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-gray-300">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                      <span className="text-xs">이미지 없음</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <span className="text-xs text-[#04F87F] font-medium">
                    {item.author_name} | {new Date(item.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <h3 className="text-base font-bold text-gray-900 mt-2 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{item.content}</p>
                  <div className="flex items-center justify-between mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLike(item.id) }}
                      className={`flex items-center gap-1.5 text-sm border-none bg-transparent cursor-pointer transition-colors ${likedIds.has(item.id) ? 'text-[#04F87F]' : 'text-gray-400 hover:text-[#04F87F]'}`}
                    >
                      <i className={`ti ${likedIds.has(item.id) ? 'ti-thumb-up' : 'ti-thumb-up'}`} />
                      {item.likes_count > 0 && item.likes_count}
                    </button>
                    {item.course && (
                      <span className="text-xs text-gray-400">{item.course.title}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
        )}
      </div>

      {/* 상세 모달 */}
      <Dialog open={!!selectedAchievement} onClose={() => setSelectedAchievement(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-xl">
            {selectedAchievement && (
              <>
                {selectedAchievement.image_url && (
                  <img src={selectedAchievement.image_url} alt={selectedAchievement.title} className="w-full h-auto rounded-t-2xl" />
                )}
                <div className="p-6">
                  <span className="text-xs text-[#04F87F] font-medium">
                    {selectedAchievement.author_name} | {new Date(selectedAchievement.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <Dialog.Title className="text-lg font-bold text-gray-900 mt-2 mb-4">
                    {selectedAchievement.title}
                  </Dialog.Title>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {selectedAchievement.content}
                  </p>

                  {/* 좋아요 */}
                  <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleLike(selectedAchievement.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-colors ${
                        likedIds.has(selectedAchievement.id)
                          ? 'border-[#04F87F] text-[#04F87F] bg-[#04F87F]/5'
                          : 'border-gray-200 text-gray-500 bg-white hover:border-[#04F87F]'
                      }`}
                    >
                      <i className={`ti ${likedIds.has(selectedAchievement.id) ? 'ti-thumb-up' : 'ti-thumb-up'}`} />
                      {selectedAchievement.likes_count}
                    </button>
                  </div>

                  {/* 선택한 강의 */}
                  {selectedAchievement.course && (
                    <Link
                      to={`/course/${selectedAchievement.course.id}`}
                      onClick={() => setSelectedAchievement(null)}
                      className="mt-4 flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl no-underline hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                      <span className="text-sm font-medium text-gray-900">이 수강생이 선택한 강의</span>
                      <span className="text-sm text-[#04F87F] font-bold flex items-center gap-1">
                        {selectedAchievement.course.title} <i className="ti ti-chevron-right text-xs" />
                      </span>
                    </Link>
                  )}

                  <div className="flex gap-3 mt-4">
                    {user && selectedAchievement.user_id === user.id && (
                      <button
                        onClick={() => openEdit(selectedAchievement)}
                        className="flex-1 py-2.5 bg-[#04F87F] text-white rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors"
                      >
                        수정하기
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedAchievement(null)}
                      className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-gray-200 transition-colors"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* 작성 모달 */}
      <Dialog open={writeOpen} onClose={() => { setWriteOpen(false); resetWriteForm() }} className="relative z-50">
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-xl p-6">
            <Dialog.Title className="text-lg font-bold text-gray-900 mb-6">{editingId ? '성과 수정하기' : '성과 작성하기'}</Dialog.Title>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold block mb-1">제목 *</label>
                <input
                  value={writeTitle}
                  onChange={(e) => setWriteTitle(e.target.value)}
                  placeholder="성과 제목을 입력하세요"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">내용 *</label>
                <textarea
                  value={writeContent}
                  onChange={(e) => setWriteContent(e.target.value)}
                  placeholder="성과 내용을 작성해주세요"
                  rows={6}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">수강한 강의 *</label>
                {myCourses.length === 0 ? (
                  <p className="text-xs text-gray-400">구매한 강의가 없습니다. 강의를 구매한 후 성과를 작성할 수 있습니다.</p>
                ) : (
                  <select
                    value={writeCourseId ?? ''}
                    onChange={(e) => setWriteCourseId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#04F87F] focus:ring-2 focus:ring-[#04F87F]/10 transition-all"
                  >
                    <option value="">강의를 선택해주세요</option>
                    {myCourses.map((p) => p.course && (
                      <option key={p.course.id} value={p.course.id}>{p.course.title}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">이미지 (선택)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageChange}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:cursor-pointer"
                />
                {writeImagePreview && (
                  <div className="mt-3 relative">
                    <img src={writeImagePreview} alt="미리보기" className="w-full h-40 object-cover rounded-xl" />
                    <button
                      onClick={() => { setWriteImage(null); setWriteImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center border-none cursor-pointer text-xs hover:bg-black/70"
                      aria-label="이미지 제거"
                    >
                      <i className="ti ti-x" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setWriteOpen(false); resetWriteForm() }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-gray-200 transition-colors"
                disabled={submitting}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 bg-[#04F87F] text-white rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </section>
  )
}

export default ReviewResultsPage
