import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AtSign, Building2, Check, Copy, ExternalLink, Laptop, Mail, X } from 'lucide-react'
import { composeLink, draftMailto, draftText, parseMailto } from '../../utils/emailCompose'
import type { EmailDraft, EmailProvider } from '../../utils/emailCompose'
import './email-composer.css'

type Session = { id: number; anchor: HTMLAnchorElement; draft: EmailDraft | null; error: string; host: HTMLElement }
const PROVIDERS: { id: EmailProvider; name: string; hint: string; Icon: typeof Mail }[] = [
  { id: 'gmail', name: 'Gmail', hint: 'Cuenta de Google', Icon: Mail },
  { id: 'outlook', name: 'Outlook', hint: 'Trabajo o institución', Icon: Building2 },
  { id: 'outlook-personal', name: 'Outlook.com', hint: 'Cuenta personal', Icon: AtSign },
]

// Covers buttons and sanitized article HTML, including body-portaled dialogs.
// It only opens composers; it never sends messages or selects a sender account.
export function EmailComposer() {
  const [session, setSession] = useState<Session | null>(null)
  const sequence = useRef(0)
  useEffect(() => {
    const clicked = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.closest('[contenteditable="true"]') || anchor.dataset.mailSystem === 'true' || !/^mailto:/i.test(anchor.getAttribute('href') ?? '')) return
      event.preventDefault()
      let draft: EmailDraft | null = null, error = ''
      try { draft = parseMailto(anchor.href) } catch (cause) { error = cause instanceof Error ? cause.message : 'El enlace de correo no es válido.' }
      const host = anchor.closest<HTMLElement>('.directory-modal, .organization-explorer-shell') ?? document.body
      setSession({ id: ++sequence.current, anchor, draft, error, host })
    }
    document.addEventListener('click',clicked)
    return () => document.removeEventListener('click',clicked)
  }, [])
  const close = useCallback(() => setSession(null), [])
  return session && createPortal(<ComposerPicker key={session.id} session={session} onClose={close} />, session.host)
}

function ComposerPicker({ session, onClose }: { session: Session; onClose: () => void }) {
  const id = useId(), panel = useRef<HTMLDivElement>(null), manualCopy = useRef<HTMLTextAreaElement>(null)
  const focused = useRef(false)
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const [message, setMessage] = useState(''), [copying, setCopying] = useState(false), [manualText, setManualText] = useState<string | null>(null)
  const { draft, anchor } = session
  const close = useCallback((restore = true) => { onClose(); if (restore && anchor.isConnected) anchor.focus({ preventScroll: true }) }, [onClose,anchor])
  useLayoutEffect(() => {
    const element = panel.current
    if (!element) return
    let native = typeof element.showPopover === 'function'
    if (native) { try { element.showPopover() } catch { native = false } }
    if (!native) element.removeAttribute('popover')
    const measure = () => {
      if (!anchor.isConnected) { close(false); return }
      const rect = anchor.getBoundingClientRect(), width = Math.min(336,window.innerWidth-24)
      const height = Math.min(element.scrollHeight || 460,window.innerHeight-24)
      const top = rect.bottom + 8 + height <= window.innerHeight-12 ? rect.bottom+8 : Math.max(12,Math.min(rect.top-height-8,window.innerHeight-height-12))
      setPosition(previous => {
        const next = { width, top, left: Math.max(12,Math.min(rect.left,window.innerWidth-width-12)), maxHeight: window.innerHeight-24 }
        return previous && Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next
      })
    }
    const toggled = (event: Event) => { if ((event as ToggleEvent).newState === 'closed') close(false) }
    const outside = (event: PointerEvent) => { if (!element.contains(event.target as Node) && !anchor.contains(event.target as Node)) close(false) }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); event.stopPropagation(); close() } }
    measure()
    element.addEventListener('toggle',toggled); document.addEventListener('keydown',key,true)
    if (!native) document.addEventListener('pointerdown',outside)
    const observer = new ResizeObserver(measure); observer.observe(element)
    window.addEventListener('resize',measure); window.addEventListener('scroll',measure,true)
    return () => {
      element.removeEventListener('toggle',toggled); document.removeEventListener('keydown',key,true)
      document.removeEventListener('pointerdown',outside); observer.disconnect()
      window.removeEventListener('resize',measure); window.removeEventListener('scroll',measure,true)
      if (native && element.matches(':popover-open')) element.hidePopover()
    }
  }, [anchor,close])
  useLayoutEffect(() => {
    if (position && !focused.current) {
      focused.current = true
      ;(panel.current?.querySelector<HTMLElement>('.email-composer-providers a') ?? panel.current?.querySelector('button'))?.focus({ preventScroll: true })
    }
  }, [position])
  useEffect(() => { if (manualText !== null) { manualCopy.current?.focus(); manualCopy.current?.select() } }, [manualText])
  const copy = async (text: string, label: string) => {
    if (copying) return
    setCopying(true); setMessage('')
    try { await navigator.clipboard.writeText(text); setMessage(label); setManualText(null) }
    catch { setManualText(text); setMessage('No pudimos copiar. Seleccioná el texto y copialo manualmente.') }
    finally { setCopying(false) }
  }
  const links = draft ? PROVIDERS.map(provider => {
    try { return { ...provider, ...composeLink(draft,provider.id) } } catch { return null }
  }).filter(link => link !== null) : []
  return <div ref={panel} id={id} className="email-composer" popover="auto" role="group" aria-labelledby={`${id}-title`} style={{ ...position, visibility: position ? 'visible' : 'hidden' }}>
    <div className="email-composer-heading"><strong id={`${id}-title`}>Abrir correo en</strong><button type="button" aria-label="Cerrar opciones de correo" onClick={() => close()}><X size={18} /></button></div>
    {draft ? <>
      <p className="email-composer-recipient">{[...draft.to,...draft.cc,...draft.bcc].join(', ')}</p>
      <div className="email-composer-providers">{links.map(({ id,name,hint,Icon,href }) => <a key={id} href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Abrir en ${name}`}><Icon size={21} aria-hidden="true" /><span><strong>{name}</strong><small>{hint}</small></span><ExternalLink size={15} aria-hidden="true" /></a>)}</div>
      {links.some(link => link.requiresCopy) && <p className="email-composer-note">El mensaje es largo. Copialo y pegalo después de abrir el correo.</p>}
      {!links.length && <p className="email-composer-note">No pudimos preparar el enlace web. Copiá los correos para continuar.</p>}
      <div className="email-composer-copy"><button type="button" disabled={copying} onClick={() => void copy([...draft.to,...draft.cc,...draft.bcc].join(', '),'Correo copiado.')}><Copy size={15} /> Copiar correo</button>{draftText(draft) && <button type="button" disabled={copying} onClick={() => void copy(draftText(draft),'Mensaje copiado.')}><Copy size={15} /> Copiar mensaje</button>}</div>
      <a className="email-composer-system" data-mail-system="true" href={draftMailto(draft)}><Laptop size={16} /> Usar aplicación del equipo</a>
      <p className="email-composer-note">Se abre un borrador para que lo revises y lo envíes.</p>
    </> : <p role="alert" className="email-composer-note">{session.error}</p>}
    {message && <p className="email-composer-feedback" role="status">{manualText === null && <Check size={14} />}{message}</p>}
    {manualText !== null && <textarea ref={manualCopy} className="email-composer-manual" aria-label="Texto para copiar manualmente" readOnly rows={4} value={manualText} />}
  </div>
}
