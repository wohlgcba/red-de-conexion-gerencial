import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { Building2, ChevronDown, ChevronUp, Eye, Landmark, Network, Plus, UserRound } from 'lucide-react'
import { Avatar } from '../common/Avatar'
import { MembershipBadge } from './OrganizationResponsibleCard'
import type { OrganizationResponsibility, OrganizationUnit } from '../../types/organization'
import type { Person } from '../../types'
import { effectiveMembership } from './organizationModel'
import { unitTone } from './organizationGraph'

export interface OrganizationNodeData extends Record<string, unknown> {
  unit: OrganizationUnit
  assignment?: OrganizationResponsibility
  person?: Person
  childCount: number
  hiddenCount: number
  expanded: boolean
  highlighted: boolean
  onActivate: (id: string) => void
  onToggle: (id: string) => void
  onDetail: (id: string) => void
  onMore: (id: string) => void
  onFocus?: (id: string) => void
}
export type ChartNode = Node<OrganizationNodeData, 'organization'>

export const OrganizationNodeCard = memo(function OrganizationNodeCard({ data, selected }: { data: OrganizationNodeData; selected?: boolean }) {
  const { unit, assignment, person, childCount, hiddenCount, expanded } = data
  const tone = unitTone(unit)
  const Icon = tone === 'government' ? UserRound : tone === 'secretariat' || tone === 'subsecretariat' ? Network : tone === 'ministry' ? Landmark : Building2
  const membership = assignment ? effectiveMembership(assignment, person) : unit.responsibilityPending ? 'pending' : 'unidentified'
  return <article className={`organization-graph-card tone-${tone} ${selected ? 'selected' : ''} ${data.highlighted ? 'on-path' : ''}`} onFocusCapture={event => { if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) data.onFocus?.(unit.id) }}>
    <div className="organization-card-top">
      <button className="organization-card-activate nodrag" type="button" onClick={() => data.onActivate(unit.id)} aria-label={`${childCount && !/gerencia/i.test(unit.type) ? 'Explorar' : 'Ver detalle de'} ${unit.name}`}><Icon size={22} aria-hidden="true" /><span>{unit.name}</span></button>
      {childCount > 0 && <button className="organization-card-expand nodrag" type="button" aria-label={`${expanded ? 'Colapsar' : 'Expandir'} ${unit.name}`} aria-expanded={expanded} onClick={() => data.onToggle(unit.id)}>{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>}
    </div>
    <div className="organization-card-code" title={unit.code ?? undefined}>{unit.code ?? 'Código no informado'}</div>
    <button className="organization-card-responsible nodrag" type="button" onClick={() => data.onDetail(unit.id)} aria-label={`Consultar responsables de ${unit.name}`}>
      {assignment && <Avatar size={34} name={assignment.name} photoUrl={person?.photoUrl} />}
      <span><strong>{assignment?.name ?? (unit.responsibilityPending ? 'Asignación pendiente de revisión' : 'Responsable no identificado')}</strong>{assignment || unit.responsibilityPending ? <MembershipBadge membership={membership} /> : <small>Sin asignación confirmada</small>}</span>
    </button>
    <div className="organization-card-bottom"><span>{unit.type}</span><button type="button" className="nodrag" aria-label={`Ver detalle de ${unit.name}`} onClick={() => data.onDetail(unit.id)}><Eye size={15} /> Detalle</button></div>
    {childCount > 0 && <div className="organization-card-children"><span>{childCount} {childCount === 1 ? 'dependencia' : 'dependencias'}</span>{expanded && hiddenCount > 0 && <button type="button" className="nodrag" onClick={() => data.onMore(unit.id)} aria-label={`Mostrar más dependencias de ${unit.name}`}><Plus size={13} />{hiddenCount} más</button>}</div>}
  </article>
})

export const OrganizationNode = memo(function OrganizationNode({ data, selected }: NodeProps<ChartNode>) {
  return <><Handle type="target" position={Position.Top} isConnectable={false} /><OrganizationNodeCard data={data} selected={selected} /><Handle type="source" position={Position.Bottom} isConnectable={false} /></>
})
