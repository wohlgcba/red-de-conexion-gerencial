import { useRef, useState } from 'react'
import { Button } from '../common/UI'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import { decideEditorial } from '../../services/editorial'
import { EDITORIAL_ACTIONS } from './editorialModel'
import type { EditorialAction, EditorialDetail } from '../../types/editorial'

export function EditorialDecisionDialog({ detail, action, note: initialNote, featured, onClose, onSaved, onReload }: {
  detail: EditorialDetail; action: EditorialAction; note: string; featured: boolean; onClose: () => void; onSaved: () => Promise<void>; onReload: () => void
}) {
  const [note, setNote] = useState(initialNote)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const required = action !== 'publicado'
  const confirm = async () => {
    if (lock.current) return
    if (required && note.trim().length < 10) { setError('Escribí una observación de al menos 10 caracteres.'); return }
    lock.current = true; setBusy(true); setError('')
    try { await decideEditorial(detail, action, note, featured); await onSaved() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la decisión.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <DirectoryDialog title={EDITORIAL_ACTIONS[action]} className="editorial-decision" busy={busy} closeOnBackdrop={false} onClose={onClose}
    footer={<><Button disabled={busy} onClick={onClose}>Cancelar</Button><Button variant={action === 'publicado' ? 'primary' : 'yellow'} disabled={busy} onClick={() => void confirm()}>{busy ? 'Guardando…' : 'Confirmar'}</Button></>}>
    <h3>{detail.item.title}</h3><p>{action === 'publicado' ? 'Esta versión quedará visible en la Red.' : action === 'cambios' ? 'El autor recibirá tus observaciones para corregir y reenviar.' : action === 'rechazado' ? 'Esta versión será rechazada. Si existe una publicación anterior, seguirá visible.' : action === 'restore' ? 'Se recuperará la visibilidad anterior. Una versión pendiente seguirá necesitando aprobación.' : 'La publicación dejará de circular y podrá restaurarse.'}</p>
    <label>Observación {required ? '(obligatoria)' : '(opcional)'}<textarea rows={4} maxLength={1000} value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
    {['cambios','rechazado','hide'].includes(action) && <p className="editorial-mail-note">Se generará una notificación interna. El correo quedará pendiente: falta configurar el servicio de envío editorial.</p>}
    {error && <div role="alert" className="form-error"><p>{error}</p><Button disabled={busy} onClick={onReload}>Actualizar revisión</Button></div>}
  </DirectoryDialog>
}
