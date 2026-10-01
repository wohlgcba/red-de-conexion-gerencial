import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { Person } from '../../types'
import { ProfilePanel } from '../directory/PersonParts'
import { UserAvatar } from './UserAvatar'

export function HeaderProfileDialog({ person, name, role, email, photoUrl, onClose, returnFocus }: {
  person?: Person; name: string; role: string; email?: string; photoUrl?: string; onClose: () => void; returnFocus: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.querySelector<HTMLElement>('button')?.focus()
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const entries = Array.from(dialog?.querySelectorAll<HTMLElement>(':is(button:not(:disabled), a[href])') ?? [])
      const first = entries[0]
      const last = entries[entries.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); returnFocus() }
  }, [onClose, returnFocus])

  return createPortal(<div className="header-profile-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={ref} className="header-profile-dialog" role="dialog" aria-modal="true" aria-label={`Mi perfil: ${name}`}>
      {person ? <ProfilePanel person={person} onClose={onClose} /> : <div className="surface profile-panel">
        <div className="panel-heading"><h2>Mi perfil</h2><button type="button" aria-label="Cerrar perfil" onClick={onClose}><X size={20} /></button></div>
        <div className="profile-person"><UserAvatar key={photoUrl} name={name} photoUrl={photoUrl} /><span><strong>{name}</strong><small>{role}</small>{email && <small>{email}</small>}</span></div>
        <p className="header-profile-fallback">Tu cuenta todavía no tiene un perfil vinculado en el directorio.</p>
      </div>}
    </div>
  </div>, document.body)
}
