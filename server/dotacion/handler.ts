import type { IncomingMessage, ServerResponse } from 'node:http'
import { DotacionError } from './errors.ts'
import { candidateId, identity, paginate, reconcile } from './model.ts'
import { readSourceSnapshot } from './source.ts'
import { readSavedSource, savedCandidateContacts, saveSource } from './snapshot.ts'
import type { SourceRow } from './model.ts'
import { assertAdmin, readDirectory } from './supabase.ts'
import type { DotacionFilters } from '../../src/types/dotacion.ts'

export function parseFilters(body: unknown): DotacionFilters {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new DotacionError(400, 'filters', 'Los filtros no son válidos.')
  const input = body as Record<string, unknown>
  const string = (name: string, max: number) => {
    const value = input[name] ?? ''
    if (typeof value !== 'string' || value.length > max) throw new DotacionError(400, 'filters', 'Los filtros no son válidos.')
    return value.trim()
  }
  const status = string('status', 30), membership = string('membership', 20)
  if (!['', 'unchanged', 'changed', 'other_role', 'missing', 'pending', 'candidate'].includes(status) || !['', 'directory', 'candidate'].includes(membership)) throw new DotacionError(400, 'filters', 'Los filtros no son válidos.')
  const page = input.page ?? 1, pageSize = input.pageSize ?? 25
  if (!Number.isInteger(page) || Number(page) < 1 || Number(page) > 10000 || ![10, 25, 50].includes(Number(pageSize))) throw new DotacionError(400, 'filters', 'La paginación no es válida.')
  if (input.exceptionsOnly != null && typeof input.exceptionsOnly !== 'boolean') throw new DotacionError(400, 'filters', 'Los filtros no son válidos.')
  return { query: string('query', 150), ministry: string('ministry', 250), status, membership: membership as DotacionFilters['membership'], page: Number(page), pageSize: Number(pageSize), exceptionsOnly: input.exceptionsOnly === true }
}
async function requestBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined) {
    if (Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) > 4096) throw new DotacionError(413, 'body', 'La solicitud es demasiado grande.')
    try { return typeof req.body === 'string' ? JSON.parse(req.body) : req.body } catch { throw new DotacionError(400, 'body', 'La solicitud no es válida.') }
  }
  let body = ''
  for await (const chunk of req) {
    body += String(chunk)
    if (Buffer.byteLength(body) > 4096) throw new DotacionError(413, 'body', 'La solicitud es demasiado grande.')
  }
  try { return JSON.parse(body || '{}') } catch { throw new DotacionError(400, 'body', 'La solicitud no es válida.') }
}
type SourceResult = { rows: SourceRow[]; warnings: string[]; coverage?: string[]; syncedAt?: string }
export const dependencies = { assertAdmin, readDirectory, readSource: readSavedSource as (keys: string[], env: NodeJS.ProcessEnv, adminId: string) => Promise<SourceResult>, readCandidateContacts: savedCandidateContacts,
  refresh: async (keys: string[], env: NodeJS.ProcessEnv, adminId: string) => {
    const startedAt = new Date().toISOString()
    const source = await readSourceSnapshot(keys, env)
    await saveSource(adminId, source, keys, startedAt, env)
    return readSavedSource(keys, env, adminId)
  } }
type Dependencies = Omit<typeof dependencies, 'refresh'> & { refresh?: typeof dependencies.refresh }
export function createDotacionHandler(deps: Dependencies = dependencies, env = process.env) {
  return async (req: IncomingMessage & { body?: unknown }, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0')
    res.setHeader('Vary', 'Authorization')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    try {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new DotacionError(405, 'method', 'Método no permitido.') }
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new DotacionError(403, 'origin', 'Origen no permitido.')
      const token = req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1]
      if (!token || token.length > 8192) throw new DotacionError(401, 'session', 'Ingresá con una cuenta administradora para consultar Dotación.')
      const adminId = await deps.assertAdmin(token, env)
      const body = await requestBody(req)
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new DotacionError(400, 'body', 'La solicitud no es válida.')
      const input = body as Record<string, unknown>
      const contactsRequested = input.action === 'contacts'
      const refreshRequested = input.action === 'refresh'
      if (input.action !== undefined && !contactsRequested && !refreshRequested) throw new DotacionError(400, 'action', 'La acción no es válida.')
      if (contactsRequested && (typeof input.candidateId !== 'string' || !/^candidate-[a-f0-9]{32}$/.test(input.candidateId))) throw new DotacionError(400, 'candidate', 'El candidato no es válido.')
      const filters = contactsRequested ? null : parseFilters(body)
      const directory = await deps.readDirectory(adminId, env)
      const keys = directory.flatMap(person => identity(person.identifier) ? [identity(person.identifier)!] : [])
      if (refreshRequested && !deps.refresh) throw new DotacionError(503, 'refresh_unavailable', 'La actualización no está disponible.')
      const source = await (refreshRequested ? deps.refresh! : deps.readSource)(keys, env, adminId)
      const secret = env.DOTACION_ROW_KEY || env.SUPABASE_SERVICE_ROLE_KEY
      if (!secret) throw new DotacionError(503, 'configuration', 'Falta configurar la identificación privada de candidatos.')
      const rows = reconcile(directory, source.rows, secret, source.coverage)
      if (contactsRequested) {
        const candidate = rows.find(row => row.id === input.candidateId && row.status === 'candidate' && !row.personId)
        const key = candidate && source.rows.map(row => identity(row.identifier)).find(key => key && candidateId(key, secret) === candidate.id)
        if (!candidate || !key) throw new DotacionError(404, 'candidate_unavailable', 'El candidato ya no está disponible para incorporación. Actualizá el cruce.')
        const contacts = await deps.readCandidateContacts(key, env, adminId)
        res.statusCode = 200; res.end(JSON.stringify({ candidateId: candidate.id, contacts, consultedAt: source.syncedAt || new Date().toISOString() })); return
      }
      const result = paginate(rows, filters!, new Date().toISOString(), source.warnings)
      if (source.syncedAt) { result.source = 'Padrón gerencial guardado en Supabase'; result.sourceUpdatedAt = source.syncedAt }
      res.statusCode = 200; res.end(JSON.stringify(result))
    } catch (cause) {
      const error = cause instanceof DotacionError ? cause : new DotacionError(500, 'internal', 'No pudimos completar el cruce online. No se modificó ningún registro.')
      res.statusCode = error.status; res.end(JSON.stringify({ code: error.code, message: error.message }))
    }
  }
}
