import { useState, useEffect, useMemo } from 'react'
import { useFaqs } from '../hooks/useFaqs'
import { supabase } from '../lib/supabase'
import Pagination from '../components/Pagination'
import VideoEmbed from '../components/VideoEmbed'
import EventBanner from '../components/EventBanner'
import { useStaleRefreshKey } from '../hooks/useVisibilityRefresh'
import type { Banner } from '../types'
import { useExternalServices } from '../hooks/useExternalServices'
import { textToHtml } from '../utils/richText'

function resolveKakaoPlusFriendUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const id = trimmed.startsWith('_') ? trimmed : `_${trimmed}`
  return `https://pf.kakao.com/${id}`
}

function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [siteKakaoLink, setSiteKakaoLink] = useState('')
  const [kakaoLinkTarget, setKakaoLinkTarget] = useState<'_blank' | '_self'>('_blank')
  const [eventBanners, setEventBanners] = useState<Banner[]>([])
  const refreshKey = useStaleRefreshKey()
  const externalServices = useExternalServices()

  const kakaoLink = useMemo(() => {
    const plusFriend = externalServices.KAKAO_PLUS_FRIEND
    if (plusFriend?.enabled && plusFriend.code) {
      return resolveKakaoPlusFriendUrl(plusFriend.code)
    }
    return siteKakaoLink
  }, [externalServices.KAKAO_PLUS_FRIEND, siteKakaoLink])

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'kakao_link').maybeSingle()
      .then(({ data }) => {
        if (data) {
          const val = (data as Record<string, unknown>).value as Record<string, string>
          setSiteKakaoLink(val?.url || '')
          if (val?.target) setKakaoLinkTarget(val.target as '_blank' | '_self')
        }
      })
  }, [])

  useEffect(() => {
    Promise.resolve(supabase.from('banners').select('*').eq('page_key', 'faq_event').eq('is_published', true).order('sort_order'))
      .then((eventRes) => {
        setEventBanners((eventRes.data ?? []) as Banner[])
      }).catch(() => {
        setEventBanners([])
      })
  }, [refreshKey])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const { faqs, totalCount, loading } = useFaqs({
    search: debouncedSearch || undefined,
    page: currentPage,
    perPage: 3,
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / 3))

  return (
    <>
      {eventBanners.length > 0 && <EventBanner banners={eventBanners} pageKey="faq_event" />}
      <section className="w-full bg-white py-16 max-sm:py-10">
        <div className="max-w-[800px] mx-auto px-5">
          <h2 className="text-2xl font-bold text-center text-gray-900">자주 묻는 질문 Q&A</h2>

          <div className="max-w-[500px] mx-auto mt-8">
            <div className="relative">
              <input
                type="text"
                placeholder="키워드를 입력하세요"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-10 text-sm outline-none focus:border-[#2ED573]"
              />
              <i className="ti ti-search absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="divide-y divide-gray-200 mt-10">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="py-8 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-2/3 mt-2" />
                </div>
              ))
            ) : (
              faqs.map((item) => (
                <div key={item.id} className="py-8">
                  <p className="text-lg font-bold text-gray-900">
                    <span className="text-xl font-extrabold">Q.</span> {item.question}
                  </p>
                  <div
                    className="rich-text-content text-sm text-gray-600 mt-3 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: textToHtml(item.answer) }}
                  />

                  {item.video_url && (
                    <div className="mt-4 w-[300px]">
                      <VideoEmbed url={item.video_url} className="w-full" />
                    </div>
                  )}

                  {item.file_url && (
                    <a
                      href={item.file_url}
                      download={item.file_name || '첨부파일'}
                      className="border border-gray-200 rounded-lg p-3 flex items-center gap-3 mt-4 max-w-[400px] no-underline"
                    >
                      <i className="ti ti-file-spreadsheet text-[#2ED573] text-2xl shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.file_name || '첨부파일'}
                        </p>
                      </div>
                      <i className="ti ti-download text-gray-400 text-xl shrink-0 cursor-pointer" />
                    </a>
                  )}
                </div>
              ))
            )}

            {!loading && faqs.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm">
                검색 결과가 없습니다.
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
          )}

          {/* 카카오 상담 유도 */}
          {kakaoLink && (
            <div className="mt-16 bg-gray-50 rounded-2xl p-8 max-sm:p-6 text-center">
              <div className="w-14 h-14 bg-[#FEE500] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#3C1E1E">
                  <path d="M12 3C6.48 3 2 6.58 2 10.9c0 2.78 1.86 5.22 4.65 6.6l-.96 3.56c-.08.3.26.54.52.37l4.23-2.82c.51.06 1.03.09 1.56.09 5.52 0 10-3.58 10-7.9S17.52 3 12 3z"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">답변을 찾지 못하셨나요?</h3>
              <p className="text-sm text-gray-500 mb-5">카카오톡 채널로 1:1 상담을 받아보세요.</p>
              <a
                href={kakaoLink}
                {...(kakaoLinkTarget === '_blank' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="inline-flex items-center gap-2 bg-[#FEE500] text-[#3C1E1E] font-bold px-6 py-3 rounded-full text-sm no-underline hover:brightness-95 transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#3C1E1E">
                  <path d="M12 3C6.48 3 2 6.58 2 10.9c0 2.78 1.86 5.22 4.65 6.6l-.96 3.56c-.08.3.26.54.52.37l4.23-2.82c.51.06 1.03.09 1.56.09 5.52 0 10-3.58 10-7.9S17.52 3 12 3z"/>
                </svg>
                카카오톡 상담하기
              </a>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default FAQPage
