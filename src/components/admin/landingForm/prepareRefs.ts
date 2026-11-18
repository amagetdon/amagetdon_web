import { landingAgentService, type RefFile, type RefText } from '../../../services/landingAgentService'

// '자료로 초안 만들기'에 넣은 파일을 AI 가 읽을 수 있는 모양으로 바꾼다.
//  · 그림: 긴 변 1568px 이하 JPEG. 세로로 긴 그림(상세페이지 조각)은 글씨가 뭉개지지 않게 위에서 아래로 잘라 여러 장으로.
//  · PDF: 작으면 그대로, 크면 글을 꺼내고 앞쪽 쪽을 그림으로.
//  · 글 파일(txt·md·html·csv·json): 글만 꺼낸다.
// 그림·PDF 는 파일 하나씩 서버에 올려 번호(file_id)로 바꾼다 — 한 요청에 다 싣지 않으므로 합계 크기 제한이 없다.

const LONG_SIDE = 1568
const TILE_WIDTH = 1200 // 세로로 긴 그림을 자를 때의 폭
const TILE_OVERLAP = 96
const PDF_WHOLE_LIMIT = 3_500_000 // 이보다 작은 PDF 는 그대로 올린다
const PDF_PAGE_IMAGES = 40 // 큰 PDF 에서 그림으로 바꿔 올리는 쪽 수
export const MAX_REF_IMAGES = 80 // 참고 그림(조각·PDF 쪽 포함) 합계
const TEXT_EXT = /\.(txt|md|markdown|html?|csv|json)$/i

export interface Prepared { refs: RefFile[]; texts: RefText[]; warnings: string[] }

export const isSupportedRef = (file: File) =>
  file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('text/') || TEXT_EXT.test(file.name)

const toJpeg = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) =>
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('그림을 바꾸지 못했습니다.'))), 'image/jpeg', 0.85))

function draw(source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w))
  canvas.height = Math.max(1, Math.round(h))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('그림을 읽지 못했습니다.')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas
}

/** 그림 한 장 → JPEG 한 장 또는 (세로로 길면) 여러 조각 */
async function imageParts(file: File): Promise<{ name: string; blob: Blob }[]> {
  const bitmap = await createImageBitmap(file)
  const { width: w, height: h } = bitmap
  if (h <= w * 2) {
    const scale = Math.min(1, LONG_SIDE / Math.max(w, h))
    return [{ name: file.name, blob: await toJpeg(draw(bitmap, 0, 0, w, h, w * scale, h * scale)) }]
  }
  const scale = Math.min(1, TILE_WIDTH / w)
  const tileSrc = LONG_SIDE / scale // 원본 기준 조각 높이
  const stepSrc = tileSrc - TILE_OVERLAP / scale
  const count = Math.max(1, Math.ceil((h - TILE_OVERLAP / scale) / stepSrc))
  const parts: { name: string; blob: Blob }[] = []
  for (let i = 0; i < count; i++) {
    const sy = Math.min(i * stepSrc, Math.max(0, h - tileSrc))
    const sh = Math.min(tileSrc, h - sy)
    parts.push({ name: `${file.name} (위에서 ${i + 1}/${count} 조각)`, blob: await toJpeg(draw(bitmap, 0, sy, w, sh, w * scale, sh * scale)) })
  }
  return parts
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, noscript, template').forEach((el) => el.remove())
  // 줄 단위 요소 뒤에 줄바꿈을 넣어 표·목록이 한 줄로 붙지 않게 한다
  doc.querySelectorAll('br, p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article').forEach((el) => el.append('\n'))
  doc.querySelectorAll('td, th').forEach((el) => el.append(' | '))
  return (doc.body?.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
}

/** 큰 PDF: 글을 꺼내고, 앞쪽 쪽을 그림으로 */
async function bigPdf(file: File, imageBudget: number, onStep: (text: string) => void): Promise<{ text: string; pages: { name: string; blob: Blob }[]; total: number }> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/', useSystemFonts: false }).promise
  const lines: string[] = []
  const pages: { name: string; blob: Blob }[] = []
  const renderCount = Math.min(pdf.numPages, PDF_PAGE_IMAGES, Math.max(0, imageBudget))
  for (let n = 1; n <= pdf.numPages; n++) {
    onStep(`"${file.name}" 읽는 중 (${n}/${pdf.numPages}쪽)…`)
    const page = await pdf.getPage(n)
    const content = await page.getTextContent()
    const text = content.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim()
    if (text) lines.push(`[${n}쪽] ${text}`)
    if (n <= renderCount) {
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(2, LONG_SIDE / Math.max(base.width, base.height)) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('PDF 를 그리지 못했습니다.')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      pages.push({ name: `${file.name} ${n}쪽`, blob: await toJpeg(canvas) })
    }
    page.cleanup()
  }
  const total = pdf.numPages
  await pdf.destroy()
  return { text: lines.join('\n'), pages, total }
}

/**
 * 파일들을 준비해 올린다. 실패하면 그때까지 올린 것을 지우고 throw.
 * 돌려준 refs 는 초안 만들기 요청에 실어 보내면 서버가 읽은 뒤 지운다.
 */
export async function prepareRefs(files: File[], onStep: (text: string) => void): Promise<Prepared> {
  const refs: RefFile[] = []
  const texts: RefText[] = []
  const warnings: string[] = []
  let images = 0
  const upload = async (name: string, blob: Blob, mediaType: string) => {
    refs.push({ name, media_type: mediaType, file_id: await landingAgentService.uploadRef(blob, mediaType) })
  }
  const tooMany = () => new Error(`참고 그림이 너무 많습니다 (긴 그림 조각·PDF 쪽 포함 ${MAX_REF_IMAGES}장까지). 파일 수를 줄여 주세요.`)

  try {
    for (const [i, file] of files.entries()) {
      onStep(`자료를 준비하고 있습니다 (${i + 1}/${files.length}) "${file.name}"…`)
      if (file.type.startsWith('image/')) {
        const parts = await imageParts(file)
        if (images + parts.length > MAX_REF_IMAGES) throw tooMany()
        for (const p of parts) await upload(p.name, p.blob, 'image/jpeg')
        images += parts.length
      } else if (file.type === 'application/pdf') {
        if (file.size <= PDF_WHOLE_LIMIT) {
          await upload(file.name, file, 'application/pdf')
        } else {
          const { text, pages, total } = await bigPdf(file, MAX_REF_IMAGES - images, onStep)
          if (text) texts.push({ name: `${file.name} (PDF 에서 꺼낸 글)`, text })
          for (const [k, p] of pages.entries()) {
            onStep(`"${file.name}" 올리는 중 (${k + 1}/${pages.length}쪽)…`)
            await upload(p.name, p.blob, 'image/jpeg')
          }
          images += pages.length
          if (!text && !pages.length) throw new Error(`"${file.name}" 에서 읽을 수 있는 내용이 없습니다.`)
          if (pages.length < total) warnings.push(`"${file.name}" 은 큰 PDF 라 글은 ${total}쪽 전부, 그림은 앞 ${pages.length}쪽만 읽었습니다. 뒤쪽의 표·캡처가 중요하면 그 쪽을 그림으로 따로 올려 주세요.`)
          if (!text) warnings.push(`"${file.name}" 에는 꺼낼 수 있는 글이 없어(스캔본) 쪽 그림으로만 읽었습니다.`)
        }
      } else if (file.type.startsWith('text/') || TEXT_EXT.test(file.name)) {
        const raw = await file.text()
        const text = /\.html?$/i.test(file.name) || file.type === 'text/html' ? htmlToText(raw) : raw.trim()
        if (text) texts.push({ name: file.name, text })
        else warnings.push(`"${file.name}" 은 비어 있어 뺐습니다.`)
      } else {
        throw new Error(`"${file.name}" 은 읽을 수 없는 형식입니다. 그림, PDF, 글 파일(txt·md·html)을 넣어 주세요. PPT·워드는 PDF 로 저장해서 넣으면 됩니다.`)
      }
    }
    return { refs, texts, warnings }
  } catch (e) {
    void landingAgentService.deleteRefs(refs.map((r) => r.file_id))
    throw e
  }
}
