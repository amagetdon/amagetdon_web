import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    letterSpacing: {
      setLetterSpacing: (value: string) => ReturnType
      unsetLetterSpacing: () => ReturnType
    }
  }
}

declare module '@tiptap/extension-text-style' {
  interface TextStyleAttributes {
    letterSpacing?: string | null
  }
}

export interface LetterSpacingOptions {
  types: string[]
}

export const LetterSpacing = Extension.create<LetterSpacingOptions>({
  name: 'letterSpacing',

  addOptions() {
    return { types: ['textStyle'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          letterSpacing: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.letterSpacing || null,
            renderHTML: (attrs) => {
              if (!attrs.letterSpacing) return {}
              return { style: `letter-spacing: ${attrs.letterSpacing}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setLetterSpacing:
        (value: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { letterSpacing: value }).run(),
      unsetLetterSpacing:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { letterSpacing: null }).removeEmptyTextStyle().run(),
    }
  },
})
