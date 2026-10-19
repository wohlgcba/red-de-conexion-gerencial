import { createHmac } from 'node:crypto'
import type { DotacionComparison, DotacionComparisonPage, DotacionFilters, DotacionStatus, InstitutionalAssignment } from '../../src/types/dotacion.ts'

export interface DirectoryEntry {
  id: string
  name: string
  identifier: string | null
  active: boolean
  role: string
  ministry: string
  secretariat: string
  directorate: string
  exceptionActive: boolean
  exceptionJustification: string | null
}
export interface SourceRow {
  identifier: string
  name: string
  role: string
  ministry: string
  unit: string
  path: string | null
}

export const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
export function identity(value: unknown): string | null {
  const key = String(value ?? '').trim().replace(/[\s-]/g, '')
  if (!/^\d{11}$/.test(key) || /^(\d)\1+$/.test(key)) return null
  const remainder = 11 - [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((sum, weight, index) => sum + Number(key[index]) * weight, 0) % 11
  const check = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder
  return Number(key[10]) === check ? key : null
}
export const isManager = (role: string) => /^(sub)?gerent[ea](?:\s|$)/.test(normalize(role))

// Read PATH only with a known delimiter. Never guess missing hierarchy from a title.
export function assignment(row: SourceRow): InstitutionalAssignment {
  const path = row.path?.split(/\s*(?:\||>|\\|;)\s*/).map(value => value.trim()).filter(Boolean) ?? []
  return {
    role: row.role.trim(), ministry: row.ministry.trim(), unit: row.unit.trim(),
    secretariat: path.filter(value => /^(?:subsecretaria|secretaria|ss|sec)\b/.test(normalize(value))).join(' > '),
    directorate: path.findLast(value => /^(?:direccion general|dg)\b/.test(normalize(value))) ?? '',
    management: path.findLast(value => /^(?:subgerencia|gerencia|go|sgo|gg)\b/.test(normalize(value))) ?? '',
  }
}
const baseline = (person: DirectoryEntry): InstitutionalAssignment => ({ role: person.role, ministry: person.ministry, secretariat: person.secretariat, directorate: person.directorate, management: '', unit: '' })
const displayName = (name: string) => name.includes(',') ? name.split(',').slice(1).join(' ').trim() + ' ' + name.split(',')[0].trim() : name.trim()
const canonicalUnit = (value: string) => normalize(value).replace(/^ss\b/, 'subsecretaria').replace(/^sec\b/, 'secretaria').replace(/^dg\b/, 'direccion general').replace(/^(subsecretaria|secretaria|direccion general) de\b/, '$1')
function comparable(field: string, before: string, current: string) {
  if (field === 'secretariat') return current.split(' > ').some(unit => canonicalUnit(unit) === canonicalUnit(before)) || canonicalUnit(before) === canonicalUnit(current)
  if (field === 'directorate') return canonicalUnit(before) === canonicalUnit(current)
  return normalize(before) === normalize(current)
}
// Only compare corresponding fields when both sources actually provide them.
function differences(old: InstitutionalAssignment, current: InstitutionalAssignment[]): string[] {
  if (!current.length) return []
  const fields = [['role', 'Cargo'], ['ministry', 'Organismo'], ['secretariat', 'Secretaría / Subsecretaría'], ['directorate', 'Dirección General']] as const
  return fields.filter(([field]) => old[field].trim() && current.every(item => item[field].trim() && !comparable(field, old[field], item[field]))).map(([, label]) => label)
}

export function reconcile(directory: DirectoryEntry[], source: SourceRow[], secret: string): DotacionComparison[] {
  const people = new Map<string, DirectoryEntry[]>()
  let incompleteDirectory = false
  for (const person of directory) {
    const key = identity(person.identifier)
    if (key) people.set(key, [...(people.get(key) ?? []), person])
    else incompleteDirectory = true
  }
  const grouped = new Map<string, SourceRow[]>()
  for (const row of source) {
    const key = identity(row.identifier)
    if (key) grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  const result: DotacionComparison[] = directory.map(person => {
    const key = identity(person.identifier)
    const records = key ? grouped.get(key) ?? [] : []
    const current = [...new Map(records.map(row => { const value = assignment(row); return [JSON.stringify(value), value] })).values()]
    const before = baseline(person)
    const changes = differences(before, current)
    let status: DotacionStatus = 'unchanged'
    let note: string | null = null
    if (!key || people.get(key)!.length > 1) { status = 'pending'; note = key ? 'Identidad vinculada a más de un perfil; requiere revisión.' : 'Falta un identificador válido y verificado para consultar.' }
    else if (!current.length) status = 'missing'
    else if (current.some(item => !item.role.trim())) { status = 'pending'; note = 'Dotación contiene asignaciones sin cargo informado.' }
    else if (!current.some(item => isManager(item.role))) status = 'other_role'
    else if (changes.length) status = 'changed'
    else if (!person.role.trim() || !person.ministry.trim() || current.some(item => !item.ministry.trim())) { status = 'pending'; note = 'Faltan datos para comparar cargo y organismo.' }
    // At least one complete assignment must still match; separate assignments must not mask a move.
    else if (!current.some(item => normalize(item.role) === normalize(before.role) && normalize(item.ministry) === normalize(before.ministry))) { status = 'changed'; changes.push('Asignación institucional') }
    return { id: person.id, personId: person.id, name: person.name, active: person.active, directory: before, current, status, changes,
      exceptionActive: person.exceptionActive, exceptionJustification: person.exceptionJustification, membershipPending: false, note }
  })
  for (const [key, records] of grouped) {
    if (people.has(key) || !records.some(row => isManager(row.role))) continue
    const current = [...new Map(records.map(row => { const value = assignment(row); return [JSON.stringify(value), value] })).values()]
    result.push({ id: 'candidate-' + createHmac('sha256', secret).update(key).digest('hex').slice(0, 32), personId: null,
      name: displayName(records[0].name) || 'Nombre no informado', active: null, directory: null, current, status: 'candidate', changes: [],
      exceptionActive: false, exceptionJustification: null, membershipPending: incompleteDirectory,
      note: incompleteDirectory ? 'Sin coincidencia entre las identidades verificadas. Hay perfiles del Directorio sin identificador; confirmar pertenencia antes de incorporar.' : null })
  }
  // Keep source managers with unusable identifiers visible for manual reconciliation.
  // They are not asserted to be non-members and cannot gain a profile or access here.
  const unresolved = new Map<string, SourceRow>()
  for (const row of source) {
    if (identity(row.identifier) || !isManager(row.role)) continue
    const opaque = createHmac('sha256', secret).update(JSON.stringify(row)).digest('hex').slice(0, 32)
    unresolved.set(opaque, row)
  }
  for (const [opaque, row] of unresolved) result.push({ id: 'unresolved-' + opaque, personId: null, name: displayName(row.name) || 'Nombre no informado',
    active: null, directory: null, current: [assignment(row)], status: 'pending', changes: [], exceptionActive: false, exceptionJustification: null,
    membershipPending: true, note: 'Dotación informa un cargo gerencial, pero su identificador no es válido para conciliarlo con el Directorio. Requiere revisión manual.' })
  return result
}

export function paginate(rows: DotacionComparison[], filters: DotacionFilters, consultedAt: string, warnings: string[]): DotacionComparisonPage {
  const counts = { unchanged: 0, changed: 0, other_role: 0, missing: 0, pending: 0, candidate: 0, exceptions: 0, directory: 0 }
  const ministries = new Set<string>()
  for (const row of rows) {
    counts[row.status]++; if (row.exceptionActive) counts.exceptions++; if (row.personId) counts.directory++
    if (row.directory?.ministry) ministries.add(row.directory.ministry)
    row.current.forEach(item => { if (item.ministry) ministries.add(item.ministry) })
  }
  const query = normalize(filters.query)
  const filtered = rows.filter(row => (!filters.status || row.status === filters.status)
    && (!filters.membership || (filters.membership === 'directory' ? !!row.personId : !row.personId))
    && (!filters.exceptionsOnly || row.exceptionActive)
    && (!filters.ministry || row.directory?.ministry === filters.ministry || row.current.some(item => item.ministry === filters.ministry))
    && (!query || normalize([row.name, ...Object.values(row.directory ?? {}), ...row.current.flatMap(item => Object.values(item))].join(' ')).includes(query)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id))
  const page = Math.min(filters.page, Math.max(1, Math.ceil(filtered.length / filters.pageSize)))
  return { rows: filtered.slice((page - 1) * filters.pageSize, page * filters.pageSize), total: filtered.length, page, pageSize: filters.pageSize,
    counts, ministries: [...ministries].sort((a, b) => a.localeCompare(b, 'es')), consultedAt, source: 'Dotación MySQL · consulta online', sourceUpdatedAt: null, warnings }
}
