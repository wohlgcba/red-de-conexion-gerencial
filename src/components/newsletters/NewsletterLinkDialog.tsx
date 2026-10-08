import { useRef, useState } from 'react'
import { Link2, Unlink } from 'lucide-react'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import { Button } from '../common/UI'
import { normalizeNewsletterLink } from '../../utils/newsletterContent'

export type LinkDraft = { from: number; to: number; text: string; href: string }

export function NewsletterLinkDialog({ draft, onClose, onApply, onRemove }: {
  draft: LinkDraft; onClose: () => void; onApply: (href: string, text: string) => boolean; onRemove: () => void
}) {
  const [text, setText] = useState(draft.text)
  const [url, setUrl] = useState(draft.href)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const apply = () => {
    const href = normalizeNewsletterLink(url)
    if (!href) { setError('Ingresá una dirección web válida (https://…) o un correo con mailto:.'); input.current?.focus(); return }
    const label = text.trim() || href
    if (!onApply(href, label)) { setError('El enlace supera el límite de contenido. Acortá el texto o la dirección.'); return }
    onClose()
  }
  return <DirectoryDialog title={draft.href ? 'Editar enlace' : 'Insertar enlace'} titleIcon={<Link2 size={20} />} className="newsletter-link-dialog" onClose={onClose} initialFocusRef={input}
    footer={<>{draft.href && <Button className="remove-link" onClick={onRemove}><Unlink size={16} /> Quitar enlace</Button>}<Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={apply}>Guardar enlace</Button></>}>
    <form className="newsletter-link-form" onSubmit={event => { event.preventDefault(); apply() }}>
      <label>Texto del enlace<input value={text} maxLength={5000} onChange={event => setText(event.target.value)} placeholder="Por ejemplo: Conocé el proyecto" /></label>
      <label>Dirección del enlace<input ref={input} value={url} maxLength={2048} onChange={event => { setUrl(event.target.value); setError('') }} placeholder="https://ejemplo.com" autoComplete="url" inputMode="url" aria-invalid={Boolean(error)} aria-describedby="newsletter-link-hint" /></label>
      <p id="newsletter-link-hint">El enlace se abrirá en una pestaña nueva al leer el newsletter.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" hidden tabIndex={-1}>Guardar enlace</button>
    </form>
  </DirectoryDialog>
}
