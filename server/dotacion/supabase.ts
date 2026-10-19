import { DotacionError } from './errors.ts'
import type { DirectoryEntry } from './model.ts'

function config(env: NodeJS.ProcessEnv) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new DotacionError(503, 'configuration', 'Falta configurar Supabase para la consulta administrativa del servidor.')
  return { url: url.replace(/\/$/, ''), key }
}
export async function assertAdmin(token: string, env: NodeJS.ProcessEnv): Promise<string> {
  const { url, key } = config(env)
  const headers = { apikey: key, Authorization: `Bearer ${token}` }
  let user: { id?: string }
  try {
    const response = await fetch(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new DotacionError(401, 'session', 'Tu sesión no es válida. Volvé a ingresar.')
    user = await response.json() as { id?: string }
    if (!user.id) throw new DotacionError(401, 'session', 'Tu sesión no es válida. Volvé a ingresar.')
    const access = await fetch(`${url}/rest/v1/rpc/is_admin`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Content-Profile': 'red_conexion_gerencial' }, body: '{}', signal: AbortSignal.timeout(8000) })
    if (!access.ok) throw new DotacionError(503, 'authorization_unavailable', 'No pudimos verificar los permisos administrativos. Reintentá.')
    if (await access.json() !== true) throw new DotacionError(403, 'forbidden', 'Solo los administradores habilitados pueden consultar este cruce.')
  } catch (error) {
    if (error instanceof DotacionError) throw error
    throw new DotacionError(503, 'authorization_unavailable', 'No pudimos verificar tu sesión. Reintentá en unos momentos.')
  }
  return user.id
}

export async function readDirectory(adminId: string, env: NodeJS.ProcessEnv): Promise<DirectoryEntry[]> {
  const { url } = config(env)
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new DotacionError(503, 'configuration', 'Falta configurar la credencial privada del servidor para conciliar el Directorio.')
  try {
    const response = await fetch(`${url}/rest/v1/rpc/server_directory_for_dotacion`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Profile': 'red_conexion_gerencial' }, body: JSON.stringify({ p_admin: adminId }), signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new DotacionError(503, 'directory_unavailable', 'La consulta privada del Directorio no está disponible. Verificá su activación y los permisos del servidor.')
    const result = await response.json()
    if (!Array.isArray(result) || result.length > 5000) throw new DotacionError(503, 'directory_unavailable', 'No se pudo obtener el Directorio completo para un cruce confiable.')
    return result as DirectoryEntry[]
  } catch (error) {
    if (error instanceof DotacionError) throw error
    throw new DotacionError(503, 'directory_unavailable', 'No pudimos consultar el Directorio para realizar el cruce.')
  }
}
