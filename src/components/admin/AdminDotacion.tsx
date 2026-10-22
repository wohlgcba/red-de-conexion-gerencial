import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, Database, Eye, Info, RefreshCw, Search, SearchX, ShieldCheck, UserRoundPlus } from 'lucide-react'
import { useCatalog } from '../../app/useCatalog'
import { Avatar } from '../common/Avatar'
import { Button, FilterSelect, Surface } from '../common/UI'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import { DirectoryProfileModal } from '../directory/DirectoryProfileModal'
import { AdminBadge, AdminLoadState, AdminPagination } from './AdminPrimitives'
import { useAdminQuery } from './useAdminQuery'
import { AdminCandidateContacts } from './AdminCandidateContacts'
import { AdminOrganizationAuthorities } from './AdminOrganizationAuthorities'
import { getDotacionComparison, refreshDotacionSnapshot } from '../../services/dotacion'
import type { DotacionComparison, DotacionFilters, DotacionStatus, InstitutionalAssignment } from '../../types/dotacion'
import './dotacion.css'

const EMPTY: DotacionFilters = { query: '', status: '', membership: '', ministry: '', exceptionsOnly: false, page: 1, pageSize: 25 }
const STATUS: Record<DotacionStatus, { label: string; tone: 'good' | 'warning' | 'danger' | 'neutral' | 'blue' }> = {
  unchanged: { label: 'Sin cambios', tone: 'good' }, changed: { label: 'Cambio de cargo o área', tone: 'warning' },
  other_role: { label: 'Otro puesto', tone: 'warning' }, missing: { label: 'No encontrado en Dotación', tone: 'danger' },
  pending: { label: 'Pendiente de verificar', tone: 'neutral' }, candidate: { label: 'Candidato a incorporar', tone: 'blue' },
}
function Status({ value }: { value: DotacionStatus }) { return <AdminBadge tone={STATUS[value].tone}>{STATUS[value].label}</AdminBadge> }
function Assignment({ value, detailed = false }: { value: InstitutionalAssignment; detailed?: boolean }) {
  return <div className="dotacion-assignment"><strong>{value.role || 'Cargo no informado'}</strong><span>{value.ministry || 'Organismo no informado'}</span>{detailed ? <dl>
    <div><dt>Secretaría / Subsecretaría</dt><dd>{value.secretariat || 'No informada en esta fuente'}</dd></div>
    <div><dt>Dirección General</dt><dd>{value.directorate || 'No informada en esta fuente'}</dd></div>
    <div><dt>Gerencia / Subgerencia</dt><dd>{value.management || 'No informada en esta fuente'}</dd></div>
    {value.unit && <div><dt>Repartición</dt><dd>{value.unit}</dd></div>}
  </dl> : <small>{value.unit || value.directorate || value.secretariat}</small>}</div>
}

export function AdminDotacion({ onReview }: { onReview: (name: string) => void }) {
  const [view, setView] = useState<'directory' | 'authorities'>('directory')
  return <><div className="authority-view-switch" aria-label="Consultas de Dotación"><Button aria-pressed={view === 'directory'} variant={view === 'directory' ? 'primary' : 'outline'} onClick={() => setView('directory')}>Directorio y candidatos</Button><Button aria-pressed={view === 'authorities'} variant={view === 'authorities' ? 'primary' : 'outline'} onClick={() => setView('authorities')}>Autoridades del Organigrama</Button></div>{view === 'authorities' ? <AdminOrganizationAuthorities /> : <DotacionComparison onReview={onReview} />}</>
}

function DotacionComparison({ onReview }: { onReview: (name: string) => void }) {
  const [filters, setFilters] = useState<DotacionFilters>(EMPTY)
  const controller = useRef<AbortController | null>(null)
  const load = useCallback(() => {
    controller.current?.abort()
    controller.current = new AbortController()
    return getDotacionComparison(filters, controller.current.signal)
  }, [filters])
  useEffect(() => () => controller.current?.abort(), [])
  const query = useAdminQuery(load)
  const { people } = useCatalog()
  const [selected, setSelected] = useState<DotacionComparison | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const close = useCallback(() => setSelected(null), [])
  const closeProfile = useCallback(() => setProfileId(null), [])
  const profile = people.find(person => person.id === profileId)
  const change = <K extends keyof DotacionFilters>(key: K, value: DotacionFilters[K]) => { setSelected(null); setFilters(previous => ({ ...previous, [key]: value, page: key === 'page' ? Number(value) : 1 })) }
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const refreshLock = useRef(false)
  const refresh = async () => {
    if (refreshLock.current) return
    refreshLock.current = true; setRefreshing(true); setRefreshError(''); setSelected(null)
    try { await refreshDotacionSnapshot(); query.reload() }
    catch (cause) { setRefreshError(cause instanceof Error ? cause.message : 'No pudimos confirmar la actualización. Revisá la fecha del padrón.'); query.reload() }
    finally { refreshLock.current = false; setRefreshing(false) }
  }
  const data = query.data
  return <Surface className="administration-members dotacion-online">
    <div className="administration-section-heading"><div><h2>Cruce con Dotación</h2><p>Integrantes de la Red y cargos gerenciales sin coincidencia en el Directorio. La consulta no modifica perfiles ni accesos.</p></div><Button onClick={() => void refresh()} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'dotacion-refreshing' : ''} /> {refreshing ? 'Actualizando padrón…' : 'Actualizar desde Dotación'}</Button></div>
    <p className="dotacion-source"><Database size={16} /> {query.loading ? 'Consultando el padrón guardado…' : data ? `${data.source} · ${data.sourceUpdatedAt ? 'actualizado ' + new Date(data.sourceUpdatedAt).toLocaleString('es-AR') : 'fecha no disponible'}` : 'Padrón guardado no disponible'}</p>
    {refreshError && <p role="alert" className="administration-warning">{refreshError}</p>}
    {refreshing && <p role="status">Leyendo únicamente gerentes, subgerentes y coincidencias del Directorio. Podés seguir consultando el padrón anterior.</p>}
    <div className="dotacion-summary" aria-label="Resumen del cruce">{([
      { key: 'directory', label: 'Integrantes del Directorio', icon: ShieldCheck, action: () => setFilters({ ...EMPTY, membership: 'directory' }) },
      { key: 'changed', label: 'Cambios de cargo o área', icon: ArrowRightLeft, action: () => setFilters({ ...EMPTY, status: 'changed' }) },
      { key: 'missing', label: 'No encontrados', icon: SearchX, action: () => setFilters({ ...EMPTY, status: 'missing' }) },
      { key: 'candidate', label: 'Candidatos a incorporar', icon: UserRoundPlus, action: () => setFilters({ ...EMPTY, membership: 'candidate' }) },
    ] as const).map(item => <button key={item.key} type="button" disabled={!data || query.loading} onClick={() => { setSelected(null); item.action() }}><span><item.icon size={21} /></span><div>{item.label}<strong>{data && !query.error ? data.counts[item.key] : '—'}</strong></div></button>)}</div>
    <div className="administration-filters dotacion-filters">
      <label className="search-input"><Search size={19} aria-hidden="true" /><input aria-label="Buscar en el cruce online" maxLength={150} value={filters.query} onChange={event => change('query', event.target.value)} placeholder="Buscar nombre, cargo o dependencia…" /></label>
      <label className="administration-filter">Pertenencia<FilterSelect aria-label="Pertenencia" value={filters.membership} onChange={event => change('membership', event.target.value as DotacionFilters['membership'])}><option value="">Todos</option><option value="directory">Directorio gerencial</option><option value="candidate">Candidatos a incorporar</option></FilterSelect></label>
      <label className="administration-filter">Resultado<FilterSelect aria-label="Resultado del cruce" value={filters.status} onChange={event => change('status', event.target.value)}><option value="">Todos los resultados</option>{Object.entries(STATUS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</FilterSelect></label>
      <label className="administration-filter">Organismo / Área rectora<FilterSelect aria-label="Organismo del cruce" value={filters.ministry} onChange={event => change('ministry', event.target.value)}><option value="">Todos los organismos</option>{data?.ministries.map(value => <option key={value}>{value}</option>)}</FilterSelect></label>
      <label className="dotacion-exception-filter"><input type="checkbox" checked={filters.exceptionsOnly} onChange={event => change('exceptionsOnly', event.target.checked)} /> Solo excepciones vigentes</label>
      <Button onClick={() => { setSelected(null); setFilters({ ...EMPTY }) }}>Limpiar filtros</Button>
    </div>
    {query.loading || query.error ? <AdminLoadState loading={query.loading} error={query.error} retry={query.reload} loadingTitle="Consultando Directorio y padrón guardado…" errorTitle="No pudimos consultar el padr?n guardado" /> : data && <>
      {data.warnings.map(warning => <p className="administration-warning" key={warning}><Info size={15} /> {warning}</p>)}
      <div className="administration-results-meta"><p role="status">{data.total} resultados · {data.counts.other_role} con otros puestos · {data.counts.exceptions} excepciones vigentes</p></div>
      {data.rows.length ? <div className="administration-table-scroll" tabIndex={0} role="region" aria-label="Comparación del Directorio con Dotación"><table className="administration-table dotacion-table"><thead><tr><th>Persona / Pertenencia</th><th>Registrado en el Directorio</th><th>Actual en Dotación</th><th>Resultado</th><th>Acciones</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.id} className={row.personId ? '' : 'dotacion-candidate'}>
        <td><div className="administration-person"><Avatar name={row.name} size={38} /><span><strong>{row.name}</strong><small>{row.personId ? `Integrante ${row.active ? 'activo' : 'inactivo'}` : row.membershipPending ? 'Pertenencia por confirmar' : 'Sin registro en el Directorio'}</small></span></div></td>
        <td>{row.directory ? <Assignment value={row.directory} /> : <span className="dotacion-muted">Sin perfil en el Directorio</span>}</td>
        <td>{row.current.length ? <><Assignment value={row.current[0]} />{row.current.length > 1 && <small>+{row.current.length - 1} asignaciones · Ver detalle</small>}</> : <span className="dotacion-muted">{row.status === 'missing' ? 'Sin coincidencia en la fuente consultada' : 'Requiere verificación'}</span>}</td>
        <td><Status value={row.status} />{row.changes.length > 0 && <small>{row.changes.join(' · ')}</small>}{row.exceptionActive && <div className="dotacion-exception"><AdminBadge tone="good">Excepción vigente</AdminBadge></div>}</td>
        <td><Button onClick={() => setSelected(row)}><Eye size={15} /> Ver detalle</Button></td>
      </tr>)}</tbody></table></div> : <div className="administration-empty"><SearchX size={30} /><h2>No encontramos resultados con estos filtros.</h2><Button onClick={() => setFilters({ ...EMPTY })}>Limpiar filtros</Button></div>}
      <AdminPagination page={data.page} total={data.total} size={data.pageSize} onPage={page => change('page', page)} onSize={size => change('pageSize', size)} />
    </>}
    <p className="administration-source-note"><Info size={17} /><span>Se guarda únicamente el padrón gerencial y las coincidencias necesarias del Directorio, con contactos reservados para administración. Abrir esta vista no consulta MySQL. La fecha indica la última lectura; usá «Actualizar desde Dotación» para renovarla. Una excepción vigente se conserva aunque cambie el cargo. Las aprobaciones mantienen su revisión administrativa.</span></p>
    {selected && <DirectoryDialog title="Detalle del cruce" onClose={close} footer={<><Button onClick={close}>Cerrar</Button>{selected.personId && <Button variant="primary" onClick={() => { close(); onReview(selected.name) }}>Revisión administrativa</Button>}{selected.personId && people.some(person => person.id === selected.personId) && <Button onClick={() => { setProfileId(selected.personId); close() }}>Ver perfil</Button>}</>}>
      <div className="dotacion-detail-heading"><Avatar name={selected.name} size={48} /><div><h2>{selected.name}</h2><Status value={selected.status} /></div></div>
      {selected.note && <p className="administration-warning">{selected.note}</p>}
      {selected.exceptionActive && <section className="administration-detail-section"><h3>Excepción vigente</h3><p>{selected.exceptionJustification || 'Aprobación administrativa registrada. Consultá la revisión del integrante para ver su historial.'}</p></section>}
      <div className="dotacion-detail-columns"><section><h3>Registrado en el Directorio</h3>{selected.directory ? <Assignment value={selected.directory} detailed /> : <p>Sin perfil registrado. La candidatura no crea una cuenta ni habilita acceso.</p>}</section><section><h3>Actual en Dotación</h3>{selected.current.length ? selected.current.map((item, index) => <div className="dotacion-detail-assignment" key={index}><h4>Asignación {index + 1}</h4><Assignment value={item} detailed /></div>) : <p>{selected.status === 'missing' ? 'La última lectura no encontró coincidencias para el identificador verificado. Revisá la fecha del padrón guardado.' : 'No hay información suficiente para realizar una vinculación confiable.'}</p>}</section></div>
      {selected.status === 'candidate' && !selected.personId && <AdminCandidateContacts key={selected.id} id={selected.id} name={selected.name} />}
      <p className="administration-disclaimer">Consulta de solo lectura. Ninguna diferencia modifica automáticamente datos, excepciones ni permisos.</p>
    </DirectoryDialog>}
    {profile && <DirectoryProfileModal person={profile} onClose={closeProfile} />}
  </Surface>
}
