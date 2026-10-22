import type { NewsletterStatus } from '../types'
export const NEWSLETTER_STATUS_LABELS: Record<NewsletterStatus, string> = {
  borrador: 'Borrador', pendiente: 'Pendiente de revisión', publicado: 'Publicado', cambios: 'Cambios solicitados',
  archivado: 'Archivado', rechazado: 'Rechazado', oculto: 'Oculto',
}
