import { useMemo } from 'react'
import { useCatalog } from '../../app/useCatalog'
import { OrganizationNodeCard } from './OrganizationNode'
import type { OrganizationCanvasProps } from './OrganizationCanvas'

export function OrganizationMobileExplorer({ graph, index, selectedId, expanded, onActivate, onToggle, onDetail, onMore }: OrganizationCanvasProps) {
  const { people } = useCatalog()
  const peopleById = useMemo(() => new Map(people.map(person => [person.id, person])), [people])
  const path = useMemo(() => new Set((index.path.get(selectedId) ?? []).map(unit => unit.id)), [index, selectedId])
  const visible = useMemo(() => {
    const rows: { id: string; depth: number }[] = []
    const visit = (id: string, depth: number) => { rows.push({ id, depth }); for (const child of graph.children.get(id) ?? []) visit(child.id, depth + 1) }
    graph.roots.forEach(root => visit(root.id, 0))
    return rows
  }, [graph])
  return <ol className="organization-mobile-explorer" aria-label="Exploración jerárquica del Organigrama">{visible.map(({ id, depth }) => {
    const unit = index.units.get(id)!
    const assignment = index.assignments.get(id)?.[0]
    return <li id={`organization-mobile-${id}`} key={id} style={{ marginLeft: Math.min(depth, 4) * 12 }}><small className="organization-mobile-level">Nivel {depth + 1}{unit.parentId ? ` · ${index.units.get(unit.parentId)?.name}` : ' · Organismo superior'}</small><OrganizationNodeCard selected={selectedId === id} data={{ unit, assignment, person: assignment?.membership === 'member' && assignment.personId ? peopleById.get(assignment.personId) : undefined, childCount: index.children.get(id)?.length ?? 0, hiddenCount: graph.hidden.get(id) ?? 0, expanded: expanded.has(id), highlighted: path.has(id), onActivate, onToggle, onDetail, onMore }} /></li>
  })}</ol>
}
