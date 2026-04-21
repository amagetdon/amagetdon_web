import { useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, FontSize, LineHeight, Color, BackgroundColor } from '@tiptap/extension-text-style'
import { TableKit } from '@tiptap/extension-table'
import { TextAlign } from '@tiptap/extension-text-align'
import { LetterSpacing } from './tiptap-letter-spacing'
import { textToHtml } from '../../utils/richText'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

const FONT_SIZES = ['12px', '13px', '14px', '15px', '16px', '18px', '20px', '24px']
const LINE_HEIGHTS = ['0', '0.5', '1', '1.5', '2', '3', '4']
const LETTER_SPACINGS = ['-1px', '-0.5px', '0', '0.5px', '1px', '2px']

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 280 }: Props) {
  const [htmlMode, setHtmlMode] = useState(false)
  const [htmlDraft, setHtmlDraft] = useState(value || '')
  const colorInputRef = useRef<HTMLInputElement>(null)
  const bgColorInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TextStyle,
      FontSize,
      LineHeight,
      Color,
      BackgroundColor,
      LetterSpacing,
      TableKit.configure({
        table: { resizable: true, HTMLAttributes: { class: 'rte-table' } },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
    ],
    content: textToHtml(value),
    editorProps: {
      attributes: {
        class: 'tiptap-content outline-none px-4 py-3 text-sm text-gray-800 leading-relaxed',
        style: `min-height: ${minHeight}px;`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
  })

  // 외부 value 변경 시 에디터 동기화 (HTML 모드가 아닐 때만)
  useEffect(() => {
    if (!editor || htmlMode) return
    const current = editor.getHTML()
    const normalized = textToHtml(value) || '<p></p>'
    if (current !== normalized && current !== value) {
      editor.commands.setContent(textToHtml(value), { emitUpdate: false })
    }
  }, [value, editor, htmlMode])

  const enterHtmlMode = () => {
    if (editor) {
      const html = editor.getHTML()
      setHtmlDraft(html === '<p></p>' ? '' : html)
    }
    setHtmlMode(true)
  }

  const exitHtmlMode = () => {
    if (editor) {
      editor.commands.setContent(htmlDraft || '', { emitUpdate: false })
      onChange(htmlDraft.trim() ? htmlDraft : '')
    }
    setHtmlMode(false)
  }

  if (!editor) {
    return (
      <div className="border border-gray-300 rounded-xl bg-gray-50" style={{ minHeight: minHeight + 48 }} />
    )
  }

  const textStyleAttrs = editor.getAttributes('textStyle')
  const currentFontSize = textStyleAttrs.fontSize ?? ''
  const currentLineHeight = textStyleAttrs.lineHeight ?? ''
  const currentLetterSpacing = textStyleAttrs.letterSpacing ?? ''
  const currentColor = textStyleAttrs.color ?? ''
  const currentBgColor = textStyleAttrs.backgroundColor ?? ''
  const isBold = editor.isActive('bold')
  const isItalic = editor.isActive('italic')
  const isUnderline = editor.isActive('underline')
  const isStrike = editor.isActive('strike')
  const activeHeading = [1, 2, 3].find((l) => editor.isActive('heading', { level: l })) ?? null
  const isBulletList = editor.isActive('bulletList')
  const isOrderedList = editor.isActive('orderedList')
  const isInTable = editor.isActive('table')
  const alignLeft = editor.isActive({ textAlign: 'left' })
  const alignCenter = editor.isActive({ textAlign: 'center' })
  const alignRight = editor.isActive({ textAlign: 'right' })
  const alignJustify = editor.isActive({ textAlign: 'justify' })

  const btnBase = 'w-8 h-8 flex items-center justify-center rounded-md text-sm border-none cursor-pointer transition-colors'
  const btnIdle = 'bg-transparent text-gray-600 hover:bg-gray-100'
  const btnActive = 'bg-[#2ED573] text-white'

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden bg-white focus-within:border-[#2ED573] focus-within:ring-2 focus-within:ring-[#2ED573]/10 transition-all">
      {/* 툴바 */}
      <div className="flex items-center gap-1 flex-wrap px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <select
          value={activeHeading ?? ''}
          onChange={(e) => {
            const v = e.target.value
            if (v === '') editor.chain().focus().setParagraph().run()
            else editor.chain().focus().toggleHeading({ level: Number(v) as 1 | 2 | 3 }).run()
          }}
          disabled={htmlMode}
          className="h-8 px-2 bg-white border border-gray-200 rounded-md text-xs text-gray-600 outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="문단/제목"
        >
          <option value="">본문</option>
          <option value="1">제목 1</option>
          <option value="2">제목 2</option>
          <option value="3">제목 3</option>
        </select>

        <select
          value={currentFontSize}
          onChange={(e) => {
            const v = e.target.value
            if (!v) editor.chain().focus().unsetFontSize().run()
            else editor.chain().focus().setFontSize(v).run()
          }}
          disabled={htmlMode}
          className="h-8 px-2 bg-white border border-gray-200 rounded-md text-xs text-gray-600 outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="글자 크기"
        >
          <option value="">크기</option>
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={currentLineHeight}
          onChange={(e) => {
            const v = e.target.value
            if (!v) editor.chain().focus().unsetLineHeight().run()
            else editor.chain().focus().setLineHeight(v).run()
          }}
          disabled={htmlMode}
          className="h-8 px-2 bg-white border border-gray-200 rounded-md text-xs text-gray-600 outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="줄 높이"
        >
          <option value="">줄높이</option>
          {LINE_HEIGHTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={currentLetterSpacing}
          onChange={(e) => {
            const v = e.target.value
            if (!v) editor.chain().focus().unsetLetterSpacing().run()
            else editor.chain().focus().setLetterSpacing(v).run()
          }}
          disabled={htmlMode}
          className="h-8 px-2 bg-white border border-gray-200 rounded-md text-xs text-gray-600 outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="자간"
        >
          <option value="">자간</option>
          {LETTER_SPACINGS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} disabled={htmlMode}
          className={`${btnBase} ${isBold ? btnActive : btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="굵게 (Ctrl+B)">
          <i className="ti ti-bold" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={htmlMode}
          className={`${btnBase} ${isItalic ? btnActive : btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="기울임 (Ctrl+I)">
          <i className="ti ti-italic" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={htmlMode}
          className={`${btnBase} ${isUnderline ? btnActive : btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="밑줄 (Ctrl+U)">
          <i className="ti ti-underline" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={htmlMode}
          className={`${btnBase} ${isStrike ? btnActive : btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="취소선">
          <i className="ti ti-strikethrough" />
        </button>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        {/* 글자 색 */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => colorInputRef.current?.click()}
            disabled={htmlMode}
            className={`${btnBase} ${btnIdle} disabled:opacity-40 disabled:cursor-not-allowed relative`}
            title="글자 색"
          >
            <i className="ti ti-palette" />
            <span
              className="absolute bottom-1 left-1 right-1 h-1 rounded-sm border border-gray-300"
              style={{ backgroundColor: currentColor || 'transparent' }}
            />
          </button>
          <input
            ref={colorInputRef}
            type="color"
            value={currentColor || '#000000'}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            className="absolute w-0 h-0 opacity-0 pointer-events-none"
            tabIndex={-1}
          />
          {currentColor && (
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetColor().run()}
              disabled={htmlMode}
              className="w-5 h-8 flex items-center justify-center text-gray-400 bg-transparent border-none cursor-pointer hover:text-red-500 disabled:opacity-40"
              title="글자 색 지우기"
            >
              <i className="ti ti-x text-xs" />
            </button>
          )}
        </div>

        {/* 배경색 */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => bgColorInputRef.current?.click()}
            disabled={htmlMode}
            className={`${btnBase} ${btnIdle} disabled:opacity-40 disabled:cursor-not-allowed relative`}
            title="배경 색"
          >
            <i className="ti ti-highlight" />
            <span
              className="absolute bottom-1 left-1 right-1 h-1 rounded-sm border border-gray-300"
              style={{ backgroundColor: currentBgColor || 'transparent' }}
            />
          </button>
          <input
            ref={bgColorInputRef}
            type="color"
            value={currentBgColor || '#ffff00'}
            onChange={(e) => editor.chain().focus().setBackgroundColor(e.target.value).run()}
            className="absolute w-0 h-0 opacity-0 pointer-events-none"
            tabIndex={-1}
          />
          {currentBgColor && (
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetBackgroundColor().run()}
              disabled={htmlMode}
              className="w-5 h-8 flex items-center justify-center text-gray-400 bg-transparent border-none cursor-pointer hover:text-red-500 disabled:opacity-40"
              title="배경 색 지우기"
            >
              <i className="ti ti-x text-xs" />
            </button>
          )}
        </div>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={htmlMode}
          className={`${btnBase} ${isBulletList ? btnActive : btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="글머리 기호">
          <i className="ti ti-list" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={htmlMode}
          className={`${btnBase} ${isOrderedList ? btnActive : btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="번호 매기기">
          <i className="ti ti-list-numbers" />
        </button>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} disabled={htmlMode}
          className={`${btnBase} ${alignLeft ? btnActive : btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="왼쪽 정렬">
          <i className="ti ti-align-left" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} disabled={htmlMode}
          className={`${btnBase} ${alignCenter ? btnActive : btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="가운데 정렬">
          <i className="ti ti-align-center" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} disabled={htmlMode}
          className={`${btnBase} ${alignRight ? btnActive : btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="오른쪽 정렬">
          <i className="ti ti-align-right" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('justify').run()} disabled={htmlMode}
          className={`${btnBase} ${alignJustify ? btnActive : btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="양쪽 정렬">
          <i className="ti ti-align-justified" />
        </button>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          disabled={htmlMode}
          className={`${btnBase} ${btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`}
          title="표 삽입 (3×3)"
        >
          <i className="ti ti-table" />
        </button>
        {isInTable && (
          <>
            <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} disabled={htmlMode}
              className={`${btnBase} ${btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="행 추가">
              <i className="ti ti-row-insert-bottom" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={htmlMode}
              className={`${btnBase} ${btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="열 추가">
              <i className="ti ti-column-insert-right" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} disabled={htmlMode}
              className={`${btnBase} ${btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="행 삭제">
              <i className="ti ti-row-remove" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} disabled={htmlMode}
              className={`${btnBase} ${btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="열 삭제">
              <i className="ti ti-column-remove" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleHeaderRow().run()} disabled={htmlMode}
              className={`${btnBase} ${btnIdle} disabled:opacity-40 disabled:cursor-not-allowed`} title="헤더 행 토글">
              <i className="ti ti-layout-navbar" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} disabled={htmlMode}
              className={`${btnBase} ${btnIdle} disabled:opacity-40 disabled:cursor-not-allowed hover:!text-red-500`} title="표 삭제">
              <i className="ti ti-table-off" />
            </button>
          </>
        )}

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={htmlMode || !editor.can().undo()}
          className={`${btnBase} ${btnIdle} disabled:opacity-30 disabled:cursor-not-allowed`} title="되돌리기 (Ctrl+Z)">
          <i className="ti ti-arrow-back-up" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={htmlMode || !editor.can().redo()}
          className={`${btnBase} ${btnIdle} disabled:opacity-30 disabled:cursor-not-allowed`} title="다시 실행 (Ctrl+Y)">
          <i className="ti ti-arrow-forward-up" />
        </button>

        {/* HTML 모드 토글 (오른쪽 정렬) */}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => (htmlMode ? exitHtmlMode() : enterHtmlMode())}
            className={`h-8 px-2.5 rounded-md text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 border ${
              htmlMode
                ? 'bg-[#2ED573] text-white border-[#2ED573]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#2ED573] hover:text-[#2ED573]'
            }`}
            title={htmlMode ? 'HTML 적용 후 에디터로 전환' : 'HTML 소스 편집'}
          >
            <i className="ti ti-code text-sm" />
            {htmlMode ? 'HTML 적용' : 'HTML'}
          </button>
        </div>
      </div>

      {/* 에디터 본문 / HTML 소스 */}
      {htmlMode ? (
        <textarea
          value={htmlDraft}
          onChange={(e) => {
            setHtmlDraft(e.target.value)
            onChange(e.target.value.trim() ? e.target.value : '')
          }}
          placeholder="<p>HTML 소스를 직접 편집합니다...</p>"
          spellCheck={false}
          className="block w-full px-4 py-3 text-xs font-mono text-gray-800 outline-none resize-y"
          style={{ minHeight: `${minHeight}px` }}
        />
      ) : (
        <div className="relative">
          {!value && placeholder && (
            <div className="absolute top-3 left-4 text-sm text-gray-400 pointer-events-none whitespace-pre-line">
              {placeholder}
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  )
}
