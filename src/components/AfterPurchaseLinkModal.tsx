import { useEffect, useRef, useState } from 'react'
import { trackOpenChatJoin } from '../lib/tracking'

interface Props {
  url: string | null
  onClose: () => void
  // 표시 라벨(강의/전자책 등). 메시지에 들어감.
  itemLabel?: string
  // 오픈채팅 입장(open_chat_join) 전환 이벤트용 메타데이터. 주어지면 링크 진입 시 1회 발화.
  tracking?: {
    contentId?: string | null
    contentName?: string | null
    instructorName?: string | null
    campaignId?: string | null
    email?: string | null
    phone?: string | null
  }
}

/**
 * 구매 직후 안내 링크(오픈채팅방 등)를 카운트다운 후 새 창으로 띄움.
 * 3 → 2 → 1 카운트가 끝나면 자동으로 window.open 시도.
 * 브라우저 popup blocker 로 차단되면 '지금 열기' 버튼으로 fallback.
 */
export default function AfterPurchaseLinkModal({ url, onClose, itemLabel = '강의', tracking }: Props) {
  const [count, setCount] = useState(3)
  const [opened, setOpened] = useState(false)
  const intervalRef = useRef<number | null>(null)

  // OpenChatJoin — 안내 링크(오픈채팅방 등)로 실제 진입하는 시점에 1회 발화 (전환이벤트설계서 #4).
  // 자동 오픈 / '지금 열기' 클릭 양쪽에서 호출되지만 dedupeKey(url) 기준으로 1회만 발화된다.
  const fireOpenChatJoin = () => {
    if (!url) return
    trackOpenChatJoin({
      dedupeKey: url,
      contentId: tracking?.contentId,
      contentName: tracking?.contentName,
      instructorName: tracking?.instructorName,
      campaignId: tracking?.campaignId,
      user: { email: tracking?.email, phone: tracking?.phone },
    })
  }

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
          if (win) {
            setOpened(true)
            fireOpenChatJoin()
          }
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
    // fireOpenChatJoin 은 url 과 함께 고정되며, deps 에 넣으면 매 렌더마다 카운트다운이 리셋되므로 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="mt-4 space-y-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { fireOpenChatJoin(); setOpened(true); onClose() }}
            className={`block w-full py-2.5 px-4 rounded-lg text-sm font-bold no-underline text-center transition-colors ${
              count > 0 ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-[#2ED573] text-white hover:bg-[#25B866]'
            }`}
          >
            지금 열기
          </a>
          {count <= 0 && (
            <button
              type="button"
              onClick={onClose}
              className="block w-full py-2.5 px-4 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
