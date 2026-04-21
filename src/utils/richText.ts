const HTML_TAG_RE = /<[a-z][\s\S]*>/i

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 기존 plain text(줄바꿈 포함)를 <p> 단락 HTML로 변환.
// 이미 HTML 태그를 포함하면 그대로 반환.
export function textToHtml(value: string | null | undefined): string {
  if (!value) return ''
  if (HTML_TAG_RE.test(value)) return value
  return value
    .split('\n')
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>'))
    .join('')
}

export function isHtmlContent(value: string | null | undefined): boolean {
  if (!value) return false
  return HTML_TAG_RE.test(value)
}

// 목록/미리보기용. HTML 태그를 제거하고 엔티티를 풀어 평문으로 반환.
export function htmlToPlainText(value: string | null | undefined): string {
  if (!value) return ''
  if (!HTML_TAG_RE.test(value)) return value
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
