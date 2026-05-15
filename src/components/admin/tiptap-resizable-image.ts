import Image from '@tiptap/extension-image'

/**
 * 기본 Image 확장에 width 속성과 드래그 리사이즈 핸들을 추가한다.
 * - 삽입 시에는 원본 크기로 들어가고(에디터/페이지 폭을 넘으면 max-width:100% 로만 캡),
 *   선택 후 우측 하단 핸들을 끌어 원하는 크기로 조절할 수 있다.
 * - width 는 인라인 style 로 직렬화되어 저장 HTML·공개 페이지에 그대로 반영된다.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const e = el as HTMLElement
          return e.style.width || e.getAttribute('width') || null
        },
        renderHTML: (attrs) => {
          if (!attrs.width) return {}
          return { style: `width: ${attrs.width}` }
        },
      },
    }
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const wrap = document.createElement('span')
      wrap.className = 'rte-image-wrap'

      const img = document.createElement('img')
      img.className = 'rte-image'
      img.src = node.attrs.src
      if (node.attrs.alt) img.alt = node.attrs.alt
      if (node.attrs.title) img.title = node.attrs.title
      img.style.width = node.attrs.width || ''
      wrap.appendChild(img)

      const handle = document.createElement('span')
      handle.className = 'rte-image-handle'
      handle.setAttribute('contenteditable', 'false')
      wrap.appendChild(handle)

      let startX = 0
      let startWidth = 0

      const onMove = (e: MouseEvent) => {
        const next = Math.max(40, Math.round(startWidth + (e.clientX - startX)))
        img.style.width = `${next}px`
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.userSelect = ''
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (typeof pos !== 'number') return
        const current = editor.state.doc.nodeAt(pos)
        if (!current) return
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, width: img.style.width }),
        )
      }

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        startX = e.clientX
        startWidth = img.getBoundingClientRect().width
        document.body.style.userSelect = 'none'
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      })

      return {
        dom: wrap,
        update: (updated) => {
          if (updated.type.name !== node.type.name) return false
          img.src = updated.attrs.src
          img.style.width = updated.attrs.width || ''
          return true
        },
      }
    }
  },
})
