import { useState, useEffect, useRef } from 'react'
import { Dialog } from '@headlessui/react'
import toast from 'react-hot-toast'
import { ReviewTabs } from './ReviewsPage'
import Pagination from '../components/Pagination'
import { achievementService } from '../services/achievementService'
import { storageService } from '../services/storageService'
import { useAuth } from '../contexts/AuthContext'
import type { Achievement } from '../types'

function ReviewResultsPage() {
  const { user, profile } = useAuth()
  const [currentPage, setCurrentPage] = useState(1)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null)

  // 작성 모달 상태
  const [writeOpen, setWriteOpen] = useState(false)
  const [writeTitle, setWriteTitle] = useState('')
  const [writeContent, setWriteContent] = useState('')
  const [writeImage, setWriteImage] = useState<File | null>(null)
  const [writeImagePreview, setWriteImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setWriteImage(file)
    const reader = new FileReader()
    reader.onloadend = () => setWriteImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const resetWriteForm = () => {
    setWriteTitle('')
    setWriteContent('')
    setWriteImage(null)
    setWriteImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!writeTitle.trim() || !writeContent.trim()) {
      toast.error('제목과 내용을 입력해주세요.')
      return
    }
    if (!user || !profile?.name) {
      toast.error('로그인이 필요합니다.')
      return
    }

    try {
      setSubmitting(true)
      let imageUrl: string | null = null

      if (writeImage) {
        const ext = writeImage.name.split('.').pop() || 'png'
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
        const path = `achievements/${fileName}`
        await storageService.uploadFile('achievements', path, writeImage)
        imageUrl = storageService.getPublicUrl('achievements', path)
      }

      await achievementService.create({
        user_id: user.id,
        author_name: profile.name,
        title: writeTitle.trim(),
        content: writeContent.trim(),
        image_url: imageUrl,
      })

      toast.success('성과가 등록되었습니다.')
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

  return (
    <section className="w-full bg-white">
      <div className="w-full h-[200px] bg-black" />

      <ReviewTabs />

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
                <div className="p-5">
                  <div className="h-3 bg-gray-200 rounded w-32 mb-2" />
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                </div>
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
                <div className="bg-gray-100 h-[280px] flex items-center justify-center overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm text-gray-400">게시판 첨부 이미지</span>
                  )}
                </div>
                <div className="p-5">
                  <span className="text-xs text-[#04F87F] font-medium">
                    {item.author_name} | {new Date(item.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <h3 className="text-base font-bold text-gray-900 mt-2 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{item.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
        )}
      </div>

      {/* 성과 상세 모달 */}
      <Dialog open={!!selectedAchievement} onClose={() => setSelectedAchievement(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-xl">
            {selectedAchievement && (
              <>
                {selectedAchievement.image_url && (
                  <img
                    src={selectedAchievement.image_url}
                    alt={selectedAchievement.title}
                    className="w-full h-auto rounded-t-2xl"
                  />
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
                  <button
                    onClick={() => setSelectedAchievement(null)}
                    className="mt-6 w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-gray-200 transition-colors"
                  >
                    닫기
                  </button>
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
            <Dialog.Title className="text-lg font-bold text-gray-900 mb-6">성과 작성하기</Dialog.Title>

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
