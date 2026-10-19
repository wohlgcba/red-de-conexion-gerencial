import { requireSupabase, SCHEMA } from '../lib/supabase'
import type { AdminAction, AdminAudit, AdminDetail, AdminFilters, AdminMembersData, AdminPageData, AdminTray, RelatedIdentity } from '../types/administration'

export class AdministrationUnavailable extends Error {}
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await requireSupabase().schema(SCHEMA).rpc(name, args)
  if (error) {
    if (/JWT issued at future/i.test(error.message)) throw new Error('JWT issued at future')
    if (['PGRST202', '42883'].includes(error.code)) throw new AdministrationUnavailable('La Administración del Directorio requiere activar la migración local de Supabase. No se realizaron cambios remotos.')
    if (error.code === '40001') throw new Error('Otro administrador modificó este registro. Actualizá la revisión antes de decidir.')
    if (error.code === '42501') throw new Error('Tu cuenta no tiene permisos para realizar esta operación.')
    if (['22023', '23505', '23503', 'P0001'].includes(error.code)) throw new Error(error.message.replace(/[0-9]{11}/g, '[identificador protegido]'))
    throw new Error('No pudimos completar la operación. Reintentá en unos momentos.')
  }
  return data as T
}
// Lists exclude full technical identifiers. Only the admin-only detail RPC returns them.
export const listAdminRequests = (tray: AdminTray, filters: AdminFilters) => rpc<AdminPageData>('admin_list_requests', { p_tray: tray, p_filters: filters })
export const getAdminRequest = (id: string) => rpc<AdminDetail>('admin_request_detail', { p_id: id })
export const decideAdminRequest = (id: string, version: number, action: AdminAction, note: string, reason: string) => rpc<void>('admin_decide_request', { p_id: id, p_version: version, p_action: action, p_note: note, p_reason: reason })
export const listAdminMembers = (filters: AdminFilters) => rpc<AdminMembersData>('admin_list_members', { p_filters: filters })
export const getAdminMemberIdentity = (id: string) => rpc<{ identifier: string | null; related: RelatedIdentity[] }>('admin_member_identity', { p_id: id })
export const getAdminMemberHistory = (id: string) => rpc<AdminAudit[]>('admin_member_history', { p_id: id })
export const actOnAdminMember = (id: string, version: number, action: 'activate' | 'deactivate' | 'delete' | 'quality_review', note: string) => rpc<void>('admin_manage_member', { p_id: id, p_version: version, p_action: action, p_note: note })
export async function getMyDirectoryGate(): Promise<string | null> {
  try { return await rpc<string | null>('get_my_directory_gate') } catch (error) { if (error instanceof AdministrationUnavailable) return null; throw error }
}
