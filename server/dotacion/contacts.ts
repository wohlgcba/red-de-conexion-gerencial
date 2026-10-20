import type { CandidateContact } from '../../src/types/dotacion.ts'

// Deliberate allowlist: never serialize arbitrary Dotación columns.
export const CONTACT_FIELDS = [
  { name: 'MAIL_LABORAL', label: 'Correo laboral', kind: 'email' },
  { name: 'MAIL_MIA', label: 'Correo registrado en MIA', kind: 'email' },
  { name: 'MAIL_PERSONAL', label: 'Correo personal', kind: 'email' },
  { name: 'TELEFONO_LABORAL', label: 'Teléfono laboral', kind: 'phone' },
  { name: 'TEL_LABORAL', label: 'Teléfono laboral', kind: 'phone' },
  { name: 'TELEFONO', label: 'Teléfono registrado', kind: 'phone' },
  { name: 'CELULAR', label: 'Celular registrado', kind: 'phone' },
] as const

export function sanitizeContacts(rows: Record<string, unknown>[], fields: typeof CONTACT_FIELDS[number][]): CandidateContact[] {
  const result: CandidateContact[] = []
  const seen = new Set<string>()
  for (const field of fields) for (const row of rows) {
    const raw = String(row[field.name] ?? '').trim()
    if (!raw || raw.length > 2000) continue
    const values = field.kind === 'email' ? raw.split(/[;,\s]+/) : raw.split(/[;\n]+/)
    for (const entry of values) {
      const value = entry.trim()
      if (field.kind === 'email' ? !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,63}$/i.test(value) || value.length > 254
        : !/^\+?[\d\s().-]{6,40}$/.test(value) || value.replace(/\D/g, '').length < 6 || /^(\d)\1+$/.test(value.replace(/\D/g, ''))) continue
      const normalized = field.kind === 'email' ? value.toLowerCase() : value.replace(/\D/g, '')
      const key = field.kind + ':' + normalized
      if (seen.has(key)) continue
      seen.add(key)
      result.push({ kind: field.kind, label: field.label, value: field.kind === 'email' ? normalized : value, sourceField: field.name })
    }
  }
  return result
}
