import type { MetricsGranularity, MetricsPeopleFilters, MetricsPerson, PositionLevel } from '../../types/metrics'

export const GRANULARITIES: { id: MetricsGranularity; label: string; range: string; phrase: string }[] = [
  { id: 'day', label: 'Día', range: 'Últimos 30 días', phrase: 'en los últimos 30 días' },
  { id: 'week', label: 'Semana', range: 'Últimas 26 semanas', phrase: 'en las últimas 26 semanas' },
  { id: 'month', label: 'Mes', range: 'Desde la primera inscripción', phrase: 'desde la primera inscripción' },
]

export const LEVELS: { id: PositionLevel; label: string; plural: string; color: string }[] = [
  { id: 'gerente', label: 'Gerente', plural: 'Gerentes', color: 'var(--metrics-gerente)' },
  { id: 'subgerente', label: 'Subgerente', plural: 'Subgerentes', color: 'var(--metrics-subgerente)' },
  { id: 'otro', label: 'Otro cargo', plural: 'Otros cargos', color: 'var(--metrics-otro)' },
]

export const ACCOUNT_LABELS: Record<MetricsPerson['account'], string> = { none: 'Sin cuenta', pending_password: 'Clave inicial pendiente', active: 'Cuenta activa' }

export const EMPTY_PEOPLE_FILTERS: MetricsPeopleFilters = { query: '', status: 'never', level: '', sort: 'name', page: 1, pageSize: 25 }

const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`)
const fmt = (iso: string, options: Intl.DateTimeFormatOptions) => day(iso).toLocaleDateString('es-AR', options).replace(/\./g, '')
const addDays = (iso: string, days: number) => { const value = day(iso); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10) }

export function axisLabel(starts: string, granularity: MetricsGranularity) {
  return granularity === 'month' ? fmt(starts, { month: 'short', year: '2-digit' }) : fmt(starts, { day: 'numeric', month: 'short' })
}

export function periodLabel(starts: string, granularity: MetricsGranularity, today: string) {
  const current = granularity === 'day' ? starts === today : granularity === 'week' ? addDays(starts, 7) > today : starts.slice(0, 7) === today.slice(0, 7)
  const label = granularity === 'day' ? fmt(starts, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : granularity === 'week' ? `Semana del ${fmt(starts, { day: 'numeric', month: 'short' })} al ${fmt(addDays(starts, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`
    : fmt(starts, { month: 'long', year: 'numeric' })
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}${current ? ' (en curso)' : ''}`
}

export const formatNumber = (value: number) => value.toLocaleString('es-AR')
export const percent = (part: number, total: number) => total ? `${Math.round(part / total * 100)}%` : '—'
export const formatDateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\./g, '') : '—'
export const formatShortDate = (iso: string | null) => iso ? fmt(iso, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// Semicolon and BOM: the format Excel in Spanish opens without asking.
export function peopleCsv(rows: MetricsPerson[]) {
  const cell = (value: string | number) => { const text = String(value).replace(/^([=+\-@])/, "'$1"); return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text }
  const header = ['Nombre', 'Correo', 'Cargo', 'Nivel', 'Organismo', 'Dirección General', 'Inscripción', 'Cuenta', 'Primer ingreso', 'Último ingreso', 'Días con actividad', 'Newsletters leídos', 'Búsquedas y perfiles abiertos']
  const lines = rows.map(row => [row.name, row.email, row.role, LEVELS.find(level => level.id === row.level)?.label ?? '', row.ministry, row.directorate, row.joinedOn,
    ACCOUNT_LABELS[row.account], formatDateTime(row.firstActivityAt), formatDateTime(row.lastActivityAt), row.activeDays, row.newslettersRead, row.directoryUses])
  return `﻿${[header, ...lines].map(line => line.map(cell).join(';')).join('\r\n')}`
}
