import { Building2, ChevronRight, Network, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../common/UI'
import type { Person } from '../../types'
import type { OrganizationUnit } from '../../types/organization'
import type { OrganizationIndex } from './organizationModel'
import { MembershipBadge, OrganizationResponsibleCard } from './OrganizationResponsibleCard'

export function OrganizationUnitDetails({ unit, index, onSelect, onProfile }: {
  unit: OrganizationUnit; index: OrganizationIndex; onSelect: (id: string) => void; onProfile: (person: Person) => void
}) {
  const path = index.path.get(unit.id) ?? [unit]
  const children = index.children.get(unit.id) ?? []
  const secretariats = path.filter(item => /^(Sub)?Secretaría$/.test(item.type)).map(item => item.name)
  const groups = [unit, ...children]
  const [visibleGroups, setVisibleGroups] = useState(20)
  return <div className="organization-detail-content" key={unit.id}>
    <h2>{unit.name}</h2>
    <nav className="organization-breadcrumb" aria-label="Recorrido institucional">{path.map((ancestor, i) => <span key={ancestor.id}>{i > 0 && <ChevronRight size={13} aria-hidden="true" />}<button type="button" onClick={() => onSelect(ancestor.id)} aria-current={ancestor.id === unit.id ? 'location' : undefined}>{ancestor.name}</button></span>)}</nav>
    <dl className="organization-institutional-data">
      <div><Building2 size={17} /><dt>Tipo</dt><dd>{unit.type}</dd></div>
      {unit.code && <div><Building2 size={17} /><dt>Código organizacional</dt><dd>{unit.code}</dd></div>}
      <div><Building2 size={17} /><dt>Organismo / Área rectora</dt><dd>{path[0].name}</dd></div>
      {secretariats.length > 0 && <div><Network size={17} /><dt>Secretaría / Subsecretaría</dt><dd>{secretariats.join(' / ')}</dd></div>}
      <div><Network size={17} /><dt>Unidad superior inmediata</dt><dd>{path.at(-2)?.name ?? 'Organismo superior'}</dd></div>
      <div><UsersRound size={17} /><dt>Unidades dependientes directas</dt><dd>{children.length}</dd></div>
    </dl>
    <section className="organization-responsibilities"><h3>Responsables y dependencias</h3><p className="organization-section-help">Asignaciones directas de esta unidad y sus dependencias inmediatas.</p>
      {groups.slice(0, visibleGroups).map(group => <div key={group.id} className="organization-responsible-group">
        {(index.assignments.get(group.id)?.length ? index.assignments.get(group.id)! : [undefined]).map((assignment, i) => <OrganizationResponsibleCard key={assignment?.id ?? i} assignment={assignment} pending={group.responsibilityPending} unitName={group.name} direct={group.id === unit.id} onProfile={onProfile} />)}
      </div>)}
      {groups.length > visibleGroups && <Button onClick={() => setVisibleGroups(count => count + 20)}>Mostrar más dependencias ({groups.length - visibleGroups})</Button>}
      {children.length === 0 && <p className="organization-section-help">No hay dependencias directas relevadas para esta unidad.</p>}
    </section>
    <section className="organization-references"><h3>Referencias</h3><div><span><MembershipBadge membership="member" /><small>Vinculación válida con el Directorio.</small></span><span><MembershipBadge membership="non_member" /><small>Ausencia de perfil verificada.</small></span><span><MembershipBadge membership="unidentified" /><small>No hay una asignación confirmada.</small></span></div><p>Una vinculación sin verificar se muestra como pendiente de conciliación.</p></section>
  </div>
}
