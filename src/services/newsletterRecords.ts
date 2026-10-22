import type { Newsletter, NewsletterStatus } from '../types'
import { COVER_BUCKET, requireSupabase } from '../lib/supabase'

export interface NewsletterRecord {
  id: string; author_id: string | null; author_user_id?: string | null; title: string; subtitle: string; topic: string
  summary: string; body: string; body_html?: string | null; image_path: string | null; tags: string[]; reading_minutes: number
  status: NewsletterStatus; featured: boolean; review_note: string | null; published_at: string | null
  created_at: string; updated_at: string; version: number; visibility?: string; revision_id?: string; revision_number?: number; has_publication?: boolean; can_delete_draft?: boolean
}
export async function newsletterRecord(row: NewsletterRecord): Promise<Newsletter> {
  let image = '/assets/newsletter-placeholder.svg'
  if (row.image_path) {
    const signed = await requireSupabase().storage.from(COVER_BUCKET).createSignedUrl(row.image_path, 3600)
    if (signed.data?.signedUrl) image = signed.data.signedUrl
  }
  return { id: row.id, title: row.title, subtitle: row.subtitle, topic: row.topic, image, imagePath: row.image_path,
    authorId: row.author_id ?? '', authorUserId: row.author_user_id, date: (row.published_at ?? row.created_at).slice(0, 10),
    updatedAt: row.updated_at.slice(0, 10), readingMinutes: row.reading_minutes, featured: row.featured, status: row.status,
    summary: row.summary, body: row.body.split(/\n\s*\n/).filter(Boolean), bodyHtml: row.body_html ?? null, tags: row.tags,
    observation: row.review_note ?? undefined, version: row.version, revisionId: row.revision_id,
    revisionNumber: row.revision_number, hasPublication: row.has_publication, canDeleteDraft: row.can_delete_draft, visibility: row.visibility }
}
