export type HeaderNotification = {
  id: string
  message: string
  read: boolean
}

// Solo demostración local. El menú recibe esta estructura para conectarla
// posteriormente a una fuente real sin cambiar su presentación.
export function getMockHeaderNotifications(): HeaderNotification[] {
  return [
    { id: 'demo-approved', message: 'Tu newsletter fue aprobado', read: false },
    { id: 'demo-changes', message: 'Se solicitaron cambios en tu newsletter', read: false },
  ]
}
