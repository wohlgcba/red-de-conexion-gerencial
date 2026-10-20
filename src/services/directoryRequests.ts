import { requireSupabase, SCHEMA } from '../lib/supabase'
import type { ChangeField, RequestStatus } from '../types/administration'
import type { IntakeLookup } from '../types/accessIntake'

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
export const submitAccessRequest = (input: { given: string; family: string; role: string; ministry: string; identifier: string; reason: string; secretariat?: string; directorate?: string }) => directoryRequestRpc<string>('submit_access_request_details', Object.fromEntries(Object.entries(input).map(([key, value]) => [`p_${key}`, value.trim()])))
export async function lookupIntake(email: string, identifier: string, signal?: AbortSignal): Promise<IntakeLookup> {
  const { data } = await requireSupabase().auth.getSession()
  if (!data.session) throw new Error('Verificá el correo elegido e iniciá sesión para continuar.')
  const response = await fetch('/api/access-intake', { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, identifier }), cache: 'no-store', signal })
  const result = await response.json().catch(() => ({ message: 'La consulta de Dotación todavía no está disponible en este entorno. Podés completar tus datos manualmente.' }))
  if (!response.ok || !Array.isArray(result.profiles)) throw new Error(result.message || 'No pudimos consultar Dotación. Completá tus datos manualmente.')
  return result
}
