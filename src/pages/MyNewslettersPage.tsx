import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, CalendarDays, Check, Clock3, Copy, Eye, FileText, Mail, MessageSquare, PencilLine, Search, Send, Trash2, X } from 'lucide-react'
import { useCatalog } from '../app/useCatalog'
import { Avatar } from '../components/common/Avatar'
import { Button, PageHeading, SearchInput, Surface } from '../components/common/UI'
import { StatusBadge, TopicChip } from '../components/newsletters/NewsletterParts'
import { formatDate, norm } from '../utils/format'
import type { NewsletterStatus } from '../types'

type Tab = 'todos' | NewsletterStatus
const tabs: [Tab, string][] = [['todos', 'Todos'], ['borrador', 'Borradores'], ['pendiente', 'Pendientes'], ['publicado', 'Publicados'], ['cambios', 'Cambios'], ['archivado', 'Archivados'], ['rechazado', 'Rechazados']]

export function MyNewslettersPage() {
  const { items, people, currentPersonId, updateStatus, duplicate, deleteNewsletter } = useCatalog()
  const navigate = useNavigate()
  const mine = items.filter(item => item.authorId === currentPersonId)
  const [tab, setTab] = useState<Tab>('todos')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(mine[0]?.id ?? null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = mine.find(item => item.id === selectedId)
  const author = people.find(person => person.id === currentPersonId)
  const counts = { borrador: mine.filter(item => item.status === 'borrador').length, pendiente: mine.filter(item => item.status === 'pendiente').length, publicado: mine.filter(item => item.status === 'publicado').length, cambios: mine.filter(item => item.status === 'cambios').length, archivado: mine.filter(item => item.status === 'archivado').length, rechazado: mine.filter(item => item.status === 'rechazado').length }
  const filtered = mine.filter(item => (tab === 'todos' || item.status === tab) && (!query || norm(`${item.title} ${item.topic} ${item.subtitle}`).includes(norm(query))))
  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true); setNotice('')
    try { await action(); setNotice(success) }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : 'No se pudo completar la acción.') }
    finally { setBusy(false) }
  }
  const send = (id: string) => void run(() => updateStatus(id, 'pendiente'), 'El newsletter se envió a revisión.')
  const copy = (id: string) => void run(async () => { const newId = await duplicate(id); setSelectedId(newId); setTab('todos') }, 'Se creó una copia en borradores.')
  const remove = (id: string) => { if (window.confirm('¿Eliminar este borrador?')) void run(async () => { await deleteNewsletter(id); setSelectedId(null) }, 'Borrador eliminado.') }

  return <div className="page-stack"><Surface className="my-intro"><PageHeading title="Mis newsletters" subtitle="Gestioná tus borradores, publicaciones y envíos a revisión." actions={<><div className="count-box"><Mail size={25} /><strong>{mine.length}<small>newsletters totales</small></strong></div><Link className="btn btn-yellow" to="/newsletters/nuevo"><PencilLine size={18} /> Crear mi newsletter</Link></>} /><div className="status-stats">{([['borrador', 'Borradores', FileText], ['pendiente', 'Pendientes', Clock3], ['publicado', 'Publicados', Check], ['cambios', 'Cambios solicitados', MessageSquare], ['archivado', 'Archivados', Archive]] as const).map(([status, label, Icon]) => <div className={`stat-card stat-${status}`} key={status}><span><Icon size={23} /></span><div>{label}<strong>{counts[status]}</strong></div></div>)}</div></Surface><div className={`content-with-aside my-layout ${selected ? '' : 'without-aside'}`}><Surface className="my-list"><div className="my-list-head"><div className="tabs" role="tablist">{tabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label} ({key === 'todos' ? mine.length : counts[key]})</button>)}</div><SearchInput value={query} onChange={setQuery} placeholder="Buscar newsletters..." /></div><div className="newsletter-table"><div className="table-head"><span>Newsletter</span><span>Temática</span><span>Última actualización</span><span>Estado</span><span>Acciones</span></div>{filtered.map(item => <div key={item.id} className={`table-row ${selectedId === item.id ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}><div className="table-newsletter"><img src={item.image} alt="" /><span><strong>{item.title}</strong><small>{item.subtitle}</small></span></div><div><TopicChip topic={item.topic} /></div><div className="table-date">{formatDate(item.updatedAt)}<small>por {author?.name}</small></div><div><StatusBadge status={item.status} /></div><div className="table-actions" onClick={event => event.stopPropagation()}>{item.status === 'borrador' || item.status === 'cambios' ? <><Link className="btn btn-outline" to={`/newsletters/editar/${item.id}`}><PencilLine size={16} /> Editar</Link><Button disabled={busy} onClick={() => send(item.id)}><Send size={15} /> Enviar</Button></> : <Link className="btn btn-outline" to={`/newsletters/${item.id}`}><Eye size={16} /> Ver</Link>}<Button disabled={busy} onClick={() => copy(item.id)}><Copy size={15} /> Duplicar</Button>{item.status === 'borrador' && <Button disabled={busy} onClick={() => remove(item.id)}><Trash2 size={15} /> Eliminar</Button>}</div></div>)}{filtered.length === 0 && <div className="empty-results">No hay newsletters en esta vista.</div>}</div></Surface>{selected && <aside className="surface my-detail"><div className="panel-heading"><h2>Detalle del newsletter</h2><button aria-label="Cerrar detalle" onClick={() => setSelectedId(null)}><X size={20} /></button></div><div className="my-detail-hero"><img src={selected.image} alt="" /><div><StatusBadge status={selected.status} /><h3>{selected.title}</h3><p>{selected.subtitle}</p></div></div><div className="my-detail-line"><Avatar name={author?.name} size={32} /><span><strong>{author?.name}</strong>{author?.role}<br />{author?.ministry}</span></div><div className="my-detail-line"><CalendarDays size={20} /><span><strong>Última actualización</strong>{formatDate(selected.updatedAt)}</span></div><div className="my-detail-line"><FileText size={20} /><span><strong>Resumen</strong>{selected.summary}</span></div><div className="my-detail-note">{selected.status === 'cambios' || selected.status === 'rechazado' ? selected.observation ?? 'Revisá las observaciones del equipo editorial.' : selected.status === 'borrador' ? 'Este newsletter aún no fue enviado. Podés seguir editándolo.' : `Estado actual: ${selected.status}.`}</div><div className="my-detail-buttons"><Button variant="primary" onClick={() => navigate(selected.status === 'borrador' || selected.status === 'cambios' ? `/newsletters/editar/${selected.id}` : `/newsletters/${selected.id}`)}>{selected.status === 'borrador' || selected.status === 'cambios' ? <PencilLine size={18} /> : <Eye size={18} />}{selected.status === 'borrador' || selected.status === 'cambios' ? 'Editar newsletter' : 'Ver newsletter'}</Button>{(selected.status === 'borrador' || selected.status === 'cambios') && <Button disabled={busy} onClick={() => send(selected.id)}><Send size={17} /> Enviar a revisión</Button>}</div></aside>}</div>{notice && <div className="toast" role="status"><Search size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Cerrar aviso">×</button></div>}</div>
}
