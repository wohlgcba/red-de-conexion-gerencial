import { requireSupabase, SCHEMA } from '../lib/supabase'
import type { OrganizationDataset, OrganizationResponsibility, OrganizationUnit } from '../types/organization'

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respuesta institucional inválida.')
  return value as Record<string, unknown>
}
const text = (value: unknown) => { if (typeof value !== 'string' || !value.trim()) throw new Error('Falta información de una unidad.'); return value }
const nullableText = (value: unknown) => value == null ? null : text(value)

// Explicit DTO projection: personal identifiers and contact fields never enter
// the chart model. The authenticated RPC returns only these safe fields.
export function parseOrganizationResponse(value: unknown): OrganizationDataset {
  const data = asRecord(value)
  if (!Array.isArray(data.units) || !Array.isArray(data.responsibilities)) throw new Error('Respuesta institucional incompleta.')
  const units: OrganizationUnit[] = data.units.map(value => {
    const item = asRecord(value)
    return { id: text(item.id), parentId: nullableText(item.parentId), name: text(item.name), type: text(item.type), code: nullableText(item.code), directorateId: nullableText(item.directorateId), responsibilityPending: item.responsibilityPending === true }
  })
  const responsibilities: OrganizationResponsibility[] = data.responsibilities.map(value => {
    const item = asRecord(value)
    if (!['member', 'non_member', 'pending'].includes(String(item.membership))) throw new Error('Estado de conciliación inválido.')
    const membership = item.membership as OrganizationResponsibility['membership']
    const personId = membership === 'member' ? nullableText(item.personId) : null
    if (membership === 'member' && !personId) throw new Error('Vinculación de perfil incompleta.')
    return { id: text(item.id), unitId: text(item.unitId), responsibleId: text(item.responsibleId), name: text(item.name), role: text(item.role), membership, personId }
  })
  return { source: 'supabase', units, responsibilities }
}

export async function getOrganizationDataset(): Promise<OrganizationDataset> {
  const source = import.meta.env.VITE_ORGANIZATION_SOURCE ?? 'supabase'
  if (source === 'local' || source === 'mock') {
    const { default: url } = await import('../mocks/organizationStructure.json?url')
    const response = await fetch(url)
    if (!response.ok) throw new Error('No pudimos cargar la estructura local del Organigrama.')
    const data = parseOrganizationResponse({ ...asRecord(await response.json()), responsibilities: [] })
    if (source === 'local') return { ...data, source: 'local' }
    const { getMockOrganization } = await import('../mocks/organization')
    return getMockOrganization(data.units)
  }
  if (source !== 'supabase') throw new Error('La fuente del Organigrama no está configurada correctamente.')
  const { data, error } = await requireSupabase().schema(SCHEMA).rpc('get_organization_chart')
  if (error) throw new Error('No pudimos cargar el Organigrama institucional. Reintentá en unos momentos.')
  return parseOrganizationResponse(data)
}
