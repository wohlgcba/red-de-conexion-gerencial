import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Home, Mail, Share2, UserRound } from 'lucide-react'
import { useCatalog } from '../app/useCatalog'
import { Avatar } from '../components/common/Avatar'
import { Button, Chip, Surface } from '../components/common/UI'
import { TopicChip } from '../components/newsletters/NewsletterParts'
import { formatDate, longDate } from '../utils/format'

export function NewsletterDetailPage() {
  const { id } = useParams()
  const { items, people, currentPersonId, isAdmin } = useCatalog()
  const [shared, setShared] = useState(false)
  const item = items.find(entry => entry.id === id)
  if (!item || item.status !== 'publicado' && item.authorId !== currentPersonId && !isAdmin) return <Surface className="not-found"><h1>Newsletter no encontrado</h1><Link to="/newsletters">Volver a newsletters</Link></Surface>
  const author = people.find(person => person.id === item.authorId)
  const related = items.filter(entry => entry.id !== item.id && entry.status === 'publicado' && entry.topic === item.topic).slice(0, 5)
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: item.title, url: window.location.href })
      else { await navigator.clipboard.writeText(window.location.href); setShared(true) }
    } catch { setShared(false) }
  }
  return <div className="page-stack detail-page"><div className="breadcrumbs"><Link to="/directorio"><Home size={16} /></Link><span>›</span><Link to="/newsletters">Newsletters</Link><span>/</span><span>{item.topic}</span></div><div className="detail-grid"><div className="detail-main"><Surface className="article-header"><div className="article-header-copy"><TopicChip topic={item.topic} /><h1>{item.title}</h1><p>{item.subtitle}</p><div className="article-byline"><Avatar name={author?.name} size={42} /><span><strong>{author?.name ?? 'Autor no disponible'}</strong><small>{author?.role} · {author?.ministry}</small></span><i /><span><CalendarDays size={15} /> {longDate(item.date)}</span><i /><span><Clock3 size={15} /> {item.readingMinutes} min de lectura</span></div></div><img className="article-cover" src={item.image} alt="Portada del newsletter" /></Surface><Surface className="article-body">{item.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{item.quote && <blockquote>“{item.quote}”<cite>— {author?.name}</cite></blockquote>}<div className="article-actions"><Link className="btn btn-outline" to="/newsletters"><ArrowLeft size={18} /> Volver a newsletters</Link><div><Button onClick={() => void share()}><Share2 size={18} /> {shared ? 'Enlace copiado' : 'Compartir'}</Button></div></div></Surface></div><aside className="detail-aside"><Surface className="author-box"><h2>Publicado por</h2><div className="author-box-person"><Avatar name={author?.name} size={72} /><span><strong>{author?.name ?? 'Autor no disponible'}</strong><small>{author?.role}<br />{author?.ministry}</small></span></div>{author && <div className="author-box-buttons"><Link className="btn btn-outline" to={`/directorio?persona=${author.id}`}><UserRound size={18} /> Ver perfil</Link><a className="btn btn-primary" href={`mailto:${author.email}`}><Mail size={18} /> Contactar</a></div>}</Surface><Surface className="topic-box"><h2>Temáticas</h2><div>{item.tags.map(tag => <Chip key={tag}>{tag}</Chip>)}</div></Surface><Surface className="related-box"><div className="box-title-row"><h2>Newsletters relacionados</h2><Link to="/newsletters">Ver todos <ArrowRight size={15} /></Link></div>{related.slice(0, 2).map(entry => <Link className="related-item" key={entry.id} to={`/newsletters/${entry.id}`}><img src={entry.image} alt="" /><span><TopicChip topic={entry.topic} /><strong>{entry.title}</strong><small>{formatDate(entry.date)} · {entry.readingMinutes} min</small></span></Link>)}{related.length === 0 && <p className="empty-related">Todavía no hay publicaciones relacionadas.</p>}</Surface></aside></div>{related.length > 2 && <Surface className="more-newsletters"><div className="box-title-row"><h2>Más newsletters de esta temática</h2><Link to="/newsletters">Ver todos <ArrowRight size={15} /></Link></div><div>{related.slice(2).map(entry => <Link key={entry.id} to={`/newsletters/${entry.id}`}><img src={entry.image} alt="" /><span><strong>{entry.title}</strong><small>{entry.subtitle}</small><small>{formatDate(entry.date)}</small></span><ArrowRight size={17} /></Link>)}</div></Surface>}</div>
}
