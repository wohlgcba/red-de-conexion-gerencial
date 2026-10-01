import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { FilterSelect } from '../common/UI'
import type { DirectoryFilters as Filters } from './directoryModel'

export function DirectoryFilters({ filters, options, onChange, onClear, idPrefix = 'directory' }: {
  filters: Filters; options: { ministries: string[]; secretariats: string[]; directorates: string[] }
  onChange: (field: keyof Filters, value: string) => void; onClear: () => void; idPrefix?: string
}) {
  return <div className="directory-filter-content">
    <div className="directory-filter-heading"><h2><SlidersHorizontal size={18} /> Filtros</h2><button type="button" onClick={onClear}><RotateCcw size={13} /> Limpiar filtros</button></div>
    <div className="directory-filter-field"><label htmlFor={`${idPrefix}-ministry`}>Ministerio / Área rectora</label><FilterSelect id={`${idPrefix}-ministry`} value={filters.ministry} onChange={event => onChange('ministry', event.target.value)}><option value="">Todos los ministerios</option>{options.ministries.map(value => <option key={value}>{value}</option>)}</FilterSelect></div>
    <div className="directory-filter-field"><label htmlFor={`${idPrefix}-secretariat`}>Secretaría / Subsecretaría</label><FilterSelect id={`${idPrefix}-secretariat`} value={filters.secretariat} onChange={event => onChange('secretariat', event.target.value)}><option value="">Todas las secretarías</option>{options.secretariats.map(value => <option key={value}>{value}</option>)}</FilterSelect></div>
    <div className="directory-filter-field"><label htmlFor={`${idPrefix}-directorate`}>Dirección General</label><FilterSelect id={`${idPrefix}-directorate`} value={filters.directorate} onChange={event => onChange('directorate', event.target.value)}><option value="">Todas las direcciones</option>{options.directorates.map(value => <option key={value}>{value}</option>)}</FilterSelect></div>
    <div className="directory-filter-field"><label htmlFor={`${idPrefix}-state`}>Estado</label><FilterSelect id={`${idPrefix}-state`} value={filters.state} onChange={event => onChange('state', event.target.value)} aria-describedby={`${idPrefix}-state-help`}><option value="">Todos</option><option value="active">Activos</option></FilterSelect><small id={`${idPrefix}-state-help`}>El directorio muestra integrantes activos.</small></div>
  </div>
}
