import { useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { LoaderCircle, PencilLine, TriangleAlert } from 'lucide-react'
import { Button } from '../common/UI'
import { DirectoryDialog } from './DirectoryDialog'
import './confirm-modal.css'

export function ConfirmModal({ title, variant = 'info', children, confirmLabel, busy = false, error, onClose, onConfirm }: {
  title: string; variant?: 'info' | 'danger'; children: ReactNode; confirmLabel: string
  busy?: boolean; error?: string; onClose: () => void; onConfirm: () => void
}) {
  const cancel = useRef<HTMLButtonElement>(null)
  const descriptionId = useId()
  const danger = variant === 'danger'
  return <DirectoryDialog title={title} className={`person-confirm-modal person-confirm-${variant}`}
    titleIcon={danger ? <TriangleAlert size={22} aria-hidden="true" /> : <PencilLine size={22} aria-hidden="true" />}
    onClose={onClose} busy={busy} closeOnBackdrop={!danger} initialFocusRef={cancel} describedBy={descriptionId}
    footer={<>
      <button ref={cancel} type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>Cancelar</button>
      <Button type="button" variant="primary" className={danger ? 'person-confirm-danger-button' : ''} disabled={busy} onClick={onConfirm}>
        {busy && <LoaderCircle size={17} aria-hidden="true" />} {busy ? 'Eliminando...' : confirmLabel}
      </Button>
    </>}>
    <div id={descriptionId} className="person-confirm-description">{children}</div>
    {error && <p className="person-confirm-error" role="alert">{error}</p>}
  </DirectoryDialog>
}
