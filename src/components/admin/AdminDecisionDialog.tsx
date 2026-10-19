import { useState } from 'react'
import { Button } from '../common/UI'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import { ACTION_LABELS, REASON_LABELS } from './adminModel'
import type { AdminAction, AdminDetail } from '../../types/administration'

export function AdminDecisionDialog({ detail, action, onClose, onConfirm, onRefresh }: { detail: AdminDetail; action: AdminAction; onClose: () => void; onConfirm: (note: string, reason: string) => Promise<void>; onRefresh: () => void }) {
  const [note, setNote] = useState('')
  const [reason, setReason] = useState(detail.validation.reasons[0] || 'other')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const required = ['exception', 'reject', 'information', 'revoke'].includes(action)
  const submit = async () => {
    if (busy) return
    if (required && note.trim().length < 10) { setError('Ingresá una justificación de al menos 10 caracteres.'); return }
    setBusy(true); setError('')
    try { await onConfirm(note.trim(), reason) } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la decisión.') } finally { setBusy(false) }
  }
  return <DirectoryDialog title={action === 'exception' ? 'Confirmar aprobación excepcional' : `${ACTION_LABELS[action]} solicitud`} className="administration-decision" onClose={onClose} busy={busy} closeOnBackdrop={false}
    footer={<><Button disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy} variant={action === 'exception' || action === 'approve' ? 'yellow' : 'primary'} className={action === 'reject' || action === 'revoke' ? 'administration-danger' : ''} onClick={() => void submit()}>{busy ? 'Guardando…' : 'Confirmar decisión'}</Button></>}>
    <div className="administration-decision-person"><strong>{detail.name}</strong><span>{detail.email}</span></div>
    <p>{action === 'revoke' ? 'Se revocará la excepción. El acceso se conservará hasta una decisión explícita de desactivación.' : action === 'approve' || action === 'exception' ? detail.kind === 'change' ? 'El cambio se aplicará al perfil y quedará registrado. Dotación y la cuenta compartida de Supabase Auth conservarán su información.' : 'Se habilitará el acceso a la Red y se conservará un registro de la decisión.' : 'La decisión y su justificación quedarán en el historial de la solicitud.'}</p>
    {action === 'exception' && <label>Motivo de excepción<select value={reason} onChange={event => setReason(event.target.value)}>{Object.entries(REASON_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
    {detail.validation.reasons.length > 0 && <div className="administration-warning">Advertencias: {detail.validation.reasons.map(item => REASON_LABELS[item]).join(' · ')}</div>}
    {action === 'information' && <p>El requerimiento aparecerá en las solicitudes y notificaciones de la persona. No se enviará un correo automático.</p>}
    {detail.kind === 'change' && <div className="administration-comparison"><div><small>Valor actual</small>{detail.oldValue || 'No informado'}</div><span>→</span><div><small>Nuevo valor solicitado</small>{detail.newValue}</div></div>}
    <label>{required ? 'Justificación obligatoria' : 'Observación (opcional)'}<textarea rows={4} maxLength={3000} value={note} onChange={event => setNote(event.target.value)} placeholder="Dejá constancia de los motivos de la decisión…" /></label>
    {error && <div role="alert" className="form-error"><p>{error}</p><Button disabled={busy} onClick={onRefresh}>Actualizar revisión</Button></div>}
  </DirectoryDialog>
}
