import { useCallback, useEffect, useState } from 'react'
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { Button, FilterSelect } from '../common/UI'
import type { AdminFilters as Filters, AdminTray } from '../../types/administration'
import { FIELD_LABELS, REASON_LABELS, STATUS_LABELS } from './adminModel'
import { DirectoryDialog } from '../directory/DirectoryDialog'

export function AdminFilters({ value, onChange, ministries, tray, members = false }: { value: Filters; onChange: (field: keyof Filters | 'clear', value?: string) => void; ministries: string[]; tray: AdminTray; members?: boolean }) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:650px)').matches)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useEffect(() => { const media = window.matchMedia('(max-width:650px)'); const listener = () => { setMobile(media.matches); setOpen(false) }; media.addEventListener('change', listener); return () => media.removeEventListener('change', listener) }, [])
  const select = (field: keyof Filters, label: string, options: Record<string, string>) => <label className="administration-filter" key={field}>{label}<FilterSelect aria-label={label} value={String(value[field])} onChange={event => onChange(field, event.target.value)}><option value="">Todos</option>{Object.entries(options).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</FilterSelect></label>
  const fields = <>
    {select('status', 'Estado', members ? { active: 'Activo', inactive: 'Inactivo' } : { open: 'En revisión (todos)', ...STATUS_LABELS })}
    {tray === 'all' && !members && select('kind', 'Tipo de solicitud', { access: 'Acceso', change: 'Cambio de datos' })}
    {tray === 'exceptions' && select('reason', 'Motivo de excepción', REASON_LABELS)}
    {tray === 'change' && !members && select('field', 'Dato a modificar', FIELD_LABELS)}
    {select('ministry', 'Organismo', Object.fromEntries(ministries.filter(Boolean).sort().map(item => [item, item])))}
    <details className="administration-more-filters" open={mobile || undefined}><summary>Más filtros</summary><div>
      {select('evidence', 'Coincidencia en Dotación', { found: 'Encontrada', missing: 'No encontrada', pending: 'Por verificar', ambiguous: 'Ambigua' })}
      {select('eligibility', 'Validación gerencial', { manager: 'Gerencial', other: 'No gerencial', unknown: 'Sin identificar' })}
      {select('duplicates', 'Duplicados', { yes: 'Con conflictos', no: 'Sin conflictos' })}
      {select('risk', 'Riesgo', { high: 'Alto', medium: 'Medio', low: 'Bajo' })}
      {!members && <>{['from', 'to'].map(field => <label className="administration-filter" key={field}>{field === 'from' ? 'Desde' : 'Hasta'}<input aria-label={field === 'from' ? 'Desde' : 'Hasta'} type="date" value={value[field as 'from' | 'to']} onChange={event => onChange(field as keyof Filters, event.target.value)} /></label>)}</>}
    </div></details>
    {select('sort', 'Ordenar por', { newest: 'Más recientes', oldest: 'Más antiguas', name: 'Nombre A–Z' })}
    <Button onClick={() => onChange('clear')}><RotateCcw size={15} /> Limpiar filtros</Button>
  </>
  return <div className="administration-filters">
    <label className="search-input administration-search"><Search size={19} aria-hidden="true" /><input aria-label="Buscar en Administración" value={value.query} maxLength={150} placeholder="Buscar por nombre, correo o identificador…" onChange={event => onChange('query', event.target.value)} autoComplete="off" /></label>
    {mobile ? <Button aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><SlidersHorizontal size={16} /> Filtros</Button> : fields}
    {mobile && open && <DirectoryDialog title="Filtros de Administración" className="administration-filter-dialog" onClose={close} footer={<Button variant="primary" onClick={close}>Ver resultados</Button>}><div className="administration-filters">{fields}</div></DirectoryDialog>}
  </div>
}
