import { useState } from 'react'

type Props = {
  open: boolean
  url: string
  onClose: () => void
}

// 인스타/페북 인앱 브라우저에서 소셜 로그인이 막힐 때 외부 브라우저로 열도록 안내하는 모달.
// Android 는 intent:// 로 자동 리다이렉트되므로, 이 모달은 보통 iOS(강제 이동 불가)에서만 노출된다.
export default function InAppBrowserGuideModal({ open, url, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl w-full max-w-[420px] overflow-hidden">
        <div className="bg-black px-6 py-5 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <i className="ti ti-external-link text-[#2ED573]" />
            외부 브라우저로 열어주세요
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white bg-transparent border-none cursor-pointer text-xl"
            aria-label="닫기"
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            인스타그램·페이스북 인앱 브라우저에서는 카카오/구글 로그인이 제한됩니다.
            아래 방법으로 <span className="font-bold text-gray-900">Safari</span> 등 외부 브라우저에서 열어주세요.
          </p>

          <ol className="text-sm text-gray-700 space-y-2 mb-5 list-decimal pl-5">
            <li>화면 <span className="font-bold">우측 상단 <i className="ti ti-dots" /> (점 세 개)</span> 메뉴를 누릅니다.</li>
            <li><span className="font-bold">"외부 브라우저에서 열기"</span> 또는 <span className="font-bold">"Safari로 열기"</span>를 선택합니다.</li>
          </ol>

          <p className="text-xs text-gray-400 mb-2">또는 아래 링크를 복사해 브라우저 주소창에 붙여넣으세요.</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={url}
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2.5 text-xs text-gray-600 outline-none bg-gray-50"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={handleCopy}
              className="shrink-0 bg-[#2ED573] text-white font-bold py-2.5 px-4 rounded-lg cursor-pointer border-none text-sm flex items-center gap-1.5"
            >
              <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} />
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
