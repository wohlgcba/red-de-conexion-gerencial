import { requireSupabase, SCHEMA } from '../lib/supabase'
import { AdministrationUnavailable } from './administration'
import { parseAuthorityMetadata } from './organization'
import type { AuthorityStatus } from '../types/organization'

export interface AuthorityCandidate extends ReturnType<typeof parseAuthorityMetadata> {
  id: string; name: string; role: string; reason: string; excluded: boolean; evidenceUntil?: string
}
export interface AuthorityReviewUnit {
  id: string; name: string; type: string; organism: string; code: string; status: AuthorityStatus
  reason: string; referenceDate: string; version: number; proposedName: string; nameEvidence: string
  candidates: AuthorityCandidate[]; history: { action: string; note: string; evidence: string; at: string }[]
}
export interface AuthorityPage { total: number; rows: AuthorityReviewUnit[]; counts: Record<string, number> }
export interface AuthorityFilters { query: string; state: string; page: number; size: number }
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const text = (v: unknown) => typeof v === 'string' ? v : ''
const states: AuthorityStatus[] = ['automatic','manual','pending','vacant','unidentified','not_applicable']
const list = (v: unknown) => Array.isArray(v) ? v : []

export function parseAuthorityPage(value: unknown): AuthorityPage {
  const root = record(value)
  if (!Array.isArray(root.rows) || typeof root.total !== 'number') throw new Error('Respuesta de autoridades incompleta.')
  return { total: root.total, counts: Object.fromEntries(Object.entries(record(root.counts)).filter(([,v]) => typeof v === 'number')) as Record<string,number>, rows: root.rows.map(value => {
    const u = record(value)
    if (!text(u.id) || !states.includes(u.status as AuthorityStatus) || typeof u.version !== 'number') throw new Error('Unidad institucional inválida.')
    return { id: text(u.id), name: text(u.name), type: text(u.type), organism: text(u.organism), code: text(u.code),
      status: u.status as AuthorityStatus, version: u.version, reason: text(u.reason), referenceDate: text(u.referenceDate), proposedName: text(u.proposedName), nameEvidence: text(u.nameEvidence),
      candidates: list(u.candidates).map(value => { const c = record(value); return { id: text(c.id), name: text(c.name), role: text(c.role), reason: text(c.reason), excluded: c.excluded === true, evidenceUntil: text(c.evidenceUntil), ...parseAuthorityMetadata(c) } }),
      history: list(u.history).map(value => { const h = record(value); return { action: text(h.action), note: text(h.note), evidence: text(h.evidence), at: text(h.at) } }),
    }
  }) }
}
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await requireSupabase().schema(SCHEMA).rpc(name, args)
  if (error) {
    if (['PGRST202','42883'].includes(error.code)) throw new AdministrationUnavailable('Falta activar la migración local de autoridades y la conciliación revisada. No se modificaron datos remotos.')
    if (error.code === '40001') throw new Error('La dependencia cambió. Cerrá y actualizá la revisión.')
    if (error.code === '42501') throw new Error('Tu cuenta no tiene permisos para revisar autoridades.')
    if (['22023','P0001'].includes(error.code)) throw new Error(error.message.replace(/\d{2}[-. ]?\d{8}[-. ]?\d/g, '[identificador protegido]'))
    throw new Error('No pudimos completar la revisión. Reintentá en unos momentos.')
  }
  return data as unknown
}
export async function getAuthorityReviews(f: AuthorityFilters) {
  return parseAuthorityPage(await rpc('admin_organization_authorities', { p_query: f.query, p_state: f.state, p_page: f.page, p_size: f.size }))
}
export async function reviewAuthority(unit: AuthorityReviewUnit, state: AuthorityStatus, assignment: string, note: string, evidence: string, acceptName: boolean) {
  await rpc('admin_review_authority', { p_unit: unit.id, p_expected: unit.version, p_assignment: state === 'manual' ? assignment : null, p_state: state, p_note: note, p_evidence: evidence, p_accept_name: acceptName })
}
