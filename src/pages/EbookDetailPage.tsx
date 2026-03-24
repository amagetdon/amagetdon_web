import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { EbookWithInstructor } from '../types'

function EbookDetailPage() {
  const { id } = useParams()
  const [ebook, setEbook] = useState<EbookWithInstructor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('ebooks')
          .select('*, instructor:instructors(id, name)')
          .eq('id', Number(id))
          .single()
        if (error) throw error
        setEbook(data as EbookWithInstructor)
      } catch {
        setEbook(null)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id])

  if (loading) {
    return (
      <section className="w-full bg-white py-10">
        <div className="max-w-[1200px] mx-auto px-5 animate-pulse">
          <div className="flex gap-8 max-md:flex-col">
            <div className="flex-1 bg-gray-200 rounded-xl h-[500px]" />
            <div className="w-[340px] space-y-4">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-6 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-full" />
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (!ebook) {
    return (
      <section className="w-full bg-white py-10">
        <div className="max-w-[1200px] mx-auto px-5 text-center text-gray-500 py-20">
          전자책 정보를 찾을 수 없습니다.
        </div>
      </section>
    )
  }

  return (
    <section className="w-full bg-white py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex gap-8 max-md:flex-col">
          {/* 왼쪽: 썸네일 */}
          <div className="flex-1">
            <div className="bg-gray-100 rounded-xl min-h-[500px] flex items-center justify-center overflow-hidden">
              {ebook.thumbnail_url ? (
                <img src={ebook.thumbnail_url} alt={ebook.title} className="w-full h-auto" />
              ) : (
                <span className="text-sm text-gray-400">전자책 표지 이미지</span>
              )}
            </div>
          </div>

          {/* 오른쪽: 정보 */}
          <div className="w-[340px] max-md:w-full shrink-0">
            <div className="sticky top-4">
              {ebook.instructor && (
                <Link to={`/instructors/${ebook.instructor.id}`} className="text-sm text-[#04F87F] font-medium no-underline hover:underline">
                  {ebook.instructor.name} 강사
                </Link>
              )}
              <h1 className="text-xl font-bold text-gray-900 mt-1">{ebook.title}</h1>

              {ebook.is_hot && (
                <span className="inline-block mt-3 px-3 py-1 bg-[#04F87F] text-white text-xs font-bold rounded-full">
                  HOT
                </span>
              )}

              <div className="border-t border-gray-200 my-6" />

              <p className="font-bold text-gray-900">가격</p>
              {ebook.original_price && (
                <p className="text-sm text-gray-400 line-through mt-2">
                  정가 {ebook.original_price.toLocaleString()}원
                </p>
              )}
              <p className="text-4xl font-extrabold text-gray-900 mt-1">
                {ebook.is_free ? '무료' : ebook.sale_price ? `${ebook.sale_price.toLocaleString()}원` : '가격 미정'}
              </p>

              <div className="border-t border-gray-200 my-6" />

              <div className="text-sm text-gray-500 space-y-2">
                <div className="flex items-center gap-2">
                  <i className="ti ti-clock text-[#04F87F]" />
                  <span>열람 기간: {ebook.duration_days}일</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="ti ti-device-mobile text-[#04F87F]" />
                  <span>PC, 모바일 열람 가능</span>
                </div>
              </div>

              <button className="w-full py-4 bg-[#04F87F] text-white font-bold text-center rounded-xl mt-6 cursor-pointer border-none">
                {ebook.is_free ? '무료로 받기' : '구매하기'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default EbookDetailPage
