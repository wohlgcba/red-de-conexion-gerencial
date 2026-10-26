export interface EmailDraft { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string }
export type EmailProvider = 'gmail' | 'outlook' | 'outlook-personal'
const hasControls = (value: string) => Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
const queryString = (entries: [string, string][]) => entries.filter(([,value]) => value).map(([key,value]) => `${key}=${encodeURIComponent(value)}`).join('&')

export function emailHref(email: string, message: { subject?: string; body?: string } = {}) {
  const query = queryString([['subject',message.subject ?? ''],['body',message.body ?? '']])
  return `mailto:${encodeURIComponent(email.trim())}${query ? '?' + query : ''}`
}
function recipients(value: string): string[] {
  if (hasControls(value)) throw new Error('El correo de destino no tiene un formato válido.')
  const result = value.split(/[,;]/).map(email => email.trim()).filter(Boolean)
  if (result.some(email => email.length > 254 || !/^[^\s@<>,;:]+@[^\s@<>,;:?#/\\%]+\.[^\s@<>,;:?#/\\%]+$/.test(email))) throw new Error('El correo de destino no tiene un formato válido.')
  return [...new Set(result)]
}
export function parseMailto(href: string): EmailDraft {
  let url: URL
  try { url = new URL(href) } catch { throw new Error('El enlace de correo no es válido.') }
  if (url.protocol !== 'mailto:' || url.hash) throw new Error('El enlace de correo no es válido.')
  let address: string
  try { address = decodeURIComponent(url.pathname) } catch { throw new Error('El correo de destino no tiene un formato válido.') }
  // RFC 6068 field names are case-insensitive. Only compose fields are used.
  const fields = new Map<string, string[]>()
  try {
    for (const part of url.search.slice(1).split('&').filter(Boolean)) {
      const separator = part.indexOf('='), name = decodeURIComponent(separator < 0 ? part : part.slice(0,separator)).toLowerCase()
      const value = decodeURIComponent(separator < 0 ? '' : part.slice(separator+1))
      fields.set(name,[...(fields.get(name) ?? []),value])
    }
  } catch { throw new Error('El enlace de correo contiene texto mal codificado.') }
  const to = recipients([address, ...(fields.get('to') ?? [])].join(','))
  const cc = recipients((fields.get('cc') ?? []).join(',')), bcc = recipients((fields.get('bcc') ?? []).join(','))
  const subject = (fields.get('subject') ?? []).join(' '), body = (fields.get('body') ?? []).join('\n')
  if (!to.length && !cc.length && !bcc.length) throw new Error('Este contacto no tiene un correo informado.')
  if (hasControls(subject)) throw new Error('El asunto del correo contiene caracteres no válidos.')
  return { to, cc, bcc, subject, body }
}
export function composeLink(draft: EmailDraft, provider: EmailProvider) {
  const endpoints = { gmail: 'https://mail.google.com/mail/', outlook: 'https://outlook.office.com/mail/deeplink/compose', 'outlook-personal': 'https://outlook.live.com/mail/deeplink/compose' }
  const url = new URL(endpoints[provider])
  if (provider === 'gmail') { url.searchParams.set('view','cm'); url.searchParams.set('fs','1') }
  for (const key of ['to','cc','bcc'] as const) if (draft[key].length) url.searchParams.set(key,draft[key].join(','))
  const subjectKey = provider === 'gmail' ? 'su' : 'subject'
  if (draft.subject) url.searchParams.set(subjectKey,draft.subject)
  if (draft.body) url.searchParams.set('body',draft.body)
  // Provider/gateway URL limits vary. Never silently truncate an invitation.
  let requiresCopy = false
  if (url.href.length > 7500) { url.searchParams.delete('body'); requiresCopy = true }
  if (url.href.length > 7500) { url.searchParams.delete(subjectKey); requiresCopy = true }
  if (url.href.length > 7500) throw new Error('Hay demasiados destinatarios para abrir el correo web. Copiá los correos para continuar.')
  return { href: url.href, requiresCopy }
}
export function draftMailto(draft: EmailDraft) {
  const query = queryString([['cc',draft.cc.join(',')],['bcc',draft.bcc.join(',')],['subject',draft.subject],['body',draft.body]])
  return `mailto:${draft.to.map(encodeURIComponent).join(',')}${query ? '?' + query : ''}`
}
export function draftText(draft: EmailDraft) {
  return [draft.subject ? `Asunto: ${draft.subject}` : '', draft.body].filter(Boolean).join('\n\n')
}
