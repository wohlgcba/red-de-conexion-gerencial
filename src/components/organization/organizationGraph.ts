import type { OrganizationUnit } from '../../types/organization'
import type { OrganizationIndex } from './organizationModel'
import { norm } from '../../utils/format'

export const NODE_WIDTH = 272
export const NODE_HEIGHT = 234
export const GRAPH_LIMIT = 220
export const CHILD_PAGE = 24
const HORIZONTAL_GAP = 36
const VERTICAL_GAP = 68

export type UnitTone = 'government' | 'ministry' | 'secretariat' | 'subsecretariat' | 'directorate' | 'management' | 'submanagement' | 'special'
export const UNIT_LEGEND: { tone: UnitTone; label: string }[] = [
  { tone: 'government', label: 'Jefatura / Vicejefatura' },
  { tone: 'ministry', label: 'Ministerios / Jefatura de Gabinete' },
  { tone: 'secretariat', label: 'Secretarías' },
  { tone: 'subsecretariat', label: 'Subsecretarías' },
  { tone: 'directorate', label: 'Direcciones Generales' },
  { tone: 'management', label: 'Gerencias' },
  { tone: 'submanagement', label: 'Subgerencias' },
  { tone: 'special', label: 'Otras unidades / áreas especiales' },
]

// Color follows institutional type, never depth. Generic root types can be
// classified by their explicit institutional denomination, without reparenting.
export function unitTone(unit: OrganizationUnit): UnitTone {
  const type = norm(unit.type)
  const name = norm(unit.name)
  if (/^(jefe de gobierno|jefatura de gobierno|vicejefatura de gobierno)$/.test(name)) return 'government'
  if (type === 'ministerio' || name.startsWith('ministerio ') || name === 'jefatura de gabinete de ministros') return 'ministry'
  if (type.startsWith('subsecretaria')) return 'subsecretariat'
  if (type.startsWith('secretaria')) return 'secretariat'
  if (type.includes('direccion general')) return 'directorate'
  if (type.startsWith('subgerencia')) return 'submanagement'
  if (type.startsWith('gerencia')) return 'management'
  return 'special'
}

export function orderedRoots(index: OrganizationIndex) {
  const order = new Map(UNIT_LEGEND.map((item, i) => [item.tone, i]))
  return [...index.roots].sort((a, b) => order.get(unitTone(a))! - order.get(unitTone(b))! || a.name.localeCompare(b.name, 'es'))
}

export function visibleOrganizationGraph(index: OrganizationIndex, scope: string, expanded: ReadonlySet<string>, limits: ReadonlyMap<string, number>, selectedId: string, maximum = GRAPH_LIMIT) {
  const roots = scope ? [index.units.get(scope)!].filter(Boolean) : orderedRoots(index)
  const path = new Set((index.path.get(selectedId) ?? []).map(unit => unit.id))
  const nodes = [...roots]
  const shown = new Set(nodes.map(unit => unit.id))
  const children = new Map<string, OrganizationUnit[]>()
  const hidden = new Map<string, number>()
  for (let cursor = 0; cursor < nodes.length; cursor++) {
    const unit = nodes[cursor]
    const all = index.children.get(unit.id) ?? []
    if (!expanded.has(unit.id)) { hidden.set(unit.id, all.length); continue }
    const wanted = all.slice(0, limits.get(unit.id) ?? CHILD_PAGE)
    for (const child of all) if (path.has(child.id) && !wanted.includes(child)) wanted.push(child)
    const selected = wanted.filter(child => path.has(child.id))
    const others = wanted.filter(child => !path.has(child.id))
    // Reserve room for a searched unit's full ancestor chain, even when a
    // sibling list is large. No placeholder nodes or fictitious edges.
    const reserve = [...path].filter(id => !shown.has(id)).length
    const room = Math.max(0, maximum - nodes.length - Math.max(0, reserve - selected.length))
    const available = [...selected, ...others.slice(0, Math.max(0, room - selected.length))]
    const availableIds = new Set(available.map(child => child.id))
    const visible = all.filter(child => availableIds.has(child.id))
    children.set(unit.id, visible)
    hidden.set(unit.id, all.length - visible.length)
    for (const child of visible) { nodes.push(child); shown.add(child.id) }
  }
  const edges = nodes.filter(unit => unit.parentId && shown.has(unit.parentId)).map(unit => ({ id: `${unit.parentId}:${unit.id}`, source: unit.parentId!, target: unit.id }))
  return { roots, nodes, children, hidden, edges, limited: nodes.length >= maximum }
}
export type VisibleOrganizationGraph = ReturnType<typeof visibleOrganizationGraph>

// A tidy tree layout in O(visible nodes), suited to this validated forest.
// Widths account for whole visible subtrees, so siblings never overlap.
// An overview grid is a presentation of independent roots, with NO edges.
export function layoutOrganizationGraph(graph: VisibleOrganizationGraph, overviewColumns = 4) {
  const positions = new Map<string, { x: number; y: number }>()
  if (!graph.edges.length && graph.roots.length > 1) {
    graph.roots.forEach((unit, i) => positions.set(unit.id, { x: (i % overviewColumns) * (NODE_WIDTH + HORIZONTAL_GAP), y: Math.floor(i / overviewColumns) * (NODE_HEIGHT + 32) }))
    return positions
  }
  const widths = new Map<string, number>()
  const measure = (unit: OrganizationUnit): number => {
    const children = graph.children.get(unit.id) ?? []
    const width = Math.max(NODE_WIDTH, children.reduce((sum, child) => sum + measure(child), 0) + Math.max(0, children.length - 1) * HORIZONTAL_GAP)
    widths.set(unit.id, width)
    return width
  }
  const place = (unit: OrganizationUnit, left: number, depth: number) => {
    const width = widths.get(unit.id)!
    positions.set(unit.id, { x: left + (width - NODE_WIDTH) / 2, y: depth * (NODE_HEIGHT + VERTICAL_GAP) })
    const children = graph.children.get(unit.id) ?? []
    const total = children.reduce((sum, child) => sum + widths.get(child.id)!, 0) + Math.max(0, children.length - 1) * HORIZONTAL_GAP
    let childLeft = left + (width - total) / 2
    for (const child of children) { place(child, childLeft, depth + 1); childLeft += widths.get(child.id)! + HORIZONTAL_GAP }
  }
  let left = 0
  for (const root of graph.roots) { const width = measure(root); place(root, left, 0); left += width + HORIZONTAL_GAP * 2 }
  return positions
}
