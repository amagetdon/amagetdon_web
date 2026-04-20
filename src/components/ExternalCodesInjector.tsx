import { useEffect } from 'react'
import { useExternalCodes } from '../hooks/useExternalCodes'
import type { ExternalCode } from '../types/externalCode'

const MARK_ATTR = 'data-external-code-id'

function extractScriptBody(raw: string): { body: string; src: string | null } {
  const match = raw.match(/<script\b([^>]*)>([\s\S]*?)<\/script>/i)
  if (!match) return { body: raw, src: null }
  const attrs = match[1] || ''
  const body = match[2] || ''
  const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)
  return { body, src: srcMatch ? srcMatch[1] : null }
}

function extractStyleBody(raw: string): string {
  const match = raw.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)
  return match ? (match[1] || '') : raw
}

function extractNoscriptBody(raw: string): string {
  const match = raw.match(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/i)
  return match ? (match[1] || '') : raw
}

function extractUrl(raw: string, tag: 'script' | 'link'): string {
  const trimmed = raw.trim()
  const attr = tag === 'script' ? 'src' : 'href'
  const tagRegex = new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*["']([^"']+)["']`, 'i')
  const match = trimmed.match(tagRegex)
  if (match) return match[1]
  return trimmed
}

function buildElement(code: ExternalCode): HTMLElement | null {
  const raw = code.content
  if (!raw.trim()) return null
  switch (code.type) {
    case 'script': {
      const { body, src } = extractScriptBody(raw)
      const script = document.createElement('script')
      if (src) {
        script.src = src
        script.async = true
      } else {
        script.text = body
      }
      return script
    }
    case 'hrefScript': {
      const src = extractUrl(raw, 'script')
      if (!src) return null
      const script = document.createElement('script')
      script.src = src
      script.async = true
      return script
    }
    case 'noscript': {
      const noscript = document.createElement('noscript')
      noscript.innerHTML = extractNoscriptBody(raw)
      return noscript
    }
    case 'style': {
      const style = document.createElement('style')
      style.textContent = extractStyleBody(raw)
      return style
    }
    case 'link': {
      const href = extractUrl(raw, 'link')
      if (!href) return null
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      return link
    }
    default:
      return null
  }
}

function removeInjected() {
  document.querySelectorAll(`[${MARK_ATTR}]`).forEach((el) => el.remove())
}

function injectAll(codes: ExternalCode[]) {
  removeInjected()
  for (const code of codes) {
    if (!code.enabled) continue
    const el = buildElement(code)
    if (!el) continue
    el.setAttribute(MARK_ATTR, code.id)
    const parent = code.position === 'body' ? document.body : document.head
    if (!parent) continue
    parent.appendChild(el)
  }
}

export default function ExternalCodesInjector() {
  const codes = useExternalCodes()

  useEffect(() => {
    injectAll(codes)
  }, [codes])

  return null
}
