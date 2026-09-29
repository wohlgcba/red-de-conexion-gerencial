import { useState } from 'react'
import { Download, FileText, LayoutGrid, Landmark, SlidersHorizontal, UsersRound } from 'lucide-react'
import { Button, FilterSelect, PageHeading, SearchInput, Surface } from '../components/common/UI'
import { PersonCard, ProfilePanel } from '../components/directory/PersonParts'
import { getDirectors } from '../services/catalog'
import { norm } from '../utils/format'

export function DirectorsPage() {
  const directors = getDirectors()
  const [selectedId, setSelectedId] = useState<string | null>(directors[0]?.id ?? null)
  const [query, setQuery] = useState('')
  const [ministry, setMinistry] = useState('')
  const [secretariat, setSecretariat] = useState('')
  const [sort, setSort] = useState('default')
  const [showFilters, setShowFilters] = useState(false)
  const ministries = [...new Set(directors.map(person => person.ministry))].sort()
  const secretariats = [...new Set(directors.map(person => person.secretariat))].sort()
  const filtered = directors.filter(person => (!query || norm(`${person.name} ${person.role} ${person.directorate} ${person.ministry} ${person.topics.join(' ')}`).includes(norm(query))) && (!ministry || person.ministry === ministry) && (!secretariat || person.secretariat === secretariat)).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'ministry' ? a.ministry.localeCompare(b.ministry) : 0)
  const exportCsv = () => {
    const lines = [['Nombre', 'Cargo', 'Dirección General', 'Ministerio', 'Secretaría'], ...filtered.map(person => [person.name, person.role, person.directorate, person.ministry, person.secretariat])]
    const csv = lines.map(line => line.map(value => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n')
    const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })); anchor.download = 'directores-generales-mock.csv'; anchor.click(); URL.revokeObjectURL(anchor.href)
  }
  return <div className="page-stack"><Surface className="directory-intro"><PageHeading title="Directorio de Directores Generales" subtitle="Consultá autoridades, áreas a cargo y perfiles clave de la Red Gerencial." actions={<><div className="count-box"><UsersRound size={26} /><strong>{directors.length} directores<br />generales</strong></div><Button onClick={exportCsv}><Download size={20} /> Exportar resumen</Button></>} /><div className="overview-stats"><div><span><UsersRound /></span><p>Directores Generales<strong>{directors.length}</strong></p></div><div><span><Landmark /></span><p>Ministerios representados<strong>{ministries.length}</strong></p></div><div><span><LayoutGrid /></span><p>Direcciones cubiertas<strong>{directors.length}</strong></p></div><div><span><FileText /></span><p>Perfiles publicados<strong>{directors.length}</strong></p></div></div></Surface><div className={`content-with-aside ${selectedId ? '' : 'without-aside'}`}><Surface className="directory-results"><div className="filters-bar"><SearchInput value={query} onChange={setQuery} placeholder="Buscar director/a, dirección general, ministerio o tema..." /><button className="mobile-filter-toggle btn btn-outline" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} /> Filtros</button><div className={`filter-controls ${showFilters ? 'open' : ''}`}><FilterSelect value={ministry} onChange={event => setMinistry(event.target.value)} aria-label="Ministerio"><option value="">Ministerio / Área rectora</option>{ministries.map(value => <option key={value}>{value}</option>)}</FilterSelect><FilterSelect value={secretariat} onChange={event => setSecretariat(event.target.value)} aria-label="Secretaría"><option value="">Secretaría / Subsecretaría</option>{secretariats.map(value => <option key={value}>{value}</option>)}</FilterSelect><FilterSelect value={sort} onChange={event => setSort(event.target.value)} aria-label="Ordenar"><option value="default">Ordenar por</option><option value="name">Nombre</option><option value="ministry">Ministerio</option></FilterSelect><Button onClick={() => { setQuery(''); setMinistry(''); setSecretariat(''); setSort('default') }}><SlidersHorizontal size={16} /> Limpiar filtros</Button></div></div><div className="person-grid">{filtered.map(person => <PersonCard key={person.id} person={person} selected={selectedId === person.id} onSelect={() => setSelectedId(person.id)} />)}</div>{filtered.length === 0 && <div className="empty-results">No encontramos perfiles con esos filtros.</div>}</Surface><ProfilePanel person={directors.find(person => person.id === selectedId)} onClose={() => setSelectedId(null)} /></div></div>
}
