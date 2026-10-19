import { Check, CircleAlert, Clock3, FileSearch, RotateCcw, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, FilterSelect } from '../common/UI'
import type { Eligibility, EvidenceStatus, RequestStatus, Risk } from '../../types/administration'
import { STATUS_LABELS } from './adminModel'
import { AdministrationUnavailable } from '../../services/administration'
import './admin-badges.css'

export function AdminBadge({ tone = 'neutral', children }: { tone?: 'good' | 'warning' | 'danger' | 'neutral' | 'blue'; children: ReactNode }) {
  const Icon = tone === 'good' ? Check : tone === 'danger' ? CircleAlert : tone === 'warning' ? Clock3 : ShieldCheck
  return <span className={`administration-badge tone-${tone}`}><Icon size={13} aria-hidden="true" />{children}</span>
}
export function RequestBadge({ status }: { status: RequestStatus }) { return <AdminBadge tone={status === 'approved' ? 'good' : status === 'rejected' ? 'danger' : status === 'reviewing' ? 'blue' : 'warning'}>{STATUS_LABELS[status]}</AdminBadge> }
export function EvidenceBadge({ value }: { value: EvidenceStatus }) { return <AdminBadge tone={value === 'found' ? 'good' : value === 'missing' ? 'danger' : 'warning'}>{{ found: 'Encontrada', missing: 'No encontrada', pending: 'Por verificar', ambiguous: 'Ambigua' }[value]}</AdminBadge> }
export function EligibilityBadge({ value }: { value: Eligibility }) { return <AdminBadge tone={value === 'manager' ? 'good' : value === 'other' ? 'warning' : 'neutral'}>{{ manager: 'Gerencial', other: 'No gerencial', unknown: 'Sin identificar' }[value]}</AdminBadge> }
export function RiskBadge({ value }: { value: Risk }) { return <AdminBadge tone={value === 'high' ? 'danger' : value === 'medium' ? 'warning' : 'good'}>{{ high: 'Alto', medium: 'Medio', low: 'Bajo' }[value]}</AdminBadge> }
export function AdminLoadState({ loading, error, retry }: { loading: boolean; error: Error | null; retry: () => void }) {
  return <div className="administration-empty" role={error ? 'alert' : 'status'}><FileSearch size={30} /><h2>{loading ? 'Consultando solicitudes…' : error instanceof AdministrationUnavailable ? 'Activación de Administración pendiente' : 'No pudimos cargar la bandeja'}</h2><p>{error?.message || 'La consulta respeta tus permisos y los filtros seleccionados.'}</p>{error && <Button onClick={retry}><RotateCcw size={16} /> Reintentar</Button>}</div>
}
export function AdminPagination({ page, total, size, onPage, onSize }: { page: number; total: number; size: number; onPage: (n: number) => void; onSize: (n: number) => void }) {
  const max = Math.max(1, Math.ceil(total / size))
  return <div className="administration-pagination"><label>Filas por página<FilterSelect aria-label="Filas por página" value={size} onChange={event => onSize(Number(event.target.value))}>{[10, 25, 50].map(n => <option key={n}>{n}</option>)}</FilterSelect></label><span>{total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} de ${total}` : '0 resultados'}</span><nav aria-label="Paginación administrativa"><Button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">‹</Button><span aria-current="page">{page} / {max}</span><Button disabled={page >= max} onClick={() => onPage(page + 1)} aria-label="Página siguiente">›</Button></nav></div>
}
