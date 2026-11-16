import { CalendarDays, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar } from '../common/Avatar'
import { Chip } from '../common/UI'
import { useCatalog } from '../../app/useCatalog'
import { formatDate } from '../../utils/format'
import { getNewsletterAuthor } from '../../utils/newsletterAuthor'
import type { Newsletter, NewsletterStatus } from '../../types'
import { NewsletterReactions } from './NewsletterReactions'
import { NEWSLETTER_STATUS_LABELS } from '../../utils/newsletterStatus'
import { tematicaStyle } from '../../config/tematicas'

const tones: Record<string, 'blue' | 'mint' | 'purple' | 'green'> = { 'Innovación pública': 'blue', 'Innovación': 'blue', 'Gestión': 'mint', 'Participación': 'purple', 'Ambiente': 'green', 'Datos': 'blue', 'Procesos': 'blue', 'Proyectos': 'blue' }

export function TopicChip({ topic, catalog = false }: { topic: string; catalog?: boolean }) {
  return catalog ? <span className="newsletter-topic-chip" style={tematicaStyle(topic)}>{topic}</span> : <Chip tone={tones[topic] ?? 'blue'}>{topic}</Chip>
}

export function StatusBadge({ status }: { status: NewsletterStatus }) {
  return <span className={`status status-${status}`}>{NEWSLETTER_STATUS_LABELS[status]}</span>
}

export function NewsletterCard({ item }: { item: Newsletter }) {
  const { people } = useCatalog()
  const author = getNewsletterAuthor(item, people)
  return <article className="newsletter-card">
    <div className="newsletter-thumb"><img src={item.image} alt="" loading="lazy" /><span className="thumb-label newsletter-topic-thumb" style={tematicaStyle(item.topic)}>{item.topic}</span></div>
    <div className="newsletter-card-body"><h3>{item.title}</h3><p>{item.subtitle}</p><div className="mini-author"><Avatar name={author.name} photoUrl={author.photoUrl} size={30} /><span><strong>{author.name}</strong><small>{author.role}<br />{author.ministry}</small></span></div></div>
    <div className="newsletter-card-footer"><span><CalendarDays size={13} /> {formatDate(item.date)}</span><Link className="btn btn-outline" to={`/newsletters/${item.id}`}>Leer newsletter</Link></div>
    {item.status === 'publicado' && <NewsletterReactions newsletterId={item.id} compact />}
  </article>
}

export function FeaturedNewsletter({ item }: { item: Newsletter }) {
  const { people } = useCatalog()
  const author = getNewsletterAuthor(item, people)
  return <section className="newsletter-featured-compact" aria-label="Newsletter destacado"><img src={item.image} alt="" /><div><span className="newsletter-featured-label"><Star size={14} fill="currentColor" aria-hidden="true" /> Destacado</span><h2>{item.title}</h2><p>{author.name} · {author.ministry} · <TopicChip topic={item.topic} catalog /></p></div><Link className="btn btn-primary" to={`/newsletters/${item.id}`}>Leer newsletter</Link></section>
}
