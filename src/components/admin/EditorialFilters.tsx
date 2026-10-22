import { useCallback, useEffect, useState } from 'react'
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { Button, FilterSelect } from '../common/UI'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import type { EditorialFilters as Filters, EditorialPage, EditorialTray } from '../../types/editorial'
import { EDITORIAL_TRAYS } from './editorialModel'
import { NEWSLETTER_STATUS_LABELS } from '../../utils/newsletterStatus'

export function EditorialFilters({ value, tray, data, onChange, onTrayChange, onClear }: {
  value: Filters; tray: EditorialTray; data: EditorialPage | null
  onChange: (field: keyof Filters, value: string) => void
  onTrayChange: (tray: EditorialTray) => void; onClear: () => void
}) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:650px)').matches)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useEffect(() => {
    const media = window.matchMedia('(max-width:650px)')
    const listener = () => { setMobile(media.matches); setOpen(false) }
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])
  const select = (field: 'topic' | 'ministry' | 'author' | 'status' | 'sort', label: string, values: { id: string; name: string }[], empty?: string) => <label className="administration-filter" key={field}>{label}<FilterSelect aria-label={label} value={value[field]} onChange={event => onChange(field, event.target.value)}>{empty && <option value="">{empty}</option>}{values.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</FilterSelect></label>
  const options = (values: string[]) => values.filter(Boolean).sort((a, b) => a.localeCompare(b, 'es')).map(name => ({ id: name, name }))
  const fields = <>
    <label className="administration-filter">Estado<FilterSelect aria-label="Estado" value={tray} onChange={event => onTrayChange(event.target.value as EditorialTray)}>{EDITORIAL_TRAYS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</FilterSelect></label>
    {select('topic', 'Temática', options(data?.topics ?? []), 'Todas')}
    {select('ministry', 'Organismo', options(data?.ministries ?? []), 'Todos')}
    <details className="administration-more-filters" open={mobile || undefined}><summary>Más filtros</summary><div>
      {select('author', 'Autor', data?.authors ?? [], 'Todos')}
      {tray === 'all' && select('status', 'Estado editorial', Object.entries(NEWSLETTER_STATUS_LABELS).map(([id, name]) => ({ id, name })), 'Todos los estados')}
    </div></details>
    {select('sort', 'Ordenar por', [{ id: 'newest', name: 'Más recientes' }, { id: 'oldest', name: 'Más antiguas' }, { id: 'title', name: 'Título A–Z' }])}
    <Button onClick={onClear} aria-label="Limpiar filtros editoriales"><RotateCcw size={15} /> Limpiar filtros</Button>
  </>
  return <div className="administration-filters">
    <label className="search-input administration-search"><Search size={19} aria-hidden="true" /><input aria-label="Buscar newsletters en Administración" value={value.query} maxLength={150} onChange={event => onChange('query', event.target.value)} placeholder="Buscar por título, autor, organismo o contenido…" autoComplete="off" /></label>
    {mobile ? <Button aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><SlidersHorizontal size={16} /> Filtros</Button> : fields}
    {mobile && open && <DirectoryDialog title="Filtros de Newsletters" className="administration-filter-dialog" onClose={close} footer={<Button variant="primary" onClick={close}>Ver resultados</Button>}><div className="administration-filters">{fields}</div></DirectoryDialog>}
  </div>
}
