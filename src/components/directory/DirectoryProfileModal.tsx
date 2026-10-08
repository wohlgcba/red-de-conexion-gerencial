import { Building2, Mail, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../app/useCatalog'
import type { Person } from '../../types'
import { formatDate } from '../../utils/format'
import { Avatar } from '../common/Avatar'
import { Button, Chip } from '../common/UI'
import { DirectoryDialog } from './DirectoryDialog'

export function DirectoryProfileModal({ person, onClose }: { person: Person; onClose: () => void }) {
  const { items } = useCatalog()
  const related = items.filter(item => item.authorId === person.id && item.status === 'publicado').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  return <DirectoryDialog title="Detalle del integrante" onClose={onClose} footer={<><Button onClick={onClose}>Cerrar</Button>{person.email && <a className="btn btn-primary" href={`mailto:${person.email}`}><Mail size={17} /> Enviar correo</a>}</>}>
    <div className="directory-profile-person"><Avatar name={person.name} photoUrl={person.photoUrl} size={90} /><div><h3>{person.name || 'Nombre no informado'}</h3><p>{person.role || 'Cargo no informado'}</p><div className="directory-profile-hierarchy"><Building2 size={15} /><span>{person.ministry || 'No informado'}<small>{person.secretariat || 'No informado'}</small><small>{person.directorate || 'No informado'}</small></span></div></div></div>
    <section className="directory-profile-section"><h3>Dependencia institucional</h3><dl className="directory-institutional-data"><div><dt>Ministerio / Área rectora</dt><dd>{person.ministry || 'No informado'}</dd></div><div><dt>Secretaría / Subsecretaría</dt><dd>{person.secretariat || 'No informado'}</dd></div><div><dt>Dirección General</dt><dd>{person.directorate || 'No informado'}</dd></div></dl></section>
    <section className="directory-profile-section"><h3>Información de contacto</h3><div className="directory-profile-contact"><div><Mail size={19} /><span><small>Correo institucional</small>{person.email ? <a href={`mailto:${person.email}`}>{person.email}</a> : 'No informado'}</span></div><div><Phone size={19} /><span><small>Teléfono</small>{person.phone ? <a href={`tel:${person.phone.replace(/[^+\d]/g, '')}`}>{person.phone}</a> : 'No informado'}</span></div></div></section>
    <section className="directory-profile-section"><h3>Breve descripción</h3><p>{person.bio || 'No agregó una descripción todavía.'}</p></section>
    <section className="directory-profile-section"><h3>Newsletters publicados</h3>{related.length ? <div className="directory-profile-newsletters">{related.map(item => <Link key={item.id} to={`/newsletters/${item.id}`} onClick={onClose}><img src={item.image} alt="" loading="lazy" /><span><strong>{item.title}</strong><small>{formatDate(item.date)}</small></span>{item.topic && <Chip>{item.topic}</Chip>}</Link>)}</div> : <p>Sin newsletters publicados.</p>}</section>
  </DirectoryDialog>
}
