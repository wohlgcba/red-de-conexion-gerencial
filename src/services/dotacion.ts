import { requireSupabase } from '../lib/supabase'
import type { DotacionComparisonPage, DotacionFilters } from '../types/dotacion'

export async function getDotacionComparison(filters: DotacionFilters, signal?: AbortSignal): Promise<DotacionComparisonPage> {
  const { data, error } = await requireSupabase().auth.getSession()
  if (error || !data.session) throw new Error('Ingresá con una cuenta administradora para consultar Dotación.')
  let response: Response
  try {
    response = await fetch('/api/admin-dotacion', { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(filters), cache: 'no-store', signal })
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new Error('No pudimos conectar con el servicio de cruce online. Reintentá en unos momentos.')
  }
  let result: DotacionComparisonPage & { message?: string }
  try { result = await response.json() } catch { throw new Error('El servicio de cruce online todavía no está disponible en este entorno.') }
  if (!response.ok) throw new Error(result.message || 'No pudimos consultar Dotación online.')
  return result
}
