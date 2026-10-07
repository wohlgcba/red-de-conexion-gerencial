import { useEffect, useId, useRef, useState } from 'react'
import { Bell, ChevronDown } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useCatalog } from '../../app/useCatalog'
import { getMockHeaderNotifications } from '../../mocks/headerNotifications'
import { UserAvatar } from './UserAvatar'
import { NotificationMenu, UserMenu } from './HeaderMenus'

type Menu = 'notifications' | 'user'

export function HeaderUserArea() {
  const { user, people, currentPersonId, isAdmin, signOut } = useCatalog()
  const location = useLocation()
  const root = useRef<HTMLDivElement>(null)
  const userButton = useRef<HTMLButtonElement>(null)
  const notificationButton = useRef<HTMLButtonElement>(null)
  const id = useId()
  const [menu, setMenu] = useState<{ type: Menu; routeKey: string } | null>(null)
  const [notifications, setNotifications] = useState(getMockHeaderNotifications)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const open = menu?.routeKey === location.key ? menu.type : null
  const person = people.find(item => item.id === currentPersonId)
  const metadataText = (key: string) => typeof user.user_metadata[key] === 'string' ? user.user_metadata[key].trim() : ''
  const metadataName = metadataText('full_name') || metadataText('name') || [metadataText('given_name'), metadataText('family_name')].filter(Boolean).join(' ')
  const name = person?.name || metadataName || user.email || 'Mi cuenta'
  const role = person?.role || metadataText('position_title') || metadataText('job_role') || (isAdmin ? 'Administración de la Red' : 'Integrante de la Red')
  const organization = person?.ministry || metadataText('ministry') || metadataText('organization')
  const image = metadataText('avatar_url') || metadataText('picture') || metadataText('photo_url')
  const photoUrl = /^https?:\/\//i.test(image) ? image : undefined
  const unreadCount = notifications.filter(item => !item.read).length

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setMenu(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMenu(null)
      ;(open === 'user' ? userButton : notificationButton).current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])

  const toggle = (type: Menu) => { setError(''); setMenu(open === type ? null : { type, routeKey: location.key }) }
  const logout = async () => {
    setMenu(null)
    setError('')
    setSigningOut(true)
    try { await signOut() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cerrar la sesión. Intentá nuevamente.') }
    finally { setSigningOut(false) }
  }
  const markRead = (notificationId?: string) => {
    setNotifications(items => items.map(item => !notificationId || item.id === notificationId ? { ...item, read: true } : item))
    window.requestAnimationFrame(() => {
      const panel = root.current?.querySelector<HTMLElement>('.header-dropdown')
      ;(panel?.querySelector<HTMLElement>('button') ?? panel)?.focus()
    })
  }

  return <>
    <div ref={root} className="header-user-area" onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setMenu(null)
    }}>
      <div className="header-institutional-logo"><img src="/assets/DesdeAdentroLogo.svg" alt="Red de Redes · Desde adentro" /></div>
      <span className="header-user-separator" aria-hidden="true" />
      <button ref={notificationButton} type="button" className={`header-icon-button ${open === 'notifications' ? 'is-open' : ''}`} aria-label={`Notificaciones${unreadCount ? `: ${unreadCount} sin leer` : ''}`} aria-expanded={open === 'notifications'} aria-haspopup="dialog" aria-controls={`${id}-notifications`} onClick={() => toggle('notifications')} onKeyDown={event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setMenu({ type: 'notifications', routeKey: location.key }) }
      }}>
        <Bell size={23} strokeWidth={1.7} aria-hidden="true" />
        {unreadCount > 0 && <span className="header-notification-badge" aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      <button ref={userButton} type="button" className={`header-user-button ${open === 'user' ? 'is-open' : ''}`} aria-label={`Menú de usuario: ${name}`} aria-expanded={open === 'user'} aria-haspopup="menu" aria-controls={`${id}-user`} onClick={() => toggle('user')} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setMenu({ type: 'user', routeKey: location.key }) }
      }}>
        <UserAvatar key={photoUrl} name={name} photoUrl={photoUrl} />
        <ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open === 'notifications' && <NotificationMenu id={`${id}-notifications`} notifications={notifications} onRead={markRead} onReadAll={() => markRead()} />}
      {open === 'user' && <UserMenu id={`${id}-user`} name={name} role={role} organization={organization} onClose={() => setMenu(null)} onSignOut={() => void logout()} busy={signingOut} />}
      {error && <p className="header-action-error" role="alert">{error}</p>}
    </div>
  </>
}
