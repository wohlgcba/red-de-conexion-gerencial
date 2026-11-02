import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { BookOpenText, ChartColumn, Info, LogIn, PencilLine, RefreshCw, Table2, UserRoundX, UsersRound } from 'lucide-react'
import { Button, Surface } from '../common/UI'
import { AdminLoadState } from './AdminPrimitives'
import { useAdminQuery } from './useAdminQuery'
import { MetricsColumnChart } from './MetricsColumnChart'
import type { ChartSeries } from './MetricsColumnChart'
import { MetricsPeople } from './MetricsPeople'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import { getMetricsOverview, setMetricsUniverse } from '../../services/metrics'
import { axisLabel, EMPTY_PEOPLE_FILTERS, formatDateTime, formatNumber, formatShortDate, GRANULARITIES, LEVELS, percent, periodLabel } from './metricsModel'
import type { MetricsGranularity, MetricsOverview, MetricsPeopleFilters, MetricsUniverse } from '../../types/metrics'
import './metrics.css'

const ACTIVITY: ChartSeries[] = [
  { key: 'visitors', label: 'Ingresaron a la Red', color: 'var(--metrics-visit)' },
  { key: 'newsletterVisitors', label: 'Entraron a Newsletters', color: 'var(--metrics-newsletter)' },
]
const GROWTH: ChartSeries[] = LEVELS.map(level => ({ key: level.id, label: level.plural, color: level.color }))

function ChartCard({ title, description, table, children }: { title: string; description: ReactNode; table: ReactNode; children: ReactNode }) {
  const [asTable, setAsTable] = useState(false)
  return <Surface className="metrics-card">
    <div className="metrics-card-heading"><div><h2>{title}</h2><p>{description}</p></div>
      <Button onClick={() => setAsTable(value => !value)} aria-pressed={asTable}>{asTable ? <><ChartColumn size={15} /> Ver gráfico</> : <><Table2 size={15} /> Ver tabla</>}</Button></div>
    {asTable ? <div className="administration-table-scroll metrics-table-view">{table}</div> : children}
  </Surface>
}

function UniverseDialog({ universe, onClose, onSaved }: { universe: MetricsUniverse | null; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(String(universe?.total ?? ''))
  const [state, setState] = useState<{ busy: boolean; error: string }>({ busy: false, error: '' })
  const save = async () => {
    setState({ busy: true, error: '' })
    try { await setMetricsUniverse(Number(value)); onSaved(); onClose() } catch (cause) { setState({ busy: false, error: cause instanceof Error ? cause.message : 'No pudimos guardar el total.' }) }
  }
  return <DirectoryDialog title="Universo de cobertura" className="metrics-universe-dialog" onClose={onClose} busy={state.busy}
    footer={<><Button onClick={onClose} disabled={state.busy}>Cancelar</Button><Button variant="primary" onClick={() => void save()} disabled={state.busy || !/^\d+$/.test(value)}>Guardar</Button></>}>
    <p>Total de gerencias y subgerencias operativas del GCBA con el que se compara la cantidad de integrantes de la Red.</p>
    <label>Total de GOs y SGOs<input type="number" min={1} max={100000} inputMode="numeric" value={value} onChange={event => setValue(event.target.value)} /></label>
    {universe && <small>Fuente actual: {universe.source} · {formatShortDate(universe.updatedAt)}</small>}
    {state.error && <p role="alert" className="administration-warning">{state.error}</p>}
  </DirectoryDialog>
}

function Coverage({ members, universe, onEdit }: { members: number; universe: MetricsUniverse | null; onEdit: () => void }) {
  const share = universe?.total ? Math.min(1, members / universe.total) : 0
  return <div className="metrics-coverage">
    <div><strong>{universe ? percent(members, universe.total) : '—'}</strong><span>de cobertura: {formatNumber(members)} de {universe ? formatNumber(universe.total) : '—'} {universe?.label ?? 'GOs y SGOs'}</span></div>
    <div className="metrics-meter" role="meter" aria-valuemin={0} aria-valuemax={universe?.total ?? 0} aria-valuenow={members} aria-label="Cobertura de la Red"><span style={{ width: `${share * 100}%` }} /></div>
    <Button variant="ghost" onClick={onEdit} aria-label="Editar universo de cobertura"><PencilLine size={14} /> Editar</Button>
  </div>
}

function Charts({ data, onEditUniverse }: { data: MetricsOverview; onEditUniverse: () => void }) {
  const labels = data.growth.map(bucket => axisLabel(bucket.starts, data.granularity))
  const periods = data.growth.map(bucket => periodLabel(bucket.starts, data.granularity, data.today))
  const last = data.growth.at(-1)
  const total = last ? last.gerente + last.subgerente + last.otro : 0
  const joined = data.growth.reduce((sum, bucket) => sum + bucket.joined, 0)
  const left = data.growth.reduce((sum, bucket) => sum + bucket.left, 0)
  const growthExtra = (index: number) => {
    const bucket = data.growth[index]
    return [`Total: ${formatNumber(bucket.gerente + bucket.subgerente + bucket.otro)}`, `Altas en el período: ${formatNumber(bucket.joined)}`, ...(bucket.left ? [`Bajas: ${formatNumber(bucket.left)}`] : [])]
  }
  const activityExtra = (index: number) => {
    const bucket = data.activity[index]
    return [`Aperturas de newsletters: ${formatNumber(bucket.newsletterViews)}`]
  }
  const range = GRANULARITIES.find(item => item.id === data.granularity)?.phrase
  const sources = [data.historySince && data.historyUntil && `Red anterior: del ${formatShortDate(data.historySince)} al ${formatShortDate(data.historyUntil)}.`,
    data.trackingSince ? `Red actual: desde el ${formatShortDate(data.trackingSince)}.` : 'Red actual: desde la activación de esta sección.'].filter(Boolean).join(' ')
  return <>
    <ChartCard title="Evolución de integrantes" description={<>Integrantes al cierre de cada período según su cargo. {formatNumber(joined)} {joined === 1 ? 'alta' : 'altas'}{left ? ` y ${formatNumber(left)} ${left === 1 ? 'baja' : 'bajas'}` : ''} {range}.</>}
      table={<table className="administration-table"><thead><tr><th>Período</th>{GROWTH.map(item => <th key={item.key}>{item.label}</th>)}<th>Total</th><th>Altas</th><th>Bajas</th></tr></thead>
        <tbody>{data.growth.map((bucket, i) => <tr key={bucket.starts}><td>{periods[i]}</td><td className="metrics-number">{formatNumber(bucket.gerente)}</td><td className="metrics-number">{formatNumber(bucket.subgerente)}</td><td className="metrics-number">{formatNumber(bucket.otro)}</td><td className="metrics-number"><strong>{formatNumber(bucket.gerente + bucket.subgerente + bucket.otro)}</strong></td><td className="metrics-number">{formatNumber(bucket.joined)}</td><td className="metrics-number">{formatNumber(bucket.left)}</td></tr>)}</tbody></table>}>
      <MetricsColumnChart title="Evolución de integrantes por cargo" labels={labels} periods={periods} series={GROWTH} stacked
        values={data.growth.map(bucket => [bucket.gerente, bucket.subgerente, bucket.otro])} extra={growthExtra} endLabel={formatNumber(total)} />
      <Coverage members={data.summary.members} universe={data.universe} onEdit={onEditUniverse} />
    </ChartCard>
    <ChartCard title="Ingresos a la Red" description={<>Personas distintas que entraron a la Red y a Newsletters en cada período. {sources}</>}
      table={<table className="administration-table"><thead><tr><th>Período</th>{ACTIVITY.map(item => <th key={item.key}>{item.label}</th>)}<th>Aperturas de newsletters</th></tr></thead>
        <tbody>{data.activity.map((bucket, i) => <tr key={bucket.starts}><td>{periods[i]}</td><td className="metrics-number">{formatNumber(bucket.visitors)}</td><td className="metrics-number">{formatNumber(bucket.newsletterVisitors)}</td><td className="metrics-number">{formatNumber(bucket.newsletterViews)}</td></tr>)}</tbody></table>}>
      <MetricsColumnChart title="Ingresos a la Red" labels={labels} periods={periods} series={ACTIVITY}
        values={data.activity.map(bucket => [bucket.visitors, bucket.newsletterVisitors])} extra={activityExtra} />
    </ChartCard>
  </>
}

function NewsletterRanking({ data }: { data: MetricsOverview }) {
  const max = Math.max(1, ...data.newsletters.map(item => item.readers))
  const read = data.newsletters.filter(item => item.readers > 0).length
  return <Surface className="metrics-card">
    <div className="metrics-card-heading"><div><h2>Newsletters más leídos</h2><p>{formatNumber(data.summary.newsletterReaders)} {data.summary.newsletterReaders === 1 ? 'integrante abrió' : 'integrantes abrieron'} al menos un newsletter · {formatNumber(data.summary.newsletterViews)} aperturas en total · {formatNumber(read)} de {formatNumber(data.newsletters.length)} con lecturas.</p></div></div>
    {data.newsletters.length ? <ol className="metrics-ranking">{data.newsletters.map((item, index) => <li key={item.id}>
      <span className="metrics-rank">{index + 1}</span>
      <div className="metrics-ranking-title"><strong>{item.title}</strong><small>{item.topic}{item.publishedAt ? ` · publicado el ${formatShortDate(item.publishedAt)}` : ''}{item.status !== 'publicado' ? ' · ya no está publicado' : ''}</small></div>
      <div className="metrics-ranking-bar" aria-label={`${formatNumber(item.readers)} lectores`}><span style={{ width: `${item.readers / max * 100}%` }} /><b>{formatNumber(item.readers)} {item.readers === 1 ? 'lector' : 'lectores'}</b></div>
      <div className="metrics-ranking-meta"><span>{formatNumber(item.views)} {item.views === 1 ? 'apertura' : 'aperturas'}</span><span>{formatNumber(item.reactions)} {item.reactions === 1 ? 'reacción' : 'reacciones'}</span></div>
    </li>)}</ol> : <div className="administration-empty"><BookOpenText size={30} /><h3>Todavía no hay newsletters publicados.</h3></div>}
  </Surface>
}

export function MetricsPanel() {
  const [granularity, setGranularity] = useState<MetricsGranularity>('month')
  const [peopleFilters, setPeopleFilters] = useState<MetricsPeopleFilters>({ ...EMPTY_PEOPLE_FILTERS })
  const [editingUniverse, setEditingUniverse] = useState(false)
  const load = useCallback(() => getMetricsOverview(granularity), [granularity])
  const query = useAdminQuery(load)
  const summary = query.data?.summary
  const show = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  const showPeople = (status: MetricsPeopleFilters['status']) => { setPeopleFilters({ ...EMPTY_PEOPLE_FILTERS, status }); show('metrics-people') }
  const never = summary ? summary.members - summary.entered : undefined
  const kpis = [
    { id: 'members', label: 'Integrantes de la Red', value: summary?.members, note: summary && `${formatNumber(summary.gerentes)} gerentes · ${formatNumber(summary.subgerentes)} subgerentes`, icon: UsersRound, onClick: () => show('metrics-charts') },
    { id: 'entered', label: 'Ingresaron a la Red', value: summary?.entered, note: summary && `${percent(summary.entered, summary.members)} de los integrantes`, icon: LogIn, onClick: () => showPeople('entered') },
    { id: 'never', label: 'Nunca ingresaron', value: never, note: summary && never !== undefined && `${percent(never, summary.members)} · ver quiénes`, icon: UserRoundX, onClick: () => showPeople('never') },
    { id: 'newsletters', label: 'Entraron a Newsletters', value: summary?.newsletterVisitors, note: summary && `${formatNumber(summary.newsletterReaders)} leyeron al menos uno`, icon: BookOpenText, onClick: () => show('metrics-ranking') },
  ]
  return <div className="metrics-panel">
    <Surface className="administration-intro"><div><h1>Métricas</h1><p>Seguí cuántos integrantes tiene la Red, quiénes ingresan y qué newsletters se leen.</p></div><div className="administration-kpis">
      {kpis.map(item => <button key={item.id} type="button" onClick={item.onClick} aria-label={`${item.label}: ${item.value === undefined ? 'sin datos' : formatNumber(item.value)}`}><span><item.icon size={23} /></span><div>{item.label}<strong>{item.value === undefined ? '—' : formatNumber(item.value)}</strong>{item.note && <small>{item.note}</small>}</div></button>)}
    </div></Surface>
    <div className="metrics-toolbar" id="metrics-charts">
      <div className="metrics-segmented" role="radiogroup" aria-label="Agrupar por">{GRANULARITIES.map(item => <button key={item.id} type="button" role="radio" aria-checked={granularity === item.id} onClick={() => setGranularity(item.id)}>{item.label}</button>)}</div>
      <p role="status">{query.loading ? 'Actualizando…' : `${GRANULARITIES.find(item => item.id === granularity)?.range} · datos al ${query.data ? formatDateTime(query.data.generatedAt) : '—'}`}</p>
      <Button onClick={query.reload} disabled={query.loading} aria-label="Actualizar métricas"><RefreshCw size={15} /></Button>
    </div>
    {query.error || (!query.data && query.loading) ? <Surface className="metrics-card"><AdminLoadState loading={query.loading} error={query.error} retry={query.reload} loadingTitle="Calculando métricas…" errorTitle="No pudimos cargar las métricas" /></Surface>
      : query.data && <div className={`metrics-grid${query.loading ? ' is-loading' : ''}`}>
        <Charts data={query.data} onEditUniverse={() => setEditingUniverse(true)} />
      </div>}
    <MetricsPeople filters={peopleFilters} onChange={setPeopleFilters} />
    {query.data && <div id="metrics-ranking" className="metrics-ranking-section"><NewsletterRanking data={query.data} /></div>}
    <p className="administration-source-note"><Info size={17} /><span>Fecha de alta: la inscripción en el formulario de la Red o, para las incorporaciones posteriores, la aprobación administrativa. Las bajas incluyen las eliminaciones manuales de la Red anterior. Un ingreso se cuenta una vez por persona y por día. La historia de ingresos hasta octubre de 2026 proviene del registro de la Red anterior, vinculado por correo. Se excluyen las cuentas de prueba.</span></p>
    {editingUniverse && <UniverseDialog universe={query.data?.universe ?? null} onClose={() => setEditingUniverse(false)} onSaved={query.reload} />}
  </div>
}
