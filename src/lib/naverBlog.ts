// 네이버 블로그(스마트에디터 ONE) 글 HTML → 우리 게시판 블로그형 본문 HTML 변환.
// 우리(강사) 블로그 글을 게시판으로 옮길 때 사용 — 브라우저 DOMParser 기반.
// 결과 HTML 은 BlogPostView 의 .blog-body 스타일(src/components/blog/blogPost.css)로 네이버 글과 같은 모양이 된다.
//   문단  <p class="bp">               (글자 크기·색·굵게·배경색 유지, 빈 줄 유지)
//   인용구 <blockquote class="bq bq-{스타일}">
//   구분선 <hr class="bhr bhr-{스타일}">
//   사진  <figure class="bimg bimg-{스타일}"><img><figcaption>
//   슬라이드 <div class="bslide">  가로 나열 <div class="bstrip">  링크 카드 <a class="blink blink-{스타일}">

export interface NaverPost {
  title: string
  category: string
  dateText: string
  nickname: string
  profileImage: string
  bodyHtml: string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** se-l-xxx 레이아웃 이름 */
const layoutOf = (el: Element) => [...el.classList].find((c) => c.startsWith('se-l-'))?.slice(5) ?? 'default'

/** 네이버 이미지 주소 — blogfiles 는 원본(type=w1)만 있으므로 그대로 쓰고, 흐린 미리보기(_blur)만 원본으로 */
const imgSrc = (img: Element | null) => {
  const src = img?.getAttribute('data-lazy-src') || img?.getAttribute('src') || ''
  return src.replace(/\?type=w\d+_blur$/, '?type=w1')
}
const imgTag = (img: Element | null) => {
  const src = imgSrc(img)
  return src ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ''
}

/** 글자 단위 서식(span) → 우리 inline 스타일 */
function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent ?? '')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  const inner = [...el.childNodes].map(inline).join('')
  const tag = el.tagName.toLowerCase()
  if (tag === 'br') return '<br>'
  if (tag === 'a') return `<a href="${esc(el.getAttribute('href') || '#')}" target="_blank" rel="noopener noreferrer">${inner}</a>`
  if (tag === 'b' || tag === 'strong') return `<strong>${inner}</strong>`
  if (tag === 'i' || tag === 'em') return `<em>${inner}</em>`
  if (tag === 'u') return `<u>${inner}</u>`
  if (tag === 's' || tag === 'strike') return `<s>${inner}</s>`
  if (tag !== 'span') return inner
  const styles: string[] = []
  const fs = [...el.classList].find((c) => /^se-fs-fs\d+$/.test(c))
  if (fs) styles.push(`font-size:${fs.slice(8)}px`)
  if (el.style.color && !/^(#222222|rgb\(34, 34, 34\))$/i.test(el.style.color)) styles.push(`color:${el.style.color}`)
  if (el.style.backgroundColor) styles.push(`background-color:${el.style.backgroundColor}`)
  let out = styles.length ? `<span style="${styles.join(';')}">${inner}</span>` : inner
  if (el.classList.contains('se-weight-bold') || el.style.fontWeight === 'bold' || Number(el.style.fontWeight) >= 600) out = `<strong>${out}</strong>`
  if (el.classList.contains('se-style-italic')) out = `<em>${out}</em>`
  if (/underline/.test(el.style.textDecoration)) out = `<u>${out}</u>`
  return out
}

/** se-text-paragraph 들 → <p class="bp"> */
function paragraphs(root: Element, cls = 'bp'): string {
  return [...root.querySelectorAll('.se-text-paragraph')].map((p) => {
    const align = [...p.classList].find((c) => /^se-text-paragraph-align-(center|right|justify)$/.test(c))?.split('-').pop()
    const lh = (p as HTMLElement).style.lineHeight
    const style = [align ? `text-align:${align}` : '', lh ? `line-height:${lh}` : ''].filter(Boolean).join(';')
    const html = [...p.childNodes].map(inline).join('').replace(/​/g, '')
    const empty = !html.replace(/<[^>]+>/g, '').replace(/&nbsp;|\s/g, '')
    return `<p class="${cls}"${style ? ` style="${style}"` : ''}>${empty ? '&nbsp;' : html}</p>`
  }).join('')
}

function component(c: Element): string {
  const type = [...c.classList].find((k) => k !== 'se-component' && k.startsWith('se-') && !k.startsWith('se-l-'))?.slice(3)
  const layout = layoutOf(c)
  switch (type) {
    case 'text':
      return paragraphs(c)
    case 'quotation': {
      const quote = c.querySelector('.se-quote')
      const cite = c.querySelector('.se-cite')?.textContent?.trim()
      return `<blockquote class="bq bq-${layout}">${quote ? paragraphs(quote, 'bq-p') : ''}${cite ? `<cite>${esc(cite)}</cite>` : ''}</blockquote>`
    }
    case 'horizontalLine':
      return `<hr class="bhr bhr-${layout}" />`
    case 'image': {
      const cap = c.querySelector('.se-caption')
      return `<figure class="bimg bimg-${layout}">${imgTag(c.querySelector('img.se-image-resource'))}${cap ? `<figcaption>${paragraphs(cap, 'bcap')}</figcaption>` : ''}</figure>`
    }
    case 'imageGroup': {
      const imgs = [...c.querySelectorAll('.se-imageGroup-item img.se-image-resource')].map(imgTag).join('')
      const cap = c.querySelector('.se-caption')
      const cls = layout === 'slide' ? 'bslide' : `bstrip bstrip-${c.querySelectorAll('.se-imageGroup-item').length}`
      return `<figure class="bgroup"><div class="${cls}">${imgs}</div>${cap ? `<figcaption>${paragraphs(cap, 'bcap')}</figcaption>` : ''}</figure>`
    }
    case 'imageStrip': {
      const items = c.querySelectorAll('img.se-image-resource')
      const cap = c.querySelector('.se-caption')
      return `<figure class="bgroup"><div class="bstrip bstrip-${items.length}">${[...items].map(imgTag).join('')}</div>${cap ? `<figcaption>${paragraphs(cap, 'bcap')}</figcaption>` : ''}</figure>`
    }
    case 'oglink': {
      const a = c.querySelector('a.se-oglink-info, a.se-oglink-thumbnail')
      const href = a?.getAttribute('href') || '#'
      const title = c.querySelector('.se-oglink-title')?.textContent?.trim() ?? ''
      const summary = c.querySelector('.se-oglink-summary')?.textContent?.trim() ?? ''
      const url = c.querySelector('.se-oglink-url')?.textContent?.trim() ?? ''
      const thumb = c.querySelector('img.se-oglink-thumbnail-resource')
      return `<a class="blink blink-${layout}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">`
        + (thumb ? `<span class="blink-thumb">${imgTag(thumb)}</span>` : '')
        + `<span class="blink-info"><strong>${esc(title)}</strong>${summary ? `<span class="blink-sum">${esc(summary)}</span>` : ''}<span class="blink-url">${esc(url)}</span></span></a>`
    }
    case 'sticker':
      return `<figure class="bimg bimg-sticker">${imgTag(c.querySelector('img'))}</figure>`
    case 'video':
    case 'oembed': {
      const iframe = c.querySelector('iframe')
      return iframe ? `<div class="bembed"><iframe src="${esc(iframe.getAttribute('src') || '')}" allowfullscreen></iframe></div>` : ''
    }
    default:
      // 표·지도 등 아직 지원하지 않는 요소는 글자만이라도 남긴다
      return c.textContent?.trim() ? `<p class="bp">${esc(c.textContent.trim())}</p>` : ''
  }
}

/** PostView 페이지 HTML 전체 또는 본문 일부를 받아 변환 */
export function convertNaverPost(html: string): NaverPost {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const titleEl = doc.querySelector('.se-documentTitle .se-title-text')
  const main = doc.querySelector('.se-main-container') ?? doc.body
  const bodyHtml = [...main.querySelectorAll(':scope > .se-component, .se-component')]
    .filter((c) => !c.classList.contains('se-documentTitle') && !c.parentElement?.closest('.se-component'))
    .map(component)
    .join('\n')
  const nick = html.match(/nickName\s*=\s*'([^']*)'/)?.[1] ?? ''
  return {
    title: titleEl?.textContent?.trim() ?? '',
    category: doc.querySelector('.blog2_series a')?.textContent?.trim() ?? '',
    dateText: doc.querySelector('.se_publishDate')?.textContent?.trim() ?? '',
    nickname: nick,
    profileImage: doc.querySelector('.blog2_container .area_profile img')?.getAttribute('src') ?? '',
    bodyHtml,
  }
}
