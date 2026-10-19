import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { purchaseService } from '../services/purchaseService'
import { progressService } from '../services/progressService'
import { reviewService } from '../services/reviewService'
import VideoPlayerModal from '../components/VideoPlayerModal'
import ReviewForm from '../components/ReviewForm'
import ProgressBar from '../components/ProgressBar'
import toast from 'react-hot-toast'
import LiveCalendarCta from '../components/LiveCalendarCta'
import { isUpcomingLive, liveLabel } from '../lib/liveCalendar'

// 무료 강의(무료·사전 알림·0원) = 유튜브 라이브만 하고 다시보기 없음 → 수강 만료일 대신 라이브 일시를 보여 준다.
// 라이브 시작 3시간 뒤를 '라이브 종료'로 보고 '종료·만료' 탭으로 옮긴다(안내·오픈채팅은 막지 않음).
const LIVE_END_MS = 3 * 60 * 60 * 1000
type CourseLite = { course_type?: string | null; sale_price?: number | null; original_price?: number | null; scheduled_at?: string | null }
const isFreeCourse = (c: CourseLite) =>
  c.course_type === 'free' || c.course_type === 'pre_alert' || (c.sale_price ?? c.original_price ?? 0) === 0
const isLiveEnded = (c: CourseLite) =>
  isFreeCourse(c) && !!c.scheduled_at && Date.now() > new Date(c.scheduled_at).getTime() + LIVE_END_MS

interface CurriculumVideo {
  url: string
  is_redirect: boolean
  label?: string | null
}

interface CurriculumItem {
  id: number
  week: number | null
  label: string
  description: string | null
  // deprecated — 단일 URL 시절 컬럼. 새 데이터는 video_urls 만 채워짐.
  video_url: string | null
  is_redirect: boolean | null
  video_urls: CurriculumVideo[] | null
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
    scheduled_at?: string | null
    after_purchase_url?: string | null
    course_type?: string | null
    sale_price?: number | null
    original_price?: number | null
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
    has_file: boolean
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

type CourseTab = 'progressing' | 'replay' | 'expired'
type EbookTab = 'active' | 'expired'
// 맨 위 '내 강의 | 내 전자책' 전환 — 주소(?tab=ebook)에 남겨 새로고침·뒤로 가기에도 유지(10/19 대표님)
type Section = 'course' | 'ebook'

function MyClassroomPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null)
  const { user, profile } = useAuth()
  const [guestBannerDismissed, setGuestBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('guest_banner_dismissed') === '1'
  })
  const [coursePurchases, setCoursePurchases] = useState<CoursePurchase[]>([])
  const [ebookPurchases, setEbookPurchases] = useState<EbookPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [courseTab, setCourseTab] = useState<CourseTab>('progressing')
  const [ebookTab, setEbookTab] = useState<EbookTab>('active')
  const [completedItems, setCompletedItems] = useState<Record<number, Set<number>>>({})
  const [completionRates, setCompletionRates] = useState<Record<number, number>>({})
  const [togglingItems, setTogglingItems] = useState<Set<number>>(new Set())
  // 커리큘럼 항목 펼침 상태 — 한 항목에 영상/링크 여러 개일 때 클릭으로 열고 닫는다.
  const [expandedCurriculumItems, setExpandedCurriculumItems] = useState<Set<number>>(new Set())
  const toggleCurriculumExpand = (itemId: number) => {
    setExpandedCurriculumItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }
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

  // 강의 상태 — 진행중 / 다시보기(마감 후 다시보기 기한 내) / 만료
  // 만료 여부는 이 구매의 수강 만료일(expires_at)만 본다. 비어 있으면 무제한(서버 영상 권한 확인과 같은 규칙).
  // 예전엔 비어 있을 때 모집 마감일로 대신 판단해서, 다시보기 0일인 무료 라이브(마감=라이브 시작)는
  // 라이브 시작 순간 '수강 기간 만료'가 되고 라이브·영상 버튼이 막혔다(10/15 129에서 확인).
  const courseStatus = (p: CoursePurchase): 'progressing' | 'replay' | 'expired' => {
    const c = p.course
    if (isExpired(p.expires_at)) return 'expired'
    if (c && isLiveEnded(c)) return 'expired'
    if (p.expires_at && c?.enrollment_deadline && isExpired(c.enrollment_deadline)) return 'replay'
    return 'progressing'
  }
  const ebookExpired = (p: EbookPurchase) => isExpired(p.expires_at)

  const progressingCourses = coursePurchases.filter((p) => courseStatus(p) === 'progressing')
  const replayCourses = coursePurchases.filter((p) => courseStatus(p) === 'replay')
  const expiredCourses = coursePurchases.filter((p) => courseStatus(p) === 'expired')
  const activeEbooks = ebookPurchases.filter((p) => !ebookExpired(p))
  const expiredEbooks = ebookPurchases.filter((p) => ebookExpired(p))

  const courseTabs = [
    { key: 'progressing' as const, label: `진행 중 (${progressingCourses.length})`, list: progressingCourses },
    { key: 'replay' as const, label: `다시보기 (${replayCourses.length})`, list: replayCourses },
    { key: 'expired' as const, label: `종료·만료 (${expiredCourses.length})`, list: expiredCourses },
  ]
  const ebookTabs = [
    { key: 'active' as const, label: `진행 중 (${activeEbooks.length})`, list: activeEbooks },
    { key: 'expired' as const, label: `만료됨 (${expiredEbooks.length})`, list: expiredEbooks },
  ]
  const section: Section = tabParam === 'ebook' ? 'ebook'
    : tabParam === 'course' ? 'course'
    : !loading && coursePurchases.length === 0 && ebookPurchases.length > 0 ? 'ebook' : 'course'
  const selectSection = (next: Section) => {
    if (next === section) return
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    setSearchParams(params)
  }

  const courseList = courseTabs.find((t) => t.key === courseTab)?.list ?? []
  const ebookList = ebookTabs.find((t) => t.key === ebookTab)?.list ?? []

  const renderCourse = (purchase: CoursePurchase) => {
    const course = purchase.course
    if (!course) return null
    const expired = isExpired(purchase.expires_at)
    const free = isFreeCourse(course)
    const liveEnded = isLiveEnded(course)
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
              ) : liveEnded ? (
                <span className="bg-gray-400 text-white text-xs font-bold px-3 py-1 rounded-full">라이브 종료</span>
              ) : deadlinePassed && reviewDDay !== null ? (
                <span className="bg-[#2ED573] text-white text-xs font-bold px-3 py-1 rounded-full">다시보기 D-{reviewDDay}</span>
              ) : deadlineDDay !== null ? (
                <span className="bg-[#2ED573] text-white text-xs font-bold px-3 py-1 rounded-full">마감 D-{deadlineDDay}</span>
              ) : null}
            </div>
            <h2 className="text-xl font-bold whitespace-pre-line">{course.title}</h2>
            <p className="text-sm text-gray-400 mt-1">{course.instructor?.name} 강사</p>
            <div className="flex flex-col gap-0.5 text-xs text-gray-400 mt-2">
              <span>최초 수강일: {formatKoDateTime(purchase.purchased_at)}</span>
              {free ? (
                course.scheduled_at && <span>라이브: {liveLabel(course.scheduled_at)} (유튜브 라이브)</span>
              ) : (<>
              <span>
                {/* 이 구매에 저장된 수강 만료일 그대로(비어 있으면 무제한) — 모집 마감일과 따로 보여 준다 */}
                수강 만료일: {purchase.expires_at ? formatKoDateTime(purchase.expires_at) : '무제한'}
                {course.enrollment_deadline && (course.duration_days ?? 0) > 0 && (
                  <> (다시보기 {course.duration_days}일)</>
                )}
              </span>
              {course.enrollment_deadline && <span>모집 마감: {formatKoDateTime(course.enrollment_deadline)}</span>}
              </>)}
            </div>
            {course.curriculum_items.length > 0 && (
              <div className="mt-3">
                <ProgressBar value={completionRate} size="sm" />
              </div>
            )}
            <div className="flex gap-2 mt-4 flex-wrap">
              <button
                onClick={() => setReviewTarget({ courseId: course.id, courseName: course.title })}
                className="bg-white border border-gray-300 text-gray-700 font-medium px-4 py-2 rounded-lg hover:border-[#2ED573] hover:text-[#2ED573] transition cursor-pointer text-sm"
              >
                {reviewedCourses.has(course.id) ? '후기 수정하기' : '후기 작성'}
              </button>
            </div>
          </div>
        </div>

        {/* 라이브 예정이면 캘린더에 추가 (라이브 시작 시각이 지나면 사라짐) */}
        {isUpcomingLive(course.scheduled_at) && (
          <LiveCalendarCta
            className="mt-4"
            event={{ courseId: course.id, title: course.title, startsAt: course.scheduled_at, openchatUrl: course.after_purchase_url }}
          />
        )}

        {course.curriculum_items.length === 0 && free ? (
          <div className="border border-gray-200 rounded-xl mt-4 px-5 py-4 flex items-center gap-3 max-sm:flex-col max-sm:items-start">
            <i className="ti ti-brand-youtube text-2xl text-[#ff0000] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 m-0">{liveEnded ? '라이브가 끝났어요' : '라이브는 유튜브에서 진행돼요'}</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-0">{liveEnded ? '안내와 자료는 오픈채팅방에서 확인해 주세요.' : '참여 링크는 오픈채팅방과 알림톡으로 보내 드려요.'}</p>
            </div>
            {course.after_purchase_url && (
              <a href={course.after_purchase_url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2ED573] text-white text-sm font-bold no-underline hover:bg-[#25B866]">
                <i className="ti ti-message-circle" /> 오픈채팅방 입장
              </a>
            )}
          </div>
        ) : course.curriculum_items.length === 0 ? (
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
              // 신규 video_urls 우선, 없으면 옛 video_url 흡수 (마이그레이션 이전 데이터 호환).
              const videos: CurriculumVideo[] = (item.video_urls && item.video_urls.length > 0)
                ? item.video_urls.filter((v) => v.url)
                : item.video_url
                  ? [{ url: item.video_url, is_redirect: !!item.is_redirect, label: null }]
                  : []
              const hasMultipleVideos = videos.length >= 2
              const singleVideo = videos.length === 1 ? videos[0] : null
              const expanded = expandedCurriculumItems.has(item.id)

              const playVideo = (v: CurriculumVideo) => {
                if (expired) { toast.error('수강 기간이 만료되었습니다.'); return }
                if (v.is_redirect) {
                  window.open(v.url, '_blank', 'noopener,noreferrer')
                } else {
                  setPlayingVideo({ url: v.url, title: v.label || item.label })
                }
                if (user) {
                  progressService.markWatched(user.id, course.id, item.id).catch(() => {})
                }
              }

              return (
                <div key={item.id} className={itemCompleted ? 'opacity-60' : ''}>
                  <div className="flex items-center gap-3 px-6 py-4">
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

                    <button
                      type="button"
                      onClick={() => hasMultipleVideos && toggleCurriculumExpand(item.id)}
                      disabled={!hasMultipleVideos}
                      className={`flex-1 min-w-0 text-left bg-transparent border-none p-0 ${hasMultipleVideos ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <p className={`text-sm font-bold whitespace-pre-line ${itemCompleted ? 'line-through text-gray-400' : ''}`}>
                        {item.week ? `[${item.week}주차] ` : ''}{item.label}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-line break-words">{item.description}</p>
                      )}
                    </button>

                    {/* 영상 1개: 우측에 바로 재생/링크 버튼. 2개 이상: 펼침 토글. */}
                    {singleVideo && (
                      <button
                        type="button"
                        onClick={() => playVideo(singleVideo)}
                        className={`border border-gray-300 rounded-lg w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer bg-white ${
                          expired ? 'opacity-50 hover:border-gray-400' : 'hover:border-[#2ED573]'
                        }`}
                        aria-label={singleVideo.is_redirect ? '외부 링크 열기' : '영상 재생'}
                      >
                        {expired ? (
                          <i className="ti ti-lock text-gray-400" />
                        ) : singleVideo.is_redirect ? (
                          <i className="ti ti-external-link text-[#2ED573]" />
                        ) : (
                          <i className="ti ti-player-play text-[#2ED573]" />
                        )}
                      </button>
                    )}
                    {hasMultipleVideos && (
                      <button
                        type="button"
                        onClick={() => toggleCurriculumExpand(item.id)}
                        className="border border-gray-300 rounded-lg w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer bg-white hover:border-[#2ED573]"
                        aria-label={expanded ? '영상 목록 접기' : '영상 목록 펼치기'}
                      >
                        <i className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-[#2ED573]`} />
                      </button>
                    )}
                  </div>

                  {hasMultipleVideos && expanded && (
                    <div className="px-6 pb-4 pl-[3.5rem] space-y-2">
                      {videos.map((v, vIdx) => (
                        <div key={vIdx} className="flex items-center gap-3 py-2.5 px-4 bg-gray-50 rounded-lg">
                          <span className="text-gray-300 text-sm shrink-0">└</span>
                          <span className="flex-1 min-w-0 text-sm font-bold text-gray-800 truncate">
                            {v.label || (v.is_redirect ? '외부 링크' : `영상 ${vIdx + 1}`)}
                          </span>
                          <button
                            type="button"
                            onClick={() => playVideo(v)}
                            className={`border border-gray-300 rounded-lg w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer bg-white ${
                              expired ? 'opacity-50 hover:border-gray-400' : 'hover:border-[#2ED573]'
                            }`}
                            aria-label={v.is_redirect ? '외부 링크 열기' : '영상 재생'}
                          >
                            {expired ? (
                              <i className="ti ti-lock text-gray-400 text-base" />
                            ) : v.is_redirect ? (
                              <i className="ti ti-external-link text-[#2ED573] text-base" />
                            ) : (
                              <i className="ti ti-player-play text-[#2ED573] text-base" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
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
              onClick={() => navigate(`/my-ebooks/${ebook.id}/read`)}
              disabled={!ebook.has_file || expired}
              className="bg-[#2ED573] text-black font-bold px-6 py-2 rounded-lg hover:brightness-110 transition cursor-pointer border-none text-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {!ebook.has_file ? 'PDF 준비중' : expired ? '열람 기간 만료' : '읽기'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 상태 탭 버튼 — danger=true 면 빨간색(만료됨), 아니면 일반(회색/그린)
  const statusTabButton = (key: string, label: string, active: boolean, danger: boolean, onClick: () => void) => (
    <button
      key={key}
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-none cursor-pointer transition-colors bg-transparent ${
        active
          ? (danger ? 'text-red-500 -mb-px' : 'text-[#2ED573] -mb-px')
          : (danger ? 'text-red-400/80 hover:text-red-500' : 'text-gray-400 hover:text-gray-600')
      }`}
      style={active ? { borderBottom: `2px solid ${danger ? '#ef4444' : '#2ED573'}`, marginBottom: '-1px' } : {}}
    >
      {label}
    </button>
  )

  const courseSkeleton = (
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
  )

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
        {/* 내 강의실 */}
        <h1 className="text-3xl font-bold mt-16 mb-5 max-sm:mt-10">내 강의실</h1>

        <div className="grid grid-cols-2 gap-1 p-1 mb-6 bg-gray-100 rounded-xl" role="tablist" aria-label="내 강의실 보기">
          {([['course', '내 강의', coursePurchases.length], ['ebook', '내 전자책', ebookPurchases.length]] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={section === key}
              onClick={() => selectSection(key)}
              className={`py-2.5 rounded-lg text-sm font-bold border-none cursor-pointer transition-colors ${
                section === key ? 'bg-white text-gray-900 shadow-sm' : 'bg-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}{!loading && <span className={`ml-1 ${section === key ? 'text-[#2ED573]' : ''}`}>{count}</span>}
            </button>
          ))}
        </div>

        {section === 'course' && (loading ? (
          courseSkeleton
        ) : (
          <>
            <div className="flex gap-2 mb-8 border-b border-gray-200">
              {courseTabs.map((t) =>
                statusTabButton(t.key, t.label, courseTab === t.key, t.key === 'expired', () => setCourseTab(t.key)),
              )}
            </div>
            {coursePurchases.length === 0 ? (
              <div className="text-center text-gray-400 py-16">구매한 강의가 없습니다.</div>
            ) : courseList.length === 0 ? (
              <div className="text-center text-gray-400 py-16">해당하는 강의가 없습니다.</div>
            ) : (
              courseList.map(renderCourse)
            )}
          </>
        ))}

        {section === 'ebook' && (loading ? (
          courseSkeleton
        ) : (
          <>
            <div className="flex gap-2 mb-8 border-b border-gray-200">
              {ebookTabs.map((t) =>
                statusTabButton(t.key, t.label, ebookTab === t.key, t.key === 'expired', () => setEbookTab(t.key)),
              )}
            </div>
            {ebookPurchases.length === 0 ? (
              <div className="text-center text-gray-400 py-16">구매한 전자책이 없습니다.</div>
            ) : ebookList.length === 0 ? (
              <div className="text-center text-gray-400 py-16">해당하는 전자책이 없습니다.</div>
            ) : (
              ebookList.map(renderEbook)
            )}
          </>
        ))}
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
