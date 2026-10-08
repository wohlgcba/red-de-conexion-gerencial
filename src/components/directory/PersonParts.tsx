import { ArrowRight, BookOpen, Building2, Mail, Phone, UserRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../app/useCatalog'
import type { Person } from '../../types'
import { Avatar } from '../common/Avatar'
import { Button, Chip } from '../common/UI'

export function PersonCard({ person, selected, onSelect, compact = false }: { person: Person; selected: boolean; onSelect: () => void; compact?: boolean }) {
  return <article className={`person-card ${selected ? 'selected' : ''} ${compact ? 'compact' : ''}`}><div className="person-card-top"><Avatar name={person.name} photoUrl={person.photoUrl} size={78} /><div><h3>{person.name}</h3><p>{person.role}</p></div></div><div className="person-card-place"><strong>{person.ministry}</strong><span>{person.secretariat || person.directorate}</span></div><div className="person-card-topics">{person.topics.slice(0, 3).map(topic => <Chip key={topic}>{topic}</Chip>)}</div><Button onClick={onSelect}><UserRound size={19} /> Ver perfil</Button></article>
}

export function ProfilePanel({ person, onClose }: { person?: Person; onClose: () => void }) {
  const { items, directorates } = useCatalog()
  if (!person) return null
  const related = items.filter(item => item.authorId === person.id && item.status === 'publicado').slice(0, 2)
  const directorate = directorates.find(item => item.id === person.directorateId)
  return <aside className="surface profile-panel"><div className="panel-heading"><h2>Detalle del perfil</h2><button aria-label="Cerrar perfil" onClick={onClose}><X size={20} /></button></div><div className="profile-person"><Avatar name={person.name} photoUrl={person.photoUrl} size={82} /><span><strong>{person.name}</strong><small>{person.role}</small><em><Building2 size={14} /> {person.ministry}</em>{person.secretariat && <em><Building2 size={14} /> {person.secretariat}</em>}</span></div>{person.bio && <div className="profile-section"><strong>Sobre su rol</strong><p>{person.bio}</p></div>}<div className="profile-contact"><a href={`mailto:${person.email}`}><Mail size={19} /><span>Correo institucional<small>{person.email}</small></span></a>{person.phone && <a href={`tel:${person.phone.replace(/[^+\d]/g, '')}`}><Phone size={19} /><span>Teléfono<small>{person.phone}</small></span></a>}</div>{person.topics.length > 0 && <div className="profile-section"><strong>Temas en los que puede asesorar</strong><div className="profile-tags">{person.topics.map(topic => <Chip key={topic}>{topic}</Chip>)}</div></div>}<div className="profile-section profile-newsletters"><div className="box-title-row"><strong>Newsletters publicados</strong><Link to="/newsletters">Ver todos <ArrowRight size={15} /></Link></div>{related.length ? related.map(item => <Link key={item.id} to={`/newsletters/${item.id}`}><BookOpen size={15} /><span>{item.title}</span><small>{item.date}</small></Link>) : <p>Sin newsletters publicados.</p>}</div>{directorate && <div className="profile-actions"><Link className="btn btn-outline" to={`/direcciones-generales?direccion=${directorate.id}`}><Building2 size={18} /> Ver dirección general</Link></div>}</aside>
}
