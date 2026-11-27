import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { tematica, tematicaStyle } from '../../config/tematicas'
import { formatDate } from '../../utils/format'
import { getNewsletterAuthor } from '../../utils/newsletterAuthor'
import type { Newsletter, Person } from '../../types'
import type { NewsletterTopicGroup } from './catalogModel'
import { topicLink } from './catalogModel'
import { TopicChip } from './NewsletterParts'

export function NewsletterTopicCard({ group }: { group: NewsletterTopicGroup }) {
  const theme = tematica(group.topic)
  const Icon = theme.icon
  return <Link className="newsletter-topic-card" to={topicLink(group.topic)} style={tematicaStyle(group.topic)}>
    <div className="newsletter-topic-banner"><Icon aria-hidden="true" /><h3>{group.topic}</h3></div>
    <div className="newsletter-topic-copy"><p className="newsletter-topic-description" title={theme.description}>{theme.description}</p><div className="newsletter-topic-authors"><div className="newsletter-topic-avatars" aria-hidden="true">{group.authors.slice(0, 3).map((author, index) => <span key={index}>{author.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</span>)}</div><span>{group.authors.length} {group.authors.length === 1 ? 'autor' : 'autores'} de {group.organisms} {group.organisms === 1 ? 'organismo' : 'organismos'}</span></div></div>
    <div className="newsletter-topic-footer"><span><strong>{group.items.length}</strong> {group.items.length === 1 ? 'newsletter' : 'newsletters'}</span><span>Último: {formatDate(group.latest)}</span></div>
  </Link>
}

export function LatestNewsletters({ items, people }: { items: Newsletter[]; people: Person[] }) {
  return <section aria-labelledby="latest-newsletters-heading"><div className="newsletter-section-heading"><h2 id="latest-newsletters-heading">Últimas publicaciones</h2><Link to="/portal?vista=todas">Ver todas <ArrowRight size={16} aria-hidden="true" /></Link></div><div className="newsletter-latest-grid">{items.slice(0, 3).map(item => <Link key={item.id} className="newsletter-latest-card" to={`/portal/${item.id}`}><img src={item.image} alt="" loading="lazy" /><div><TopicChip topic={item.topic} catalog /><h3>{item.title}</h3><p>{getNewsletterAuthor(item, people).name} · <time dateTime={item.date}>{formatDate(item.date)}</time></p></div></Link>)}</div></section>
}
