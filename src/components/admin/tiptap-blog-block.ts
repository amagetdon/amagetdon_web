import { Node } from '@tiptap/core'
import '../blog/blogPost.css'

// 블로그형 게시판 블록 — 인용구·구분선·사진(설명·링크)·슬라이드·가로 나열·링크 카드·태그.
// 블록의 HTML 을 그대로(attrs.html) 보관해 편집기에서도 글 화면과 똑같이 보이고, 저장해도 모양이 바뀌지 않는다.
// 편집은 블록을 더블클릭 → 'blog-block-edit' 이벤트 → RichTextEditor 의 블록 편집 창.

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blogBlock: {
      insertBlogBlock: (html: string) => ReturnType
    }
  }
}

export const BLOG_BLOCK_SELECTORS = ['blockquote.bq', 'hr.bhr', 'figure.bimg', 'figure.bgroup', 'a.blink', 'div.bembed', 'div.btags']

export interface BlogBlockEditDetail { pos: number; html: string }

function toElement(html: string): HTMLElement {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return (t.content.firstElementChild as HTMLElement) ?? document.createElement('div')
}

export const BlogBlock = Node.create({
  name: 'blogBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return { html: { default: '' } }
  },

  parseHTML() {
    return BLOG_BLOCK_SELECTORS.map((tag) => ({
      tag,
      priority: 1000,
      getAttrs: (el: HTMLElement | string) => (typeof el === 'string' ? false : { html: el.outerHTML }),
    }))
  },

  renderHTML({ node }) {
    return toElement(node.attrs.html as string)
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div')
      dom.className = 'blog-body blog-block-nv'
      dom.contentEditable = 'false'
      dom.innerHTML = node.attrs.html as string
      dom.title = '더블클릭해서 수정'
      dom.addEventListener('dblclick', (e) => {
        e.preventDefault()
        const pos = typeof getPos === 'function' ? getPos() : null
        if (pos == null) return
        editor.view.dom.dispatchEvent(new CustomEvent<BlogBlockEditDetail>('blog-block-edit', { detail: { pos, html: node.attrs.html as string }, bubbles: true }))
      })
      // 편집기 안에서는 링크가 열리지 않게
      dom.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) e.preventDefault() })
      return { dom }
    }
  },

  addCommands() {
    return {
      insertBlogBlock: (html: string) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { html } }),
    }
  },
})
