import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, ChevronLeft, ChevronRight, Landmark, Plus, Search, SlidersHorizontal, UsersRound } from 'lucide-react'
import { useCatalog } from '../app/useCatalog'
import { Button, FilterSelect, Surface } from '../components/common/UI'
import { DirectoryFilters } from '../components/directory/DirectoryFilters'
import { DirectoryDialog } from '../components/directory/DirectoryDialog'
import { DirectoryPersonCard } from '../components/directory/DirectoryPersonCard'
import { DirectoryProfileModal } from '../components/directory/DirectoryProfileModal'
import { PersonEditor } from '../components/directory/PersonEditor'
import { changeDirectoryFilter, directoryOptions, DIRECTORY_PAGE_SIZE, EMPTY_DIRECTORY_FILTERS, getDirectoryResults, representedDirectorates } from '../components/directory/directoryModel'
import type { DirectoryFilters as Filters, DirectorySort } from '../components/directory/directoryModel'
import type { Person } from '../types'
import '../components/directory/directory.css'

export function DirectoryPage() {
  const { people, items, directorates, isAdmin, savePerson, deletePerson } = useCatalog()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Person | 'new' | null>(null)
  const [actionError, setActionError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_DIRECTORY_FILTERS)
  const [sort, setSort] = useState<DirectorySort>('az')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const options = useMemo(() => directoryOptions(people, filters), [people, filters])
  const filtered = useMemo(() => getDirectoryResults(people, items, filters, query, sort), [people, items, filters, query, sort])
  const selected = people.find(person => person.id === params.get('persona'))
  const pageCount = Math.max(1, Math.ceil(filtered.length / DIRECTORY_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const offset = (currentPage - 1) * DIRECTORY_PAGE_SIZE
  const visible = filtered.slice(offset, offset + DIRECTORY_PAGE_SIZE)
  const firstPage = Math.max(1, Math.min(currentPage - 2, pageCount - 4))
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstPage + index)
  const activeFilters = Object.values(filters).filter(Boolean).length
  const closeProfile = useCallback(() => setParams(previous => { const next = new URLSearchParams(previous); next.delete('persona'); return next }, { replace: true }), [setParams])
  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const closeEditor = useCallback(() => setEditing(null), [])
  const clear = () => { setFilters(EMPTY_DIRECTORY_FILTERS); setQuery(''); setPage(1) }
  const changeFilter = (field: keyof Filters, value: string) => { setFilters(current => changeDirectoryFilter(people, current, field, value)); setPage(1) }
  const openProfile = (id: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set('persona', id); return next })
  const remove = async (person: Person) => {
    if (!isAdmin || !window.confirm(`¿Eliminar el perfil de ${person.name}?`)) return
    setActionError(''); setDeletingId(person.id)
    try { await deletePerson(person.id); if (selected?.id === person.id) closeProfile() }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'No se pudo eliminar el perfil.') }
    finally { setDeletingId(null) }
  }

  return <div className="directory-page">
    <Surface className="directory-page-intro">
      <div className="directory-title-block"><h1>Directorio de la Red</h1><p>Buscá y conectá con integrantes, áreas y conocimientos de la Red de Conexión Gerencial.</p></div>
      <div className="directory-summary">
        <div className="directory-kpis"><div><span><UsersRound size={23} /></span><p>Integrantes<strong>{people.length.toLocaleString('es-AR')}</strong></p></div><div><span><Building2 size={23} /></span><p>Direcciones representadas<strong>{representedDirectorates(people).toLocaleString('es-AR')}</strong></p></div><div><span><Landmark size={23} /></span><p>Ministerios / Áreas<strong>{options.ministries.length}</strong></p></div></div>
        {isAdmin && <Button variant="yellow" onClick={() => setEditing('new')}><Plus size={17} /> Agregar integrante</Button>}
      </div>
    </Surface>
    {actionError && <p className="directory-action-error" role="alert">{actionError}</p>}
    <div className="directory-layout">
      <aside className="surface directory-sidebar" aria-label="Filtros del directorio"><DirectoryFilters filters={filters} options={options} onChange={changeFilter} onClear={clear} /></aside>
      <Surface className="directory-listing">
        <div className="directory-toolbar"><label className="search-input directory-search"><Search size={21} aria-hidden="true" /><input aria-label="Buscar integrantes" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Buscar por nombre, cargo, ministerio o área..." /></label><div className="directory-sort"><label htmlFor="directory-sort">Ordenar por</label><FilterSelect id="directory-sort" value={sort} onChange={event => { setSort(event.target.value as DirectorySort); setPage(1) }} aria-describedby={sort === 'recent' ? 'directory-sort-help' : undefined}><option value="recent">Actividad más reciente</option><option value="az">Nombre A-Z</option><option value="za">Nombre Z-A</option></FilterSelect></div><Button className="directory-open-filters" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={17} /> Filtros{activeFilters > 0 && <span>{activeFilters}</span>}</Button></div>
        {sort === 'recent' && <p id="directory-sort-help" className="directory-sort-help">Según la publicación de newsletters. Sin publicaciones, se ordenan por nombre.</p>}
        <div className="directory-results-count" role="status" aria-live="polite">{filtered.length ? `Mostrando ${offset + 1}–${offset + visible.length} de ${filtered.length.toLocaleString('es-AR')} integrantes` : '0 integrantes'}</div>
        {visible.length ? <div className="directory-people-grid">{visible.map(person => <DirectoryPersonCard key={person.id} person={person} selected={selected?.id === person.id} onSelect={() => openProfile(person.id)} onEdit={isAdmin ? () => { setActionError(''); setEditing(person) } : undefined} onDelete={isAdmin ? () => void remove(person) : undefined} busy={deletingId !== null} />)}</div> : <div className="directory-empty"><span><UsersRound size={30} /></span><h2>No encontramos integrantes con estos filtros.</h2><p>Probá con otra búsqueda o limpiá los filtros para ver a toda la Red.</p><Button onClick={clear}>Limpiar filtros</Button></div>}
        {filtered.length > DIRECTORY_PAGE_SIZE && <nav className="directory-pagination" aria-label="Paginación del directorio"><Button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Página anterior"><ChevronLeft size={17} /><span>Anterior</span></Button><div>{firstPage > 1 && <><button type="button" onClick={() => setPage(1)} aria-label="Página 1">1</button>{firstPage > 2 && <span>…</span>}</>}{pages.map(value => <button type="button" key={value} aria-label={`Página ${value}`} aria-current={value === currentPage ? 'page' : undefined} onClick={() => setPage(value)}>{value}</button>)}{pages[pages.length - 1] < pageCount && <>{pages[pages.length - 1] < pageCount - 1 && <span>…</span>}<button type="button" onClick={() => setPage(pageCount)} aria-label={`Página ${pageCount}`}>{pageCount}</button></>}</div><Button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Página siguiente"><span>Siguiente</span><ChevronRight size={17} /></Button></nav>}
      </Surface>
    </div>
    {selected && <DirectoryProfileModal person={selected} onClose={closeProfile} />}
    {filtersOpen && <DirectoryDialog title="Filtros del directorio" className="directory-filter-drawer" onClose={closeFilters} footer={<Button variant="primary" onClick={closeFilters}>Ver {filtered.length} integrantes</Button>}><DirectoryFilters idPrefix="directory-mobile" filters={filters} options={options} onChange={changeFilter} onClear={clear} /></DirectoryDialog>}
    {editing && isAdmin && <PersonEditor key={editing === 'new' ? 'new' : editing.id} person={editing === 'new' ? undefined : editing} directorates={directorates} onSave={savePerson} onClose={closeEditor} />}
  </div>
}
