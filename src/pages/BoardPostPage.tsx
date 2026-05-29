import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { boardService, BOARD_CTA_DEFAULTS } from '../services/boardService'
import { textToHtml } from '../utils/richText'
import { useAuth } from '../contexts/AuthContext'
import type { BoardPostPublic } from '../types'

export default function BoardPostPage() {
  const { token } = useParams<{ token: string }>()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const [post, setPost] = useState<BoardPostPublic | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound'>('loading')
  const contentRef = useRef<HTMLDivElement>(null)
  const [clipped, setClipped] = useState(false)

  useEffect(() => {
    let active = true
    if (!token) { setStatus('notfound'); return }
    setStatus('loading')
    boardService.getByToken(token)
      .then((data) => {
        if (!active) return
        if (data) { setPost(data); setStatus('ok') }
        else { setStatus('notfound') }
      })
      .catch(() => { if (active) setStatus('notfound') })
    return () => { active = false }
  }, [token])

  useEffect(() => {
    if (post?.title) {
      const prev = document.title
      document.title = post.title
      return () => { document.title = prev }
    }
  }, [post?.title])

  // 로그인 안 한 방문자 + 티저 모드일 때만 미리보기로 자른다.
  const teaser = status === 'ok' && !!post?.cta_enabled && !user

  // 실제 본문이 미리보기 높이를 넘는지 측정해서 하단 페이드 표시 여부 결정.
  // 한 번만 재면 이미지가 아직 로드 전이라 높이가 작게 잡혀(캐시 여부에 따라 들쭉날쭉) 페이드가 왔다갔다 한다.
  // ResizeObserver 로 본문 크기 변화(이미지/폰트 로드, 리사이즈)마다 다시 측정한다.
  useEffect(() => {
    const el = contentRef.current
    if (!teaser || !el || !post) { setClipped(false); return }
    const measure = () => setClipped(el.scrollHeight > post.preview_height + 8)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [teaser, post])

  if (status === 'loading' || authLoading) {
    return (
      <section className="w-full bg-white min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
      </section>
    )
  }

  if (status === 'notfound' || !post) {
    return (
      <section className="w-full bg-white min-h-[60vh] flex items-center justify-center px-5">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-file-off text-gray-400 text-2xl" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">글을 찾을 수 없습니다</h1>
          <p className="text-sm text-gray-500">링크가 만료되었거나 삭제된 글입니다.</p>
        </div>
      </section>
    )
  }

  // 비워둔 항목은 기본값으로 대체
  const lockedText = post.cta_locked_text?.trim() || BOARD_CTA_DEFAULTS.lockedText
  const ctaTitle = post.cta_title?.trim() || BOARD_CTA_DEFAULTS.title
  const ctaSubtitle = post.cta_subtitle?.trim() || BOARD_CTA_DEFAULTS.subtitle
  const buttonText = post.cta_button_text?.trim() || BOARD_CTA_DEFAULTS.buttonText

  return (
    <section className="w-full bg-white py-12 max-sm:py-8">
      <div className="max-w-[800px] mx-auto px-5">
        <header className="border-b border-gray-200 pb-6 mb-8">
          <h1 className="text-2xl max-sm:text-xl font-bold text-gray-900 leading-snug break-words">{post.title}</h1>
          <p className="text-sm text-gray-400 mt-3">{new Date(post.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </header>

        {/* 본문 — 티저 모드면 preview_height 만큼만 노출하고 하단 페이드 */}
        <div
          className="relative overflow-hidden"
          style={teaser ? { maxHeight: post.preview_height } : undefined}
        >
          <div
            ref={contentRef}
            className="rich-text-content text-[15px] text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: textToHtml(post.content) }}
          />
          {teaser && clipped && (
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-white pointer-events-none" />
          )}
        </div>

        {/* 티저 하단: 안내문 + 가입 유도 + 로그인 버튼 (비워둔 항목은 기본값으로 표시) */}
        {teaser && (
          <>
            <p className="text-center text-gray-400 text-sm mt-4 mb-10">{lockedText}</p>

            <div className="border-t border-gray-100 pt-12 pb-4 text-center">
              <div
                className="rich-text-content text-xl max-sm:text-lg font-bold text-gray-900 leading-relaxed [&_p]:text-center"
                dangerouslySetInnerHTML={{ __html: textToHtml(ctaTitle) }}
              />
              <p className="text-sm text-gray-400 mt-3">{ctaSubtitle}</p>
              <Link
                to="/login"
                state={{ from: { pathname: location.pathname } }}
                className="block w-full max-w-md mx-auto mt-8 py-4 bg-[#2ED573] text-white text-center font-bold rounded-xl no-underline hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20"
              >
                {buttonText}
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
