import { Building2, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../app/useCatalog'
import { Chip, PageHeading, Surface } from '../components/common/UI'
import { UserAvatar } from '../components/layout/UserAvatar'
import './account.css'

export function AccountPage() {
  const { user, people, currentPersonId, isAdmin } = useCatalog()
  const person = people.find(item => item.id === currentPersonId)
  const metadataText = (key: string) => typeof user.user_metadata[key] === 'string' ? user.user_metadata[key].trim() : ''
  const metadataName = metadataText('full_name') || metadataText('name') || [metadataText('given_name'), metadataText('family_name')].filter(Boolean).join(' ')
  const name = person?.name || metadataName || user.email || 'Mi cuenta'
  const role = person?.role || metadataText('position_title') || metadataText('job_role') || (isAdmin ? 'Administración de la Red' : 'Integrante de la Red')
  const organization = person?.ministry || metadataText('ministry') || metadataText('organization')
  const image = metadataText('avatar_url') || metadataText('picture') || metadataText('photo_url')
  const photoUrl = /^https?:\/\//i.test(image) ? image : undefined
  const fields = [
    ['Nombre y apellido', person?.name || metadataName],
    ['Cargo', role],
    ['Ministerio / Área rectora', organization],
    ['Secretaría / Subsecretaría', person?.secretariat],
    ['Dirección General', person?.directorate],
    ['Correo institucional', person?.email],
    ['Teléfono', person?.phone],
  ]

  return <div className="page-stack account-overview">
    <Surface className="account-intro"><PageHeading title="Mi cuenta" subtitle="Consultá tu información de la Red y administrá el acceso a tu cuenta."
      actions={<Link className="btn btn-outline" to="/mi-cuenta/contrasena"><LockKeyhole size={18} /> Cambiar contraseña</Link>} /></Surface>
    <div className="account-overview-columns">
      <Surface className="account-profile-card">
        <div className="panel-heading"><h2>Mi perfil</h2></div>
        <div className="account-identity"><UserAvatar key={photoUrl} name={name} photoUrl={photoUrl} /><div><h2>{name}</h2><p>{role}</p>{organization && <span><Building2 size={17} aria-hidden="true" /> {organization}</span>}</div></div>
        {!person && <p className="account-profile-note">Tu cuenta todavía no tiene un perfil vinculado en el Directorio. Se muestran los datos disponibles de tu sesión.</p>}
        <section className="account-profile-section"><h3>Datos institucionales</h3><dl className="account-profile-fields">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'No informado'}</dd></div>)}</dl></section>
        {person && <>
          <section className="account-profile-section"><h3>Breve descripción</h3><p>{person.bio || 'Todavía no hay una descripción en tu perfil.'}</p></section>
          <section className="account-profile-section"><h3>Temas en los que podés asesorar</h3>{person.topics.length ? <div className="account-profile-topics">{person.topics.map(topic => <Chip key={topic}>{topic}</Chip>)}</div> : <p>Todavía no hay temas de asesoramiento en tu perfil.</p>}</section>
          <Link className="btn btn-outline" to={`/directorio?persona=${person.id}`}><UserRound size={18} /> Ver mi perfil en el Directorio</Link>
        </>}
      </Surface>
      <aside className="account-access-aside">
        <Surface className="account-access-card"><h2><ShieldCheck size={21} aria-hidden="true" /> Acceso a la Red</h2><dl><div><dt>Correo de acceso</dt><dd><Mail size={17} aria-hidden="true" /> {user.email || 'No informado'}</dd></div><div><dt>Permisos</dt><dd>{isAdmin ? 'Administrador' : 'Integrante'}</dd></div></dl></Surface>
        <Surface className="account-access-card"><h2><LockKeyhole size={21} aria-hidden="true" /> Contraseña</h2><p>Administrá tu contraseña desde una pantalla independiente.</p><Link className="btn btn-primary" to="/mi-cuenta/contrasena">Cambiar contraseña</Link></Surface>
      </aside>
    </div>
  </div>
}
