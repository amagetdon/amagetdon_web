import { useRef } from 'react'
import { trackOpenChatJoin } from '../lib/tracking'
import { logOpenChat } from '../lib/openchatLog'

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
  // 창 제목 (유료 결제 완료 화면은 '결제가 완료됐어요!')
  title?: string
  // 미리보기·테스트용: 앱 안 브라우저(같은 탭 이동) 동작을 강제
  forceSameTab?: boolean
}

// 카카오톡·인스타그램·페이스북·라인·네이버·밴드 등 앱 안 브라우저 — 새 창이 막히거나 무시되는 경우가 많아 같은 탭으로 이동
const IN_APP_RE = /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|FB4A|Line\/|NAVER\(inapp|DaumApps|BAND\/|everytimeApp/i

/**
 * 신청·결제 직후 안내 링크(오픈채팅방 등) 입장 창.
 * 예전엔 3초 카운트다운 뒤 사용자 터치 없이 window.open 했는데, 휴대폰·앱 안 브라우저·로그인 후 자동 이어 신청에서
 * 팝업 차단으로 자주 막혔다(10/13~14 129번 신청자: 자동 열림 30% · 직접 클릭 59% · 기록 없음 11%).
 * 지금은 큰 '오픈채팅 입장하기' 버튼을 누를 때 연다 — 사용자 터치로 여는 창은 차단되지 않는다.
 * 앱 안 브라우저면 같은 탭에서 이동하되, 이동 전에 입장 기록·전환 이벤트를 먼저 보낸다.
 */
export default function AfterPurchaseLinkModal({ url, onClose, itemLabel = '강의', tracking, title = '신청이 완료됐어요!', forceSameTab }: Props) {
  const navigatingRef = useRef(false)
  if (!url) return null

  const sameTab = forceSameTab ?? IN_APP_RE.test(navigator.userAgent)

  // OpenChatJoin — 안내 링크로 실제 진입할 때 1회 (dedupeKey=url 로 세션당 1회, DB 기록은 최초 1회)
  const recordJoin = () => {
    trackOpenChatJoin({
      dedupeKey: url,
      contentId: tracking?.contentId,
      contentName: tracking?.contentName,
      instructorName: tracking?.instructorName,
      campaignId: tracking?.campaignId,
      user: { email: tracking?.email, phone: tracking?.phone },
    })
    return logOpenChat(tracking?.contentId, true)
  }

  const handleEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!sameTab) {
      // 새 창(링크 기본 동작) — 이 페이지가 남아 있으므로 기록은 기다리지 않아도 전송된다
      void recordJoin()
      onClose()
      return
    }
    // 같은 탭 이동 — 페이지를 떠나면 기록 요청이 끊길 수 있어 최대 0.8초 기다린 뒤 이동
    e.preventDefault()
    if (navigatingRef.current) return
    navigatingRef.current = true
    const go = () => { window.location.href = url }
    Promise.race([recordJoin(), new Promise((r) => setTimeout(r, 800))]).then(go, go)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-50 bg-transparent border-none cursor-pointer"
        >
          <i className="ti ti-x text-lg" />
        </button>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
          <i className="ti ti-check text-[#2ED573] text-3xl" />
        </div>
        <p className="text-lg font-bold text-gray-900">{title}</p>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed" style={{ textWrap: 'balance', wordBreak: 'keep-all' }}>
          {itemLabel} 안내와 자료는 <b className="text-gray-800">오픈채팅방</b>에서 드려요. 지금 입장해 주세요.
        </p>
        <a
          href={url}
          target={sameTab ? '_self' : '_blank'}
          rel="noopener noreferrer"
          onClick={handleEnter}
          className="mt-5 flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-[#2ED573] hover:bg-[#25B866] text-white text-base font-bold no-underline transition-colors shadow-sm shadow-[#2ED573]/30"
        >
          <i className="ti ti-message-circle text-xl" />
          오픈채팅 입장하기
        </a>
        {itemLabel === '강의' && (
          <p className="text-[11px] text-gray-400 mt-3">나중에는 강의 화면의 '채팅방 이동하기'로 들어올 수 있어요.</p>
        )}
      </div>
    </div>
  )
}
