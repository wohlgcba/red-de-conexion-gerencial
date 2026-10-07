import { useEffect, useId, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function DirectoryDialog({ title, children, footer, className = '', onClose, titleIcon, busy = false, closeOnBackdrop = true, initialFocusRef, describedBy }: {
  title: string; children: ReactNode; footer?: ReactNode; className?: string; onClose: () => void
  titleIcon?: ReactNode; busy?: boolean; closeOnBackdrop?: boolean; initialFocusRef?: RefObject<HTMLElement | null>; describedBy?: string
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const processing = useRef(busy)
  useEffect(() => {
    processing.current = busy
    if (busy) dialog.current?.focus()
  }, [busy])
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const app = document.getElementById('root')
    const wasInert = app?.inert ?? false
    const previousOverflow = document.body.style.overflow
    if (app) app.inert = true
    document.body.style.overflow = 'hidden'
    const panel = dialog.current
    const entries = () => Array.from(panel?.querySelectorAll<HTMLElement>(':is(button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary)') ?? [])
    ;(initialFocusRef?.current ?? entries()[0] ?? panel)?.focus()
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!processing.current) onClose(); return }
      if (event.key !== 'Tab') return
      const items = entries()
      const first = items[0]
      const last = items[items.length - 1]
      if (!first) { event.preventDefault(); panel?.focus() }
      else if (!panel?.contains(document.activeElement) || document.activeElement === panel) { event.preventDefault(); (event.shiftKey ? last : first)?.focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    const containFocus = (event: FocusEvent) => {
      if (!panel?.contains(event.target as Node)) (entries()[0] ?? panel)?.focus()
    }
    document.addEventListener('keydown', handleKeys)
    document.addEventListener('focusin', containFocus)
    return () => {
      document.removeEventListener('keydown', handleKeys)
      document.removeEventListener('focusin', containFocus)
      if (app) app.inert = wasInert
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [onClose, initialFocusRef])

  return createPortal(<div className={`directory-modal-backdrop ${className}`} onClick={event => { if (closeOnBackdrop && !busy && event.target === event.currentTarget) onClose() }}>
    <div ref={dialog} className="directory-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={describedBy} aria-busy={busy || undefined} tabIndex={-1}>
      <div className="directory-modal-heading"><h2 id={titleId}>{titleIcon}{title}</h2><button type="button" disabled={busy} aria-label={`Cerrar ${title.toLowerCase()}`} onClick={onClose}><X size={21} /></button></div>
      <div className="directory-modal-body">{children}</div>
      {footer && <div className="directory-modal-footer">{footer}</div>}
    </div>
  </div>, document.body)
}
