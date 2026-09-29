import { CalendarDays, BookOpen, Star, UserRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar } from '../common/Avatar'
import { Button, Chip } from '../common/UI'
import { useCatalog } from '../../app/useCatalog'
import { formatDate } from '../../utils/format'
import type { Newsletter, NewsletterStatus } from '../../types'

const tones: Record<string, 'blue' | 'mint' | 'purple' | 'green'> = { 'Innovación pública': 'blue', 'Innovación': 'blue', 'Gestión': 'mint', 'Participación': 'purple', 'Ambiente': 'green', 'Datos': 'blue', 'Procesos': 'blue', 'Proyectos': 'blue' }

export function TopicChip({ topic }: { topic: string }) { return <Chip tone={tones[topic] ?? 'blue'}>{topic}</Chip> }

export function StatusBadge({ status }: { status: NewsletterStatus }) {
  const label: Record<NewsletterStatus, string> = { borrador: 'Borrador', pendiente: 'Pendiente de revisión', publicado: 'Publicado', cambios: 'Cambios solicitados', archivado: 'Archivado', rechazado: 'Rechazado' }
  return <span className={`status status-${status}`}>{label[status]}</span>
}

export function NewsletterCard({ item, onSelect }: { item: Newsletter, onSelect?: (id: string) => void }) {
  const { people } = useCatalog()
  const author = people.find(person => person.id === item.authorId)
  return <article className="newsletter-card"><div className="newsletter-thumb"><img src={item.image} alt="" /><span className={`thumb-label ${tones[item.topic] ?? 'blue'}`}>{item.topic}</span></div><div className="newsletter-card-body"><h3>{item.title}</h3><p>{item.subtitle}</p><div className="mini-author"><Avatar index={author?.avatar} size={30} /><span><strong>{author?.name}</strong><small>{author?.role}<br />{author?.ministry}</small></span></div></div><div className="newsletter-card-footer"><span><CalendarDays size={13} /> {formatDate(item.date)}</span><Button onClick={() => onSelect?.(item.id)}>Leer newsletter</Button></div></article>
}

export function FeaturedNewsletter({ item }: { item: Newsletter }) {
  const { people } = useCatalog()
  const author = people.find(person => person.id === item.authorId)
  return <div className="featured-newsletter"><img src={item.image} alt="Equipo colaborando en una sala de reuniones" /><div className="featured-copy"><TopicChip topic={item.topic} /><h2>{item.title}</h2><p>{item.subtitle}</p><div className="featured-author"><Avatar index={author?.avatar} size={44} /><span><strong>{author?.name}</strong><small>{author?.role} · {author?.ministry}</small></span></div></div><Link className="btn btn-primary featured-read" to={`/newsletters/${item.id}`}>Leer newsletter</Link></div>
}

export function NewsletterDetailPanel({ item, onClose }: { item?: Newsletter, onClose: () => void }) {
  const { people } = useCatalog()
  if (!item) return null
  const author = people.find(person => person.id === item.authorId)
  return <aside className="surface newsletter-panel"><div className="panel-heading"><h2>Detalle del newsletter</h2><button aria-label="Cerrar detalle" onClick={onClose}><X size={20} /></button></div><div className="panel-hero"><div><TopicChip topic={item.topic} /><h3>{item.title}</h3><p>{item.subtitle}</p></div><img src={item.image} alt="" /></div><div className="panel-author"><Avatar index={author?.avatar} size={48} /><span><strong>{author?.name}</strong><small>{author?.role}<br />{author?.ministry}</small></span></div><div className="panel-meta"><span><CalendarDays size={16} /> Publicado {formatDate(item.date)}</span>{item.featured && <span><Star size={16} fill="#ffbd00" stroke="#ffbd00" /> Destacado</span>}</div><p className="panel-summary">{item.summary}</p><div className="panel-buttons"><Link className="btn btn-primary" to={`/newsletters/${item.id}`}><BookOpen size={18} /> Leer completo</Link><Link className="btn btn-outline" to={`/directorio?persona=${author?.id}`}><UserRound size={18} /> Ver perfil</Link></div><div className="panel-topics"><strong>Temáticas</strong><div>{item.tags.map(tag => <Chip key={tag}>{tag}</Chip>)}</div></div></aside>
}
