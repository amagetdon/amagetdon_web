import { useEffect, useRef, useState } from 'react'

interface Props {
  url: string | null
  onClose: () => void
  // 표시 라벨(강의/전자책 등). 메시지에 들어감.
  itemLabel?: string
}

/**
 * 구매 직후 안내 링크(오픈채팅방 등)를 카운트다운 후 새 창으로 띄움.
 * 3 → 2 → 1 카운트가 끝나면 자동으로 window.open 시도.
 * 브라우저 popup blocker 로 차단되면 '지금 열기' 버튼으로 fallback.
 */
export default function AfterPurchaseLinkModal({ url, onClose, itemLabel = '강의' }: Props) {
  const [count, setCount] = useState(3)
  const [opened, setOpened] = useState(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (!url) return
    setCount(3)
    setOpened(false)
    intervalRef.current = window.setInterval(() => {
      setCount((c) => {
        const next = c - 1
        if (next <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          // 자동 발사 시도. blocker 에 막히면 사용자가 버튼으로 직접 열게 됨.
          const win = window.open(url, '_blank', 'noopener,noreferrer')
          if (win) setOpened(true)
        }
        return Math.max(0, next)
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [url])

  // 자동으로 열렸으면 잠깐 보였다가 닫히게
  useEffect(() => {
    if (!opened) return
    const t = window.setTimeout(() => onClose(), 1500)
    return () => clearTimeout(t)
  }, [opened, onClose])

  if (!url) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
          {opened ? (
            <i className="ti ti-check text-[#2ED573] text-4xl" />
          ) : count > 0 ? (
            <span className="text-4xl font-bold text-[#2ED573]">{count}</span>
          ) : (
            <div className="w-8 h-8 border-3 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <p className="text-sm font-bold text-gray-900 mb-1">
          {opened
            ? '새 창이 열렸어요!'
            : count > 0
              ? `${count}초 뒤에 ${itemLabel} 정보를 공유받을 수 있는 링크를 열게요!`
              : '잠시만 기다려주세요...'}
        </p>
        {!opened && (
          <p className="text-xs text-gray-500 mb-4">
            {count > 0 ? '오픈채팅방 등으로 안내됩니다' : '새 창이 안 열리면 아래 버튼을 눌러주세요'}
          </p>
        )}
        <div className="mt-4">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { setOpened(true); onClose() }}
            className={`block w-full py-2.5 px-4 rounded-lg text-sm font-bold no-underline text-center transition-colors ${
              count > 0 ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-[#2ED573] text-white hover:bg-[#25B866]'
            }`}
          >
            지금 열기
          </a>
        </div>
      </div>
    </div>
  )
}
