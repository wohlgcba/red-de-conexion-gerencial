import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, History, MessageSquare, PencilLine, XCircle } from 'lucide-react'
import { useCatalog } from '../../app/useCatalog'
import { getEditorialDetail } from '../../services/editorial'
import { useAdminQuery } from './useAdminQuery'
import { AdminLoadState } from './AdminPrimitives'
import { Button, FilterSelect } from '../common/UI'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import { NewsletterArticle } from '../newsletters/NewsletterArticle'
import { StatusBadge } from '../newsletters/NewsletterParts'
import { getNewsletterAuthor } from '../../utils/newsletterAuthor'
import { EDITORIAL_EVENTS, editorialDate, REQUEST_TYPES } from './editorialModel'
import { EditorialDecisionDialog } from './EditorialDecisionDialog'
import type { EditorialAction } from '../../types/editorial'
import { NEWSLETTER_STATUS_LABELS } from '../../utils/newsletterStatus'

export function EditorialReviewDialog({ id, initialAction, historyOpen = false, onClose, onChanged }: {
  id: string; initialAction?: EditorialAction; historyOpen?: boolean; onClose: () => void; onChanged: () => void
}) {
  const { people, refresh } = useCatalog()
  const load = useCallback(() => getEditorialDetail(id), [id])
  const query = useAdminQuery(load)
  const [action, setAction] = useState<EditorialAction | null>(initialAction ?? null)
  const [note, setNote] = useState('')
  const [featured, setFeatured] = useState(false)
  const [revision, setRevision] = useState('')
  const [comparison, setComparison] = useState('')
  const cancel = useCallback(() => setAction(null), [])
  const detail = query.data
  if (detail && action) return <EditorialDecisionDialog detail={detail} action={action} note={note} featured={featured} onClose={cancel}
    onReload={() => { setAction(null); query.reload(); onChanged() }} onSaved={async () => { onChanged(); onClose(); await refresh() }} />
  const selected = detail?.versions.find(version => version.id === revision) ?? detail?.versions.find(version => version.id === detail.workingRevision) ?? detail?.versions[0]
  const before = detail?.versions.find(version => version.id === comparison)
  const pending = !!detail && detail.visibility !== 'hidden' && detail.visibility !== 'archived' && detail.versions.some(version => version.id === detail.workingRevision && version.state === 'pendiente')
  const live = detail?.versions.find(version => version.id === detail.publishedRevision)
  return <DirectoryDialog title="Revisión editorial" className="editorial-review-dialog" onClose={onClose} titleIcon={<History size={22} />} footer={<Button onClick={onClose}>Cerrar</Button>}>
    {!detail || !selected ? <AdminLoadState loading={query.loading} error={query.error} retry={query.reload} loadingTitle="Cargando newsletter…" /> : <>
      <div className="editorial-review-meta"><StatusBadge status={['hidden','archived'].includes(detail.visibility) ? detail.item.status : selected.item.status} /><span>{REQUEST_TYPES[selected.requestType]}</span><span>Versión {selected.number} · {editorialDate(selected.submittedAt ?? selected.createdAt)}</span></div>
      {detail.visibility === 'visible' && live && selected.id !== live.id && <p className="editorial-info">La versión {live.number} sigue publicada mientras se revisa esta propuesta.</p>}
      <div className="editorial-version-selectors"><label>Versión a revisar<FilterSelect value={selected.id} onChange={event => setRevision(event.target.value)}>{detail.versions.map(version => <option key={version.id} value={version.id}>Versión {version.number} · {version.state === 'sustituida' ? 'Anterior' : NEWSLETTER_STATUS_LABELS[version.state]}</option>)}</FilterSelect></label><label>Comparar con<FilterSelect value={comparison} onChange={event => setComparison(event.target.value)}><option value="">Sin comparación</option>{detail.versions.filter(version => version.id !== selected.id).map(version => <option key={version.id} value={version.id}>Versión {version.number} · {version.state === 'sustituida' ? 'Anterior' : NEWSLETTER_STATUS_LABELS[version.state]}</option>)}</FilterSelect></label></div>
      <div className={`editorial-preview${before ? ' comparing' : ''}`}>
        {before && <section><h3>Versión {before.number}</h3><NewsletterArticle item={before.item} author={getNewsletterAuthor(detail.item, people)} /></section>}
        <section><h3>Versión {selected.number}</h3><NewsletterArticle item={selected.item} author={getNewsletterAuthor(detail.item, people)} /></section>
      </div>
      {pending && <><label className="editorial-note">Observaciones del administrador <small>{note.length}/1000</small><textarea rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="Escribí las correcciones o comentarios para el autor." /></label><label className="editorial-feature"><input type="checkbox" checked={featured} onChange={event => setFeatured(event.target.checked)} /> Destacar al publicar</label></>}
      <div className="editorial-review-actions">
        {detail.visibility !== 'hidden' && detail.visibility !== 'archived' && (detail.workingRevision || live) && <Link className="btn btn-outline" to={`/newsletters/editar/${id}?editorial=minor`}><PencilLine size={16} /> Editar errores menores</Link>}
        {pending && selected.id === detail.workingRevision && <><Button onClick={() => setAction('cambios')}><MessageSquare size={16} /> Solicitar correcciones</Button><Button variant="primary" onClick={() => setAction('publicado')}><Check size={16} /> Aprobar y publicar</Button><Button className="administration-danger-outline" onClick={() => setAction('rechazado')}><XCircle size={16} /> Rechazar</Button></>}
      </div>
      <details className="editorial-history" open={historyOpen || undefined}><summary>Historial editorial ({detail.history.length})</summary><p className="editorial-small">Hasta 200 eventos y 100 versiones recientes, más la versión publicada.</p>{detail.history.length ? <ol>{detail.history.map(event => <li key={event.id}><strong>{EDITORIAL_EVENTS[event.action] ?? event.action}</strong><time>{editorialDate(event.at)}</time><small>{event.actor}</small>{event.note && <p>{event.note}</p>}{event.emailState === 'pending_configuration' && <small>Correo pendiente de configuración.</small>}{event.emailState === 'sent' && <small>Correo enviado.</small>}</li>)}</ol> : <p>Sin revisiones registradas desde la activación de este módulo.</p>}</details>
    </>}
  </DirectoryDialog>
}
