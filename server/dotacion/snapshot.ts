import type { CandidateContact } from '../../src/types/dotacion.ts'
import type { IntakeLookup, IntakeProfile } from '../../src/types/accessIntake.ts'
import { assignment, identity, isManager } from './model.ts'
import type { SourceRow } from './model.ts'
import { DotacionError } from './errors.ts'

export interface SavedSource { rows: SourceRow[]; warnings: string[]; coverage: string[]; syncedAt: string }
export async function snapshotRpc<T>(name: string, args: object, env: NodeJS.ProcessEnv): Promise<T> {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new DotacionError(503, 'configuration', 'Falta configurar el padrón privado del servidor.')
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Profile': 'red_conexion_gerencial' }, body: JSON.stringify(args), signal: AbortSignal.timeout(name === 'server_replace_gerencial_snapshot' ? 40000 : 10000) })
    if (!response.ok) throw new DotacionError(503, 'snapshot_unavailable', 'No pudimos consultar o actualizar el padrón guardado. La versión anterior se conserva; verificá la activación y reintentá.')
    return await response.json() as T
  } catch (error) {
    if (error instanceof DotacionError) throw error
    throw new DotacionError(503, 'snapshot_unconfirmed', 'No pudimos confirmar la respuesta del servidor. Consultá nuevamente el padrón y su fecha antes de repetir la actualización.')
  }
}
export async function readSavedSource(_keys: string[], env: NodeJS.ProcessEnv, adminId: string): Promise<SavedSource> {
  const result = await snapshotRpc<SavedSource | null>('server_gerencial_snapshot', { p_admin: adminId }, env)
  if (!result) throw new DotacionError(503, 'snapshot_empty', 'Todavía no hay un padrón guardado. Elegí «Actualizar desde Dotación» para realizar la primera carga gerencial.')
  return result
}
export async function saveSource(adminId: string, source: { rows: (SourceRow & { contacts?: CandidateContact[] })[]; warnings: string[] }, coverage: string[], startedAt: string, env: NodeJS.ProcessEnv) {
  // Explicit whitelist and deduplication. Never forward a MySQL record wholesale.
  const people = new Map<string, { identifier: string; rows: SourceRow[]; contacts: CandidateContact[] }>()
  for (const row of source.rows) {
    const key = identity(row.identifier)
    if (!key) continue
    if (!isManager(row.role) && !coverage.includes(key)) throw new DotacionError(503, 'scope', 'La actualización excede el padrón gerencial autorizado.')
    const person = people.get(key) ?? { identifier: key, rows: [], contacts: [] }
    const clean = { identifier: key, name: row.name, role: row.role, ministry: row.ministry, unit: row.unit, path: row.path }
    if (!person.rows.some(previous => JSON.stringify(previous) === JSON.stringify(clean))) person.rows.push(clean)
    for (const contact of row.contacts ?? []) if (!person.contacts.some(previous => previous.kind === contact.kind && previous.value === contact.value)) person.contacts.push({ kind: contact.kind, label: contact.label, value: contact.value, sourceField: contact.sourceField })
    people.set(key, person)
  }
  await snapshotRpc('server_replace_gerencial_snapshot', { p_admin: adminId, p_people: [...people.values()], p_coverage: [...new Set(coverage)], p_warnings: source.warnings, p_started_at: startedAt }, env)
}
export const savedCandidateContacts = (key: string, env: NodeJS.ProcessEnv, adminId: string) => snapshotRpc<CandidateContact[]>('server_gerencial_contacts', { p_admin: adminId, p_key: key }, env)
export async function savedIntakeProfile(key: string, _email: string, env: NodeJS.ProcessEnv, userId: string): Promise<IntakeLookup> {
  const rows = await snapshotRpc<SourceRow[]>('server_gerencial_intake', { p_user: userId, p_key: key }, env)
  if (!rows.length) return { outcome: 'manual', profiles: [] }
  const managers = rows.filter(row => isManager(row.role))
  if (!managers.length) return { outcome: 'other', profiles: [] }
  const profiles: IntakeProfile[] = managers.map(row => {
    const parts = row.name.split(','), data = assignment(row)
    return { given: parts.length > 1 ? parts.slice(1).join(',').trim().slice(0, 100) : '', family: parts.length > 1 ? parts[0].trim().slice(0, 100) : '', role: data.role.slice(0, 200), ministry: data.ministry.slice(0, 200), secretariat: data.secretariat.slice(0, 300), directorate: data.directorate.slice(0, 300), unit: data.unit }
  })
  return { outcome: 'matched', profiles }
}
