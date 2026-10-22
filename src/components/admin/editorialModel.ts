import type { EditorialAction, EditorialFilters, EditorialTray } from '../../types/editorial'
export const EDITORIAL_FILTERS: EditorialFilters = { query: '', topic: '', ministry: '', author: '', status: '', sort: 'newest', page: 1, pageSize: 10 }
export const EDITORIAL_TRAYS: { id: EditorialTray; label: string; heading: string }[] = [
  { id: 'pending', label: 'Pendientes', heading: 'Newsletters pendientes de revisión' },
  { id: 'changes', label: 'Cambios solicitados', heading: 'Newsletters con cambios solicitados' },
  { id: 'published', label: 'Publicados', heading: 'Newsletters publicados' },
  { id: 'retired', label: 'Ocultos / archivados', heading: 'Newsletters ocultos y archivados' },
  { id: 'all', label: 'Todos', heading: 'Todos los newsletters' },
]
export const EDITORIAL_ACTIONS: Record<EditorialAction,string> = { publicado: 'Aprobar y publicar', cambios: 'Solicitar correcciones', rechazado: 'Rechazar', hide: 'Ocultar', archive: 'Archivar', restore: 'Restaurar' }
export const EDITORIAL_EVENTS: Record<string,string> = { ...EDITORIAL_ACTIONS, submitted: 'Enviado a revisión', draft_saved: 'Borrador guardado', direct_publish: 'Publicado por administración', minor: 'Corrección administrativa', draft_deleted: 'Borrador eliminado' }
export const REQUEST_TYPES: Record<string,string> = { new: 'Nueva publicación', correction: 'Corrección reenviada', version: 'Nueva versión', minor: 'Edición menor', legacy: 'Publicación existente' }
export const editorialDate = (date: string) => new Date(date).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
