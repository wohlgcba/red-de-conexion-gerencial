// Explicit, limited refresh. No Excel downloads or local roster files.
// Supply DOTACION_ADMIN_USER_ID for an enabled administrator; secrets stay in env.
import { loadEnvFile } from 'node:process'
import { readDirectory } from '../server/dotacion/supabase.ts'
import { readSourceSnapshot } from '../server/dotacion/source.ts'
import { readSavedSource, saveSource } from '../server/dotacion/snapshot.ts'
import { identity, paginate, reconcile } from '../server/dotacion/model.ts'

for (const file of ['.env.local', '.env.dotacion.local']) {
  try { loadEnvFile(file) } catch (error) { if (error.code !== 'ENOENT') throw error }
}
try {
  const admin = process.env.DOTACION_ADMIN_USER_ID
  if (!admin || !/^[a-f0-9-]{36}$/i.test(admin)) throw new Error('administrator_required')
  const startedAt = new Date().toISOString()
  const directory = await readDirectory(admin, process.env)
  const keys = directory.flatMap(person => identity(person.identifier) ? [identity(person.identifier)] : [])
  const source = await readSourceSnapshot(keys, process.env)
  await saveSource(admin, source, keys, startedAt, process.env)
  const saved = await readSavedSource(keys, process.env, admin)
  const rows = reconcile(directory, saved.rows, process.env.DOTACION_ROW_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, saved.coverage)
  const result = paginate(rows, { query: '', status: '', membership: '', ministry: '', exceptionsOnly: false, page: 1, pageSize: 25 }, new Date().toISOString(), saved.warnings)
  console.log(JSON.stringify({ refreshed: true, storedPeople: new Set(saved.rows.map(row => row.identifier)).size, storedAssignments: saved.rows.length, counts: result.counts, syncedAt: saved.syncedAt, directoryProfilesModified: 0 }))
} catch (error) {
  console.log(JSON.stringify({ refreshed: false, code: error.code || 'refresh_failed', message: error.code ? error.message : 'Verificá la configuración privada y el administrador habilitado. No se muestran datos personales ni errores SQL.', verifySnapshotDate: true, directoryProfilesModified: 0 }))
  process.exitCode = 1
}
