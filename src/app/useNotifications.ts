import { useCallback, useEffect, useRef, useState } from 'react'
import { getMyNotifications, readMyNotifications } from '../services/notifications'
import type { Notifications } from '../services/notifications'

export function useNotifications() {
  const [data, setData] = useState<Notifications>({ items: [], unreadCount: 0 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const lifecycle = useRef({ mounted: false, request: 0, writing: false })
  const refresh = useCallback(async () => {
    const active = lifecycle.current
    const request = ++active.request
    try { const result = await getMyNotifications(); if (active.mounted && active.request === request) { setData(result); setError('') } }
    catch { if (active.mounted && active.request === request) setError('No pudimos cargar las notificaciones.') }
    finally { if (active.mounted && active.request === request) setLoading(false) }
  }, [])
  useEffect(() => {
    const active = lifecycle.current; active.mounted = true
    const timer = window.setTimeout(() => void refresh(), 0)
    const interval = window.setInterval(() => { if (!document.hidden && !active.writing) void refresh() }, 60000)
    return () => { active.mounted = false; active.request++; window.clearTimeout(timer); window.clearInterval(interval) }
  }, [refresh])
  const markRead = async (id?: string) => {
    const active = lifecycle.current
    if (active.writing) return
    active.writing = true; setBusy(true)
    try { await readMyNotifications(id); if (active.mounted) await refresh() }
    catch { if (active.mounted) setError('No pudimos marcar el aviso como leído. Reintentá.') }
    finally { active.writing = false; if (active.mounted) setBusy(false) }
  }
  return { ...data, error, loading, busy, refresh, markRead }
}
