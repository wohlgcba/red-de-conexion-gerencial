import { directoryRequestRpc } from './directoryRequests'

export type HeaderNotification = { id: string; message: string; href: string; read: boolean; createdAt: string }
export type Notifications = { items: HeaderNotification[]; unreadCount: number }
export const getMyNotifications = () => directoryRequestRpc<Notifications>('get_my_notifications')
export const readMyNotifications = (id?: string) => directoryRequestRpc<void>('read_my_notifications', { p_id: id ?? null })
