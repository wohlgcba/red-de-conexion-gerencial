import { useCallback, useRef, useState } from 'react'
import { Eye, Pencil, Plus, ShieldCheck } from 'lucide-react'
import { useCatalog } from '../../app/useCatalog'
import { Button, Surface } from '../common/UI'
import { Avatar } from '../common/Avatar'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import { DirectoryProfileModal } from '../directory/DirectoryProfileModal'
import { PersonEditor } from '../directory/PersonEditor'
import { AdminFilters } from './AdminFilters'
import { AdminBadge, AdminLoadState, AdminPagination, EligibilityBadge, EvidenceBadge, RiskBadge } from './AdminPrimitives'
import { useAdminQuery } from './useAdminQuery'
import { actOnAdminMember, getAdminMemberIdentity, listAdminMembers } from '../../services/administration'
import { adminDate, EMPTY_ADMIN_FILTERS, REASON_LABELS } from './adminModel'
import type { AdminFilters as Filters, AdminMember, RelatedIdentity } from '../../types/administration'
import type { Person } from '../../types'
import { savePerson as saveAdministrativePerson } from '../../services/catalog'
import { AdminMemberHistory } from './AdminMemberHistory'

type MemberAction = 'activate' | 'deactivate' | 'delete' | 'quality_review'
type PersonSave = Partial<Person> & Pick<Person, 'givenName' | 'familyName' | 'role' | 'ministry' | 'email'>
export function AdminMembers({ quality, initialSearch = '' }: { quality: boolean; initialSearch?: string }) {
  const { directorates, refresh } = useCatalog()
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_ADMIN_FILTERS, sort: 'name', query: initialSearch })
  const load = useCallback(() => listAdminMembers(filters), [filters])
  const query = useAdminQuery(load)
  const [profile, setProfile] = useState<AdminMember | null>(null)
  const [review, setReview] = useState<AdminMember | null>(null)
  const [identifier, setIdentifier] = useState<string | null>(null)
  const [identityError, setIdentityError] = useState('')
  const [identityBusy, setIdentityBusy] = useState(false)
  const [related, setRelated] = useState<RelatedIdentity[]>([])
  const identitySequence = useRef(0)
  const [editing, setEditing] = useState<AdminMember | 'new' | null>(null)
  const [pendingEdit, setPendingEdit] = useState<PersonSave | null>(null)
  const editResult = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null)
  const [confirmation, setConfirmation] = useState<{ person: AdminMember; action: MemberAction } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const closeProfile = useCallback(() => setProfile(null), [])
  const closeReview = useCallback(() => { identitySequence.current++; setReview(null); setIdentifier(null); setIdentityError(''); setRelated([]); setIdentityBusy(false) }, [])
  const closeEdit = useCallback(() => setEditing(null), [])
  const closeConfirm = useCallback(() => { setConfirmation(null); setPendingEdit(null); setError(''); setNote(''); editResult.current?.reject(new Error('La edición no fue confirmada.')); editResult.current = null }, [])
  const change = (field: keyof Filters | 'clear', value?: string | number) => setFilters(previous => field === 'clear' ? { ...EMPTY_ADMIN_FILTERS, sort: 'name' } : { ...previous, [field]: value, page: field === 'page' ? Number(value) : 1 })
  const confirm = async () => {
    if (busy) return
    if (note.trim().length < 10) { setError('Ingresá un motivo de al menos 10 caracteres.'); return }
    setBusy(true); setError('')
    try {
      if (pendingEdit) { await saveAdministrativePerson(pendingEdit, note.trim()); editResult.current?.resolve(); editResult.current = null; setPendingEdit(null) }
      else if (confirmation) await actOnAdminMember(confirmation.person.id, confirmation.person.version ?? 0, confirmation.action, note.trim())
      setConfirmation(null); setReview(null); setNote(''); setMessage('Operación registrada correctamente.'); query.reload(); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos completar la operación.') } finally { setBusy(false) }
  }
  const request = (person: AdminMember, action: MemberAction) => { setReview(null); setConfirmation({ person, action }); setError(''); setNote('') }
  const reveal = async () => {
    if (!review || identityBusy) return
    const request = ++identitySequence.current
    setIdentityBusy(true); setIdentityError('')
    try { const result = await getAdminMemberIdentity(review.id); if (request === identitySequence.current) { setIdentifier(result.identifier || 'No hay un identificador verificado.'); setRelated(result.related) } } catch (cause) { if (request === identitySequence.current) setIdentityError(cause instanceof Error ? cause.message : 'No pudimos consultar la identidad.') } finally { if (request === identitySequence.current) setIdentityBusy(false) }
  }
  return <Surface className="administration-members">
    <div className="administration-section-heading"><div><h2>{quality ? 'Calidad de datos del Directorio' : 'Directorio gerencial'}</h2><p>{quality ? 'Alertas institucionales de todos los integrantes. Ninguna advertencia suspende accesos automáticamente.' : 'Administrá perfiles activos e inactivos. Para consultar cargos actuales, usá Cruce con Dotación.'}</p></div>{!quality && <Button variant="yellow" onClick={() => setEditing('new')}><Plus size={16} /> Agregar integrante</Button>}</div>
    {quality && query.data && <div className="administration-quality-counts">{([{ key: 'high', label: 'Conflictos graves' }, { key: 'medium', label: 'Revisión institucional' }, { key: 'low', label: 'Sin observaciones' }] as const).map(item => <button type="button" key={item.key} onClick={() => change('risk', item.key)}><RiskBadge value={item.key} /><strong>{query.data?.counts[item.key]}</strong>{item.label}</button>)}</div>}
    <AdminFilters members value={filters} onChange={change} ministries={query.data?.ministries ?? []} tray="all" />
    {query.loading || query.error ? <AdminLoadState loading={query.loading} error={query.error} retry={query.reload} /> : <>
      <p className="administration-results-meta" role="status">{query.data?.total ?? 0} integrantes</p>
      <div className="administration-table-scroll"><table className="administration-table"><thead><tr><th>Integrante</th><th>Estado</th><th>Validaci?n en fuente guardada</th><th>Cargo en fuente de referencia</th><th>Calidad</th><th>Acciones</th></tr></thead><tbody>{query.data?.rows.map(person => <tr key={person.id}><td><div className="administration-person"><Avatar name={person.name} size={38} /><span><strong>{person.name}</strong><small>{person.role}</small><small>{person.ministry}</small></span></div></td><td><AdminBadge tone={person.active ? 'good' : 'neutral'}>{person.active ? 'Activo' : 'Inactivo'}</AdminBadge>{person.exceptionActive && <small>Excepción vigente</small>}</td><td><EvidenceBadge value={person.validation.evidence} /></td><td>{person.validation.roles.join(' · ') || 'Sin información verificada'}<br /><EligibilityBadge value={person.validation.eligibility} /></td><td><RiskBadge value={person.validation.risk} />{person.qualityReviewedAt && <small>Revisado {adminDate(person.qualityReviewedAt)}</small>}</td><td><div className="administration-row-actions"><Button onClick={() => { setReview(person); setIdentifier(null); setIdentityError('') }}><Eye size={15} /> Revisar</Button>{!quality && <Button onClick={() => setEditing(person)}><Pencil size={15} /> Editar</Button>}</div></td></tr>)}</tbody></table></div>
      {!query.data?.rows.length && <div className="administration-empty"><ShieldCheck size={30} /><h2>No encontramos integrantes con estos filtros.</h2><Button onClick={() => change('clear')}>Limpiar filtros</Button></div>}
      <AdminPagination page={filters.page} total={query.data?.total ?? 0} size={filters.pageSize} onPage={n => change('page', n)} onSize={n => change('pageSize', n)} />
    </>}
    {message && <p role="status" className="administration-success">{message}</p>}
    {review && !confirmation && <DirectoryDialog title="Revisión del integrante" onClose={closeReview} footer={<><Button onClick={() => { setProfile(review); setReview(null) }}>Ver perfil</Button><Button onClick={() => request(review, 'quality_review')}>Registrar revisión</Button><Button onClick={() => request(review, review.active ? 'deactivate' : 'activate')}>{review.active ? 'Desactivar' : 'Reactivar'}</Button><Button className="administration-danger-outline" onClick={() => request(review, 'delete')}>Eliminar</Button></>}>
      <h3>{review.name}</h3><dl className="administration-member-comparison"><div><dt>Cargo en el Directorio</dt><dd>{review.role}</dd></div><div><dt>Cargo en fuente de referencia</dt><dd>{review.validation.roles.join(' · ') || 'Pendiente de verificación'}</dd></div><div><dt>Fuente y fecha de referencia</dt><dd>{review.validation.source || 'No disponible'} · {review.validation.sourceDate || 'Fecha no informada'}</dd></div></dl>
      <p>{review.email} · {review.ministry}</p><RiskBadge value={review.validation.risk} />{review.validation.reasons.length ? <ul>{review.validation.reasons.map(reason => <li key={reason}>{REASON_LABELS[reason] || reason}</li>)}</ul> : <p>Sin observaciones en los controles disponibles.</p>}
      <p>Información detectada: {review.validation.detectedAt ? adminDate(review.validation.detectedAt) : 'Sin fecha de verificación disponible'}.</p><p>Revisión: {review.qualityReviewedAt ? `Registrada el ${adminDate(review.qualityReviewedAt)}` : 'Pendiente de revisión administrativa'}.</p>
      {review.exceptionActive && <p className="administration-success">Tiene una excepción vigente. Podés consultar y revocar su autorización desde la bandeja Excepciones.</p>}
      <Button disabled={identityBusy} onClick={() => void reveal()}>Consultar CUIL/CUIT protegido</Button>{identifier && <p>CUIL/CUIT: {identifier}</p>}{identityError && <p role="alert">{identityError}</p>}
      {identifier && related.map(item => <div className="administration-related-identity" key={item.id}><strong>{item.name}</strong><p>{item.email} · {item.role} · {item.ministry}</p><p>{item.active ? 'Activo' : 'Inactivo'} · CUIL/CUIT: {item.identifier || 'No verificado'}</p></div>)}
      <p className="administration-disclaimer">Los cambios de cargo generan una advertencia; el acceso se conserva hasta una decisión administrativa explícita.</p>
      <AdminMemberHistory id={review.id} />
    </DirectoryDialog>}
    {profile && <DirectoryProfileModal person={profile} onClose={closeProfile} />}
    {editing && <div style={{ display: pendingEdit ? 'none' : undefined }}><PersonEditor person={editing === 'new' ? undefined : editing} directorates={directorates} onClose={closeEdit} onSave={value => new Promise<void>((resolve, reject) => { editResult.current = { resolve, reject }; setPendingEdit(value); setError(''); setNote('') })} /></div>}
    {(confirmation || pendingEdit) && <DirectoryDialog className="administration-decision" title={pendingEdit ? 'Confirmar edición del integrante' : ({ activate: 'Reactivar integrante', deactivate: 'Desactivar integrante', delete: 'Eliminar integrante', quality_review: 'Registrar revisión de calidad' }[confirmation!.action])} onClose={closeConfirm} busy={busy} closeOnBackdrop={false} footer={<><Button disabled={busy} onClick={closeConfirm}>Cancelar</Button><Button disabled={busy} variant="yellow" className={confirmation?.action === 'delete' || confirmation?.action === 'deactivate' ? 'administration-danger' : ''} onClick={() => void confirm()}>{busy ? 'Guardando…' : 'Confirmar operación'}</Button></>}>
      <h3>{pendingEdit ? `${pendingEdit.givenName} ${pendingEdit.familyName}` : confirmation?.person.name}</h3><p>{confirmation?.action === 'delete' ? 'La eliminación puede ser irreversible. Si existen publicaciones o solicitudes vinculadas, la base impedirá eliminar el perfil; podés desactivarlo.' : confirmation?.action === 'deactivate' ? 'Se suspenderá el acceso de este integrante únicamente a Red de Conexión Gerencial.' : 'Se registrará la operación y se conservará su historial administrativo.'}</p>
      {pendingEdit && <p>Nuevo cargo: {pendingEdit.role} · Organismo: {pendingEdit.ministry} · Correo: {pendingEdit.email}</p>}
      <label>Motivo de la operación<textarea rows={3} maxLength={3000} value={note} onChange={event => setNote(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}
    </DirectoryDialog>}
  </Surface>
}
