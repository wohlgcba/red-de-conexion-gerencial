import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, PencilLine, Plus, SlidersHorizontal, Trash2, UsersRound } from 'lucide-react'
import { useCatalog } from '../app/useCatalog'
import { Button, FilterSelect, PageHeading, SearchInput, Surface } from '../components/common/UI'
import { PersonCard, ProfilePanel } from '../components/directory/PersonParts'
import { PersonEditor } from '../components/directory/PersonEditor'
import type { Person } from '../types'
import { norm } from '../utils/format'

export function DirectoryPage() {
  const { people, directorates, isAdmin, savePerson, deletePerson } = useCatalog()
  const [params] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(params.get('persona') ?? people[0]?.id ?? null)
  const [editing, setEditing] = useState<Person | 'new' | null>(null)
  const [actionError, setActionError] = useState('')
  const [query, setQuery] = useState('')
  const [ministry, setMinistry] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const ministries = [...new Set(people.map(person => person.ministry))].sort()
  const selected = people.find(person => person.id === selectedId)
  const filtered = people.filter(person => (!ministry || person.ministry === ministry) && (!query || norm(`${person.name} ${person.role} ${person.ministry} ${person.directorate} ${person.topics.join(' ')}`).includes(norm(query))))
  const remove = async () => {
    if (!selected || !window.confirm(`¿Eliminar el perfil de ${selected.name}?`)) return
    setActionError('')
    try { await deletePerson(selected.id); setSelectedId(null) }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'No se pudo eliminar el perfil.') }
  }

  return <div className="page-stack"><Surface className="directory-intro"><PageHeading title="Directorio de la Red" subtitle="Encontrá integrantes, áreas y conocimientos para conectar equipos de gestión." actions={<><div className="count-box"><UsersRound size={27} /><strong>{people.length} integrantes<br />en la Red</strong></div>{isAdmin && <Button variant="yellow" onClick={() => setEditing('new')}><Plus size={17} /> Agregar integrante</Button>}</>} /><div className="overview-stats three"><div><span><UsersRound /></span><p>Integrantes<strong>{people.length}</strong></p></div><div><span><Building2 /></span><p>Direcciones representadas<strong>{directorates.length}</strong></p></div><div><span><Building2 /></span><p>Ministerios / Áreas<strong>{ministries.length}</strong></p></div></div></Surface><div className={`content-with-aside ${selected ? '' : 'without-aside'}`}><Surface className="directory-results"><div className="filters-bar"><SearchInput value={query} onChange={setQuery} placeholder="Buscar por nombre, cargo, ministerio o tema..." /><button className="mobile-filter-toggle btn btn-outline" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} /> Filtros</button><div className={`filter-controls ${showFilters ? 'open' : ''}`}><FilterSelect value={ministry} onChange={event => setMinistry(event.target.value)} aria-label="Filtrar por ministerio"><option value="">Ministerio / Área rectora</option>{ministries.map(value => <option key={value}>{value}</option>)}</FilterSelect><Button onClick={() => { setQuery(''); setMinistry('') }}><SlidersHorizontal size={16} /> Limpiar filtros</Button></div></div><div className="person-grid">{filtered.map(person => <PersonCard key={person.id} person={person} selected={selectedId === person.id} onSelect={() => setSelectedId(person.id)} compact />)}</div>{filtered.length === 0 && <div className="empty-results">No encontramos personas con esos filtros.</div>}</Surface>{selected && <div className="profile-panel-wrap"><ProfilePanel person={selected} onClose={() => setSelectedId(null)} />{isAdmin && <div className="admin-panel-actions"><Button onClick={() => setEditing(selected)}><PencilLine size={16} /> Editar</Button><Button onClick={() => void remove()}><Trash2 size={16} /> Eliminar</Button></div>}</div>}</div>{actionError && <p className="form-error" role="alert">{actionError}</p>}{editing && <PersonEditor key={editing === 'new' ? 'new' : editing.id} person={editing === 'new' ? undefined : editing} directorates={directorates} onSave={savePerson} onClose={() => setEditing(null)} />}</div>
}
