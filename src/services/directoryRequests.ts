import { requireSupabase, SCHEMA } from '../lib/supabase'
import type { ChangeField, RequestStatus } from '../types/administration'

export type OwnRequest = { id: string; kind: 'access' | 'change'; status: RequestStatus; field: ChangeField | null; oldValue: string | null; newValue: string | null; reason: string; note: string; createdAt: string; version: number }
export async function directoryRequestRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await requireSupabase().schema(SCHEMA).rpc(name, args)
  if (error) {
    if (['42883', 'PGRST202'].includes(error.code)) throw new Error('Las solicitudes todavía no están habilitadas. Contactá a la administración.')
    if (error.code === '40001') throw new Error('La solicitud cambió. Actualizá antes de responder.')
    if (error.code === '42501') throw new Error('Verificá tu correo e iniciá sesión para continuar.')
    if (error.code === '22023') throw new Error(error.message.replace(/[0-9]{11}/g, '[identificador protegido]'))
    throw new Error('No pudimos completar la solicitud. Intentá nuevamente.')
  }
  return data as T
}
export const getMyDirectoryRequests = () => directoryRequestRpc<OwnRequest[]>('get_my_directory_requests')
export const submitProfileChange = (field: ChangeField, value: string, reason: string) => directoryRequestRpc<string>('submit_profile_change', { p_field: field, p_value: value, p_reason: reason })
export const replyToMyRequest = (id: string, version: number, message: string) => directoryRequestRpc<void>('reply_to_my_request', { p_id: id, p_version: version, p_message: message })
export const submitAccessRequest = (input: { given: string; family: string; role: string; ministry: string; identifier: string; reason: string }) => directoryRequestRpc<string>('submit_access_request', Object.fromEntries(Object.entries(input).map(([key, value]) => [`p_${key}`, value.trim()])))
