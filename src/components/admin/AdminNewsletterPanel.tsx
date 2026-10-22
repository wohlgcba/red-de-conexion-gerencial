import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { Archive, Clock3, FilePenLine, RotateCcw, Search, Send } from 'lucide-react'
import { useCatalog } from '../../app/useCatalog'
import { Button, FilterSelect, Surface } from '../common/UI'
import { AdminLoadState, AdminPagination } from './AdminPrimitives'
import { useAdminQuery } from './useAdminQuery'
import { getEditorialPage } from '../../services/editorial'
import { EDITORIAL_FILTERS, EDITORIAL_TRAYS } from './editorialModel'
import { EditorialTable } from './EditorialTable'
import { EditorialReviewDialog } from './EditorialReviewDialog'
import type { EditorialAction, EditorialFilters, EditorialTray } from '../../types/editorial'
import './editorial.css'
import { NEWSLETTER_STATUS_LABELS } from '../../utils/newsletterStatus'

export function AdminNewsletterPanel({ navigation }: { navigation?: ReactNode }) {
  const { isAdmin } = useCatalog()
  const [tray, setTray] = useState<EditorialTray>('pending')
  const [filters, setFilters] = useState<EditorialFilters>({ ...EDITORIAL_FILTERS })
  const [selected, setSelected] = useState<{ id: string; action?: EditorialAction; history?: boolean } | null>(null)
  const load = useCallback(() => getEditorialPage(tray, filters), [tray, filters])
  const query = useAdminQuery(load)
  const close = useCallback(() => setSelected(null), [])
  const selectTray = (next: EditorialTray) => { setTray(next); setFilters({ ...EDITORIAL_FILTERS }); setSelected(null) }
  const change = (field: keyof EditorialFilters, value: string) => setFilters(previous => ({ ...previous, [field]: value, page: 1 }))
  const options = (field: 'topic' | 'ministry' | 'author' | 'status' | 'sort', label: string, values: { id: string; name: string }[], empty?: string) => <label className="editorial-filter" key={field}>{label}<FilterSelect aria-label={label} value={filters[field]} onChange={event => change(field,event.target.value)}>{empty && <option value="">{empty}</option>}{values.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</FilterSelect></label>
  const asOptions = (values: string[]) => values.filter(Boolean).map(value => ({ id: value, name: value }))
  if (!isAdmin) return <Surface className="not-found"><h1>Acceso no autorizado</h1></Surface>
  return <div className="editorial-page">
    <Surface className="administration-intro"><div><h1>Administración</h1><p>Gestioná el contenido de la Red de Conexión Gerencial.</p></div><div className="administration-kpis">
      {([{ id: 'pending', label: 'Pendientes de revisión', icon: Clock3 }, { id: 'changes', label: 'Cambios solicitados', icon: FilePenLine }, { id: 'published', label: 'Publicados', icon: Send }, { id: 'retired', label: 'Ocultos / archivados', icon: Archive }] as const).map(value => <button key={value.id} type="button" onClick={() => selectTray(value.id)}><span><value.icon size={23} /></span><div>{value.label}<strong>{query.data?.counts[value.id] ?? '—'}</strong></div></button>)}
    </div></Surface>
    {navigation}
    <section className="surface editorial-tabs" role="tablist" aria-label="Bandejas editoriales" onKeyDown={event => { const index = EDITORIAL_TRAYS.findIndex(value => value.id === tray); const next = event.key === 'ArrowRight' ? (index+1)%5 : event.key === 'ArrowLeft' ? (index+4)%5 : event.key === 'Home' ? 0 : event.key === 'End' ? 4 : -1; if (next >= 0) { event.preventDefault(); selectTray(EDITORIAL_TRAYS[next].id); document.getElementById(`editorial-tab-${EDITORIAL_TRAYS[next].id}`)?.focus() } }}>
      {EDITORIAL_TRAYS.map(value => <button type="button" role="tab" id={`editorial-tab-${value.id}`} aria-controls="editorial-inbox" aria-selected={tray === value.id} tabIndex={tray === value.id ? 0 : -1} key={value.id} onClick={() => selectTray(value.id)}>{value.label}</button>)}
    </section>
    <section className="surface editorial-inbox" role="tabpanel" id="editorial-inbox" aria-labelledby={`editorial-tab-${tray}`}>
      <h2>{EDITORIAL_TRAYS.find(value => value.id === tray)?.heading}</h2><p className="editorial-inbox-description">{tray === 'pending' ? 'Revisá el contenido antes de su publicación.' : tray === 'changes' ? 'Esperando las correcciones y el reenvío del autor.' : tray === 'retired' ? 'Contenido retirado de circulación que podés restaurar.' : tray === 'published' ? 'Publicaciones visibles para la Red.' : 'Seguimiento de todas las publicaciones y propuestas.'}</p>
      <div className="editorial-filters"><label className="search-input"><Search size={18} /><input aria-label="Buscar newsletters en Administración" value={filters.query} maxLength={150} onChange={event => change('query',event.target.value)} placeholder="Buscar por título, autor, organismo o contenido…" /></label>
        {tray === 'all' && options('status','Estado editorial',Object.entries(NEWSLETTER_STATUS_LABELS).map(([id,name]) => ({ id,name })),'Todos los estados')}
        {options('topic','Temática',asOptions(query.data?.topics ?? []),'Todas las temáticas')}
        {options('ministry','Ministerio / Área rectora',asOptions(query.data?.ministries ?? []),'Todos los organismos')}
        {options('author','Autor',query.data?.authors ?? [],'Todos los autores')}
        {options('sort','Ordenar por',[{ id:'newest', name:'Más recientes' },{ id:'oldest', name:'Más antiguas' },{ id:'title', name:'Título A–Z' }])}
        <Button onClick={() => setFilters({ ...EDITORIAL_FILTERS })} aria-label="Limpiar filtros editoriales"><RotateCcw size={16} /></Button>
      </div>
      <p role="status" className="editorial-results">{query.loading ? 'Consultando publicaciones…' : query.data ? `${query.data.total} ${query.data.total === 1 ? 'newsletter' : 'newsletters'}` : 'Consulta no disponible'}</p>
      {query.loading || query.error ? <AdminLoadState loading={query.loading} error={query.error} retry={query.reload} loadingTitle="Cargando bandeja editorial…" /> : query.data?.rows.length ? <><EditorialTable rows={query.data.rows} tray={tray} onReview={(id,action,history) => setSelected({ id,action,history })} /><AdminPagination page={filters.page} size={filters.pageSize} total={query.data.total} onPage={page => setFilters(previous => ({ ...previous,page }))} onSize={pageSize => setFilters(previous => ({ ...previous,pageSize,page:1 }))} /></> : <div className="administration-empty"><Archive size={30} /><h3>No hay newsletters en esta vista.</h3><Button onClick={() => setFilters({ ...EDITORIAL_FILTERS })}>Limpiar filtros</Button></div>}
    </section>
    {selected && <EditorialReviewDialog key={`${selected.id}-${selected.action}-${selected.history}`} id={selected.id} initialAction={selected.action} historyOpen={selected.history} onClose={close} onChanged={query.reload} />}
  </div>
}
