import { Info, Mail, Phone, UserRound } from 'lucide-react'
import { useCatalog } from '../../app/useCatalog'
import { Avatar } from '../common/Avatar'
import { Button } from '../common/UI'
import type { AuthorityStatus, Membership, OrganizationResponsibility } from '../../types/organization'
import type { Person } from '../../types'
import { effectiveMembership } from './organizationModel'
import { AUTHORITY_LABELS, authorityPlaceholder } from '../../utils/organizationAuthority'

const labels = { member: 'Miembro de la Red', non_member: 'No miembro', pending: 'Pendiente de conciliación', unidentified: 'Responsable no identificado' }
export function MembershipBadge({ membership }: { membership: Membership | 'unidentified' }) {
  return <span className={`organization-badge membership-${membership}`}>{membership === 'member' && <i aria-hidden="true" />}{labels[membership]}</span>
}
export function OrganizationResponsibleCard({ assignment, pending = false, identificationStatus, reason, unitName, direct, onProfile }: {
  assignment?: OrganizationResponsibility; pending?: boolean; identificationStatus?: AuthorityStatus; reason?: string; unitName: string; direct: boolean; onProfile: (person: Person) => void
}) {
  const { people } = useCatalog()
  const person = assignment?.membership === 'member' ? people.find(person => person.id === assignment.personId) : undefined
  const membership = assignment ? effectiveMembership(assignment, person) : pending ? 'pending' : 'unidentified'
  return <article className="organization-responsible-card">
    <Avatar name={assignment?.name} photoUrl={person?.photoUrl} size={44} />
    <div className="organization-responsible-info"><div><strong>{assignment?.name ?? authorityPlaceholder({ identificationStatus, responsibilityPending: pending })}</strong>{assignment && <MembershipBadge membership={membership} />}</div>
      {assignment && <p>{assignment.role}</p>}
      {assignment?.identificationStatus && <small>{AUTHORITY_LABELS[assignment.identificationStatus]}</small>}
      {assignment?.source && <small>Fuente: {assignment.source}{assignment.sourcePeriod ? ` · ${assignment.sourcePeriod}` : ''}{assignment.sourceDate ? ` · ${assignment.sourceDate}` : ''}</small>}
      {assignment?.checkedAt && <small>Última conciliación: {assignment.checkedAt}</small>}
      {assignment?.administrativeRole && assignment.administrativeRole !== assignment.role && <small>Clasificación administrativa: {assignment.administrativeRole}</small>}
      {assignment?.validityBasis && <small>{assignment.validityBasis}</small>}
      {!assignment && reason && <small>{reason}</small>}
      <small className="organization-responsible-origin">{direct ? 'Responsable directo' : 'Unidad dependiente'} · {unitName}</small>
      {membership === 'member' && person ? <div className="organization-contact-row"><span>{person.email && <a href={`mailto:${person.email}`}><Mail size={14} />{person.email}</a>}{person.phone && <a href={`tel:${person.phone.replace(/[^+\d]/g, '')}`}><Phone size={14} />{person.phone}</a>}</span><Button onClick={() => onProfile(person)}><UserRound size={14} /> Ver perfil en Directorio</Button></div>
        : assignment && <span className="organization-no-profile"><Info size={13} />{membership === 'non_member' ? 'Sin perfil en la Red' : 'La vinculación con el Directorio está pendiente de verificación.'}</span>}
    </div>
  </article>
}
