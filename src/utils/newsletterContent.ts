import DOMPurify from 'dompurify'

export const NEWSLETTER_TEXT_LIMIT = 5000
export const NEWSLETTER_HTML_LIMIT = 60000

export function normalizeNewsletterLink(value: string): string | null {
  const input = value.trim()
  if (!input || Array.from(input).some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return null
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`)
    if (url.protocol === 'mailto:') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(url.pathname) ? url.href : null
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null
    return url.href
  } catch { return null }
}

// Both the editor and the reader use this allowlist. Stored content is untrusted.
export function sanitizeNewsletterHtml(html: string): string {
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a'],
    ALLOWED_ATTR: ['href', 'start'], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false, RETURN_DOM_FRAGMENT: true,
  })
  for (const link of fragment.querySelectorAll('a')) {
    const href = normalizeNewsletterLink(link.getAttribute('href') ?? '')
    if (!href) { link.replaceWith(...link.childNodes); continue }
    link.setAttribute('href', href)
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  }
  const container = document.createElement('div')
  container.append(fragment)
  return container.innerHTML
}

export function legacyNewsletterHtml(paragraphs: string[]): string {
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return paragraphs.length ? paragraphs.map(text => `<p>${escape(text).replace(/\n/g, '<br>')}</p>`).join('') : '<p></p>'
}
