import { useState } from 'react'
import { Link } from 'react-router-dom'

interface ResultData {
  author: string
  date: string
  title: string
  content: string
  image: string
  likesCount?: number
}

interface ResultModalProps {
  isOpen: boolean
  onClose: () => void
  result: ResultData
}

function ResultModal({ isOpen, onClose, result }: ResultModalProps) {
  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(result.likesCount ?? 0)

  if (!isOpen) return null

  const handleLike = () => {
    setLiked(!liked)
    setLikesCount((prev) => liked ? prev - 1 : prev + 1)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl p-8 max-w-[600px] w-full mx-4 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center cursor-pointer bg-transparent border-none text-gray-400 hover:text-gray-600"
          aria-label="닫기"
        >
          <i className="ti ti-x text-xl" />
        </button>

        <p className="text-xs text-gray-400">{result.author} | {result.date}</p>

        {result.image && (
          <div className="my-4 rounded-xl overflow-hidden">
            <img
              src={result.image}
              alt={result.title}
              className="w-full h-auto"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}

        <h3 className="text-lg font-bold text-gray-900">{result.title}</h3>

        <p className="text-sm text-gray-600 leading-relaxed mt-3 whitespace-pre-line">
          {result.content}
        </p>

        <button
          onClick={handleLike}
          className={`flex items-center gap-2 mt-4 border-none bg-transparent cursor-pointer ${
            liked ? 'text-[#2ED573]' : 'text-gray-500'
          }`}
          aria-label={liked ? '좋아요 취소' : '좋아요'}
        >
          <i className={`ti ${liked ? 'ti-thumb-up-filled' : 'ti-thumb-up'}`} />
          <span className="text-sm">{likesCount}</span>
        </button>

        <div className="mt-6">
          <Link
            to="/academy"
            onClick={onClose}
            className="block bg-[#2ED573] text-white rounded-full px-6 py-3 font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors text-center no-underline"
          >
            강의 둘러보기 &gt;
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ResultModal
