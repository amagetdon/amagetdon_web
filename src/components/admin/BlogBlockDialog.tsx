import { useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

// 블로그형 게시판 블록 편집 창 — 인용구·구분선·사진·슬라이드/나열·링크 카드·태그.
// 기존 블록(html)을 받아 항목별 입력칸으로 풀고, 저장하면 다시 같은 형식의 HTML 로 만든다(src/lib/naverBlog.ts 와 같은 클래스).

export type BlogBlockKind = 'quote' | 'hr' | 'image' | 'gallery' | 'link' | 'tags' | 'raw'

const QUOTE_STYLES: [string, string][] = [
  ['default', '따옴표'], ['quotation_line', '세로줄'], ['quotation_underline', '밑줄'],
  ['quotation_bubble', '말풍선'], ['quotation_postit', '포스트잇'], ['quotation_corner', '테두리'],
]
const HR_STYLES: [string, string][] = [
  ['line1', '가는 실선'], ['default', '짧은 선'], ['line2', '파선'], ['line3', '점선'], ['line4', '이중선'], ['line5', '점'],
]
const UTM_KEY = 'blog_link_utm'
const DEFAULT_UTM = { source: 'DABLE', medium: 'native', campaign: 'min_ai_dbl' }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const img = (src: string) => `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
// **굵게** 표시를 <strong> 으로
const md = (l: string) => esc(l).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
const lines = (text: string, cls: string) => text.split('\n').map((l) => `<p class="${cls}">${l.trim() ? md(l) : '&nbsp;'}</p>`).join('')
/** 문단 HTML → 편집용 텍스트 (굵은 글씨는 **표시**) */
const mdOf = (el: Element | null, sel: string) => (el ? [...el.querySelectorAll(sel)].map((p) => {
  const tmp = document.createElement('div')
  tmp.innerHTML = p.innerHTML.replace(/<(strong|b)>([\s\S]*?)<\/(strong|b)>/gi, '**$2**')
  return (tmp.textContent ?? '').replace(/\u00a0/g, '').trimEnd()
}).join('\n') : '')
const textOf = (el: Element | null, sel: string) => (el ? [...el.querySelectorAll(sel)].map((p) => (p.textContent ?? '').replace(/\u00a0/g, '').trimEnd()).join('\n') : '')

interface State {
  kind: BlogBlockKind
  style: string
  text: string
  caption: string
  href: string
  images: string[]
  gallery: 'slide' | 'strip'
  title: string
  summary: string
  urlText: string
  tags: string
  raw: string
  bold: boolean
}

function parse(html: string | null, kind: BlogBlockKind): State {
  const s: State = { kind, style: '', text: '', caption: '', href: '', images: [], gallery: 'slide', title: '', summary: '', urlText: '', tags: '', raw: html ?? '', bold: false }
  if (!html) {
    s.style = kind === 'quote' ? 'default' : kind === 'hr' ? 'line1' : kind === 'link' ? 'large_image' : 'default'
    return s
  }
  const el = new DOMParser().parseFromString(html, 'text/html').body.firstElementChild
  if (!el) return { ...s, kind: 'raw' }
  const layout = (prefix: string) => [...el.classList].find((c) => c.startsWith(prefix))?.slice(prefix.length) ?? 'default'
  if (el.matches('blockquote.bq')) {
    const style = [...el.classList].find((c) => c.startsWith('bq-') && c !== 'bq-bold')?.slice(3) ?? 'default'
    return { ...s, kind: 'quote', style, bold: el.classList.contains('bq-bold'), text: mdOf(el, '.bq-p, p'), caption: el.querySelector('cite')?.textContent ?? '' }
  }
  if (el.matches('hr.bhr')) return { ...s, kind: 'hr', style: layout('bhr-') }
  if (el.matches('figure.bimg')) {
    return { ...s, kind: 'image', style: layout('bimg-'), images: [el.querySelector('img')?.getAttribute('src') ?? ''].filter(Boolean),
      href: el.querySelector('a')?.getAttribute('href') ?? '', caption: textOf(el.querySelector('figcaption'), 'p') || (el.querySelector('figcaption')?.textContent ?? '') }
  }
  if (el.matches('figure.bgroup')) {
    return { ...s, kind: 'gallery', gallery: el.querySelector('.bslide') ? 'slide' : 'strip',
      images: [...el.querySelectorAll('img')].map((i) => i.getAttribute('src') ?? '').filter(Boolean),
      caption: textOf(el.querySelector('figcaption'), 'p') || (el.querySelector('figcaption')?.textContent ?? '') }
  }
  if (el.matches('a.blink')) {
    return { ...s, kind: 'link', style: layout('blink-'), href: el.getAttribute('href') ?? '', images: [el.querySelector('img')?.getAttribute('src') ?? ''].filter(Boolean),
      title: el.querySelector('strong')?.textContent ?? '', summary: el.querySelector('.blink-sum')?.textContent ?? '', urlText: el.querySelector('.blink-url')?.textContent ?? '' }
  }
  if (el.matches('div.btags')) return { ...s, kind: 'tags', tags: (el.getAttribute('data-tags') ?? '').split(',').join(', ') }
  return { ...s, kind: 'raw' }
}

function build(s: State): string {
  const cap = s.caption.trim() ? `<figcaption>${lines(s.caption, 'bcap')}</figcaption>` : ''
  switch (s.kind) {
    case 'quote':
      return `<blockquote class="bq bq-${s.style}${s.bold ? ' bq-bold' : ''}">${lines(s.text, 'bq-p')}${s.caption.trim() ? `<cite>${esc(s.caption.trim())}</cite>` : ''}</blockquote>`
    case 'hr':
      return `<hr class="bhr bhr-${s.style}" />`
    case 'image': {
      const pic = s.images[0] ? img(s.images[0]) : ''
      const body = s.href.trim() ? `<a href="${esc(s.href.trim())}">${pic}</a>` : pic
      return `<figure class="bimg bimg-${s.style}">${body}${cap}</figure>`
    }
    case 'gallery': {
      const cls = s.gallery === 'slide' ? 'bslide' : `bstrip bstrip-${s.images.length}`
      return `<figure class="bgroup"><div class="${cls}">${s.images.map(img).join('')}</div>${cap}</figure>`
    }
    case 'link': {
      let host = s.urlText.trim()
      if (!host) { try { host = new URL(s.href).hostname } catch { host = '' } }
      return `<a class="blink blink-${s.style}" href="${esc(s.href.trim())}" target="_blank" rel="noopener noreferrer">`
        + (s.images[0] ? `<span class="blink-thumb">${img(s.images[0])}</span>` : '')
        + `<span class="blink-info"><strong>${esc(s.title)}</strong>${s.summary.trim() ? `<span class="blink-sum">${esc(s.summary)}</span>` : ''}<span class="blink-url">${esc(host)}</span></span></a>`
    }
    case 'tags': {
      const list = s.tags.split(/[,#\s]+/).map((t) => t.trim()).filter(Boolean)
      return `<div class="btags" data-tags="${esc(list.join(','))}">${list.map((t) => `#${esc(t)}`).join(' ')}</div>`
    }
    default:
      return s.raw
  }
}

const TITLES: Record<BlogBlockKind, string> = { quote: '인용구', hr: '구분선', image: '사진', gallery: '사진 여러 장', link: '링크 카드', tags: '태그', raw: 'HTML 블록' }

interface Props {
  html: string | null
  kind: BlogBlockKind
  onSave: (html: string) => void
  onDelete?: () => void
  onClose: () => void
  uploadImage: (file: File) => Promise<string>
}

export default function BlogBlockDialog({ html, kind, onSave, onDelete, onClose, uploadImage }: Props) {
  const [s, setS] = useState<State>(() => parse(html, kind))
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [utm, setUtm] = useState(() => {
    try { return { ...DEFAULT_UTM, ...JSON.parse(localStorage.getItem(UTM_KEY) || '{}') } } catch { return DEFAULT_UTM }
  })
  const preview = useMemo(() => build(s), [s])
  const set = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }))
  const multi = s.kind === 'gallery'

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const f of [...files]) urls.push(await uploadImage(f))
      set({ images: multi ? [...s.images, ...urls] : urls.slice(0, 1) })
    } catch (e) {
      toast.error(`사진 올리기 실패: ${(e as Error).message}`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // 링크에 UTM 붙이기 — 우리 사이트 강의·전자책 링크용 (소재 구분 utm_content 는 글 화면에서 자동)
  const applyUtm = () => {
    try {
      const u = new URL(s.href.trim())
      u.searchParams.set('utm_source', utm.source)
      u.searchParams.set('utm_medium', utm.medium)
      u.searchParams.set('utm_campaign', utm.campaign)
      u.searchParams.delete('utm_content')
      set({ href: u.toString() })
      localStorage.setItem(UTM_KEY, JSON.stringify(utm))
    } catch {
      toast.error('링크 주소를 먼저 정확히 넣어주세요 (https:// 로 시작)')
    }
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]'
  const label = 'text-xs font-bold block mb-1 text-gray-600'

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-[880px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h4 className="font-bold">{TITLES[s.kind]} {html ? '수정' : '추가'}</h4>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-gray-400"><i className="ti ti-x" /></button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 max-md:grid-cols-1 gap-5 p-5">
          <div className="space-y-3">
            {(s.kind === 'quote' || s.kind === 'hr' || s.kind === 'link' || s.kind === 'image') && (
              <div>
                <label className={label}>모양</label>
                <div className="flex flex-wrap gap-1.5">
                  {(s.kind === 'quote' ? QUOTE_STYLES : s.kind === 'hr' ? HR_STYLES : s.kind === 'link'
                    ? [['large_image', '큰 사진'], ['default', '작은 사진']] as [string, string][]
                    : [['default', '원본 크기'], ['large_image', '본문 폭에 맞춤']] as [string, string][]).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => set({ style: v })}
                      className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${s.style === v ? 'bg-[#2ED573] text-white border-[#2ED573]' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>
                  ))}
                </div>
              </div>
            )}

            {s.kind === 'gallery' && (
              <div>
                <label className={label}>보여주기</label>
                <div className="flex gap-1.5">
                  {([['slide', '좌우로 넘기기'], ['strip', '나란히 놓기']] as const).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => set({ gallery: v })}
                      className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${s.gallery === v ? 'bg-[#2ED573] text-white border-[#2ED573]' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>
                  ))}
                </div>
              </div>
            )}

            {s.kind === 'quote' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-600">내용 (줄바꿈 그대로)</label>
                    <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={s.bold} onChange={(e) => set({ bold: e.target.checked })} className="accent-[#2ED573]" /> 전체 굵게
                    </label>
                  </div>
                  <textarea rows={5} value={s.text} onChange={(e) => set({ text: e.target.value })} className={input} />
                  <p className="text-[11px] text-gray-400 mt-1">일부만 굵게: <code>**굵게 할 글자**</code> 처럼 별표 두 개로 감싸세요.</p>
                </div>
                <div><label className={label}>출처 (선택)</label><input value={s.caption} onChange={(e) => set({ caption: e.target.value })} className={input} /></div>
              </>
            )}

            {(s.kind === 'image' || s.kind === 'gallery' || s.kind === 'link') && (
              <div>
                <label className={label}>{s.kind === 'link' ? '썸네일 사진' : '사진'}</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {s.images.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 bg-gray-100 rounded overflow-hidden">
                      <img src={src} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => set({ images: s.images.filter((_, j) => j !== i) })}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs border-none cursor-pointer">×</button>
                      {multi && i > 0 && (
                        <button type="button" onClick={() => { const a = [...s.images]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set({ images: a }) }}
                          className="absolute bottom-0.5 left-0.5 w-5 h-5 rounded bg-black/60 text-white text-xs border-none cursor-pointer">‹</button>
                      )}
                    </div>
                  ))}
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple={multi} className="hidden" onChange={(e) => onFiles(e.target.files)} />
                <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-white cursor-pointer disabled:opacity-50">
                  {uploading ? '올리는 중…' : multi ? '사진 추가' : '사진 선택'}
                </button>
              </div>
            )}

            {(s.kind === 'image' || s.kind === 'gallery') && (
              <div><label className={label}>사진 설명 (선택)</label><textarea rows={2} value={s.caption} onChange={(e) => set({ caption: e.target.value })} className={input} /></div>
            )}

            {(s.kind === 'image' || s.kind === 'link') && (
              <div>
                <label className={label}>{s.kind === 'image' ? '누르면 이동할 주소 (선택)' : '링크 주소'}</label>
                <input value={s.href} onChange={(e) => set({ href: e.target.value })} placeholder="https://amag-class.com/course/129" className={input} />
                <div className="mt-2 rounded-lg bg-gray-50 p-2.5 space-y-1.5">
                  <p className="text-[11px] text-gray-500">강의·전자책 링크 UTM (소재 구분 utm_content 는 글 화면에서 자동: 광고 소재 또는 글 번호)</p>
                  <div className="flex gap-1.5">
                    {(['source', 'medium', 'campaign'] as const).map((k) => (
                      <input key={k} value={utm[k]} onChange={(e) => setUtm({ ...utm, [k]: e.target.value })} placeholder={`utm_${k}`}
                        className="flex-1 min-w-0 border border-gray-200 rounded px-2 py-1 text-xs" />
                    ))}
                    <button type="button" onClick={applyUtm} className="px-2.5 py-1 rounded bg-gray-800 text-white text-xs border-none cursor-pointer whitespace-nowrap">붙이기</button>
                  </div>
                </div>
              </div>
            )}

            {s.kind === 'link' && (
              <>
                <div><label className={label}>제목</label><input value={s.title} onChange={(e) => set({ title: e.target.value })} className={input} /></div>
                <div><label className={label}>요약 (선택)</label><input value={s.summary} onChange={(e) => set({ summary: e.target.value })} className={input} /></div>
                <div><label className={label}>표시할 주소 (비우면 도메인)</label><input value={s.urlText} onChange={(e) => set({ urlText: e.target.value })} className={input} /></div>
              </>
            )}

            {s.kind === 'tags' && (
              <div><label className={label}>태그 (쉼표로 구분)</label><input value={s.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="시니어부업, ai수익화, 무료강의" className={input} /></div>
            )}

            {s.kind === 'raw' && (
              <div><label className={label}>HTML</label><textarea rows={10} value={s.raw} onChange={(e) => set({ raw: e.target.value })} className={`${input} font-mono text-xs`} /></div>
            )}
          </div>

          <div>
            <p className={label}>미리보기</p>
            <div className="border border-gray-100 rounded-lg p-4 overflow-hidden">
              <div className="blog-body blog-block-nv" dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-between gap-2">
          <div>{onDelete && <button onClick={onDelete} className="px-4 py-2 rounded-xl text-sm bg-white text-red-500 border border-red-200 cursor-pointer">블록 삭제</button>}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm bg-gray-100 border-none cursor-pointer">취소</button>
            <button onClick={() => onSave(build(s))} disabled={uploading} className="px-4 py-2 rounded-xl text-sm bg-[#2ED573] text-white font-bold border-none cursor-pointer disabled:opacity-40">{html ? '수정' : '넣기'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
