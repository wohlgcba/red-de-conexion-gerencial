import { Info, Mail, Phone, UserRound } from 'lucide-react'
import { useCatalog } from '../../app/useCatalog'
import { Avatar } from '../common/Avatar'
import { Button } from '../common/UI'
import type { Membership, OrganizationResponsibility } from '../../types/organization'
import type { Person } from '../../types'
import { effectiveMembership } from './organizationModel'

const labels = { member: 'Miembro de la Red', non_member: 'No miembro', pending: 'Pendiente de conciliación', unidentified: 'Responsable no identificado' }
export function MembershipBadge({ membership }: { membership: Membership | 'unidentified' }) {
  return <span className={`organization-badge membership-${membership}`}>{membership === 'member' && <i aria-hidden="true" />}{labels[membership]}</span>
}
export function OrganizationResponsibleCard({ assignment, pending = false, unitName, direct, onProfile }: {
  assignment?: OrganizationResponsibility; pending?: boolean; unitName: string; direct: boolean; onProfile: (person: Person) => void
}) {
  const { people } = useCatalog()
  const person = assignment?.membership === 'member' ? people.find(person => person.id === assignment.personId) : undefined
  const membership = assignment ? effectiveMembership(assignment, person) : pending ? 'pending' : 'unidentified'
  return <article className="organization-responsible-card">
    <Avatar name={assignment?.name} photoUrl={person?.photoUrl} size={44} />
    <div className="organization-responsible-info"><div><strong>{assignment?.name ?? (pending ? 'Asignación pendiente de revisión' : 'Responsable no identificado')}</strong><MembershipBadge membership={membership} /></div>
      {assignment && <p>{assignment.role}</p>}
      <small className="organization-responsible-origin">{direct ? 'Responsable directo' : 'Unidad dependiente'} · {unitName}</small>
      {membership === 'member' && person ? <div className="organization-contact-row"><span>{person.email && <a href={`mailto:${person.email}`}><Mail size={14} />{person.email}</a>}{person.phone && <a href={`tel:${person.phone.replace(/[^+\d]/g, '')}`}><Phone size={14} />{person.phone}</a>}</span><Button onClick={() => onProfile(person)}><UserRound size={14} /> Ver perfil en Directorio</Button></div>
        : <span className="organization-no-profile"><Info size={13} />{membership === 'non_member' ? 'Sin perfil en la Red' : pending && !assignment ? 'Los datos contienen candidatos cuya asignación necesita revisión.' : membership === 'pending' ? 'La vinculación con el Directorio está pendiente de verificación.' : 'No hay una asignación de responsabilidad confirmada para esta unidad.'}</span>}
    </div>
  </article>
}
