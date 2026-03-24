import { useState } from 'react'

interface ResultData {
  author: string
  date: string
  title: string
  content: string
  image: string
}

interface ResultModalProps {
  isOpen: boolean
  onClose: () => void
  result: ResultData
}

function ResultModal({ isOpen, onClose, result }: ResultModalProps) {
  const [liked, setLiked] = useState(false)

  if (!isOpen) return null

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
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center cursor-pointer bg-transparent border-none text-gray-400 hover:text-gray-600"
          aria-label="닫기"
        >
          <i className="ti ti-x text-xl" />
        </button>

        {/* 작성자/날짜 */}
        <p className="text-xs text-gray-400">{result.author} | {result.date}</p>

        {/* 이미지 */}
        <div className="my-4 rounded-xl overflow-hidden">
          <img
            src={result.image}
            alt={result.title}
            className="w-full h-auto"
          />
        </div>

        {/* 제목 */}
        <h3 className="text-lg font-bold text-gray-900">
          {result.title}
        </h3>

        {/* 내용 */}
        <p className="text-sm text-gray-600 leading-relaxed mt-3 whitespace-pre-line">
          {result.content}
        </p>

        {/* 좋아요 */}
        <button
          onClick={() => setLiked(!liked)}
          className={`flex items-center gap-2 mt-4 border-none bg-transparent cursor-pointer ${
            liked ? 'text-[#04F87F]' : 'text-gray-500'
          }`}
          aria-label={liked ? '좋아요 취소' : '좋아요'}
        >
          <i className={`ti ${liked ? 'ti-thumb-up-filled' : 'ti-thumb-up'}`} />
          <span className="text-sm">13</span>
        </button>

        {/* CTA 버튼들 */}
        <div className="flex flex-col gap-3 mt-6">
          <button className="bg-[#04F87F] text-white rounded-full px-6 py-3 font-bold cursor-pointer border-none hover:bg-[#03d46d] transition-colors">
            이 수강생이 선택한 강의 &gt;
          </button>
          <button className="border border-gray-300 rounded-full px-6 py-3 cursor-pointer bg-white text-gray-700 hover:bg-gray-50 transition-colors">
            이 수강생이 선택한 강의 &gt;
          </button>
          <button className="border border-gray-300 rounded-full px-6 py-3 cursor-pointer bg-white text-gray-700 hover:bg-gray-50 transition-colors">
            이 수강생이 선택한 강의 &gt;
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResultModal
