import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Building2, Landmark, LayoutGrid, PencilLine, Plus, SlidersHorizontal, Trash2, UsersRound, X } from 'lucide-react'
import { useCatalog } from '../app/useCatalog'
import { Avatar } from '../components/common/Avatar'
import { Button, Chip, FilterSelect, PageHeading, SearchInput, Surface } from '../components/common/UI'
import { DirectorateEditor } from '../components/directory/DirectorateEditor'
import type { Directorate } from '../types'
import { norm } from '../utils/format'

export function DirectoratesPage() {
  const { directorates, people, isAdmin, saveDirectorate, deleteDirectorate } = useCatalog()
  const [params] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(params.get('direccion') ?? directorates[0]?.id ?? null)
  const [editing, setEditing] = useState<Directorate | 'new' | null>(null)
  const [actionError, setActionError] = useState('')
  const [query, setQuery] = useState('')
  const [ministry, setMinistry] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const ministries = [...new Set(directorates.map(item => item.ministry))].sort()
  const filtered = directorates.filter(item => (!ministry || item.ministry === ministry) && (!query || norm(`${item.name} ${item.ministry} ${item.secretariat} ${item.topics.join(' ')}`).includes(norm(query))))
  const selected = directorates.find(item => item.id === selectedId)
  const remove = async () => {
    if (!selected || !window.confirm(`¿Eliminar ${selected.name}? Los perfiles vinculados conservarán su texto de origen.`)) return
    setActionError('')
    try { await deleteDirectorate(selected.id); setSelectedId(null) }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'No se pudo eliminar la dirección.') }
  }

  return <div className="page-stack"><Surface className="directory-intro"><PageHeading title="Direcciones Generales" subtitle="Explorá las áreas, sus equipos y los temas de trabajo de la Red Gerencial." actions={<><div className="count-box"><Building2 size={27} /><strong>{directorates.length} direcciones<br />generales</strong></div>{isAdmin && <Button variant="yellow" onClick={() => setEditing('new')}><Plus size={17} /> Agregar dirección</Button>}</>} /><div className="overview-stats three"><div><span><Building2 /></span><p>Direcciones Generales<strong>{directorates.length}</strong></p></div><div><span><Landmark /></span><p>Ministerios representados<strong>{ministries.length}</strong></p></div><div><span><UsersRound /></span><p>Integrantes vinculados<strong>{directorates.reduce((sum, item) => sum + item.members, 0)}</strong></p></div></div></Surface><div className={`content-with-aside ${selected ? '' : 'without-aside'}`}><Surface className="directory-results"><div className="filters-bar"><SearchInput value={query} onChange={setQuery} placeholder="Buscar dirección general, ministerio o tema..." /><button className="mobile-filter-toggle btn btn-outline" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} /> Filtros</button><div className={`filter-controls ${showFilters ? 'open' : ''}`}><FilterSelect value={ministry} onChange={event => setMinistry(event.target.value)} aria-label="Ministerio"><option value="">Ministerio / Área rectora</option>{ministries.map(value => <option key={value}>{value}</option>)}</FilterSelect><Button onClick={() => { setQuery(''); setMinistry('') }}><SlidersHorizontal size={16} /> Limpiar filtros</Button></div></div><div className="directorate-grid">{filtered.map(item => <article className={`directorate-card ${selectedId === item.id ? 'selected' : ''}`} key={item.id}><span className="directorate-icon"><Building2 size={25} /></span><h3>{item.name}</h3><p>{item.ministry}</p><small>{item.secretariat}</small><div className="directorate-topics">{item.topics.map(topic => <Chip key={topic}>{topic}</Chip>)}</div><div className="directorate-card-bottom"><span><UsersRound size={17} /> {item.members} integrantes</span><Button onClick={() => setSelectedId(item.id)}>Ver dirección <ArrowRight size={15} /></Button></div></article>)}</div>{filtered.length === 0 && <div className="empty-results">No encontramos direcciones con esos filtros.</div>}</Surface>{selected && <aside className="surface directorate-panel"><div className="panel-heading"><h2>Detalle de la dirección</h2><button onClick={() => setSelectedId(null)} aria-label="Cerrar detalle"><X size={20} /></button></div><span className="directorate-panel-icon"><LayoutGrid size={30} /></span><h3>{selected.name}</h3>{selected.summary && <p className="directorate-panel-summary">{selected.summary}</p>}<div className="directorate-panel-info"><strong>Ministerio / Área rectora</strong>{selected.ministry}<strong>Secretaría / Subsecretaría</strong>{selected.secretariat || 'Sin especificar'}<strong>Integrantes vinculados</strong>{selected.members} personas</div>{selected.topics.length > 0 && <div className="profile-section"><strong>Temas de trabajo</strong><div className="profile-tags">{selected.topics.map(topic => <Chip key={topic}>{topic}</Chip>)}</div></div>}<div className="profile-section"><strong>Integrantes vinculados</strong>{selected.featuredPersonIds.map(id => { const person = people.find(value => value.id === id); return person && <Link className="directorate-member" key={id} to={`/directorio?persona=${id}`}><Avatar name={person.name} photoUrl={person.photoUrl} size={43} /><span>{person.name}<small>{person.role}</small></span><ArrowRight size={16} /></Link> })}</div>{isAdmin && <div className="admin-panel-actions"><Button onClick={() => setEditing(selected)}><PencilLine size={16} /> Editar</Button><Button onClick={() => void remove()}><Trash2 size={16} /> Eliminar</Button></div>}</aside>}</div>{actionError && <p className="form-error" role="alert">{actionError}</p>}{editing && <DirectorateEditor key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? undefined : editing} onSave={saveDirectorate} onClose={() => setEditing(null)} />}</div>
}
