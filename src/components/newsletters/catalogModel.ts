import type { Newsletter, Person } from '../../types'
import { getNewsletterAuthor } from '../../utils/newsletterAuthor.ts'

export function publishedByDate(items: Newsletter[]) {
  return items.filter(item => item.status === 'publicado').slice().sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export function groupNewsletters(items: Newsletter[], people: Person[]) {
  const groups = new Map<string, Newsletter[]>()
  for (const item of publishedByDate(items)) {
    const topic = item.topic.trim() || 'Sin temática'
    const entries = groups.get(topic) ?? []
    entries.push(item)
    groups.set(topic, entries)
  }
  return [...groups].map(([topic, items]) => {
    const authors = new Map<string, ReturnType<typeof getNewsletterAuthor>>()
    for (const item of items) authors.set(item.authorId || item.authorUserId || 'institutional', getNewsletterAuthor(item, people))
    const organisms = new Set([...authors.values()].map(author => author.ministry.trim()).filter(Boolean))
    return { topic, items, authors: [...authors.values()], organisms: organisms.size, latest: items[0].date }
  }).sort((a, b) => b.latest.localeCompare(a.latest) || a.topic.localeCompare(b.topic, 'es-AR'))
}

export type NewsletterTopicGroup = ReturnType<typeof groupNewsletters>[number]

export function topicLink(topic: string) {
  // Keep the exact data value: no slug collisions or new database identifiers.
  return `/portal?${new URLSearchParams({ tematica: topic })}`
}
