import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// 모바일 브라우저(특히 iOS Safari)는 canvas 한 변 4096px / 총 16M 픽셀 제한.
// 보수적으로 4096 / 16777216 으로 클램프.
const MAX_CANVAS_DIM = 4096
const MAX_CANVAS_AREA = 16_777_216

const isMobile = () =>
  typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)

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
  const { user, profile } = useAuth()

  const [ebook, setEbook] = useState<EbookInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [fitMode, setFitMode] = useState<'width' | 'manual'>('width')
  const [rendering, setRendering] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const watermarkText = profile?.email || profile?.name || user?.id || ''

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

  // PDF 로드 — 모바일에서는 stream + range 활성화로 큰 파일도 빠르게 시작
  useEffect(() => {
    if (!ebook?.file_url) return

    const loadPdf = async () => {
      try {
        const pdf = await pdfjsLib.getDocument({
          url: ebook.file_url!,
          // stream/range 비활성화 시 모바일 셀룰러 환경에서 timeout 발생 — 켜둠
          disableAutoFetch: false,
          disableStream: false,
          // 모바일 메모리 보호 — fontFace 사용으로 캔버스 메모리 절감
          useSystemFonts: true,
        }).promise
        pdfRef.current = pdf
        setNumPages(pdf.numPages)
        setCurrentPage(1)
      } catch (e) {
        console.error('[EbookReader] PDF 로드 실패:', e)
        setError('PDF 파일을 불러올 수 없습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해 주세요.')
      }
    }

    loadPdf()

    return () => {
      pdfRef.current?.destroy()
      pdfRef.current = null
    }
  }, [ebook?.file_url])

  // 컨테이너 폭 추적 (반응형 fit-to-width)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateWidth = () => {
      // padding 16px(좌우) 제외
      const w = Math.max(0, el.clientWidth - 32)
      setContainerWidth(w)
    }
    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    ro.observe(el)
    window.addEventListener('orientationchange', updateWidth)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', updateWidth)
    }
  }, [])

  // 페이지 렌더링 — 캔버스 크기 안전 클램프 + DPR 캡
  const renderPage = useCallback(async (pageNum: number) => {
    const pdf = pdfRef.current
    const canvas = canvasRef.current
    if (!pdf || !canvas) return

    setRendering(true)
    try {
      const page = await pdf.getPage(pageNum)
      const baseViewport = page.getViewport({ scale: 1 })

      // fit-to-width 모드: 컨테이너 폭에 맞춤 (모바일 기본)
      let effectiveScale = scale
      if (fitMode === 'width' && containerWidth > 0) {
        effectiveScale = Math.min(3, containerWidth / baseViewport.width)
      }

      // DPR 캡 — 모바일은 2, 데스크톱은 2.5까지
      const rawDpr = window.devicePixelRatio || 1
      let dpr = Math.min(rawDpr, isMobile() ? 2 : 2.5)

      let viewport = page.getViewport({ scale: effectiveScale })

      // 캔버스 한 변 4096 / 총 16M 픽셀 제한 (특히 iOS) — scale·dpr 동시 클램프
      const clampToLimits = () => {
        const w = viewport.width * dpr
        const h = viewport.height * dpr
        const maxDim = Math.max(w, h)
        if (maxDim > MAX_CANVAS_DIM) {
          const r = MAX_CANVAS_DIM / maxDim
          dpr *= r
        }
        const w2 = viewport.width * dpr
        const h2 = viewport.height * dpr
        if (w2 * h2 > MAX_CANVAS_AREA) {
          const r = Math.sqrt(MAX_CANVAS_AREA / (w2 * h2))
          dpr *= r
        }
      }
      clampToLimits()

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError('캔버스 컨텍스트를 사용할 수 없습니다.')
        return
      }

      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      await page.render({ canvasContext: ctx, viewport, canvas } as never).promise

      // 워터마크 — 화면 한 페이지 분량만 (성능)
      if (watermarkText) {
        ctx.save()
        ctx.globalAlpha = 0.05
        ctx.font = '14px sans-serif'
        ctx.fillStyle = '#000'
        ctx.translate(viewport.width / 2, viewport.height / 2)
        ctx.rotate(-Math.PI / 6)

        const text = watermarkText
        const colWidth = ctx.measureText(text).width + 100
        const lineHeight = 80
        const halfW = viewport.width
        const halfH = viewport.height
        for (let y = -halfH; y < halfH; y += lineHeight) {
          for (let x = -halfW; x < halfW; x += colWidth) {
            ctx.fillText(text, x, y)
          }
        }
        ctx.restore()
      }
    } catch (e) {
      console.error('[EbookReader] 페이지 렌더 실패:', e)
      setError('페이지를 표시하는 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.')
    } finally {
      setRendering(false)
    }
  }, [scale, fitMode, containerWidth, watermarkText])

  useEffect(() => {
    if (numPages > 0) renderPage(currentPage)
  }, [currentPage, numPages, renderPage])

  // 키보드 단축키 차단 + 페이지 이동
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 인쇄/저장 차단
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) {
        e.preventDefault()
      }
      // 페이지 이동
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setCurrentPage((p) => Math.max(1, p - 1))
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        setCurrentPage((p) => Math.min(numPages, p + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [numPages])

  // 우클릭 차단
  useEffect(() => {
    const handleContext = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', handleContext)
    return () => document.removeEventListener('contextmenu', handleContext)
  }, [])

  const handleClose = () => navigate(-1)

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
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
            className="bg-[#2ED573] text-black font-bold px-6 py-2.5 rounded-lg hover:brightness-110 transition cursor-pointer"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  if (!ebook) return null

  return (
    <div
      className="fixed inset-0 bg-gray-900 flex flex-col z-50 select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 border-b border-gray-700 shrink-0">
        <h1 className="text-white font-semibold text-sm truncate mr-4">
          {ebook.title}
        </h1>
        <div className="flex items-center gap-3 shrink-0">
          {/* 페이지 네비게이션 */}
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-300 border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <i className="ti ti-chevron-left text-xs" />
            </button>
            <span className="text-gray-300 min-w-[60px] text-center">
              {currentPage} / {numPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
              className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-300 border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <i className="ti ti-chevron-right text-xs" />
            </button>
          </div>

          {/* 줌 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setFitMode('manual')
                setScale((s) => Math.max(0.5, s - 0.2))
              }}
              className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-300 border-none cursor-pointer transition-colors"
              aria-label="축소"
            >
              <i className="ti ti-minus text-xs" />
            </button>
            <button
              onClick={() => {
                setFitMode('width')
                setScale(1)
              }}
              className={`px-2 h-7 flex items-center justify-center rounded text-xs border-none cursor-pointer transition-colors max-sm:hidden ${
                fitMode === 'width' ? 'bg-[#2ED573] text-black' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              aria-label="너비 맞춤"
            >
              맞춤
            </button>
            <button
              onClick={() => {
                setFitMode('manual')
                setScale((s) => Math.min(3, s + 0.2))
              }}
              className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-300 border-none cursor-pointer transition-colors"
              aria-label="확대"
            >
              <i className="ti ti-plus text-xs" />
            </button>
          </div>

          {/* 닫기 */}
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition cursor-pointer bg-transparent border-none"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* PDF 캔버스 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center px-4 py-4 bg-gray-900"
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="max-w-full block"
            style={{ pointerEvents: 'none', touchAction: 'pan-y pinch-zoom' }}
          />
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 pointer-events-none">
              <div className="w-8 h-8 border-2 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* 하단 워터마크 안내 */}
      <div className="px-4 py-1.5 bg-gray-800 border-t border-gray-700 text-center shrink-0">
        <p className="text-[10px] text-gray-600">본 콘텐츠는 구매자 전용이며 무단 복제 및 배포를 금합니다.</p>
      </div>
    </div>
  )
}

export default EbookReaderPage
