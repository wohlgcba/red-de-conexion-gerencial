import { requireSupabase, SCHEMA } from '../lib/supabase'
import type { NewsletterReactionSummary } from '../types/newsletterReactions'
import { emptyReactionCounts, isReactionType, REACTIONS } from '../utils/newsletterReactions'

export function parseReactionSummaries(value: unknown): NewsletterReactionSummary[] {
  if (!Array.isArray(value)) throw new Error('No se pudieron cargar las reacciones.')
  return value.map(row => {
    if (!row || typeof row !== 'object' || typeof row.newsletter_id !== 'string' || !row.counts || typeof row.counts !== 'object'
        || row.my_reaction !== null && !isReactionType(row.my_reaction)) throw new Error('Respuesta de reacciones inválida.')
    const counts = emptyReactionCounts()
    for (const { type } of REACTIONS) {
      const count: unknown = row.counts[type] ?? 0
      if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new Error('Contador de reacciones inválido.')
      counts[type] = count
    }
    return { newsletterId: row.newsletter_id, counts, mine: row.my_reaction }
  })
}

function check(error: { code?: string; message: string } | null) {
  if (!error) return
  if (error.code === 'PGRST202' || error.code === '42883') throw new Error('Las reacciones todavía no están habilitadas.')
  throw new Error('No pudimos conectar con las reacciones. Volvé a intentarlo.')
}

export async function getNewsletterReactions(ids: string[]): Promise<NewsletterReactionSummary[]> {
  if (!ids.length) return []
  const batches: string[][] = []
  const unique = [...new Set(ids)]
  for (let i = 0; i < unique.length; i += 200) batches.push(unique.slice(i, i + 200))
  return (await Promise.all(batches.map(async p_newsletter_ids => {
    const { data, error } = await requireSupabase().schema(SCHEMA).rpc('get_newsletter_reactions', { p_newsletter_ids })
    check(error)
    return parseReactionSummaries(data)
  }))).flat()
}

export async function setNewsletterReaction(newsletterId: string, reaction: NewsletterReactionSummary['mine']): Promise<NewsletterReactionSummary> {
  const { data, error } = await requireSupabase().schema(SCHEMA).rpc('set_newsletter_reaction', { p_newsletter_id: newsletterId, p_reaction: reaction })
  check(error)
  const result = parseReactionSummaries(data).find(row => row.newsletterId === newsletterId)
  if (!result) throw new Error('La publicación ya no está disponible para reaccionar.')
  return result
}
