import { useCallback } from 'react'
import { Eye, PencilLine, Send } from 'lucide-react'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import { Button } from '../common/UI'
import { NewsletterArticle } from './NewsletterArticle'
import type { Newsletter } from '../../types'
import type { getNewsletterAuthor } from '../../utils/newsletterAuthor'
import './newsletter-preview.css'

export default function NewsletterPreviewDialog({ item, author, isAdmin, busy, error, onClose, onSave }: {
  item: Newsletter; author: ReturnType<typeof getNewsletterAuthor>; isAdmin: boolean; busy: boolean; error: string
  onClose: () => void; onSave: (status: 'borrador' | 'pendiente' | 'publicado') => void
}) {
  const close = useCallback(() => { if (!busy) onClose() }, [busy, onClose])
  return <DirectoryDialog title="Vista previa del newsletter" titleIcon={<Eye size={22} />} onClose={close} busy={busy} className="newsletter-preview-dialog" footer={<>
    <Button disabled={busy} onClick={close}>Volver a editar</Button>
    <Button disabled={busy} onClick={() => onSave('borrador')}><PencilLine size={18} /> Guardar borrador</Button>
    <Button variant="primary" disabled={busy} onClick={() => onSave(isAdmin ? 'publicado' : 'pendiente')}><Send size={18} /> {isAdmin ? 'Publicar newsletter' : 'Enviar a revisión'}</Button>
  </>}>
    <p className="newsletter-preview-notice">Así se verá tu publicación. Revisá la portada, los datos y el contenido antes de terminar.</p>
    <NewsletterArticle item={item} author={author} />
    {error && <p className="form-error" role="alert">{error}</p>}
  </DirectoryDialog>
}
