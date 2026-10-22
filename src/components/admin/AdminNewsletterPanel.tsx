import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { Archive, Clock3, FilePenLine, RefreshCw, Send } from 'lucide-react'
import { useCatalog } from '../../app/useCatalog'
import { Button, Surface } from '../common/UI'
import { AdminLoadState, AdminPagination } from './AdminPrimitives'
import { useAdminQuery } from './useAdminQuery'
import { getEditorialPage } from '../../services/editorial'
import { EDITORIAL_FILTERS, EDITORIAL_TRAYS } from './editorialModel'
import { EditorialTable } from './EditorialTable'
import { EditorialReviewDialog } from './EditorialReviewDialog'
import { EditorialFilters } from './EditorialFilters'
import type { EditorialAction, EditorialFilters as Filters, EditorialTray } from '../../types/editorial'
import './editorial.css'

export function AdminNewsletterPanel({ navigation }: { navigation?: ReactNode }) {
  const { isAdmin } = useCatalog()
  const [tray, setTray] = useState<EditorialTray>('all')
  const [filters, setFilters] = useState<Filters>({ ...EDITORIAL_FILTERS })
  const [selected, setSelected] = useState<{ id: string; action?: EditorialAction; history?: boolean } | null>(null)
  const load = useCallback(() => getEditorialPage(tray, filters), [tray, filters])
  const query = useAdminQuery(load)
  const close = useCallback(() => setSelected(null), [])
  const selectTray = (next: EditorialTray) => { setTray(next); setFilters({ ...EDITORIAL_FILTERS }); setSelected(null) }
  const changeTray = (next: EditorialTray) => { setTray(next); setFilters(previous => ({ ...previous, status: '', page: 1 })); setSelected(null) }
  const clear = () => selectTray('all')
  const change = (field: keyof Filters, value: string) => setFilters(previous => ({ ...previous, [field]: value, page: 1 }))
  if (!isAdmin) return <Surface className="not-found"><h1>Acceso no autorizado</h1></Surface>
  return <div className="editorial-page">
    <Surface className="administration-intro"><div><h1>Administración</h1><p>Gestioná el contenido de la Red de Conexión Gerencial.</p></div><div className="administration-kpis">
      {([{ id: 'pending', label: 'Pendientes de revisión', icon: Clock3 }, { id: 'changes', label: 'Cambios solicitados', icon: FilePenLine }, { id: 'published', label: 'Publicados', icon: Send }, { id: 'retired', label: 'Ocultos / archivados', icon: Archive }] as const).map(value => <button key={value.id} type="button" onClick={() => selectTray(value.id)}><span><value.icon size={23} /></span><div>{value.label}<strong>{query.data?.counts[value.id] ?? '—'}</strong></div></button>)}
    </div></Surface>
    {navigation}
    <Surface className="administration-inbox editorial-inbox">
      <h2 className="reaction-sr-only">{EDITORIAL_TRAYS.find(value => value.id === tray)?.heading}</h2>
      <EditorialFilters value={filters} tray={tray} data={query.data} onChange={change} onTrayChange={changeTray} onClear={clear} />
      <div className="administration-results-meta"><p role="status">{query.loading ? 'Consultando…' : query.data ? `${query.data.total} ${query.data.total === 1 ? 'newsletter' : 'newsletters'} · ${EDITORIAL_TRAYS.find(value => value.id === tray)?.label}` : 'Consulta no disponible'}</p><Button onClick={query.reload} disabled={query.loading} aria-label="Actualizar bandeja editorial"><RefreshCw size={15} /></Button></div>
      {query.loading || query.error ? <AdminLoadState loading={query.loading} error={query.error} retry={query.reload} loadingTitle="Cargando bandeja editorial…" /> : query.data?.rows.length ? <><EditorialTable rows={query.data.rows} tray={tray} onReview={(id,action,history) => setSelected({ id,action,history })} /><AdminPagination page={filters.page} size={filters.pageSize} total={query.data.total} onPage={page => setFilters(previous => ({ ...previous,page }))} onSize={pageSize => setFilters(previous => ({ ...previous,pageSize,page:1 }))} /></> : <div className="administration-empty"><Archive size={30} /><h3>No hay newsletters en esta vista.</h3><Button onClick={clear}>Limpiar filtros</Button></div>}
    </Surface>
    {selected && <EditorialReviewDialog key={`${selected.id}-${selected.action}-${selected.history}`} id={selected.id} initialAction={selected.action} historyOpen={selected.history} onClose={close} onChanged={query.reload} />}
  </div>
}
