import { Eye, History, MessageSquare, MoreHorizontal, Archive, EyeOff, RotateCcw, PencilLine } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Avatar } from '../common/Avatar'
import { Button } from '../common/UI'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import { TopicChip } from '../newsletters/NewsletterParts'
import { AdminBadge } from './AdminPrimitives'
import { NEWSLETTER_STATUS_LABELS } from '../../utils/newsletterStatus'
import type { EditorialAction, EditorialRow, EditorialTray } from '../../types/editorial'
import { editorialDate, REQUEST_TYPES } from './editorialModel'

export function EditorialTable({ rows, tray, onReview }: { rows: EditorialRow[]; tray: EditorialTray; onReview: (id: string, action?: EditorialAction, history?: boolean) => void }) {
  const [menu, setMenu] = useState<EditorialRow | null>(null)
  const close = () => setMenu(null)
  const act = (action?: EditorialAction, history?: boolean) => { if (menu) { const id = menu.item.id; setMenu(null); onReview(id, action, history) } }
  return <><div className="administration-table-scroll"><table className="administration-table editorial-table"><caption className="reaction-sr-only">Administración de newsletters</caption><thead><tr><th>Newsletter</th><th>Temática</th><th>Autor</th><th>Ministerio / Área rectora</th>{tray === 'pending' && <th>Tipo</th>}<th>{tray === 'pending' ? 'Fecha de envío' : 'Última actualización'}</th>{['changes','retired'].includes(tray) && <th>{tray === 'changes' ? 'Última observación' : 'Motivo / Administrador'}</th>}<th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.map(row => <tr key={row.item.id}>
    <td><div className="administration-person editorial-title-cell"><img src={row.item.image} alt="" /><div><strong>{row.item.title}</strong><p>{row.item.subtitle}</p></div></div></td>
    <td><TopicChip topic={row.item.topic} /></td><td><div className="administration-person editorial-author-cell"><Avatar name={row.authorName} size={36} /><div><strong>{row.authorName}</strong><small>{row.authorRole}</small></div></div></td><td><strong>{row.ministry}</strong><small>{row.unit}</small></td>
    {tray === 'pending' && <td>{REQUEST_TYPES[row.requestType] ?? 'Nueva publicación'}</td>}
    <td className="administration-date"><time>{editorialDate(tray === 'pending' ? row.sentAt : row.lastEvent?.at ?? row.item.updatedAt+'T12:00:00')}</time></td>
    {['changes','retired'].includes(tray) && <td>{row.lastEvent?.note || row.item.observation || 'Sin observación registrada'}{tray === 'retired' && <small>{row.lastEvent?.actor || 'Sin registro anterior'}</small>}</td>}
    <td><AdminBadge tone={row.item.status === 'publicado' ? 'good' : ['pendiente','borrador'].includes(row.item.status) ? 'warning' : ['cambios','rechazado'].includes(row.item.status) ? 'danger' : 'neutral'}>{NEWSLETTER_STATUS_LABELS[row.item.status]}</AdminBadge>{row.item.status === 'publicado' && row.workState === 'pendiente' && <small className="editorial-version-flag">Nueva versión pendiente</small>}</td>
    <td><div className="editorial-row-actions">{tray === 'published' ? <Link className="btn btn-primary" to={`/newsletters/${row.item.id}`}><Eye size={15} /> Ver publicación</Link> : <Button className="administration-review-button" variant="primary" onClick={() => onReview(row.item.id)}><Eye size={15} /> {tray === 'pending' ? 'Revisar' : 'Ver detalle'}</Button>}
      <Button aria-label={`Más acciones de ${row.item.title}`} aria-haspopup="dialog" onClick={() => setMenu(row)}><MoreHorizontal size={18} /></Button></div></td>
  </tr>)}</tbody></table></div>
  {menu && <DirectoryDialog title="Acciones del newsletter" onClose={close} className="editorial-row-menu"><h3>{menu.item.title}</h3><div className="editorial-menu-actions"><Button onClick={() => act(undefined,true)}><History size={16} /> Historial y versiones</Button>
    {menu.workState === 'pendiente' && !['oculto','archivado'].includes(menu.item.status) && <Button onClick={() => act('cambios')}><MessageSquare size={16} /> Solicitar cambios</Button>}
    {menu.workState === 'cambios' && <Button onClick={() => act(undefined,true)}><MessageSquare size={16} /> Ver observaciones</Button>}
    {['oculto','archivado'].includes(menu.item.status) ? <Button onClick={() => act('restore')}><RotateCcw size={16} /> Restaurar</Button> : <>{menu.item.status !== 'rechazado' && <Link className="btn btn-outline" to={`/newsletters/editar/${menu.item.id}?editorial=minor`}><PencilLine size={16} /> Editar errores menores</Link>}{menu.item.status === 'publicado' && <Button onClick={() => act('hide')}><EyeOff size={16} /> Ocultar</Button>}<Button onClick={() => act('archive')}><Archive size={16} /> Archivar</Button></>}
  </div></DirectoryDialog>}</>
}
