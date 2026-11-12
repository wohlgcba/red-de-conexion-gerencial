import { requireSupabase, SCHEMA } from '../lib/supabase'
import { AdministrationUnavailable } from './administration'
import type { ActivityKind, MetricsGranularity, MetricsOverview, MetricsPeopleFilters, MetricsPeoplePage } from '../types/metrics'

async function metricsRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().schema(SCHEMA).rpc(name, args)
  if (error) {
    if (['PGRST202', '42883', '42P01'].includes(error.code)) throw new AdministrationUnavailable('Falta activar la migración de métricas rcg_metrics.sql. Los datos existentes se conservan.')
    if (error.code === '42501') throw new Error('Tu cuenta no tiene permisos para consultar las métricas.')
    throw new Error(error.code === '22023' ? error.message : 'No pudimos cargar las métricas. Reintentá en unos momentos.')
  }
  return data as T
}

export const getMetricsOverview = (granularity: MetricsGranularity) => metricsRpc<MetricsOverview>('admin_metrics', { p_granularity: granularity })
export const getMetricsPeople = (filters: MetricsPeopleFilters, exportAll = false) => metricsRpc<MetricsPeoplePage>('admin_metrics_people', { p_filters: { ...filters, export: exportAll } })

// One call per tab, day and target is enough: the database aggregates per day.
const recorded = new Set<string>()
const pending = new Map<string, Promise<void>>()
export function recordActivity(userId: string, kind: ActivityKind, targetId?: string): Promise<void> {
  const key = `rcg:activity:${userId}:${new Date().toLocaleDateString('en-CA')}:${kind}:${targetId ?? ''}`
  const running = pending.get(key)
  if (running) return running
  if (recorded.has(key)) return Promise.resolve()
  try { if (window.sessionStorage.getItem(key)) return Promise.resolve() } catch { /* Memory cache remains available. */ }
  const request = Promise.resolve(requireSupabase().schema(SCHEMA).rpc('record_activity', { p_kind: kind, p_target: targetId ?? null }))
    .then(({ error }) => {
      if (error) return
      recorded.add(key)
      try { window.sessionStorage.setItem(key, '1') } catch { /* Memory cache remains available. */ }
    }).catch(() => undefined).finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}

// The database ignores the same term from the same person within ten minutes.
export function recordSearch(term: string, results: number) {
  if (term.trim().length < 2) return
  void requireSupabase().schema(SCHEMA).rpc('record_search', { p_term: term, p_results: results }).then(() => undefined, () => undefined)
}
