import { X509Certificate } from 'node:crypto'
import { DotacionError } from './errors.ts'

export function tlsOptions(env: NodeJS.ProcessEnv, host: string, port: number) {
  const ca = env.DOTACION_DB_CA?.replace(/\\n/g, '\n')
  const mode = env.DOTACION_DB_TLS_MODE || 'strict'
  const fail = () => { throw new DotacionError(503, 'tls_configuration', 'La configuración del certificado de Dotación requiere revisión. No se enviaron credenciales.') }
  if (!['strict', 'private-ca'].includes(mode)) return fail()
  if (mode === 'private-ca') {
    // The installation's auto-generated server certificate has no DNS SAN.
    // Trust only its explicitly configured CA, bound to this endpoint. Certificate
    // chain verification stays enabled; no plaintext or unverified-TLS mode exists.
    if (!ca || env.DOTACION_DB_CA_ENDPOINT?.toLowerCase() !== `${host}:${port}`.toLowerCase()) return fail()
    const pem = ca.trim()
    const certificates = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)
    if (certificates?.length !== 1 || certificates[0] !== pem) return fail()
    const expected = env.DOTACION_DB_CA_SHA256?.replace(/:/g, '').toUpperCase()
    if (!expected || !/^[A-F0-9]{64}$/.test(expected)) return fail()
    try {
      const certificate = new X509Certificate(pem)
      if (!certificate.ca || certificate.fingerprint256.replace(/:/g, '') !== expected) return fail()
    } catch { return fail() }
  }
  return { rejectUnauthorized: true, verifyIdentity: mode === 'strict', minVersion: 'TLSv1.2' as const, ...(ca ? { ca } : {}) }
}
