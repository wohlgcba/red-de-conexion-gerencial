const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const embedHosts = new Set(['youtube-nocookie.com', 'www.youtube-nocookie.com'])
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/

export function youtubeVideoId(href: string): string | null {
  try {
    const url = new URL(href)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null
    const parts = url.pathname.split('/').filter(Boolean)
    let id: string | null = null
    if (url.hostname === 'youtu.be' && parts.length === 1) id = parts[0]
    else if (youtubeHosts.has(url.hostname) && parts.length === 1 && parts[0] === 'watch') id = url.searchParams.get('v')
    else if (parts.length === 2 && (
      youtubeHosts.has(url.hostname) && ['embed', 'shorts', 'live'].includes(parts[0])
      || embedHosts.has(url.hostname) && parts[0] === 'embed'
    )) id = parts[1]
    return id && videoIdPattern.test(id) ? id : null
  } catch { return null }
}

export function publicationVideoIds(links: readonly string[], paragraphs: readonly string[]) {
  const textLinks = paragraphs.flatMap(text => text.match(/https?:\/\/[^\s<>"']+/g) ?? [])
    .map(href => href.replace(/[.,;!?\])]+$/, ''))
  return [...new Set([...links, ...textLinks].map(youtubeVideoId).filter(id => id !== null))]
}
