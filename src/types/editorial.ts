import type { Newsletter, NewsletterStatus } from './index'

export type EditorialTray = 'pending' | 'changes' | 'published' | 'retired' | 'all'
export type EditorialAction = 'publicado' | 'cambios' | 'rechazado' | 'hide' | 'archive' | 'restore'
export type EditorialIntent = 'borrador' | 'pendiente' | 'publicado' | 'minor'
export interface EditorialFilters { query: string; topic: string; ministry: string; author: string; status: string; sort: string; page: number; pageSize: number }
export interface EditorialEvent { id: string; revisionId: string; action: string; actor: string; note: string; at: string; emailState: 'sent' | 'pending_configuration' | 'not_requested' }
export interface EditorialRow {
  item: Newsletter; authorName: string; authorRole: string; ministry: string; unit: string; sentAt: string
  workState: NewsletterStatus | null; workId: string | null; requestType: string; lastEvent: Omit<EditorialEvent, 'id' | 'revisionId' | 'emailState'> | null
}
export interface EditorialPage { rows: EditorialRow[]; total: number; counts: Record<Exclude<EditorialTray,'all'>,number>; topics: string[]; ministries: string[]; authors: { id: string; name: string }[]; emailConfigured: boolean }
export interface EditorialVersion { id: string; number: number; state: NewsletterStatus | 'sustituida'; requestType: string; createdAt: string; submittedAt: string | null; item: Newsletter }
export interface EditorialDetail { item: Newsletter; visibility: string; workingRevision: string | null; publishedRevision: string | null; versions: EditorialVersion[]; history: EditorialEvent[] }
