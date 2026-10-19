import mysql from 'mysql2/promise'
import type { RowDataPacket, Connection } from 'mysql2/promise'
import { DotacionError } from './errors.ts'
import { identity } from './model.ts'
import type { SourceRow } from './model.ts'
import { tlsOptions } from './tls.ts'

const REQUIRED = ['CUIL_SIN_GUIONES', 'AYN', 'MINISTERIO', 'LIT_PUESTO', 'DESC_REP']
const MAX_MANAGERS = 5000
const MAX_ASSIGNMENTS = 15000
const identifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new DotacionError(503, 'configuration', 'La configuración de Dotación no es válida.')
  return '`' + value + '`'
}
export function connectionOptions(env: NodeJS.ProcessEnv) {
  if (!env.DOTACION_DB_HOST || !env.DOTACION_DB_USER || !env.DOTACION_DB_PASSWORD || !env.DOTACION_DB_NAME) throw new DotacionError(503, 'configuration', 'Falta configurar la conexión privada a Dotación en el servidor.')
  const port = Number(env.DOTACION_DB_PORT || 3306)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new DotacionError(503, 'configuration', 'El puerto de Dotación no es válido.')
  return { host: env.DOTACION_DB_HOST, port, user: env.DOTACION_DB_USER, password: env.DOTACION_DB_PASSWORD, database: env.DOTACION_DB_NAME,
    connectTimeout: 10000, multipleStatements: false, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true,
    ssl: tlsOptions(env, env.DOTACION_DB_HOST, port) }
}

export async function readSource(keys: string[], env: NodeJS.ProcessEnv, connect: typeof mysql.createConnection = mysql.createConnection): Promise<{ rows: SourceRow[]; warnings: string[] }> {
  let connection: Connection | undefined
  try {
    const table = identifier(env.DOTACION_DB_TABLE || 'dotacion_gcba_prueba')
    const pendingConnection = connect(connectionOptions(env))
    // connectTimeout covers TCP; the outer timer also bounds TLS/authentication.
    let connectTimer: ReturnType<typeof setTimeout> | undefined
    try {
      connection = await Promise.race([pendingConnection, new Promise<never>((_, reject) => {
        connectTimer = setTimeout(() => {
          void pendingConnection.then(c => c.destroy(), () => {})
          reject(new DotacionError(503, 'source_unavailable', 'El servidor de Dotación no respondió dentro del tiempo previsto. Reintentá la consulta.'))
        }, 12000)
      })])
    } finally { clearTimeout(connectTimer) }
    await connection.query({ sql: "SHOW SESSION STATUS LIKE 'Ssl_cipher'", timeout: 10000 }).then(([result]) => {
      if (!(result as RowDataPacket[])[0]?.Value) throw new DotacionError(503, 'tls', 'Dotación requiere una conexión cifrada y verificada.')
    })
    const [metadata] = await connection.query<RowDataPacket[]>({ sql: `SHOW COLUMNS FROM ${table}`, timeout: 10000 })
    const columns = new Map(metadata.map(row => [String(row.Field).toUpperCase(), String(row.Field)]))
    if (REQUIRED.some(name => !columns.has(name))) throw new DotacionError(503, 'schema', 'La fuente de Dotación no contiene las columnas institucionales requeridas.')
    const [engine] = await connection.execute<RowDataPacket[]>({ sql: 'SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', timeout: 10000 }, [env.DOTACION_DB_NAME!, env.DOTACION_DB_TABLE || 'dotacion_gcba_prueba'])
    if (String(engine[0]?.engine).toUpperCase() !== 'INNODB') throw new DotacionError(503, 'source_engine', 'La fuente de Dotación no permite una lectura consistente durante las actualizaciones. Requiere revisión del servidor.')
    const col = (name: string) => identifier(columns.get(name)!)
    const projection = REQUIRED.map((name, index) => `${col(name)} AS ${identifier(['identifier', 'name', 'ministry', 'role', 'unit'][index])}`).join(', ')
      + (columns.has('PATH_NOMBRES') ? `, ${col('PATH_NOMBRES')} AS path` : ', NULL AS path')
    // Only required institutional fields. Never select personal contacts, dates or full roster.
    const rows: SourceRow[] = []
    const uniqueKeys = [...new Set(keys.map(identity).filter((key): key is string => !!key))]
    await connection.query({ sql: 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ', timeout: 10000 })
    await connection.query({ sql: 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY', timeout: 10000 })
    const [size] = await connection.query<RowDataPacket[]>({ sql: `SELECT COUNT(*) AS total FROM ${table}`, timeout: 10000 })
    if (!Number(size[0]?.total)) throw new DotacionError(503, 'source_updating', 'Dotación está vacía o en proceso de actualización. Reintentá al finalizar la carga; no se marcaron personas como ausentes.')
    for (let start = 0; start < uniqueKeys.length; start += 150) {
      const batch = uniqueKeys.slice(start, start + 150)
      const [found] = await connection.execute<RowDataPacket[]>({ sql: `SELECT DISTINCT ${projection} FROM ${table} WHERE ${col('CUIL_SIN_GUIONES')} IN (${batch.map(() => '?').join(',')}) LIMIT ${MAX_ASSIGNMENTS + 1}`, timeout: 10000 }, batch)
      rows.push(...found.map(toRow))
      if (rows.length > MAX_ASSIGNMENTS) throw new DotacionError(503, 'limit', 'La fuente contiene demasiadas asignaciones para una conciliación completa. Requiere revisar la consulta.')
    }
    // Anchored role: excludes assistants/advisors whose title merely mentions a manager.
    const [managers] = await connection.query<RowDataPacket[]>({ sql: `SELECT DISTINCT ${projection} FROM ${table} WHERE UPPER(TRIM(${col('LIT_PUESTO')})) REGEXP '^(SUB)?GERENT[EA]([[:space:]]|$)' LIMIT ${MAX_MANAGERS + 1}`, timeout: 10000 })
    if (managers.length > MAX_MANAGERS) throw new DotacionError(503, 'limit', 'La consulta de cargos gerenciales superó el límite previsto. No se muestran resultados parciales.')
    if (!managers.length) throw new DotacionError(503, 'source_updating', 'La fuente todavía no contiene cargos gerenciales identificables. Reintentá al finalizar su actualización; no se muestran ausencias basadas en una carga incompleta.')
    await connection.commit()
    const all = [...rows, ...managers.map(toRow)]
    const invalid = managers.filter(row => !identity(row.identifier)).length
    const warnings: string[] = []
    if (!columns.has('PATH_NOMBRES')) warnings.push('La fuente no ofrece PATH_NOMBRES. Se compara cargo, organismo y repartición; no se inventan niveles institucionales.')
    if (invalid) warnings.push(`${invalid} asignaciones gerenciales no tienen identificador válido; no se presentan como candidatos verificados.`)
    return { rows: all, warnings }
  } catch (error) {
    if (error instanceof DotacionError) throw error
    // Never forward database messages: they can contain SQL, identity keys or credentials.
    throw new DotacionError(503, 'source_unavailable', 'No pudimos consultar Dotación online. Ninguna persona fue marcada como ausente ni se modificaron perfiles. Verificá conectividad y permisos del servidor MySQL.')
  } finally { connection?.destroy() }
}
const toRow = (row: RowDataPacket): SourceRow => ({ identifier: String(row.identifier ?? ''), name: String(row.name ?? ''), role: String(row.role ?? ''), ministry: String(row.ministry ?? ''), unit: String(row.unit ?? ''), path: row.path == null ? null : String(row.path) })
