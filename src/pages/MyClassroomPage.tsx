import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { purchaseService } from '../services/purchaseService'
import { progressService } from '../services/progressService'
import { reviewService } from '../services/reviewService'
import VideoPlayerModal from '../components/VideoPlayerModal'
import ReviewForm from '../components/ReviewForm'
import ProgressBar from '../components/ProgressBar'
import toast from 'react-hot-toast'

interface CurriculumItem {
  id: number
  week: number | null
  label: string
  description: string | null
  video_url: string | null
  is_redirect: boolean | null
}

interface CoursePurchase {
  id: number
  purchased_at: string | null
  expires_at: string | null
  course: {
    id: number
    title: string
    thumbnail_url: string | null
    enrollment_deadline: string | null
    duration_days: number | null
    instructor: { id: number; name: string } | null
    curriculum_items: CurriculumItem[]
  } | null
}

interface EbookPurchase {
  id: number
  purchased_at: string | null
  expires_at: string | null
  ebook: {
    id: number
    title: string
    thumbnail_url: string | null
    file_url: string | null
    instructor: { id: number; name: string } | null
  } | null
}

const formatKoDateTime = (iso: string | null | undefined) => {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

type TabType = 'all' | 'courses' | 'ebooks'

function MyClassroomPage() {
  const navigate = useNavigate()
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null)
  const { user, profile } = useAuth()
  const [guestBannerDismissed, setGuestBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('guest_banner_dismissed') === '1'
  })
  const [coursePurchases, setCoursePurchases] = useState<CoursePurchase[]>([])
  const [ebookPurchases, setEbookPurchases] = useState<EbookPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabType>('all')
  const [completedItems, setCompletedItems] = useState<Record<number, Set<number>>>({})
  const [completionRates, setCompletionRates] = useState<Record<number, number>>({})
  const [togglingItems, setTogglingItems] = useState<Set<number>>(new Set())
  const [reviewTarget, setReviewTarget] = useState<{ courseId: number; courseName: string } | null>(null)
  const [reviewedCourses, setReviewedCourses] = useState<Set<number>>(new Set())

  const loadProgress = useCallback(async (userId: string, courseIds: number[]) => {
    const completedMap: Record<number, Set<number>> = {}
    const ratesMap: Record<number, number> = {}

    await Promise.all(
      courseIds.map(async (courseId) => {
        try {
          const [progress, completion] = await Promise.all([
            progressService.getCourseProgress(userId, courseId),
            progressService.getCourseCompletion(userId, courseId),
          ])
          completedMap[courseId] = new Set(
            progress.filter((p) => p.is_completed).map((p) => p.curriculum_item_id)
          )
          ratesMap[courseId] = completion
        } catch {
          completedMap[courseId] = new Set()
          ratesMap[courseId] = 0
        }
      })
    )

    setCompletedItems(completedMap)
    setCompletionRates(ratesMap)
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const loadData = async () => {
      try {
        const [courseData, ebookData] = await Promise.all([
          purchaseService.getMyClassroom(user.id),
          purchaseService.getMyEbooks(user.id),
        ])
        if (cancelled) return

        const courses = courseData as CoursePurchase[]
        const ebooks = ebookData as EbookPurchase[]
        setCoursePurchases(courses)
        setEbookPurchases(ebooks)

        const courseIds = courses
          .map((p) => p.course?.id)
          .filter((id): id is number => id != null)

        if (courseIds.length > 0) {
          await Promise.all([
            loadProgress(user.id, courseIds),
            Promise.all(
              courseIds.map(async (cid) => {
                try {
                  const existing = await reviewService.getByUser(user.id, cid)
                  return existing ? cid : null
                } catch {
                  return null
                }
              })
            ).then((results) => {
              if (!cancelled) {
                setReviewedCourses(new Set(results.filter((id): id is number => id != null)))
              }
            }),
          ])
        }
      } catch {
        // 데이터 로드 실패
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [user, loadProgress])

  const getDDay = (expiresAt: string | null) => {
    if (!expiresAt) return null
    const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
    return diff > 0 ? diff : 0
  }

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt).getTime() < Date.now()
  }

  const handleToggleComplete = async (courseId: number, itemId: number) => {
    if (!user || togglingItems.has(itemId)) return

    const currentCompleted = completedItems[courseId] ?? new Set()
    const newIsCompleted = !currentCompleted.has(itemId)

    setTogglingItems((prev) => new Set(prev).add(itemId))

    setCompletedItems((prev) => {
      const updated = new Set(prev[courseId] ?? new Set<number>())
      if (newIsCompleted) updated.add(itemId)
      else updated.delete(itemId)
      return { ...prev, [courseId]: updated }
    })

    try {
      await progressService.toggleCompleted(user.id, courseId, itemId, newIsCompleted)
      const completion = await progressService.getCourseCompletion(user.id, courseId)
      setCompletionRates((prev) => ({ ...prev, [courseId]: completion }))
    } catch (err) {
      setCompletedItems((prev) => {
        const rollback = new Set(prev[courseId] ?? new Set<number>())
        if (newIsCompleted) rollback.delete(itemId)
        else rollback.add(itemId)
        return { ...prev, [courseId]: rollback }
      })
      const message = err instanceof Error ? err.message : '진도 업데이트에 실패했습니다.'
      toast.error(message)
    } finally {
      setTogglingItems((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: '모두보기' },
    { key: 'courses', label: `강의 (${coursePurchases.length})` },
    { key: 'ebooks', label: `전자책 (${ebookPurchases.length})` },
  ]

  const showCourses = tab === 'all' || tab === 'courses'
  const showEbooks = tab === 'all' || tab === 'ebooks'
  const isEmpty = coursePurchases.length === 0 && ebookPurchases.length === 0

  const renderCourse = (purchase: CoursePurchase) => {
    const course = purchase.course
    if (!course) return null
    const effectiveExpiry = purchase.expires_at ?? course.enrollment_deadline
    const expired = isExpired(effectiveExpiry)
    const deadlinePassed = isExpired(course.enrollment_deadline)
    const deadlineDDay = getDDay(course.enrollment_deadline)
    const reviewDDay = purchase.expires_at ? getDDay(purchase.expires_at) : null
    const courseCompleted = completedItems[course.id] ?? new Set<number>()
    const completionRate = completionRates[course.id] ?? 0

    return (
      <div key={`course-${purchase.id}`} className="mb-12">
        <div className="flex items-start gap-6 max-sm:flex-col">
          <div className="bg-black rounded-xl w-[300px] aspect-video shrink-0 max-sm:w-full border-2 border-[#2ED573] overflow-hidden flex items-center justify-center">
            {course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-600 text-sm">썸네일</span>
            )}
          </div>
          <div className="flex-1 max-sm:w-full">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">강의</span>
              {expired ? (
                <span className="bg-gray-400 text-white text-xs font-bold px-3 py-1 rounded-full">수강 기간 만료</span>
              ) : deadlinePassed && reviewDDay !== null ? (
                <>
                  <span className="bg-gray-400 text-white text-xs font-bold px-3 py-1 rounded-full">수강 기간 만료</span>
                  <span className="bg-[#2ED573] text-white text-xs font-bold px-3 py-1 rounded-full">다시보기 D-{reviewDDay}</span>
                </>
              ) : deadlineDDay !== null ? (
                <span className="bg-[#2ED573] text-white text-xs font-bold px-3 py-1 rounded-full">마감 D-{deadlineDDay}</span>
              ) : null}
            </div>
            <h2 className="text-xl font-bold whitespace-pre-line">{course.title}</h2>
            <p className="text-sm text-gray-400 mt-1">{course.instructor?.name} 강사</p>
            <div className="flex flex-col gap-0.5 text-xs text-gray-400 mt-2">
              <span>최초 수강일: {formatKoDateTime(purchase.purchased_at)}</span>
              <span>
                수강 만료일: {course.enrollment_deadline ? formatKoDateTime(course.enrollment_deadline) : '무제한'}
                {course.enrollment_deadline && (course.duration_days ?? 0) > 0 && (
                  <> (다시보기 {course.duration_days}일)</>
                )}
              </span>
            </div>
            {course.curriculum_items.length > 0 && (
              <div className="mt-3">
                <ProgressBar value={completionRate} size="sm" />
              </div>
            )}
            <div className="flex gap-2 mt-4 flex-wrap">
              <button
                onClick={() => navigate(`/course/${course.id}`)}
                className="bg-[#2ED573] text-black font-bold px-5 py-2 rounded-lg hover:brightness-110 transition cursor-pointer border-none text-sm"
              >
                강의 상세보기
              </button>
              <button
                onClick={() => setReviewTarget({ courseId: course.id, courseName: course.title })}
                className="bg-white border border-gray-300 text-gray-700 font-medium px-4 py-2 rounded-lg hover:border-[#2ED573] hover:text-[#2ED573] transition cursor-pointer text-sm"
              >
                {reviewedCourses.has(course.id) ? '후기 수정하기' : '후기 작성'}
              </button>
            </div>
          </div>
        </div>

        {course.curriculum_items.length === 0 ? (
          <div className="border border-gray-200 rounded-xl mt-4">
            <div className="flex items-center gap-3 px-6 py-4 opacity-60">
              <div className="w-5 h-5 rounded border-2 border-gray-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-400">강의를 준비 중입니다.</p>
                <p className="text-xs text-gray-400 mt-0.5">커리큘럼이 업로드되면 여기에 표시됩니다.</p>
              </div>
              <div className="border border-gray-300 rounded-lg w-10 h-10 flex items-center justify-center shrink-0 bg-white opacity-50">
                <i className="ti ti-clock text-gray-400" />
              </div>
            </div>
          </div>
        ) : (
          <div className={`border border-gray-200 rounded-xl mt-4 divide-y divide-gray-200 ${expired ? 'opacity-60' : ''}`}>
            {course.curriculum_items.map((item) => {
              const itemCompleted = courseCompleted.has(item.id)
              const isToggling = togglingItems.has(item.id)

              return (
                <div key={item.id} className={`flex items-center gap-3 px-6 py-4 ${itemCompleted ? 'opacity-60' : ''}`}>
                  <button
                    type="button"
                    onClick={() => handleToggleComplete(course.id, item.id)}
                    disabled={isToggling}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                      itemCompleted ? 'bg-[#2ED573] border-[#2ED573]' : 'border-gray-300 hover:border-[#2ED573]'
                    } ${isToggling ? 'opacity-50' : ''}`}
                    aria-label={itemCompleted ? `${item.label} 완료 해제` : `${item.label} 완료 표시`}
                  >
                    {itemCompleted && <i className="ti ti-check text-white text-xs" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold whitespace-pre-line ${itemCompleted ? 'line-through text-gray-400' : ''}`}>
                      {item.week ? `[${item.week}주차] ` : ''}{item.label}
                    </p>
                    {item.description && (
                      <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-line break-words">{item.description}</p>
                    )}
                  </div>

                  {item.video_url && (
                    <button
                      onClick={() => {
                        if (expired) { toast.error('수강 기간이 만료되었습니다.'); return }
                        if (item.is_redirect) {
                          window.open(item.video_url!, '_blank', 'noopener,noreferrer')
                        } else {
                          setPlayingVideo({ url: item.video_url!, title: item.label })
                        }
                        if (user) {
                          progressService.markWatched(user.id, course.id, item.id).catch(() => {})
                        }
                      }}
                      className={`border border-gray-300 rounded-lg w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer bg-white ${
                        expired ? 'opacity-50 hover:border-gray-400' : 'hover:border-[#2ED573]'
                      }`}
                      aria-label={item.is_redirect ? '외부 링크 열기' : '영상 재생'}
                    >
                      {expired ? (
                        <i className="ti ti-lock text-gray-400" />
                      ) : item.is_redirect ? (
                        <i className="ti ti-external-link text-[#2ED573]" />
                      ) : (
                        <i className="ti ti-player-play text-[#2ED573]" />
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderEbook = (purchase: EbookPurchase) => {
    const ebook = purchase.ebook
    if (!ebook) return null
    const dDay = getDDay(purchase.expires_at)
    const expired = isExpired(purchase.expires_at)

    return (
      <div key={`ebook-${purchase.id}`} className="flex items-start gap-6 mb-12 max-sm:flex-col">
        <div className="bg-black rounded-xl w-[300px] aspect-[3/4] border-2 border-[#2ED573] shrink-0 max-sm:w-full overflow-hidden flex items-center justify-center">
          {ebook.thumbnail_url ? (
            <img src={ebook.thumbnail_url} alt={ebook.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-gray-600 text-sm">썸네일</span>
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">전자책</span>
            {expired ? (
              <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">열람 기간 만료</span>
            ) : dDay !== null ? (
              <span className="bg-[#2ED573] text-white text-xs font-bold px-3 py-1 rounded-full">D-{dDay}</span>
            ) : null}
          </div>
          <h2 className="text-xl font-bold whitespace-pre-line">{ebook.title}</h2>
          <p className="text-sm text-gray-400 mt-1">{ebook.instructor?.name} 강사</p>
          <div className="flex flex-col gap-0.5 text-xs text-gray-400 mt-2">
            <span>최초 수강일: {formatKoDateTime(purchase.purchased_at)}</span>
            <span>수강 만료일: {purchase.expires_at ? formatKoDateTime(purchase.expires_at) : '무제한'}</span>
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            <button
              onClick={() => navigate(`/ebook/${ebook.id}`)}
              className="bg-[#2ED573] text-black font-bold px-5 py-2 rounded-lg hover:brightness-110 transition cursor-pointer border-none text-sm"
            >
              전자책 상세보기
            </button>
            <button
              onClick={() => navigate(`/my-ebooks/${ebook.id}/read`)}
              disabled={!ebook.file_url || expired}
              className="bg-white border border-gray-300 text-gray-700 font-medium px-5 py-2 rounded-lg hover:border-[#2ED573] hover:text-[#2ED573] transition cursor-pointer text-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-200"
            >
              {!ebook.file_url ? 'PDF 준비중' : expired ? '열람 기간 만료' : '읽기'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-black h-[200px] w-full" />

      <div className="max-w-[800px] mx-auto px-6">
        {profile?.provider === 'guest' && !guestBannerDismissed && (
          <div className="mt-6 mb-3 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 max-sm:flex-col max-sm:items-stretch">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <span className="text-base shrink-0 leading-tight">✨</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-emerald-900">고객님, 현재 비회원으로 이용 중이에요 :)</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">회원가입하고 더 편한 서비스와 혜택을 받아보세요 😊</p>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0 max-sm:w-full">
              <button
                onClick={() => navigate('/mypage')}
                className="bg-[#2ED573] text-white text-xs font-bold px-3 py-1.5 rounded-md cursor-pointer border-none hover:bg-[#25B866] transition-colors max-sm:flex-1"
              >
                회원가입하기
              </button>
              <button
                onClick={() => {
                  setGuestBannerDismissed(true)
                  sessionStorage.setItem('guest_banner_dismissed', '1')
                }}
                className="bg-white border border-gray-200 text-gray-500 text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer hover:bg-gray-50 transition-colors max-sm:flex-1"
              >
                나중에
              </button>
            </div>
          </div>
        )}
        <h1 className="text-3xl font-bold mt-16 mb-6">내 강의실</h1>

        {/* 탭 */}
        <div className="flex gap-2 mb-8 border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-none cursor-pointer transition-colors bg-transparent ${
                tab === t.key
                  ? 'text-[#2ED573] border-b-2 border-[#2ED573] -mb-px'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              style={tab === t.key ? { borderBottom: '2px solid #2ED573', marginBottom: '-1px' } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-8">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-start gap-6">
                <div className="bg-gray-200 rounded-xl w-[300px] aspect-video" />
                <div className="flex-1 space-y-3">
                  <div className="h-6 bg-gray-200 rounded w-24" />
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="text-center text-gray-400 py-20">구매한 강의/전자책이 없습니다.</div>
        ) : (
          <>
            {showCourses && coursePurchases.map(renderCourse)}
            {showEbooks && ebookPurchases.map(renderEbook)}
            {showCourses && coursePurchases.length === 0 && tab === 'courses' && (
              <div className="text-center text-gray-400 py-20">구매한 강의가 없습니다.</div>
            )}
            {showEbooks && ebookPurchases.length === 0 && tab === 'ebooks' && (
              <div className="text-center text-gray-400 py-20">구매한 전자책이 없습니다.</div>
            )}
          </>
        )}
      </div>

      {playingVideo && (
        <VideoPlayerModal
          isOpen={true}
          onClose={() => setPlayingVideo(null)}
          videoUrl={playingVideo.url}
          title={playingVideo.title}
        />
      )}

      {reviewTarget && (
        <ReviewForm
          courseId={reviewTarget.courseId}
          courseName={reviewTarget.courseName}
          isOpen={true}
          onClose={() => setReviewTarget(null)}
          onSuccess={() => {
            setReviewedCourses((prev) => new Set(prev).add(reviewTarget.courseId))
            setReviewTarget(null)
          }}
        />
      )}
    </>
  )
}

export default MyClassroomPage
