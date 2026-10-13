import type { OrganizationDataset, OrganizationUnit } from '../../types/organization'
import { norm } from '../../utils/format'
import type { Person } from '../../types'
import type { Membership, OrganizationResponsibility } from '../../types/organization'

export function effectiveMembership(item: OrganizationResponsibility, person?: Person): Membership {
  return item.membership === 'member' && !person ? 'pending' : item.membership
}

export function buildOrganizationIndex(dataset: OrganizationDataset) {
  const units = new Map(dataset.units.map(unit => [unit.id, unit]))
  if (units.size !== dataset.units.length) throw new Error('La estructura contiene identificadores duplicados.')
  const children = new Map<string, OrganizationUnit[]>()
  const roots: OrganizationUnit[] = []
  const path = new Map<string, OrganizationUnit[]>()
  const rootId = new Map<string, string>()
  const visiting = new Set<string>()
  const visit = (unit: OrganizationUnit): OrganizationUnit[] => {
    const known = path.get(unit.id)
    if (known) return known
    if (visiting.has(unit.id)) throw new Error('La estructura contiene una dependencia circular.')
    visiting.add(unit.id)
    const parent = unit.parentId ? units.get(unit.parentId) : undefined
    if (unit.parentId && !parent) throw new Error('No se encontró una unidad superior de la estructura.')
    const ancestors = parent ? visit(parent) : []
    if (ancestors.length >= 60) throw new Error('La estructura supera la profundidad admitida.')
    const result = [...ancestors, unit]
    path.set(unit.id, result); rootId.set(unit.id, result[0].id); visiting.delete(unit.id)
    return result
  }
  for (const unit of dataset.units) {
    visit(unit)
    if (!unit.parentId) roots.push(unit)
    else { const list = children.get(unit.parentId) ?? []; list.push(unit); children.set(unit.parentId, list) }
  }
  const assignments = new Map<string, OrganizationDataset['responsibilities']>()
  for (const assignment of dataset.responsibilities) {
    if (!units.has(assignment.unitId)) throw new Error('Una responsabilidad apunta a una unidad inexistente.')
    const list = assignments.get(assignment.unitId) ?? []; list.push(assignment); assignments.set(assignment.unitId, list)
  }
  const search = dataset.units.map(unit => ({ unit, rootId: rootId.get(unit.id)!, text: norm([unit.name, unit.type, ...(assignments.get(unit.id) ?? []).map(item => item.name)].join(' ')) }))
  return { units, children, roots, path, rootId, assignments, search,
    statistics: { roots: roots.length, units: units.size, responsible: new Set(dataset.responsibilities.map(item => item.responsibleId)).size } }
}
export type OrganizationIndex = ReturnType<typeof buildOrganizationIndex>

export function visibleOrganizationNodes(index: OrganizationIndex, root: string, expanded: Set<string>) {
  const result: { unit: OrganizationUnit; depth: number }[] = []
  const visit = (unit: OrganizationUnit, depth: number) => {
    result.push({ unit, depth })
    if (expanded.has(unit.id)) for (const child of index.children.get(unit.id) ?? []) visit(child, depth + 1)
  }
  const unit = index.units.get(root)
  if (unit) visit(unit, 0)
  return result
}

export function expansionForRoot(index: OrganizationIndex, root: string, limit = 500) {
  const expanded = new Set<string>()
  const queue = [root]
  let visible = 1
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const children = index.children.get(queue[cursor]) ?? []
    if (!children.length) continue
    if (visible + children.length > limit) return { expanded, limited: true }
    expanded.add(queue[cursor]); visible += children.length; queue.push(...children.map(unit => unit.id))
  }
  return { expanded, limited: false }
}
