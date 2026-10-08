import { Building2, CheckCircle2, Landmark, Network, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { FilterDropdown } from '../common/FilterDropdown'
import type { DirectoryFilters as Filters } from './directoryModel'

export function DirectoryFilters({ filters, options, onChange, onClear, idPrefix = 'directory' }: {
  filters: Filters; options: { ministries: string[]; secretariats: string[]; directorates: string[] }
  onChange: (field: keyof Filters, value: string) => void; onClear: () => void; idPrefix?: string
}) {
  const fields = [
    { field: 'ministry' as const, label: 'Ministerio / Área rectora', placeholder: 'Todos los ministerios', search: 'Buscar ministerio o área...', values: options.ministries, icon: <Landmark size={17} /> },
    { field: 'secretariat' as const, label: 'Secretaría / Subsecretaría', placeholder: 'Todas las secretarías', search: 'Buscar secretaría...', values: options.secretariats, icon: <Network size={17} /> },
    { field: 'directorate' as const, label: 'Dirección General', placeholder: 'Todas las direcciones', search: 'Buscar dirección general...', values: options.directorates, icon: <Building2 size={17} /> },
  ]
  return <div className="directory-filter-content">
    <div className="directory-filter-heading"><h2><SlidersHorizontal size={18} /> Filtros</h2><button type="button" onClick={onClear}><RotateCcw size={13} /> Limpiar filtros</button></div>
    {fields.map(({ field, label, placeholder, search, values, icon }) => <div className="directory-filter-field" key={field}>
      <label id={`${idPrefix}-${field}-label`} htmlFor={`${idPrefix}-${field}`}>{label}</label>
      <FilterDropdown id={`${idPrefix}-${field}`} labelledBy={`${idPrefix}-${field}-label`} value={filters[field]}
        onChange={value => onChange(field, value)} icon={icon} searchPlaceholder={search}
        options={[{ value: '', label: placeholder }, ...values.map(value => ({ value, label: value }))]} />
    </div>)}
    <div className="directory-filter-field"><label id={`${idPrefix}-state-label`} htmlFor={`${idPrefix}-state`}>Estado</label>
      <FilterDropdown id={`${idPrefix}-state`} labelledBy={`${idPrefix}-state-label`} value={filters.state} onChange={value => onChange('state', value)}
        describedBy={`${idPrefix}-state-help`} icon={<CheckCircle2 size={17} />} options={[{ value: '', label: 'Todos' }, { value: 'active', label: 'Activos' }]} />
      <small id={`${idPrefix}-state-help`}>El directorio muestra integrantes activos.</small>
    </div>
  </div>
}
