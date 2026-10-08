import { CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar } from '../common/Avatar'
import { Chip } from '../common/UI'
import { useCatalog } from '../../app/useCatalog'
import { formatDate } from '../../utils/format'
import { getNewsletterAuthor } from '../../utils/newsletterAuthor'
import type { Newsletter, NewsletterStatus } from '../../types'

const tones: Record<string, 'blue' | 'mint' | 'purple' | 'green'> = { 'Innovación pública': 'blue', 'Innovación': 'blue', 'Gestión': 'mint', 'Participación': 'purple', 'Ambiente': 'green', 'Datos': 'blue', 'Procesos': 'blue', 'Proyectos': 'blue' }

export function TopicChip({ topic }: { topic: string }) { return <Chip tone={tones[topic] ?? 'blue'}>{topic}</Chip> }

export function StatusBadge({ status }: { status: NewsletterStatus }) {
  const label: Record<NewsletterStatus, string> = { borrador: 'Borrador', pendiente: 'Pendiente de revisión', publicado: 'Publicado', cambios: 'Cambios solicitados', archivado: 'Archivado', rechazado: 'Rechazado' }
  return <span className={`status status-${status}`}>{label[status]}</span>
}

export function NewsletterCard({ item }: { item: Newsletter }) {
  const { people } = useCatalog()
  const author = getNewsletterAuthor(item, people)
  return <article className="newsletter-card">
    <div className="newsletter-thumb"><img src={item.image} alt="" /><span className={`thumb-label ${tones[item.topic] ?? 'blue'}`}>{item.topic}</span></div>
    <div className="newsletter-card-body"><h3>{item.title}</h3><p>{item.subtitle}</p><div className="mini-author"><Avatar name={author.name} photoUrl={author.photoUrl} size={30} /><span><strong>{author.name}</strong><small>{author.role}<br />{author.ministry}</small></span></div></div>
    <div className="newsletter-card-footer"><span><CalendarDays size={13} /> {formatDate(item.date)}</span><Link className="btn btn-outline" to={`/newsletters/${item.id}`}>Leer newsletter</Link></div>
  </article>
}

export function FeaturedNewsletter({ item }: { item: Newsletter }) {
  const { people } = useCatalog()
  const author = getNewsletterAuthor(item, people)
  return <div className="featured-newsletter"><img src={item.image} alt="Equipo colaborando en una sala de reuniones" /><div className="featured-copy"><TopicChip topic={item.topic} /><h2>{item.title}</h2><p>{item.subtitle}</p><div className="featured-author"><Avatar name={author.name} photoUrl={author.photoUrl} size={44} /><span><strong>{author.name}</strong><small>{author.role} · {author.ministry}</small></span></div></div><Link className="btn btn-primary featured-read" to={`/newsletters/${item.id}`}>Leer newsletter</Link></div>
}
