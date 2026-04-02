import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'


interface EbookInfo {
  id: number
  title: string
  file_url: string | null
}

interface PurchaseInfo {
  id: number
  expires_at: string | null
}

function EbookReaderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [ebook, setEbook] = useState<EbookInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !id) return

    const fetchData = async () => {
      try {
        const ebookId = parseInt(id, 10)
        if (isNaN(ebookId)) {
          setError('잘못된 전자책 ID입니다.')
          setLoading(false)
          return
        }

        const [ebookResult, purchaseResult] = await Promise.all([
          supabase
            .from('ebooks')
            .select('id, title, file_url')
            .eq('id', ebookId)
            .single<EbookInfo>(),
          supabase
            .from('purchases')
            .select('id, expires_at')
            .eq('user_id', user.id)
            .eq('ebook_id', ebookId)
            .single<PurchaseInfo>(),
        ])

        if (ebookResult.error || !ebookResult.data) {
          setError('전자책을 찾을 수 없습니다.')
          setLoading(false)
          return
        }

        if (purchaseResult.error || !purchaseResult.data) {
          setError('구매 내역이 없습니다. 전자책을 구매한 후 이용해 주세요.')
          setLoading(false)
          return
        }

        const purchase = purchaseResult.data
        if (purchase.expires_at) {
          const expiresDate = new Date(purchase.expires_at)
          if (expiresDate.getTime() < Date.now()) {
            setError('열람 기간이 만료되었습니다.')
            setLoading(false)
            return
          }
        }

        if (!ebookResult.data.file_url) {
          setError('PDF 파일이 아직 등록되지 않았습니다.')
          setLoading(false)
          return
        }

        setEbook(ebookResult.data)
      } catch {
        setError('데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, id])

  const handleClose = () => {
    navigate(-1)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#04F87F] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-300 text-sm">전자책을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md mx-4 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-white text-lg font-semibold mb-2">접근 불가</p>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button
            onClick={handleClose}
            className="bg-[#04F87F] text-black font-bold px-6 py-2.5 rounded-lg hover:brightness-110 transition cursor-pointer"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  if (!ebook) return null

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <h1 className="text-white font-semibold text-sm sm:text-base truncate mr-4">
          {ebook.title}
        </h1>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-white transition shrink-0 cursor-pointer"
          aria-label="닫기"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <iframe
          src={ebook.file_url ?? ''}
          title={ebook.title}
          className="w-full h-full border-0"
          allowFullScreen
        />
      </div>
    </div>
  )
}

export default EbookReaderPage
