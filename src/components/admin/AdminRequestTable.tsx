import { Eye } from 'lucide-react'
import { Avatar } from '../common/Avatar'
import { Button } from '../common/UI'
import { AdminBadge, EligibilityBadge, EvidenceBadge, RequestBadge, RiskBadge } from './AdminPrimitives'
import { adminDate, FIELD_LABELS, REASON_LABELS, requestSummary } from './adminModel'
import type { AdminRequest, AdminTray } from '../../types/administration'

export function AdminRequestTable({ rows, tray, selected, onSelect, disabled }: { rows: AdminRequest[]; tray: AdminTray; selected: string | null; onSelect: (id: string) => void; disabled: boolean }) {
  return <div className="administration-table-scroll"><table className={`administration-table tray-${tray}`}><caption className="reaction-sr-only">Solicitudes administrativas del Directorio</caption><thead><tr><th>Nombre y apellido</th>
    {tray === 'access' && <><th>Correo / Cargo declarado</th><th>Dotación</th><th>Validación gerencial</th><th>Duplicados</th></>}
    {tray === 'exceptions' && <><th>Solicitud de origen</th><th>Motivo de excepción</th><th>Dotación / Cargo</th><th>Conflictos</th></>}
    {tray === 'change' && <><th>Dato a modificar</th><th>Valor actual</th><th>Nuevo valor</th><th>Tipo</th></>}
    {tray === 'all' && <><th>Tipo de solicitud</th><th>Resumen</th><th>Riesgo</th><th>Intervino</th></>}
    <th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className={selected === row.id ? 'is-selected' : ''}>
      <td><div className="administration-person"><Avatar name={row.name} size={36} /><span><strong>{row.name}</strong><small>{row.ministry || 'Organismo no informado'}</small></span></div></td>
      {tray === 'access' && <><td><span className="administration-email">{row.email}</span><small>{row.role || 'Cargo no declarado'}</small></td><td><EvidenceBadge value={row.validation.evidence} /></td><td><EligibilityBadge value={row.validation.eligibility} /></td><td><AdminBadge tone={row.validation.duplicateEmail + row.validation.duplicateIdentifier > 0 ? 'danger' : 'neutral'}>{row.validation.duplicateEmail + row.validation.duplicateIdentifier > 0 ? 'Revisar identidad' : 'Sin duplicados'}</AdminBadge></td></>}
      {tray === 'exceptions' && <><td>{row.kind === 'access' ? 'Acceso al Directorio' : 'Cambio de datos'}</td><td>{row.exceptionActive ? <AdminBadge tone="good">Excepción vigente</AdminBadge> : <strong>{REASON_LABELS[row.validation.reasons[0]] || 'Revisión administrativa'}</strong>}<small>{row.validation.reasons.map(item => REASON_LABELS[item]).filter(Boolean).join(' · ')}</small></td><td><EvidenceBadge value={row.validation.evidence} /><EligibilityBadge value={row.validation.eligibility} /></td><td><RiskBadge value={row.validation.risk} /></td></>}
      {tray === 'change' && <><td>{row.field ? FIELD_LABELS[row.field] : 'Dato institucional'}</td><td>{row.oldValue || 'No informado'}</td><td>{row.newValue || 'No informado'}</td><td><AdminBadge tone="blue">Institucional</AdminBadge></td></>}
      {tray === 'all' && <><td><AdminBadge tone={row.kind === 'access' ? 'blue' : 'warning'}>{row.kind === 'access' ? 'Acceso' : 'Cambio de datos'}</AdminBadge>{row.exceptionActive && <small>Excepción vigente</small>}</td><td>{requestSummary(row.kind, row.field)}</td><td><RiskBadge value={row.validation.risk} /></td><td>{row.reviewer || 'Sin intervención'}</td></>}
      <td className="administration-date">{adminDate(row.createdAt)}</td><td><RequestBadge status={row.status} /></td><td className="administration-request-actions"><Button className="administration-review-button" variant={selected === row.id ? 'primary' : 'outline'} disabled={disabled} onClick={() => onSelect(row.id)} aria-label={`Revisar solicitud de ${row.name}`} aria-haspopup="dialog" aria-expanded={selected === row.id}><Eye size={15} /><span>{row.status === 'approved' || row.status === 'rejected' ? 'Ver' : 'Revisar'}</span></Button></td>
    </tr>)}</tbody></table></div>
}
