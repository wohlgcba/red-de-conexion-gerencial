import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, MessageSquare, Archive, Trash2, XCircle, Star } from 'lucide-react'
import { useCatalog } from '../app/useCatalog'
import { Button, PageHeading, Surface } from '../components/common/UI'
import { StatusBadge } from '../components/newsletters/NewsletterParts'
import type { NewsletterStatus } from '../types'
import { formatDate } from '../utils/format'

export function AdminPage() {
  const { isAdmin, items, people, reviewNewsletter, deleteNewsletter } = useCatalog()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [featured, setFeatured] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'pendientes' | 'todos'>('pendientes')
  if (!isAdmin) return <Surface className="not-found"><h1>Acceso no autorizado</h1></Surface>
  const rows = items.filter(item => filter === 'todos' || item.status === 'pendiente')
  const selected = items.find(item => item.id === selectedId)
  const choose = (id: string) => { const item = items.find(entry => entry.id === id); setSelectedId(id); setNote(item?.observation ?? ''); setFeatured(item?.featured ?? false); setError('') }
  const review = async (status: NewsletterStatus) => {
    if (!selected) return
    if (['cambios', 'rechazado'].includes(status) && !note.trim()) { setError('Escribí una observación para solicitar cambios o rechazar.'); return }
    setBusy(true); setError('')
    try { await reviewNewsletter(selected.id, status, note.trim(), status === 'publicado' && featured); setSelectedId(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la revisión.') }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!selected || !window.confirm('¿Eliminar definitivamente este newsletter?')) return
    setBusy(true); setError('')
    try { await deleteNewsletter(selected.id); setSelectedId(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar.') }
    finally { setBusy(false) }
  }

  return <div className="page-stack"><Surface className="directory-intro"><PageHeading title="Administración editorial" subtitle="Revisá publicaciones y gestioná el contenido de la Red." actions={<div className="count-box"><MessageSquare size={24} /><strong>{items.filter(item => item.status === 'pendiente').length} pendientes<br />de revisión</strong></div>} /><div className="admin-shortcuts"><Link className="btn btn-outline" to="/directorio">Gestionar directorio</Link><Link className="btn btn-outline" to="/direcciones-generales">Gestionar direcciones</Link></div></Surface><div className={`content-with-aside ${selected ? '' : 'without-aside'}`}><Surface className="directory-results"><div className="admin-filter"><Button onClick={() => setFilter('pendientes')} variant={filter === 'pendientes' ? 'primary' : 'outline'}>Pendientes</Button><Button onClick={() => setFilter('todos')} variant={filter === 'todos' ? 'primary' : 'outline'}>Todos</Button></div><div className="admin-newsletter-list">{rows.map(item => <button key={item.id} className={`admin-newsletter-row ${selectedId === item.id ? 'selected' : ''}`} onClick={() => choose(item.id)}><img src={item.image} alt="" /><span><strong>{item.title}</strong><small>{people.find(person => person.id === item.authorId)?.name ?? 'Autor no disponible'} · {formatDate(item.updatedAt)}</small></span><StatusBadge status={item.status} /></button>)}{rows.length === 0 && <div className="empty-results">No hay newsletters en esta bandeja.</div>}</div></Surface>{selected && <aside className="surface newsletter-panel"><div className="panel-heading"><h2>Revisión del newsletter</h2><button onClick={() => setSelectedId(null)} aria-label="Cerrar"><XCircle size={20} /></button></div><img className="admin-cover" src={selected.image} alt="Portada" /><StatusBadge status={selected.status} /><h3>{selected.title}</h3><p>{selected.subtitle}</p><Link className="btn btn-outline wide-btn" to={`/newsletters/${selected.id}`}>Leer completo</Link><label className="admin-note">Observaciones<textarea value={note} onChange={event => setNote(event.target.value)} rows={4} placeholder="Motivo de los cambios o del rechazo" /></label><label className="admin-featured"><input type="checkbox" checked={featured} onChange={event => setFeatured(event.target.checked)} /><Star size={16} /> Destacar al publicar</label>{error && <p className="form-error" role="alert">{error}</p>}<div className="admin-review-actions"><Button variant="primary" disabled={busy} onClick={() => void review('publicado')}><Check size={16} /> Publicar</Button><Button disabled={busy} onClick={() => void review('cambios')}><MessageSquare size={16} /> Pedir cambios</Button><Button disabled={busy} onClick={() => void review('rechazado')}><XCircle size={16} /> Rechazar</Button><Button disabled={busy} onClick={() => void review('archivado')}><Archive size={16} /> Archivar</Button><Button disabled={busy} onClick={() => void remove()}><Trash2 size={16} /> Eliminar</Button></div></aside>}</div></div>
}
