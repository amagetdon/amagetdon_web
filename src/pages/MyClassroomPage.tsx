import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { purchaseService } from '../services/purchaseService'
import VideoPlayerModal from '../components/VideoPlayerModal'

function MyClassroomPage() {
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null)
  const { user } = useAuth()
  const [purchases, setPurchases] = useState<Array<{
    id: number
    expires_at: string | null
    course: {
      id: number
      title: string
      thumbnail_url: string | null
      instructor: { id: number; name: string } | null
      curriculum_items: Array<{ id: number; week: number | null; label: string; video_url: string | null }>
    } | null
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    purchaseService.getMyClassroom(user.id)
      .then((data) => setPurchases(data as typeof purchases))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const getDDay = (expiresAt: string | null) => {
    if (!expiresAt) return null
    const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
    return diff > 0 ? diff : 0
  }

  return (
    <>
      <div className="bg-black h-[200px] w-full" />

      <div className="max-w-[800px] mx-auto px-6">
        <h1 className="text-3xl font-bold mt-16 mb-8">수강중인 클래스</h1>

        {loading ? (
          <div className="animate-pulse space-y-8">
            {[1, 2].map((i) => (
              <div key={i}>
                <div className="flex items-start gap-6">
                  <div className="bg-gray-200 rounded-xl w-[300px] h-[200px]" />
                  <div className="flex-1 space-y-3">
                    <div className="h-6 bg-gray-200 rounded w-24" />
                    <div className="h-5 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center text-gray-400 py-20">수강중인 클래스가 없습니다.</div>
        ) : (
          purchases.map((purchase) => {
            const course = purchase.course
            if (!course) return null
            const dDay = getDDay(purchase.expires_at)

            return (
              <div key={purchase.id} className="mb-16">
                <div className="flex items-start gap-6 max-sm:flex-col">
                  <div className="bg-black rounded-xl w-[300px] h-[200px] shrink-0 max-sm:w-full border-2 border-[#04F87F] overflow-hidden flex items-center justify-center">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-600 text-sm">썸네일</span>
                    )}
                  </div>
                  <div>
                    {dDay !== null && (
                      <span className="bg-[#04F87F] text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-2">
                        남은 수강기간 D-{dDay}
                      </span>
                    )}
                    <h2 className="text-xl font-bold whitespace-pre-line">{course.title}</h2>
                    <p className="text-sm text-gray-400 mt-1">{course.instructor?.name} 강사</p>
                  </div>
                </div>

                {course.curriculum_items.length > 0 && (
                  <div className="border border-gray-200 rounded-xl mt-4 divide-y divide-gray-200">
                    {course.curriculum_items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-6 py-4">
                        <p className="text-sm font-bold whitespace-pre-line">
                          {item.week ? `[${item.week}주차]\n` : ''}{item.label}
                        </p>
                        <button
                          onClick={() => item.video_url && setPlayingVideo({ url: item.video_url, title: item.label })}
                          disabled={!item.video_url}
                          className={`border border-gray-300 rounded-lg w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer bg-white ${!item.video_url ? 'opacity-30 cursor-not-allowed' : 'hover:border-[#04F87F]'}`}
                        >
                          <i className={`ti ti-player-play ${item.video_url ? 'text-[#04F87F]' : 'text-gray-400'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
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
    </>
  )
}

export default MyClassroomPage
