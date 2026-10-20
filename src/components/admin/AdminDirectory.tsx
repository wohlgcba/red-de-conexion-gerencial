import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { Building2, Clock3, FilePenLine, Info, RefreshCw, ShieldCheck, TriangleAlert, UserRoundPlus, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Surface } from '../common/UI'
import { AdminFilters } from './AdminFilters'
import { AdminLoadState, AdminPagination } from './AdminPrimitives'
import { AdminRequestTable } from './AdminRequestTable'
import { AdminRequestDetail } from './AdminRequestDetail'
import { AdminMembers } from './AdminMembers'
import { AdminDotacion } from './AdminDotacion'
import { EMPTY_ADMIN_FILTERS, TRAYS } from './adminModel'
import { useAdminQuery } from './useAdminQuery'
import { listAdminRequests } from '../../services/administration'
import type { AdminFilters as Filters, AdminTray } from '../../types/administration'

export function AdminDirectory({ navigation }: { navigation?: ReactNode }) {
  const [view, setView] = useState<'requests' | 'members' | 'quality'>('requests')
  const [memberSearch, setMemberSearch] = useState('')
  const [tray, setTray] = useState<AdminTray>('access')
  const [filtersByTray, setFiltersByTray] = useState<Record<AdminTray, Filters>>(() => Object.fromEntries(TRAYS.map(item => [item.id, { ...EMPTY_ADMIN_FILTERS, status: item.id === 'all' ? '' : 'open' }])) as Record<AdminTray, Filters>)
  const [selection, setSelection] = useState<Partial<Record<AdminTray, string>>>({})
  const [revision, setRevision] = useState(0)
  const [toast, setToast] = useState('')
  const filters = filtersByTray[tray]
  const load = useCallback(() => listAdminRequests(tray, filters), [tray, filters])
  const query = useAdminQuery(load)
  const closeDetail = useCallback(() => setSelection(previous => ({ ...previous, [tray]: undefined })), [tray])
  const change = (field: keyof Filters | 'clear', value?: string | number) => setFiltersByTray(previous => ({ ...previous, [tray]: field === 'clear' ? { ...EMPTY_ADMIN_FILTERS } : { ...previous[tray], [field]: value, page: field === 'page' ? Number(value) : 1 } }))
  const showCount = (target: AdminTray) => { setTray(target); setView('requests'); setFiltersByTray(previous => ({ ...previous, [target]: { ...EMPTY_ADMIN_FILTERS, status: 'open' } })) }
  const selected = selection[tray] || null
  return <div className="administration-directory">
    <Surface className="administration-intro"><div><h1>Administración del Directorio</h1><p>Revisá solicitudes de acceso, excepciones y cambios vinculados al Directorio de la Red.</p></div><div className="administration-kpis">
      {([{ id: 'access', label: 'Pendientes de acceso', icon: UserRoundPlus }, { id: 'exceptions', label: 'Excepciones pendientes', icon: TriangleAlert }, { id: 'change', label: 'Cambios de datos', icon: FilePenLine }, { id: 'all', label: 'Total en revisión', icon: Clock3 }] as const).map(item => <button key={item.id} type="button" onClick={() => showCount(item.id)} aria-label={`${item.label}: ${query.data?.counts[item.id] ?? 'sin datos'}`}><span><item.icon size={23} /></span><div>{item.label}<strong>{query.data ? query.data.counts[item.id] : '—'}</strong></div></button>)}
    </div></Surface>
    {navigation}
    <div className="administration-tools" aria-label="Herramientas del Directorio"><Button variant={view === 'requests' ? 'primary' : 'outline'} onClick={() => setView('requests')}><FilePenLine size={16} /> Solicitudes</Button><Button variant={view === 'members' ? 'primary' : 'outline'} onClick={() => { setMemberSearch(''); setView('members') }}><UsersRound size={16} /> Directorio gerencial</Button><Button variant={view === 'quality' ? 'primary' : 'outline'} onClick={() => setView('quality')}><ShieldCheck size={16} /> Cruce con Dotación</Button><Link className="btn btn-outline" to="/administracion/direcciones-generales"><Building2 size={16} /> Gestionar unidades vinculadas</Link></div>
    {view === 'quality' ? <AdminDotacion onReview={name => { setMemberSearch(name); setView('members') }} /> : view === 'members' ? <AdminMembers key={memberSearch} quality={false} initialSearch={memberSearch} /> : <>
      <div className="administration-workspace">
        <Surface className="administration-inbox"><div className="administration-trays" role="tablist" aria-label="Bandejas del Directorio" onKeyDown={event => { const current = TRAYS.findIndex(item => item.id === tray); const index = event.key === 'ArrowRight' ? (current + 1) % TRAYS.length : event.key === 'ArrowLeft' ? (current + TRAYS.length - 1) % TRAYS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TRAYS.length - 1 : -1; if (index >= 0) { event.preventDefault(); setTray(TRAYS[index].id); document.getElementById(`admin-tab-${TRAYS[index].id}`)?.focus() } }}>{TRAYS.map(item => <button key={item.id} type="button" role="tab" tabIndex={tray === item.id ? 0 : -1} id={`admin-tab-${item.id}`} aria-controls="admin-inbox" aria-selected={tray === item.id} onClick={() => setTray(item.id)}>{item.label}</button>)}</div>
          <div id="admin-inbox" role="tabpanel" aria-labelledby={`admin-tab-${tray}`}><AdminFilters value={filters} onChange={change} ministries={query.data?.ministries ?? []} tray={tray} />
          <div className="administration-results-meta"><p role="status">{query.loading ? 'Consultando…' : query.data ? `${query.data.total} ${query.data.total === 1 ? 'solicitud' : 'solicitudes'} · ${TRAYS.find(item => item.id === tray)?.label}` : 'Consulta no disponible'}</p><Button onClick={query.reload} disabled={query.loading} aria-label="Actualizar bandeja"><RefreshCw size={15} /></Button></div>
          {query.loading || query.error ? <AdminLoadState loading={query.loading} error={query.error} retry={query.reload} /> : query.data && query.data.rows.length ? <><AdminRequestTable rows={query.data.rows} tray={tray} selected={selected} disabled={query.loading} onSelect={id => setSelection(previous => ({ ...previous, [tray]: id }))} /><AdminPagination page={filters.page} total={query.data.total} size={filters.pageSize} onPage={n => change('page', n)} onSize={n => change('pageSize', n)} /></> : <div className="administration-empty"><ShieldCheck size={32} /><h2>{query.data?.total ? 'Esta página no contiene registros.' : 'No hay solicitudes en esta bandeja.'}</h2><p>No encontramos registros con los filtros seleccionados. Las nuevas solicitudes de ingreso y los cambios institucionales aparecerán aquí.</p><Button onClick={() => change('clear')}>Limpiar filtros</Button></div>}
          </div>
        </Surface>
        {selected && <AdminRequestDetail key={selected} id={selected} revision={revision} onClose={closeDetail} onChanged={saved => { query.reload(); setRevision(n => n + 1); if (saved) setToast('Decisión registrada correctamente.') }} />}
      </div>
      <p className="administration-source-note"><Info size={17} /><span>{query.data?.sourceNotice || 'Las solicitudes y validaciones se consultan mediante funciones administrativas protegidas.'}</span></p>
    </>}
    {toast && <div className="toast" role="status">{toast}<button type="button" aria-label="Cerrar mensaje" onClick={() => setToast('')}>×</button></div>}
  </div>
}
