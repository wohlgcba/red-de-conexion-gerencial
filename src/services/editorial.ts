import { requireSupabase, SCHEMA } from '../lib/supabase'
import { AdministrationUnavailable } from './administration'
import { newsletterRecord } from './newsletterRecords'
import type { NewsletterRecord } from './newsletterRecords'
import type { EditorialAction, EditorialDetail, EditorialFilters, EditorialIntent, EditorialPage, EditorialTray } from '../types/editorial'
import type { Newsletter } from '../types'
import { sanitizeNewsletterHtml } from '../utils/newsletterContent'

export async function editorialRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await requireSupabase().schema(SCHEMA).rpc(name, args)
  if (error) {
    if (['PGRST202','42883','42703'].includes(error.code)) throw new AdministrationUnavailable('Falta activar la migración editorial rcg_editorial.sql. Los datos existentes se conservan.')
    if (error.code === '40001') throw new Error('Otro administrador o el autor modificó este newsletter. Actualizá la revisión antes de confirmar.')
    if (error.code === '42501') throw new Error('Tu cuenta no tiene permiso para esta operación editorial.')
    throw new Error(error.code === '22023' ? error.message : 'No pudimos completar la operación editorial. Intentá nuevamente.')
  }
  return data as T
}
type RawRow = NewsletterRecord & { content: Partial<NewsletterRecord>; author_name: string; author_role: string; author_ministry: string; author_unit: string; sent_at: string; work_state: EditorialPage['rows'][number]['workState']; work_id: string | null; request_type: string; last_event: EditorialPage['rows'][number]['lastEvent'] }
export async function getEditorialPage(tray: EditorialTray, filters: EditorialFilters): Promise<EditorialPage> {
  const result = await editorialRpc<Omit<EditorialPage,'rows'> & { rows: RawRow[] }>('editorial_list', { p_tray: tray, p_filters: filters })
  return { ...result, rows: await Promise.all(result.rows.map(async row => ({ item: await newsletterRecord({ ...row, ...row.content, status: ['pending','changes'].includes(tray) ? row.work_state ?? row.status : row.status }),
    authorName: row.author_name, authorRole: row.author_role, ministry: row.author_ministry, unit: row.author_unit, sentAt: row.sent_at,
    workState: row.work_state, workId: row.work_id, requestType: row.request_type, lastEvent: row.last_event }))) }
}
export async function getEditorialDetail(id: string): Promise<EditorialDetail> {
  const result = await editorialRpc<{ newsletter: NewsletterRecord & { published_revision: string | null; working_revision: string | null; visibility: string }; versions: { id: string; number: number; content: Partial<NewsletterRecord>; state: EditorialDetail['versions'][number]['state']; request_type: string; created_at: string; submitted_at: string | null }[]; history: EditorialDetail['history'] }>('editorial_detail', { p_id: id })
  const root = result.newsletter
  return { item: await newsletterRecord(root), visibility: root.visibility, workingRevision: root.working_revision, publishedRevision: root.published_revision, history: result.history,
    versions: await Promise.all(result.versions.map(async version => ({ id: version.id, number: version.number, state: version.state, requestType: version.request_type,
      createdAt: version.created_at, submittedAt: version.submitted_at,
      item: await newsletterRecord({ ...root, ...version.content, status: version.state === 'sustituida' ? 'borrador' : version.state, revision_id: version.id, revision_number: version.number, created_at: version.created_at, updated_at: version.created_at }) }))) }
}
export async function getMyEditorialWork(): Promise<Newsletter[]> {
  try { return await Promise.all((await editorialRpc<NewsletterRecord[]>('editorial_my_work')).map(newsletterRecord)) }
  catch (error) { if (error instanceof AdministrationUnavailable) return []; throw error }
}
export const saveEditorialNewsletter = (item: Newsletter, intent: EditorialIntent = item.status as EditorialIntent, note = '') => editorialRpc<string>('editorial_save', {
  p_id: item.id || null, p_expected: item.version ?? 0, p_intent: intent, p_note: note,
  p_content: { title: item.title.trim(), subtitle: item.subtitle.trim(), topic: item.topic.trim(), summary: item.summary.trim(), body: item.body.join('\n\n'),
    body_html: item.bodyHtml ? sanitizeNewsletterHtml(item.bodyHtml) : null, image_path: item.imagePath ?? null, tags: item.tags, reading_minutes: item.readingMinutes },
})
export const decideEditorial = (detail: EditorialDetail, action: EditorialAction, note: string, featured: boolean) => editorialRpc<void>('editorial_decide', {
  p_id: detail.item.id, p_expected: detail.item.version, p_revision: detail.workingRevision, p_action: action, p_note: note.trim(), p_featured: featured,
})
export const deleteEditorialDraft = (item: Newsletter) => editorialRpc<void>('editorial_delete_draft', { p_id: item.id, p_expected: item.version })
