import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { purchaseService } from '../services/purchaseService'

function MyEbooksPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [purchases, setPurchases] = useState<Array<{
    id: number
    expires_at: string | null
    ebook: {
      id: number
      title: string
      thumbnail_url: string | null
      file_url: string | null
      instructor: { id: number; name: string } | null
    } | null
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    purchaseService.getMyEbooks(user.id)
      .then((data) => setPurchases(data as typeof purchases))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const getDDay = (expiresAt: string | null) => {
    if (!expiresAt) return null
    const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
    return diff > 0 ? diff : 0
  }

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt).getTime() < Date.now()
  }

  return (
    <>
      <div className="bg-black h-[200px] w-full" />

      <div className="max-w-[800px] mx-auto px-6">
        <h1 className="text-3xl font-bold mt-16 mb-8">수강중인 전자책</h1>

        {loading ? (
          <div className="animate-pulse space-y-8">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-start gap-6">
                <div className="bg-gray-200 rounded-xl w-[300px] h-[200px]" />
                <div className="flex-1 space-y-3">
                  <div className="h-6 bg-gray-200 rounded w-24" />
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center text-gray-400 py-20">수강중인 전자책이 없습니다.</div>
        ) : (
          purchases.map((purchase) => {
            const ebook = purchase.ebook
            if (!ebook) return null
            const dDay = getDDay(purchase.expires_at)

            return (
              <div key={purchase.id} className="flex items-start gap-6 mb-12 max-sm:flex-col">
                <div className="bg-black rounded-xl w-[300px] aspect-video border-2 border-[#2ED573] shrink-0 max-sm:w-full overflow-hidden flex items-center justify-center">
                  {ebook.thumbnail_url ? (
                    <img src={ebook.thumbnail_url} alt={ebook.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-600 text-sm">썸네일</span>
                  )}
                </div>
                <div className="flex flex-col">
                  {dDay !== null && !isExpired(purchase.expires_at) && (
                    <span className="bg-[#2ED573] text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-2 w-fit">
                      남은 수강기간 D-{dDay}
                    </span>
                  )}
                  {isExpired(purchase.expires_at) && (
                    <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-2 w-fit">
                      열람 기간이 만료되었습니다
                    </span>
                  )}
                  <h2 className="text-xl font-bold whitespace-pre-line">{ebook.title}</h2>
                  <p className="text-sm text-gray-400 mt-1">{ebook.instructor?.name} 강사</p>
                  <button
                    onClick={() => navigate(`/my-ebooks/${ebook.id}/read`)}
                    disabled={!ebook.file_url || isExpired(purchase.expires_at)}
                    className="mt-4 bg-[#2ED573] text-black font-bold px-5 py-2 rounded-lg hover:brightness-110 transition w-fit cursor-pointer disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:brightness-100"
                  >
                    읽기
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

export default MyEbooksPage
