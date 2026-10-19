import { useCallback, useState } from 'react'
import { Button } from '../common/UI'
import { useAdminQuery } from './useAdminQuery'
import { RequestBadge } from './AdminPrimitives'
import { adminDate, FIELD_LABELS } from './adminModel'
import { getMyDirectoryRequests, replyToMyRequest, submitProfileChange } from '../../services/directoryRequests'
import type { OwnRequest } from '../../services/directoryRequests'
import type { ChangeField } from '../../types/administration'

export function MyDirectoryRequests({ canChange = false }: { canChange?: boolean }) {
  const load = useCallback(() => getMyDirectoryRequests(), [])
  const query = useAdminQuery(load)
  const [field, setField] = useState<ChangeField>('position_title')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('')
    try { await submitProfileChange(field, value.trim(), reason.trim()); setValue(''); setReason(''); query.reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo enviar la solicitud.') } finally { setBusy(false) }
  }
  return <section className="own-directory-requests"><h2>Mis solicitudes</h2><p>Seguimiento de accesos y cambios institucionales.</p>
    {query.loading ? <p role="status">Consultando solicitudes…</p> : query.error ? <><p role="alert">{query.error.message}</p><Button onClick={query.reload}>Reintentar</Button></> : query.data?.length ? query.data.map(row => <OwnRequestCard key={`${row.id}-${row.version}`} row={row} onChanged={query.reload} />) : <p>Todavía no enviaste solicitudes.</p>}
    {canChange && <form onSubmit={event => void submit(event)}><h3>Solicitar un cambio institucional</h3><p>La administración revisará el cambio antes de aplicarlo a tu perfil.</p><label>Dato a modificar<select value={field} onChange={event => setField(event.target.value as ChangeField)}>{Object.entries(FIELD_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Nuevo valor<input required value={value} maxLength={500} onChange={event => setValue(event.target.value)} /></label><label>Justificación<textarea required minLength={10} maxLength={3000} rows={3} value={reason} onChange={event => setReason(event.target.value)} /></label>{error && <p role="alert" className="form-error">{error}</p>}<Button type="submit" variant="primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitud'}</Button></form>}
  </section>
}

function OwnRequestCard({ row, onChanged }: { row: OwnRequest; onChanged: () => void }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reply = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('')
    try { await replyToMyRequest(row.id, row.version, message.trim()); onChanged() } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo enviar la aclaración.') } finally { setBusy(false) }
  }
  return <article className="own-request-card"><div><strong>{row.kind === 'access' ? 'Ingreso a la Red' : row.field ? FIELD_LABELS[row.field] : 'Cambio de datos'}</strong><RequestBadge status={row.status} /></div><small>{adminDate(row.createdAt)}</small>{row.kind === 'change' && <p>{row.oldValue || 'Sin informar'} → {row.newValue}</p>}<p>{row.reason}</p>{row.note && <p><strong>Administración:</strong> {row.note}</p>}{row.status === 'information' && <form onSubmit={event => void reply(event)}><label>Aclaración solicitada<textarea value={message} required minLength={10} maxLength={3000} onChange={event => setMessage(event.target.value)} rows={3} /></label>{error && <p role="alert">{error}</p>}<Button disabled={busy} type="submit">{busy ? 'Enviando…' : 'Enviar aclaración'}</Button></form>}</article>
}
