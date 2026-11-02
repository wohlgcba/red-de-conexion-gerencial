import { useCallback, useState } from 'react'
import { Download, RefreshCw, UserRoundX } from 'lucide-react'
import { Button, FilterSelect, SearchInput, Surface } from '../common/UI'
import { AdminBadge, AdminLoadState, AdminPagination } from './AdminPrimitives'
import { useAdminQuery } from './useAdminQuery'
import { getMetricsPeople } from '../../services/metrics'
import { ACCOUNT_LABELS, EMPTY_PEOPLE_FILTERS, formatDateTime, formatNumber, formatShortDate, LEVELS, peopleCsv } from './metricsModel'
import type { MetricsPeopleFilters } from '../../types/metrics'

type Props = { filters: MetricsPeopleFilters; onChange: (filters: MetricsPeopleFilters) => void }

export function MetricsPeople({ filters, onChange }: Props) {
  const load = useCallback(() => getMetricsPeople(filters), [filters])
  const query = useAdminQuery(load)
  const [exporting, setExporting] = useState('')
  const change = <K extends keyof MetricsPeopleFilters>(field: K, value: MetricsPeopleFilters[K]) => onChange({ ...filters, [field]: value, page: field === 'page' ? Number(value) : 1 })
  const download = async () => {
    setExporting('Preparando archivo…')
    try {
      const page = await getMetricsPeople(filters, true)
      const url = URL.createObjectURL(new Blob([peopleCsv(page.rows)], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `red-ingresos-${filters.status || 'todos'}-${new Date().toLocaleDateString('en-CA')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setExporting('')
    } catch (cause) { setExporting(cause instanceof Error ? cause.message : 'No pudimos preparar el archivo.') }
  }
  const counts = query.data?.counts
  const tabs = [{ id: 'never', label: 'Nunca ingresaron', count: counts?.never }, { id: 'entered', label: 'Ingresaron', count: counts?.entered }, { id: '', label: 'Todos', count: counts?.all }] as const
  return <Surface className="metrics-card metrics-people">
    <section id="metrics-people" aria-labelledby="metrics-people-title">
      <div className="metrics-card-heading"><div><h2 id="metrics-people-title">Ingresos por integrante</h2><p>Quiénes entraron a la Red y quiénes todavía no. Las cuentas de prueba no se incluyen.</p></div>
        <Button onClick={() => void download()} disabled={Boolean(exporting) && exporting.endsWith('…')}><Download size={15} /> Descargar CSV</Button></div>
      <div className="metrics-segmented" role="tablist" aria-label="Estado de ingreso">{tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={filters.status === tab.id} onClick={() => change('status', tab.id)}>{tab.label}<span>{tab.count === undefined ? '—' : formatNumber(tab.count)}</span></button>)}</div>
      <div className="administration-filters metrics-people-filters">
        <div className="administration-search"><SearchInput value={filters.query} onChange={value => change('query', value)} placeholder="Buscar por nombre, correo, cargo u organismo" /></div>
        <label className="administration-filter">Cargo<FilterSelect value={filters.level} onChange={event => change('level', event.target.value as MetricsPeopleFilters['level'])}><option value="">Todos los cargos</option>{LEVELS.map(level => <option key={level.id} value={level.id}>{level.plural}</option>)}</FilterSelect></label>
        <label className="administration-filter">Orden<FilterSelect value={filters.sort} onChange={event => change('sort', event.target.value as MetricsPeopleFilters['sort'])}><option value="name">Apellido</option><option value="recent">Último ingreso</option><option value="active">Más días activos</option><option value="joined">Inscripción más reciente</option></FilterSelect></label>
        <Button onClick={() => onChange({ ...EMPTY_PEOPLE_FILTERS })}>Limpiar</Button>
      </div>
      <div className="administration-results-meta"><p role="status">{exporting || (query.loading ? 'Consultando…' : query.data ? `${formatNumber(query.data.total)} ${query.data.total === 1 ? 'integrante' : 'integrantes'}` : 'Consulta no disponible')}</p><Button onClick={query.reload} disabled={query.loading} aria-label="Actualizar integrantes"><RefreshCw size={15} /></Button></div>
      {query.loading || query.error ? <AdminLoadState loading={query.loading} error={query.error} retry={query.reload} loadingTitle="Cargando integrantes…" errorTitle="No pudimos cargar los integrantes" />
        : query.data?.rows.length ? <><div className="administration-table-scroll"><table className="administration-table metrics-people-table"><thead><tr><th>Integrante</th><th>Cargo</th><th>Organismo</th><th>Cuenta</th><th>Último ingreso</th><th>Días activos</th><th>Newsletters leídos</th></tr></thead>
          <tbody>{query.data.rows.map(row => <tr key={row.id}>
            <td><div className="administration-person"><span><strong>{row.name}</strong><small>{row.email}</small></span></div></td>
            <td>{row.role}<small>{LEVELS.find(level => level.id === row.level)?.label} · inscripción {formatShortDate(row.joinedOn)}</small></td>
            <td>{row.ministry}{row.directorate && <small>{row.directorate}</small>}</td>
            <td><AdminBadge tone={row.account === 'active' ? 'good' : row.account === 'pending_password' ? 'warning' : 'neutral'}>{ACCOUNT_LABELS[row.account]}</AdminBadge></td>
            <td className="administration-date">{row.lastActivityAt ? formatDateTime(row.lastActivityAt) : 'Nunca'}</td>
            <td className="metrics-number">{formatNumber(row.activeDays)}</td>
            <td className="metrics-number">{formatNumber(row.newslettersRead)}</td>
          </tr>)}</tbody></table></div>
          <AdminPagination page={filters.page} total={query.data.total} size={filters.pageSize} onPage={page => change('page', page)} onSize={size => onChange({ ...filters, pageSize: size, page: 1 })} /></>
        : <div className="administration-empty"><UserRoundX size={30} /><h3>No hay integrantes con estos filtros.</h3><Button onClick={() => onChange({ ...EMPTY_PEOPLE_FILTERS })}>Limpiar filtros</Button></div>}
    </section>
  </Surface>
}
