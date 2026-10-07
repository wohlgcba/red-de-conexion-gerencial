import { CheckCheck, LockKeyhole, LogOut, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { HeaderNotification } from '../../mocks/headerNotifications'
import { HeaderDropdown } from './HeaderDropdown'

export function UserMenu({ id, name, role, organization, onClose, onSignOut, busy }: {
  id: string; name: string; role: string; organization?: string; onClose: () => void; onSignOut: () => void; busy: boolean
}) {
  return <HeaderDropdown id={id} label="Menú de usuario" menu>
    <div className="header-user-details" role="presentation"><strong>{name}</strong><span>{role}</span>{organization && <span>{organization}</span>}</div>
    <div className="header-menu-group" role="presentation">
      <Link role="menuitem" to="/mi-cuenta" onClick={onClose}><UserRound size={18} /> Mi cuenta</Link>
      <Link role="menuitem" to="/mi-cuenta" onClick={onClose}><LockKeyhole size={18} /> Cambiar contraseña</Link>
    </div>
    <div className="header-menu-group" role="presentation">
      <button type="button" role="menuitem" className="header-logout" disabled={busy} onClick={onSignOut}><LogOut size={18} /> Cerrar sesión</button>
    </div>
  </HeaderDropdown>
}

export function NotificationMenu({ id, notifications, onRead, onReadAll }: {
  id: string; notifications: HeaderNotification[]; onRead: (id: string) => void; onReadAll: () => void
}) {
  const unread = notifications.filter(item => !item.read)
  return <HeaderDropdown id={id} label="Notificaciones">
    <div className="header-notification-heading"><h2>Notificaciones</h2><span>Demostración</span></div>
    <p className="header-demo-note">Ejemplos de interfaz; no son avisos reales.</p>
    {unread.length ? <>
      <ul className="header-notification-list">{unread.map(item => <li key={item.id}><button type="button" onClick={() => onRead(item.id)} aria-label={`${item.message}. Marcar como leída`}><span className="header-unread-dot" />{item.message}</button></li>)}</ul>
      <button type="button" className="header-read-all" onClick={onReadAll}><CheckCheck size={16} /> Marcar todas como leídas</button>
    </> : <p className="header-no-notifications" role="status">No tenés notificaciones nuevas.</p>}
  </HeaderDropdown>
}
