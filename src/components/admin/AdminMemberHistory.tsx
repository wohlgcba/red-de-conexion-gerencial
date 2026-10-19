import { useCallback } from 'react'
import { getAdminMemberHistory } from '../../services/administration'
import { useAdminQuery } from './useAdminQuery'
import { adminDate, ACTION_LABELS } from './adminModel'
import type { AdminAction } from '../../types/administration'
import { Button } from '../common/UI'

const LABELS: Record<string, string> = { insert: 'Alta de integrante', update: 'Edición de perfil', delete: 'Eliminación', activate: 'Reactivación', deactivate: 'Desactivación', quality_review: 'Revisión de calidad', created: 'Solicitud registrada' }
export function AdminMemberHistory({ id }: { id: string }) {
  const load = useCallback(() => getAdminMemberHistory(id), [id])
  const query = useAdminQuery(load)
  return <section className="administration-detail-section"><h3>Historial administrativo</h3>{query.loading ? <p role="status">Consultando historial…</p> : query.error ? <><p role="alert">{query.error.message}</p><Button onClick={query.reload}>Reintentar</Button></> : query.data?.length ? <ol className="administration-history">{query.data.map(event => <li key={event.id}><strong>{LABELS[event.action] || ACTION_LABELS[event.action as AdminAction] || event.action}</strong><small>{event.actor} · {adminDate(event.at)}</small><p>{event.reason}</p>{Object.keys(event.before).length > 0 && <details><summary>Ver valores registrados</summary><pre>{JSON.stringify({ antes: event.before, despues: event.after }, null, 2)}</pre></details>}</li>)}</ol> : <p>Sin operaciones registradas desde la activación de la auditoría.</p>}</section>
}
