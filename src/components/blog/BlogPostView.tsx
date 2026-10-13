import { useEffect, useRef, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import './blogPost.css'

// 게시판 글의 블로그형 화면 — 네이버 블로그 글 모양(제목 영역·본문·하단 태그)과 블로그 배치(왼쪽 프로필·카테고리).
// 네이버 고유 메뉴·이웃·공유 아이콘은 넣지 않고, 그 자리는 우리 기능(구독·URL 복사·인쇄)으로 채운다.

export interface BlogProfile {
  image?: string | null
  name: string
  sub?: string | null          // 이름 아래 작은 글씨 (아이디 자리)
  description?: string | null
  moreHref?: string | null     // '프로필 ›'
  button?: { label: string; onClick?: () => void; href?: string } | null
}
export interface BlogCategory { label: string; count?: number; href?: string; active?: boolean }
export interface BlogLink { label: string; href: string }

interface Props {
  blogTitle: string
  blogHref?: string
  profile: BlogProfile
  categories: BlogCategory[]
  recent?: BlogLink[]
  post: {
    category?: string | null
    categoryHref?: string | null
    title: string
    authorName: string
    authorImage?: string | null
    dateText: string
    bodyHtml: string
    tags?: string[]
  }
  subscribe?: { label: string; onClick: () => void } | null
  /** 본문 바로 위(구분선 아래) — 열람 상태 안내 등 */
  beforeBody?: ReactNode
  /** 본문 바로 아래(태그 위) — 잠금 안내·결제 버튼 등 */
  afterBody?: ReactNode
  /** 본문 영역 감싸기(잠긴 글 미리보기 높이 자르기 등) */
  bodyStyle?: React.CSSProperties
  bodyOverlay?: ReactNode
  bodyRef?: React.Ref<HTMLDivElement>
}

/** 슬라이드(.bslide)에 좌우 버튼·쪽수 붙이기 */
function enhanceSlides(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.bslide').forEach((slide) => {
    if (slide.parentElement?.classList.contains('bslide-wrap')) return
    const imgs = slide.querySelectorAll('img').length
    if (imgs < 2) return
    const wrap = document.createElement('div')
    wrap.className = 'bslide-wrap'
    slide.parentElement?.insertBefore(wrap, slide)
    wrap.appendChild(slide)
    const count = document.createElement('div')
    count.className = 'bslide-count'
    const update = () => { count.textContent = `${Math.round(slide.scrollLeft / slide.clientWidth) + 1} / ${imgs}` }
    const btn = (cls: string, dir: number, label: string) => {
      const b = document.createElement('button')
      b.type = 'button'; b.className = `bslide-btn ${cls}`; b.textContent = label; b.setAttribute('aria-label', cls === 'prev' ? '이전 사진' : '다음 사진')
      b.onclick = () => slide.scrollBy({ left: dir * slide.clientWidth, behavior: 'smooth' })
      wrap.appendChild(b)
    }
    btn('prev', -1, '‹'); btn('next', 1, '›')
    wrap.after(count)
    slide.addEventListener('scroll', update, { passive: true })
    update()
  })
}

export default function BlogPostView({ blogTitle, blogHref = '#', profile, categories, recent, post, subscribe, beforeBody, afterBody, bodyStyle, bodyOverlay, bodyRef }: Props) {
  const bodyEl = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (bodyEl.current) enhanceSlides(bodyEl.current)
  }, [post.bodyHtml])

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('주소를 복사했습니다.')
    } catch {
      toast.error('복사하지 못했습니다.')
    }
  }

  const setBodyRef = (el: HTMLDivElement | null) => {
    bodyEl.current = el
    if (typeof bodyRef === 'function') bodyRef(el)
    else if (bodyRef) (bodyRef as React.MutableRefObject<HTMLDivElement | null>).current = el
  }

  return (
    <div className="blogwrap">
      <div className="blog-frame">
        <div className="blog-head"><a href={blogHref}>{blogTitle}</a></div>

        <div className="blog-cols">
          <aside className="blog-side">
            {profile.image ? <img className="blog-prof-img" src={profile.image} alt="" referrerPolicy="no-referrer" /> : <div className="blog-prof-img" />}
            <div className="blog-prof">
              <div className="blog-prof-name">{profile.name}</div>
              {profile.sub && <div className="blog-prof-id">{profile.sub}</div>}
              {profile.description && <div className="blog-prof-desc">{profile.description}</div>}
              {profile.moreHref && <a className="blog-prof-more" href={profile.moreHref}>프로필 ›</a>}
              {profile.button && (profile.button.href
                ? <a className="blog-prof-btn" href={profile.button.href}><i className="ti ti-plus" />{profile.button.label}</a>
                : <button type="button" className="blog-prof-btn" onClick={profile.button.onClick}><i className="ti ti-plus" />{profile.button.label}</button>)}
            </div>

            <div className="blog-box">
              <h4>카테고리 <i className="ti ti-chevron-up" /></h4>
              <ul>
                {categories.map((c) => (
                  <li key={c.label}>
                    <a href={c.href ?? '#'} className={c.active ? 'on' : undefined}>{c.label}</a>
                    {c.count !== undefined && <span className="cnt">({c.count})</span>}
                  </li>
                ))}
              </ul>
            </div>

            {recent && recent.length > 0 && (
              <div className="blog-box">
                <h4>최근 글 <i className="ti ti-chevron-up" /></h4>
                <ul>{recent.map((r) => <li key={r.href}><a href={r.href}>{r.label}</a></li>)}</ul>
              </div>
            )}
          </aside>

          <main className="blog-main">
            {post.category && (post.categoryHref ? <a className="blog-cat" href={post.categoryHref}>{post.category}</a> : <span className="blog-cat">{post.category}</span>)}
            <h1 className="blog-title">{post.title}</h1>
            <div className="blog-meta">
              <div className="blog-meta-left">
                {post.authorImage ? <img src={post.authorImage} alt="" referrerPolicy="no-referrer" /> : null}
                <span className="who">{post.authorName}</span>
                <span className="when">{post.dateText}</span>
              </div>
              <div className="blog-meta-right">
                <button type="button" className="url" onClick={copyUrl}>URL 복사</button>
                {subscribe && <button type="button" className="sub" onClick={subscribe.onClick}>+{subscribe.label}</button>}
              </div>
            </div>

            {beforeBody}
            <div style={{ position: 'relative', overflow: bodyStyle ? 'hidden' : undefined, ...bodyStyle }}>
              <div ref={setBodyRef} className="blog-body" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
              {bodyOverlay}
            </div>

            {afterBody}

            {post.tags && post.tags.length > 0 && (
              <div className="blog-tags">{post.tags.map((t) => <span key={t}>#{t.replace(/^#/, '')}</span>)}</div>
            )}

            <div className="blog-foot">
              <div className="blog-foot-left">
                <button type="button" onClick={copyUrl}><i className="ti ti-link" /> 링크 복사</button>
              </div>
              <div className="blog-foot-right">
                <button type="button" onClick={() => window.print()}>인쇄</button>
              </div>
            </div>
            <div className="blog-top"><a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>▲ TOP</a></div>
          </main>
        </div>
      </div>
    </div>
  )
}
