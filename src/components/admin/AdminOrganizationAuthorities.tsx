import { useCallback, useRef, useState } from 'react'
import { Eye, RefreshCw, Search } from 'lucide-react'
import { Button, FilterSelect, Surface } from '../common/UI'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import { AdminBadge, AdminLoadState, AdminPagination } from './AdminPrimitives'
import { useAdminQuery } from './useAdminQuery'
import { getAuthorityReviews, reviewAuthority } from '../../services/organizationAuthorities'
import type { AuthorityFilters, AuthorityReviewUnit } from '../../services/organizationAuthorities'
import type { AuthorityStatus } from '../../types/organization'
import { AUTHORITY_LABELS } from '../../utils/organizationAuthority'
import './organization-authorities.css'

const EMPTY: AuthorityFilters = { query: '', state: 'pending', page: 1, size: 25 }
function State({ value }: { value: AuthorityStatus }) { return <AdminBadge tone={value === 'automatic' || value === 'manual' ? 'good' : value === 'pending' ? 'warning' : 'neutral'}>{AUTHORITY_LABELS[value]}</AdminBadge> }

export function AdminOrganizationAuthorities() {
  const [filters, setFilters] = useState(EMPTY)
  const load = useCallback(async () => ({ ...await getAuthorityReviews(filters), requestKey: JSON.stringify(filters) }), [filters])
  const query = useAdminQuery(load)
  const loading = query.loading || !!query.data && query.data.requestKey !== JSON.stringify(filters)
  const [selected, setSelected] = useState<AuthorityReviewUnit | null>(null)
  const close = useCallback(() => setSelected(null), [])
  const change = (patch: Partial<AuthorityFilters>) => setFilters(f => ({ ...f, ...patch, page: patch.page ?? 1 }))
  return <Surface className="administration-members authority-panel">
    <div className="administration-section-heading"><div><h2>Autoridades del Organigrama</h2><p>Revisá titularidad, fuentes y cambios de denominación.</p></div><Button onClick={query.reload} disabled={loading}><RefreshCw size={16} /> Actualizar</Button></div>
    <div className="administration-filters authority-filters">
      <label className="search-input"><Search size={18} /><input aria-label="Buscar dependencia u organismo" maxLength={150} placeholder="Buscar dependencia u organismo…" value={filters.query} onChange={e => change({ query: e.target.value })} /></label>
      <label className="administration-filter">Identificación<FilterSelect value={filters.state} aria-label="Estado de identificación" onChange={e => change({ state: e.target.value })}><option value="">Todos</option>{Object.entries(AUTHORITY_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}<option value="renamed">Cambios de denominación</option></FilterSelect></label>
      <Button onClick={() => setFilters(EMPTY)}>Limpiar filtros</Button>
    </div>
    {loading || query.error ? <AdminLoadState loading={loading} error={query.error} retry={query.reload} loadingTitle="Consultando autoridades…" errorTitle="No pudimos consultar las autoridades" /> : query.data && <>
      <p className="administration-results-meta" role="status">{query.data.total} dependencias · {query.data.counts.automatic ?? 0} identificadas automáticamente · {query.data.counts.manual ?? 0} confirmadas manualmente</p>
      <div className="administration-table-scroll" role="region" aria-label="Autoridades por dependencia" tabIndex={0}><table className="administration-table"><thead><tr><th>Dependencia</th><th>Organismo</th><th>Identificación</th><th>Referencia</th><th>Acciones</th></tr></thead><tbody>{query.data.rows.map(u => <tr key={u.id}>
        <td><strong>{u.name}</strong><small>{u.type} {u.code && `· ${u.code}`}</small>{u.proposedName && <small>Denominación propuesta: {u.proposedName}</small>}</td><td>{u.organism}</td><td><State value={u.status} /></td><td>{u.referenceDate || 'Sin fecha'}</td><td><Button onClick={() => setSelected(u)}><Eye size={15} /> Revisar</Button></td>
      </tr>)}</tbody></table></div>
      {!query.data.rows.length && <p className="administration-empty">No hay dependencias con estos filtros.</p>}
      <AdminPagination page={filters.page} size={filters.size} total={query.data.total} onPage={page => change({ page })} onSize={size => change({ size })} />
    </>}
    {selected && <AuthorityReview key={selected.id} unit={selected} onClose={close} onSaved={() => { close(); query.reload() }} />}
  </Surface>
}

function AuthorityReview({ unit, onClose, onSaved }: { unit: AuthorityReviewUnit; onClose: () => void; onSaved: () => void }) {
  const [state, setState] = useState<AuthorityStatus>(unit.status === 'automatic' ? 'manual' : unit.status)
  const [assignment, setAssignment] = useState(unit.candidates.find(c => c.identificationStatus === 'automatic' || c.identificationStatus === 'manual')?.id ?? '')
  const [note, setNote] = useState('')
  const [evidence, setEvidence] = useState('')
  const [acceptName, setAcceptName] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const valid = note.trim().length >= 15 && evidence.trim().length >= 5 && (state !== 'manual' || assignment)
  const save = async () => {
    if (lock.current || !valid) return
    lock.current = true; setBusy(true); setError('')
    try { await reviewAuthority(unit, state, assignment, note.trim(), evidence.trim(), acceptName); onSaved() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos guardar la revisión.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <DirectoryDialog title="Revisar titularidad" className="authority-review-modal" busy={busy} onClose={onClose} footer={<><Button disabled={busy} onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={busy || !valid} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar revisión'}</Button></>}>
    <h3>{unit.name}</h3><p>{unit.organism} · {unit.type}</p><State value={unit.status} /><p>{unit.reason}</p>
    {unit.proposedName && <section className="authority-name-proposal"><strong>{unit.proposedName}</strong><p>{unit.nameEvidence}</p><label><input type="checkbox" checked={acceptName} disabled={busy} onChange={e => setAcceptName(e.target.checked)} /> Confirmar cambio de nombre. Se conservarán el código, la jerarquía y el nombre anterior.</label></section>}
    <section className="authority-candidates"><h3>Candidatos y evidencia</h3>{unit.candidates.length ? unit.candidates.map(c => <article key={c.id}><strong>{c.name}</strong><span>{c.role}</span><small>{c.administrativeRole && `Clasificación: ${c.administrativeRole} · `}{c.confidence === 'high' ? 'Confianza alta' : c.confidence === 'medium' ? 'Confianza media' : 'Evidencia insuficiente'}</small><small>{c.source || 'Fuente sin actualizar'} {c.sourcePeriod} {c.sourceDate}</small><small>{c.reason}</small>{c.evidenceUntil && <small>Evidencia a renovar: {c.evidenceUntil}</small>}{c.excluded && <small>Excluido de asignación automática</small>}</article>) : <p>No hay una persona con evidencia suficiente.</p>}</section>
    <div className="authority-decision"><label>Resultado<FilterSelect disabled={busy} value={state} onChange={e => setState(e.target.value as AuthorityStatus)}>{(['manual','pending','vacant','unidentified','not_applicable'] as const).map(key => <option key={key} value={key}>{AUTHORITY_LABELS[key]}</option>)}</FilterSelect></label>
      {state === 'manual' && <label>Titular<FilterSelect aria-label="Titular confirmado" disabled={busy} value={assignment} onChange={e => setAssignment(e.target.value)}><option value="">Seleccioná una persona</option>{unit.candidates.filter(c => !c.excluded).map(c => <option key={c.id} value={c.id}>{c.name} · {c.role}</option>)}</FilterSelect></label>}
      <label>Justificación<textarea disabled={busy} rows={3} minLength={15} maxLength={1500} value={note} onChange={e => setNote(e.target.value)} placeholder="Indicá el motivo de la decisión." /></label>
      <label>Fuente institucional<input disabled={busy} minLength={5} maxLength={1000} value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Documento, norma o referencia verificable" /></label>
    </div><p className="administration-source-note">La revisión modifica únicamente la titularidad o denominación de esta dependencia. No crea perfiles ni habilita accesos.</p>
    {error && <p role="alert" className="administration-warning">{error}</p>}
    {unit.history.length > 0 && <details><summary>Historial de revisiones</summary>{unit.history.map((h,i) => <p key={i}><strong>{h.at}</strong><br />{h.note}<br /><small>{h.evidence}</small></p>)}</details>}
  </DirectoryDialog>
}
