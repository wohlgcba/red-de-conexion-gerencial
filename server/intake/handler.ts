import type { IncomingMessage, ServerResponse } from 'node:http'
import { DotacionError } from '../dotacion/errors.ts'
import { savedIntakeProfile as readIntakeProfile } from '../dotacion/snapshot.ts'
import { identity } from '../dotacion/model.ts'

export async function verifyApplicant(token: string, email: string, env: NodeJS.ProcessEnv) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new DotacionError(503, 'configuration', 'La consulta de ingreso no está configurada.')
  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new DotacionError(401, 'session', 'Verificá el correo elegido e iniciá sesión para continuar.')
  const user = await response.json() as { id?: string; email?: string; email_confirmed_at?: string }
  if (!user.id || !user.email_confirmed_at) throw new DotacionError(403, 'unverified', 'Primero verificá el correo que elegiste para solicitar ingreso.')
  if (user.email?.trim().toLowerCase() !== email) throw new DotacionError(403, 'email_mismatch', 'La sesión pertenece a otro correo. Ingresá con el correo que completaste en el formulario.')
  return user.id
}
export function createIntakeHandler(deps = { verifyApplicant, readIntakeProfile }, env = process.env) {
  return async (req: IncomingMessage & { body?: unknown }, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0')
    res.setHeader('Vary', 'Authorization')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new DotacionError(405, 'method', 'Método no permitido.') }
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new DotacionError(403, 'origin', 'Origen no permitido.')
      const token = req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1]
      if (!token || token.length > 8192) throw new DotacionError(401, 'session', 'Verificá tu correo e iniciá sesión para continuar.')
      let body = req.body
      if (body === undefined) {
        let text = ''
        for await (const chunk of req) { text += String(chunk); if (Buffer.byteLength(text) > 2048) throw new DotacionError(413, 'body', 'La solicitud es demasiado grande.') }
        body = text
      }
      if (typeof body === 'string') { if (Buffer.byteLength(body) > 2048) throw new DotacionError(413, 'body', 'La solicitud es demasiado grande.'); try { body = JSON.parse(body) } catch { throw new DotacionError(400, 'body', 'La solicitud no es válida.') } }
      if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > 2048) throw new DotacionError(400, 'body', 'La solicitud no es válida.')
      const input = body as Record<string, unknown>
      const key = identity(input.identifier)
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
      if (!key || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DotacionError(400, 'identity', 'Revisá el correo y el CUIT/CUIL ingresados.')
      const userId = await deps.verifyApplicant(token, email, env)
      const result = await deps.readIntakeProfile(key, email, env, userId)
      res.statusCode = 200; res.end(JSON.stringify(result))
    } catch (cause) {
      const error = cause instanceof DotacionError ? cause : new DotacionError(503, 'unavailable', 'No pudimos consultar Dotación. Podés completar tus datos manualmente y enviarlos a revisión.')
      res.statusCode = error.status; res.end(JSON.stringify({ code: error.code, message: error.message }))
    }
  }
}
